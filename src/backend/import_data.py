
import os, csv, sqlite3, json
from datetime import datetime

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "gloryflow.db"))
ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))

def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    # Ensure schema exists
    schema_file = os.path.join(ROOT, "db", "schema.sql")
    with open(schema_file, "r", encoding="utf-8") as f:
        cur.executescript(f.read())
    conn.commit()

    # Insert partners
    path = os.path.join(ROOT, "data", "partners.csv")
    with open(path, newline='', encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        cur.execute("INSERT INTO partners(name,type,email,phone) VALUES (?,?,?,?)",
                    (r["name"], r["type"], r.get("email"), r.get("phone")))

    # Insert shipments
    path = os.path.join(ROOT, "data", "shipments.csv")
    with open(path, newline='', encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        cur.execute("""INSERT INTO shipments(reference,direction,mode,customer_id,incoterm,pol,pod,vessel,eta,free_days)
                       VALUES (?,?,?,?,?,?,?,?,?,?)""",
                    (r["reference"], r["direction"], r["mode"], r["customer_id"], r.get("incoterm"),
                     r["pol"], r["pod"], r.get("vessel"), r["eta"], r.get("free_days")))

    # Insert containers
    path = os.path.join(ROOT, "data", "containers.csv")
    with open(path, newline='', encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        # Map shipment by reference
        ref = r["shipment_reference"]
        sid = cur.execute("SELECT id FROM shipments WHERE reference=?", (ref,)).fetchone()[0]
        cur.execute("INSERT INTO containers(shipment_id,code,size,status) VALUES (?,?,?,?)",
                    (sid, r["code"], r["size"], r["status"]))

    conn.commit()
    print("Import terminé.")
    # Show quick stats
    for table in ("partners","shipments","containers"):
        n = cur.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"{table}: {n} lignes")
    conn.close()

if __name__ == "__main__":
    run()
