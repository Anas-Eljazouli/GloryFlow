from flask import Flask, send_from_directory
import os

app = Flask(__name__)
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "src", "frontend"))

@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)

if __name__ == "__main__":
    print(f"Frontend: {FRONTEND_DIR}")
    print(f"Index exists: {os.path.exists(os.path.join(FRONTEND_DIR, 'index.html'))}")
    print(f"CSS exists: {os.path.exists(os.path.join(FRONTEND_DIR, 'styles.css'))}")
    app.run(host="127.0.0.1", port=5000, debug=False)
