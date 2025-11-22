
# GLORYFlow — Prototype (BJ GLORY LOGISTICS)

Prototype Flask + SQLite + **Interface Web** (vanilla HTML/JS) pour la digitalisation des dossiers de transit et la gestion du risque de surestaries.

## Lancer l'API + Interface Web
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r src/backend/requirements.txt
python src/backend/main.py
```
- Ouvrir le navigateur sur **http://localhost:8000/** → interface GLORYFlow
- Bouton **Charger données démo** pour pré-remplir la base
- Table **Dossiers** : actions *Risque*, *Docs*, *Ajouter conteneur*
- Panneau latéral : résultats du **score de surestaries**, gestion des **documents**, ajout de **conteneur**

### Endpoints (API)
- `GET /health`
- `GET/POST /shipments` ; `GET /shipments/{id}` ; `PATCH /shipments/{id}`
- `POST /containers`
- `GET/POST /documents`
- `POST /admin/seed`
- `GET /kpi/demurrage_risk?shipment_id=1`

## Structure
- `/src/frontend` : **Site web** (index.html, app.js, styles.css)
- `/src/backend` : Flask minimal + validation ISO 6346
- `/db/schema.sql` : tables de base
- `/api/openapi.yaml` : contrat d'API
- `/data/*.csv` : jeux de données synthétiques
- `/docs` : rapport, guide d'exécution, diagrammes
- `/postman/GLORYFlow.postman_collection.json` : requêtes prêtes à l'emploi
