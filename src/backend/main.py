
import os, sqlite3, json, datetime, math
from flask import Flask, request, jsonify, g, send_from_directory

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "gloryflow.db"))
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
REQUIRED_DOCS = {"BL","Invoice","PackingList"}

# BIC-registered container owner codes (major shipping lines)
VALID_OWNER_CODES = {
    'MSC': 'MSC', 'MAE': 'Maersk', 'CMA': 'CMA CGM', 'CSC': 'COSCO', 'HAP': 'Hapag-Lloyd',
    'ONE': 'Ocean Network Express', 'EGL': 'Evergreen', 'YML': 'Yang Ming', 'PIL': 'PIL',
    'ZIM': 'ZIM', 'WAN': 'Wan Hai', 'HMM': 'HMM', 'MSK': 'Maersk', 'SEA': 'SeaLand',
    'NYK': 'NYK Line', 'MOL': 'MOL', 'KLI': 'K Line', 'APL': 'APL', 'OOC': 'OOCL',
    'ACL': 'ACL', 'HLC': 'Hapag-Lloyd', 'COS': 'COSCO', 'CHI': 'China Shipping',
    'TEX': 'Textainer', 'TRI': 'Triton', 'CAI': 'CAI', 'FSC': 'Florens', 'GEI': 'Seaco',
    'TGH': 'Touax', 'TEM': 'Textainer', 'SUD': 'Seacube', 'OOL': 'OOCL'
}

app = Flask(__name__, static_folder=None, static_url_path=None)

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        # Enforce foreign key constraints for this connection
        g.db.execute("PRAGMA foreign_keys = ON")
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def apply_schema(db):
    schema_path = os.path.abspath(os.path.join(os.path.dirname(__file__),"..","..","db","schema.sql"))
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = f.read()
    db.executescript(schema)
    db.commit()

def init_db():
    with app.app_context():
        db = get_db()
        apply_schema(db)

def iso6346_check_digit(owner, serial):
    letter_vals = {}
    val = 10
    for ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        letter_vals[ch] = val
        val += 1
        if val % 11 == 0:
            val += 1
    code = owner + "U" + serial
    weights = [2**i for i in range(len(code))]
    total = 0
    for i, ch in enumerate(code):
        v = letter_vals[ch] if ch.isalpha() else int(ch)
        total += v * weights[i]
    return (total % 11) % 10

def compute_demurrage_risk(db, shipment_row):
    """Compute demurrage risk metrics for one shipment row."""
    eta_raw = shipment_row["eta"]
    free_days = shipment_row["free_days"]
    if not eta_raw:
        return {"error": "missing eta"}
    eta = datetime.datetime.strptime(eta_raw, "%Y-%m-%d").date()
    today = datetime.date.today()
    days_left = (eta + datetime.timedelta(days=free_days) - today).days
    docs = db.execute("SELECT type FROM documents WHERE shipment_id=?", (shipment_row["id"],)).fetchall()
    have = {d["type"] for d in docs}
    completeness = len(REQUIRED_DOCS & have)/len(REQUIRED_DOCS)
    missing = sorted(list(REQUIRED_DOCS - have))
    raw = max(0.0, 1.0 - (days_left/10.0)) * (1.0 - completeness/2)
    score = max(0, min(100, int(raw*100)))
    msg = "OK"
    if days_left <= 3: msg = "Alerte J-3"
    if days_left <= 1: msg = "Alerte J-1"
    client_email = None
    if hasattr(shipment_row, "keys") and "client_email" in shipment_row.keys():
        client_email = shipment_row["client_email"]
    elif isinstance(shipment_row, dict):
        client_email = shipment_row.get("client_email")
    return {
        "shipment_id": shipment_row["id"],
        "reference": shipment_row["reference"],
        "score": score,
        "days_left": days_left,
        "docs_completeness": round(completeness,2),
        "message": msg,
        "missing_docs": missing,
        "client_email": client_email,
    }

# ---------- Static Frontend ----------
@app.route("/")
def index_page():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/static/<path:filename>")
def static_files(filename):
    # Serve CSS, JS files from frontend folder (they're not in a 'static' subfolder)
    print(f"Static file requested: {filename}")
    print(f"Looking in: {FRONTEND_DIR}")
    print(f"Full path: {os.path.join(FRONTEND_DIR, filename)}")
    print(f"File exists: {os.path.exists(os.path.join(FRONTEND_DIR, filename))}")
    return send_from_directory(FRONTEND_DIR, filename)

# ---------- API ----------
@app.route("/health")
def health():
    return {"status":"ok"}

@app.route("/shipments", methods=["GET", "POST"])
def shipments():
    db = get_db()
    if request.method == "POST":
        data = request.json
        cols = ("reference","direction","mode","client_id","shipping_line_id","incoterm","pol","pod","vessel","eta","free_days")
        values = []
        for c in cols:
            v = data.get(c)
            if c in ("client_id","shipping_line_id","free_days") and v not in (None, ""):
                try:
                    v = int(v)
                except ValueError:
                    pass
            values.append(v)
        db.execute(
            "INSERT INTO shipments(reference,direction,mode,client_id,shipping_line_id,incoterm,pol,pod,vessel,eta,free_days) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            values
        )
        db.commit()
        return {"message":"created"}, 201
    else:
        rows = db.execute("""
            SELECT s.*,
                   c.name AS client_name,
                   sl.name AS shipping_line_name,
                   (SELECT COUNT(*) FROM containers co WHERE co.shipment_id = s.id) AS container_count
            FROM shipments s
            LEFT JOIN clients c ON s.client_id = c.id
            LEFT JOIN shipping_lines sl ON s.shipping_line_id = sl.id
            ORDER BY s.id DESC
        """).fetchall()
        return jsonify([dict(r) for r in rows])

@app.route("/clients", methods=["GET", "POST"])
def clients():
    db = get_db()
    if request.method == "POST":
        data = request.json
        db.execute(
            "INSERT INTO clients(name,email,phone) VALUES (?,?,?)",
            (data.get("name"), data.get("email"), data.get("phone")),
        )
        db.commit()
        return {"message": "created"}, 201
    else:
        rows = db.execute("SELECT * FROM clients ORDER BY name ASC").fetchall()
        return jsonify([dict(r) for r in rows])

@app.route("/clients/<int:cid>", methods=["PATCH", "DELETE"])
def client_detail(cid):
    db = get_db()
    if request.method == "PATCH":
        data = request.json
        if not data:
            return {"message": "nothing to update"}
        keys = ", ".join([f"{k}=?" for k in data.keys()])
        vals = list(data.values()) + [cid]
        db.execute(f"UPDATE clients SET {keys} WHERE id=?", vals)
        db.commit()
        return {"message": "updated"}
    else:
        db.execute("DELETE FROM clients WHERE id=?", (cid,))
        db.commit()
        return {"message": "deleted"}

@app.route("/shipping_lines", methods=["GET", "POST"])
def shipping_lines():
    db = get_db()
    if request.method == "POST":
        data = request.json
        db.execute(
            "INSERT INTO shipping_lines(name,email,phone) VALUES (?,?,?)",
            (data.get("name"), data.get("email"), data.get("phone")),
        )
        db.commit()
        return {"message": "created"}, 201
    else:
        rows = db.execute("SELECT * FROM shipping_lines ORDER BY name ASC").fetchall()
        return jsonify([dict(r) for r in rows])

@app.route("/shipping_lines/<int:sid>", methods=["PATCH", "DELETE"])
def shipping_line_detail(sid):
    db = get_db()
    if request.method == "PATCH":
        data = request.json
        if not data:
            return {"message": "nothing to update"}
        keys = ", ".join([f"{k}=?" for k in data.keys()])
        vals = list(data.values()) + [sid]
        db.execute(f"UPDATE shipping_lines SET {keys} WHERE id=?", vals)
        db.commit()
        return {"message": "updated"}
    else:
        db.execute("DELETE FROM shipping_lines WHERE id=?", (sid,))
        db.commit()
        return {"message": "deleted"}

@app.route("/shipments/<int:sid>", methods=["GET", "PATCH"])
def shipment_detail(sid):
    db = get_db()
    if request.method == "GET":
        r = db.execute("SELECT * FROM shipments WHERE id=?", (sid,)).fetchone()
        if not r: return {"error":"not found"}, 404
        return dict(r)
    else:
        data = request.json
        keys = ", ".join([f"{k}=?" for k in data.keys()])
        vals = list(data.values()) + [sid]
        db.execute(f"UPDATE shipments SET {keys} WHERE id=?", vals)
        db.commit()
        return {"message":"updated"}

@app.route("/shipments/<int:sid>", methods=["DELETE"])
def shipment_delete(sid):
    db = get_db()
    db.execute("DELETE FROM shipments WHERE id=?", (sid,))
    db.commit()
    return {"message":"deleted"}

@app.route("/containers", methods=["GET", "POST"])
def containers():
    db = get_db()
    if request.method == "POST":
        data = request.json
        code = data["code"].strip().upper()
        print("container code raw", repr(code))
        # Validate ISO 6346 format and BIC registration
        if len(code) != 11:
            return {"error":f"Format invalide: le code doit contenir 11 caractères (reçu {len(code)})"},400
        owner = code[:3]
        if owner not in VALID_OWNER_CODES:
            return {"error":f"Code propriétaire '{owner}' non reconnu. Utilisez un code enregistré BIC (ex: MSC, MAE, CMA, ONE, etc.)"},400
        if code[3] != "U":
            return {"error":"Format invalide: le 4ème caractère doit être 'U' (catégorie équipement)"},400
        serial = code[4:10]
        try:
            check = int(code[-1])
        except:
            return {"error":"Format invalide: le dernier caractère doit être un chiffre"},400
        expected_check = iso6346_check_digit(owner, serial)
        if expected_check != check:
            return {"error":f"Chiffre de contrôle invalide: attendu {expected_check}. Code valide: {owner}U{serial}{expected_check}"},400
        try:
            db.execute("INSERT INTO containers(shipment_id, code, size) VALUES (?,?,?)",
                       (data["shipment_id"], code, data.get("size","40HC")))
            db.commit()
        except sqlite3.IntegrityError as exc:
            return {"error": "Ce conteneur existe déjà."}, 400
        return {"message":"created"}, 201
    else:
        sid = request.args.get("shipment_id")
        if sid:
            rows = db.execute("SELECT * FROM containers WHERE shipment_id=? ORDER BY id DESC", (sid,)).fetchall()
        else:
            rows = db.execute("SELECT * FROM containers ORDER BY id DESC").fetchall()
        return jsonify([dict(r) for r in rows])

@app.route("/containers/<int:cid>", methods=["PATCH","DELETE"])
def container_detail(cid):
    db = get_db()
    if request.method == "PATCH":
        data = request.json
        if "code" in data:
            code = data["code"]
            if len(code) != 11 or code[3] != "U":
                return {"error":"Invalid code format"}, 400
            owner = code[:3]
            serial = code[4:10]
            try:
                check = int(code[-1])
            except:
                return {"error":"Invalid check digit"}, 400
            if iso6346_check_digit(owner, serial) != check:
                return {"error":"Invalid check digit"}, 400
        keys = ", ".join([f"{k}=?" for k in data.keys()])
        vals = list(data.values()) + [cid]
        db.execute(f"UPDATE containers SET {keys} WHERE id=?", vals)
        db.commit()
        return {"message":"updated"}
    else:
        db.execute("DELETE FROM containers WHERE id=?", (cid,))
        db.commit()
        return {"message":"deleted"}

@app.route("/documents", methods=["GET","POST"])
def documents():
    db = get_db()
    if request.method == "GET":
        sid = int(request.args.get("shipment_id"))
        rows = db.execute("SELECT id, shipment_id, type, filename, uploaded_at FROM documents WHERE shipment_id=?", (sid,)).fetchall()
        return jsonify([dict(r) for r in rows])
    else:
        data = request.json
        sid = data["shipment_id"]
        dtype = data["type"]
        db.execute("INSERT INTO documents(shipment_id, type, filename, extracted_json) VALUES (?,?,?,?)",
                   (sid, dtype, None, None))
        db.commit()
        return {"message":"created"}, 201

@app.route("/kpi/demurrage_risk")
def demurrage_risk():
    sid = int(request.args.get("shipment_id"))
    db = get_db()
    s = db.execute("""
        SELECT s.id, s.reference, s.eta, s.free_days, c.email AS client_email
        FROM shipments s
        LEFT JOIN clients c ON s.client_id = c.id
        WHERE s.id=?
    """, (sid,)).fetchone()
    if not s: return {"error":"not found"}, 404
    risk = compute_demurrage_risk(db, s)
    return risk

@app.route("/kpi/demurrage_risk_all")
def demurrage_risk_all():
    """Batch risk scores for n8n pulls. Optional filters: min_score, max_days_left."""
    db = get_db()
    min_score = int(request.args.get("min_score", 0))
    max_days_left = request.args.get("max_days_left")
    max_days_left = int(max_days_left) if max_days_left is not None else None
    rows = db.execute("""
        SELECT s.id, s.reference, s.eta, s.free_days, c.email AS client_email
        FROM shipments s
        LEFT JOIN clients c ON s.client_id = c.id
        ORDER BY s.id DESC
    """).fetchall()
    results = []
    for s in rows:
        risk = compute_demurrage_risk(db, s)
        if "error" in risk:  # skip invalid shipments
            continue
        if risk["score"] < min_score:
            continue
        if max_days_left is not None and risk["days_left"] > max_days_left:
            continue
        results.append(risk)
    return jsonify(results)

@app.route("/admin/seed", methods=["POST"])
def seed():
    db = get_db()
    # Ensure schema exists before seeding to avoid 'no such table' errors
    apply_schema(db)
    n = db.execute("SELECT COUNT(*) as c FROM shipments").fetchone()["c"]
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..",".."))
    def load_csv(path):
        import csv
        with open(path, newline='', encoding="utf-8") as f:
            return list(csv.DictReader(f))
    if n == 0:
        clients = load_csv(os.path.join(base, "data", "clients.csv"))
        for c in clients:
            db.execute("INSERT INTO clients(name, email, phone) VALUES (?,?,?)",
                       (c["name"], c.get("email"), c.get("phone")))
        shipping_lines = load_csv(os.path.join(base, "data", "shipping_lines.csv"))
        for sl in shipping_lines:
            db.execute("INSERT INTO shipping_lines(name, email, phone) VALUES (?,?,?)",
                       (sl["name"], sl.get("email"), sl.get("phone")))
        shipments = load_csv(os.path.join(base, "data", "shipments.csv"))
        for s in shipments:
            cols = ("reference","direction","mode","client_id","shipping_line_id","incoterm","pol","pod","vessel","eta","free_days")
            vals = [s[c] for c in cols]
            vals[3] = int(vals[3]) if vals[3] else None
            vals[4] = int(vals[4]) if vals[4] else None
            vals[10] = int(vals[10]) if s["free_days"] else 5
            db.execute("INSERT INTO shipments(reference,direction,mode,client_id,shipping_line_id,incoterm,pol,pod,vessel,eta,free_days) VALUES (?,?,?,?,?,?,?,?,?,?,?)", vals)
        containers = load_csv(os.path.join(base, "data", "containers.csv"))
        ref_to_id = {r["reference"]: r["id"] for r in db.execute("SELECT id, reference FROM shipments").fetchall()}
        for c in containers:
            sid = ref_to_id.get(c["shipment_reference"])
            if sid:
                db.execute("INSERT INTO containers(shipment_id, code, size, status) VALUES (?,?,?,?)",
                           (sid, c["code"], c["size"], c["status"]))
        db.commit()
        return {"message":"seeded"}
    else:
        return {"message":"already seeded", "shipments": n}

if __name__ == "__main__":
    print(f"Frontend directory: {FRONTEND_DIR}")
    print(f"DB Path: {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print("Initializing database (file did not exist)...")
        init_db()
    else:
        # Always ensure schema exists/updated (idempotent due to IF NOT EXISTS)
        print("Ensuring database schema is present...")
        with app.app_context():
            db = get_db()
            apply_schema(db)
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"Starting Flask server on http://{host}:{port}")
    app.run(host=host, port=port, debug=True, use_reloader=False)
