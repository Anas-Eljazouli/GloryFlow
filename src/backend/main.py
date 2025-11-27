
import os, sqlite3, json, datetime, math
from flask import Flask, request, jsonify, g, send_from_directory

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "gloryflow.db"))
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
REQUIRED_DOCS = {"BL","Invoice","PackingList"}

app = Flask(__name__, static_folder=None, static_url_path=None)

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        schema_path = os.path.abspath(os.path.join(os.path.dirname(__file__),"..","..","db","schema.sql"))
        schema = open(schema_path, "r", encoding="utf-8").read()
        db.executescript(schema)
        db.commit()

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
    customer_email = None
    if hasattr(shipment_row, "keys") and "customer_email" in shipment_row.keys():
        customer_email = shipment_row["customer_email"]
    elif isinstance(shipment_row, dict):
        customer_email = shipment_row.get("customer_email")
    return {
        "shipment_id": shipment_row["id"],
        "reference": shipment_row["reference"],
        "score": score,
        "days_left": days_left,
        "docs_completeness": round(completeness,2),
        "message": msg,
        "missing_docs": missing,
        "customer_email": customer_email,
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
        cols = ("reference","direction","mode","customer_id","incoterm","pol","pod","vessel","eta","free_days")
        values = [data.get(c) for c in cols]
        db.execute(
            "INSERT INTO shipments(reference,direction,mode,customer_id,incoterm,pol,pod,vessel,eta,free_days) VALUES (?,?,?,?,?,?,?,?,?,?)",
            values
        )
        db.commit()
        return {"message":"created"}, 201
    else:
        rows = db.execute("SELECT * FROM shipments ORDER BY id DESC").fetchall()
        return jsonify([dict(r) for r in rows])

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

@app.route("/containers", methods=["POST"])
def add_container():
    db = get_db()
    data = request.json
    code = data["code"]
    # Validate ISO 6346 quickly
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
    db.execute("INSERT INTO containers(shipment_id, code, size) VALUES (?,?,?)",
               (data["shipment_id"], code, data.get("size","40HC")))
    db.commit()
    return {"message":"created"}, 201

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
        SELECT s.id, s.reference, s.eta, s.free_days, p.email AS customer_email
        FROM shipments s
        LEFT JOIN partners p ON s.customer_id = p.id
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
        SELECT s.id, s.reference, s.eta, s.free_days, p.email AS customer_email
        FROM shipments s
        LEFT JOIN partners p ON s.customer_id = p.id
        ORDER BY s.id DESC
    """).fetchall()
    results = []
    for s in rows:
        risk = compute_demurrage_risk(db, s)
        if "error" in risk:  # skip invalid shipments
            continue
        if risk["score"] < min_score:
            continue
        if max_days_left is not None and risk["days_left"] >= max_days_left:
            continue
        results.append(risk)
    return jsonify(results)

@app.route("/admin/seed", methods=["POST"])
def seed():
    db = get_db()
    n = db.execute("SELECT COUNT(*) as c FROM shipments").fetchone()["c"]
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..",".."))
    def load_csv(path):
        import csv
        with open(path, newline='', encoding="utf-8") as f:
            return list(csv.DictReader(f))
    if n == 0:
        partners = load_csv(os.path.join(base, "data", "partners.csv"))
        for p in partners:
            db.execute("INSERT INTO partners(name, type, email, phone) VALUES (?,?,?,?)",
                       (p["name"], p["type"], p["email"], p["phone"]))
        shipments = load_csv(os.path.join(base, "data", "shipments.csv"))
        for s in shipments:
            cols = ("reference","direction","mode","customer_id","incoterm","pol","pod","vessel","eta","free_days")
            vals = [s[c] for c in cols]
            vals[3] = int(vals[3]) if vals[3] else None
            vals[9] = int(vals[9]) if s["free_days"] else 5
            db.execute("INSERT INTO shipments(reference,direction,mode,customer_id,incoterm,pol,pod,vessel,eta,free_days) VALUES (?,?,?,?,?,?,?,?,?,?)", vals)
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
        print("Initializing database...")
        init_db()
    print("Starting Flask server on http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
