
# GLORYFlow — Prototype (BJ GLORY LOGISTICS)

Prototype Flask + SQLite + **Interface Web** (vanilla HTML/JS) pour la digitalisation des dossiers de transit et la gestion du risque de surestaries.

## Lancer l'API + Interface Web
```powershell
# Créer et activer l'environnement virtuel (Windows PowerShell)
python -m venv .venv
& ".venv\Scripts\Activate.ps1"

# Installer les dépendances backend
pip install -r src/backend/requirements.txt

# Démarrer le serveur Flask
python src/backend/main.py
```
- Ouvrir le navigateur sur **http://localhost:5000/** → interface GLORYFlow
- Bouton **Charger données démo** (*Admin*) pour pré-remplir la base
- Pages principales: **Dossiers**, **Nouveau dossier**, **Risque & Documents**, **Conteneurs**, **Admin**
- UI: filtre avancé, recherche, mode compact, modals d'édition, validation ISO 6346 pour conteneurs

### Endpoints (API)
- `GET /health`
- Shipments: `GET /shipments`, `POST /shipments`, `GET /shipments/{id}`, `PATCH /shipments/{id}`, `DELETE /shipments/{id}`
- Clients: `GET /clients`, `POST /clients`, `PATCH /clients/{id}`, `DELETE /clients/{id}`
- Shipping Lines: `GET /shipping_lines`, `POST /shipping_lines`, `PATCH /shipping_lines/{id}`, `DELETE /shipping_lines/{id}`
- Containers: `GET /containers?shipment_id={optional}`, `POST /containers`, `PATCH /containers/{id}`, `DELETE /containers/{id}`
- Documents: `GET /documents?shipment_id={id}`, `POST /documents`
- Admin: `POST /admin/seed`
- KPI: `GET /kpi/demurrage_risk?shipment_id={id}`, `GET /kpi/demurrage_risk_all?min_score={0-100}&max_days_left={int}`

## Structure
- `/src/frontend` : **Site web** (index.html, app.js, styles.css)
- `/src/backend` : Flask minimal + validation ISO 6346
- `/db/schema.sql` : tables de base
- `/api/openapi.yaml` : contrat d'API
- `/data/*.csv` : jeux de données synthétiques
- `/docs` : rapport, guide d'exécution, diagrammes
- `/postman/GLORYFlow.postman_collection.json` : requêtes prêtes à l'emploi

## Notes techniques
- Base SQLite créée et initialisée automatiquement si absente (`DB_PATH` configurable via variable d'environnement).
- Les `foreign keys` SQLite nécessitent `PRAGMA foreign_keys=ON` (à ajouter si besoin pour cascades).
- Le score de surestaries combine `$days\_left$` et complétude documentaire; seuils d'alerte J-3/J-1.
- Voir `api/openapi.yaml` (v0.3.0) pour le contrat complet.
