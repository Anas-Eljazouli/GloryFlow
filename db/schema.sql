
CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('client','shipping_line','trucker','customs')) NOT NULL,
  email TEXT,
  phone TEXT
);
CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE,
  direction TEXT CHECK(direction IN ('import','export')) NOT NULL,
  mode TEXT CHECK(mode IN ('sea','air','road')) DEFAULT 'sea',
  customer_id INTEGER REFERENCES partners(id),
  incoterm TEXT,
  pol TEXT,
  pod TEXT,
  vessel TEXT,
  eta DATE,
  free_days INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS containers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id INTEGER REFERENCES shipments(id),
  code TEXT UNIQUE NOT NULL,
  size TEXT,
  tare_kg INTEGER,
  status TEXT CHECK(status IN ('full','empty','released','gate_out')) DEFAULT 'full'
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id INTEGER REFERENCES shipments(id),
  type TEXT CHECK(type IN ('BL','Invoice','PackingList','DUM','MainLevee','Autre')),
  filename TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  extracted_json TEXT
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id INTEGER REFERENCES shipments(id),
  title TEXT,
  due_date DATE,
  done INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS risk_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id INTEGER REFERENCES shipments(id),
  score REAL,
  days_left INTEGER,
  docs_completeness REAL,
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
