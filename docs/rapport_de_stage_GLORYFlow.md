
# Rapport de Stage (PFA)
**Intitulé** : *GLORYFlow – Digitalisation du suivi des dossiers de transit et gestion du risque de surestaries*  
**Entreprise d’accueil** : **BJ GLORY LOGISTICS SARL AU**, Casablanca, Maroc  
**Cursus** : Génie Logiciel & Digitalisation – ENSEM  
**Stagiaire** : M. **ANAS EL JAZOULI**  
**Période** : 01 juillet 2025 – 31 août 2025  
**Encadrante en entreprise** : Mme **Lamiaa Mafhoume** (Gérante)  
**Encadrant pédagogique** : …

---

## Remerciements
Je tiens à remercier l’équipe de BJ GLORY LOGISTICS pour son accueil ainsi que mon encadrant pédagogique pour ses conseils. Ce travail a été l’occasion de transformer un besoin opérationnel récurrent du métier du transit en un prototype fonctionnel de digitalisation.

---

## Résumé (FR)
Ce rapport présente la conception et la réalisation d’un **prototype logiciel** visant à **centraliser les dossiers de transit**, **structurer le workflow** (pré‑alerte, déclaration, paiement, main levée, enlèvement) et **anticiper les surestaries** via un **score de risque**. Le produit, nommé **GLORYFlow**, repose sur une **API REST Flask** et une **base de données relationnelle**. Il prévoit des **exports/imports CSV** compatibles avec les pratiques de l’écosystème marocain (PORTNET/BADR) sans intégrations techniques non autorisées. Les résultats montrent un gain attendu de productivité et une meilleure visibilité des dossiers sensibles.

**Mots‑clés** : Transit, Logistique, PORTNET, BADR, Surestaries, Digitalisation, API REST, Flask, KPI.

## Abstract (EN)
This internship report describes the design and implementation of a prototype to digitalize freight forwarding operations: centralized case management, structured workflow and a demurrage risk score. The solution, **GLORYFlow**, is implemented as a **Flask REST API** with a relational database and relies on **CSV interchange** to remain compliant with the Moroccan ecosystem (PORTNET/BADR). Results show improved visibility and expected productivity gains.

---

## Liste des sigles et abréviations
- **BL** : Bill of Lading (Connaissement)  
- **DUM** : Déclaration Unique de Marchandises  
- **GED** : Gestion Électronique de Documents  
- **KPI** : Key Performance Indicator (Indicateur de performance)  
- **ETA** : Estimated Time of Arrival (Date estimée d’arrivée)  
- **RBAC** : Role Based Access Control  
- **API** : Application Programming Interface

---

## Introduction
Les **sociétés de transit et commissionnaires** orchestrent un flux documentaire conséquent entre clients importateurs/exportateurs, compagnies maritimes, transporteurs, douanes et autorités portuaires. Dans une **PME de logistique**, la dispersion des informations (emails, Excel, portails externes) nuit à la visibilité et génère des **coûts** comme les **surestaries/detention**.  
L’objectif de ce stage est de **concevoir** et **prototyper** une solution de **digitalisation** – GLORYFlow – afin de :  
1) centraliser les dossiers et documents, 2) piloter le workflow, 3) anticiper les risques, 4) fournir des **KPI** décisionnels.

---

## Chapitre 1 — Présentation de BJ GLORY LOGISTICS et de l’écosystème
### 1.1 L’entreprise d’accueil
BJ GLORY LOGISTICS SARL AU est un **commissionnaire de transport** basé à **Casablanca**. L’entreprise traite des opérations d’import/export, organise le transport, et coordonne les formalités documentaires et douanières.

### 1.2 Processus métier (vue générale)
- **Pré‑alerte** : réception BL, facture, packing list.  
- **Déclaration** : préparation DUM, obtention de la **main levée**.  
- **Enlèvement** : organisation du camion, restitution/gestion des conteneurs.  
- **Clôture** : facture finale, archivage et KPI.

### 1.3 Écosystème numérique
- **PORTNET** : guichet unique national pour la **dématérialisation** des formalités du commerce extérieur.  
- **BADR (Douanes)** : système d’information pour les formalités douanières.  
- **Compagnies maritimes** & **terminaux** : réservation, bons, frais de surestaries/detention.  
GLORYFlow **n’automatise pas** les échanges avec PORTNET/BADR : il **prépare** et **trace** les actions (exports/imports CSV, références, dates), ce qui est **conforme** aux bonnes pratiques pour un prototype académique.

---

## Chapitre 2 — Contexte, problématique et objectifs
### 2.1 Constat
Les dossiers sont éparpillés (fichiers, mails, Excel), les tâches sont peu tracées, la visibilité sur **ETA** et **free days** est partielle, d’où des **risques de surestaries** et une difficulté à suivre les **KPI**.

### 2.2 Problématique
Comment **centraliser** et **fiabiliser** l’information tout en **alertant** proactivement les équipes pour réduire délais et coûts, sans perturber les outils existants ?

### 2.3 Objectifs SMART
- **O1** : Centraliser 100% des dossiers dans une base unifiée.  
- **O2** : Mettre en place un **workflow** standardisé avec jalons et tâches.  
- **O3** : Déployer un **score de risque** simple mais actionnable (0..100, alertes J‑3/J‑1).  
- **O4** : Publier un **tableau de bord** minimal (KPI de cycle et de risque).  
- **O5** : Respecter la **conformité** (aucune intégration non autorisée aux SI externes).

---

## Chapitre 3 — Analyse des besoins (fonctionnel)
### 3.1 Personas et rôles
- **Agent d’exploitation** : crée et met à jour les dossiers, charge les documents.  
- **Déclarant/Douane** : renseigne DUM, suit les validations.  
- **Direction** : consulte KPI et analyse des risques.

### 3.2 User stories (extrait)
- En tant qu’**agent**, je veux **créer un dossier** import avec ETA et free days pour suivre sa date limite.  
- En tant qu’**agent**, je veux **attacher un conteneur** avec **contrôle ISO 6346** pour éviter les erreurs de saisie.  
- En tant que **direction**, je veux **voir les dossiers à risque** pour prioriser les actions.  

### 3.3 Spécifications (MoSCoW)
- **Must** : dossiers, conteneurs, documents typés, score risque, alertes J‑3/J‑1.  
- **Should** : tâches, échéances, exports CSV.  
- **Could** : OCR léger (regex), tableau de bord visuel.  
- **Won’t (MVP)** : intégrations live à PORTNET/BADR sans habilitation.

### 3.4 Règles de gestion clés
- Un **dossier** peut avoir **N conteneurs**.  
- Le **code conteneur** est conforme **ISO 6346** (contrôle du **check digit**).  
- La **complétude documentaire** (BL/Invoice/PackingList) impacte le **score**.

---

## Chapitre 4 — Conception (technique)
### 4.1 Architecture logique
- **Front (facultatif)** : React/Vue (non inclus dans le MVP).  
- **API** : **Flask** (Python) – services REST.  
- **DB** : **SQLite** (PoC) / PostgreSQL (cible).  
- **Stockage** : système de fichiers ou S3/MinIO (GED).

### 4.2 Modèle de données (extrait)
Tables : `partners`, `shipments`, `containers`, `documents`, `tasks`, `risk_scores`.  
Attributs essentiels : `shipments(reference, direction, pol, pod, eta, free_days, customer_id)` ; `containers(code, size, status)`…

### 4.3 API (extrait)
- `GET /health` → statut.  
- `GET/POST /shipments` → lister/créer un dossier.  
- `POST /containers` → ajouter un conteneur avec **validation ISO 6346**.  
- `GET /kpi/demurrage_risk?shipment_id=ID` → score 0..100 + message d’alerte.

### 4.4 Algorithmes
- **ISO 6346** : calcul du **check digit** (pondération 2^position, mapping alphanumérique normalisé).  
- **Score de risque (simplifié)** :  
  `raw = max(0, 1 - days_left/10) * (1 - completeness/2)` ; `score = clamp(0..100)`  
  où `completeness = % {BL, Invoice, PackingList} présents`.

---

## Chapitre 5 — Réalisation
### 5.1 Choix technologiques
- **Flask 3** (API rapide, légère), **SQLite** (démo), **OpenAPI** (contrat), **Postman** (tests).

### 5.2 Structure du code (MVP)
```
/src/backend
  ├── main.py                # API Flask (DB, endpoints, scoring, ISO 6346)
  ├── requirements.txt
  ├── import_data.py         # script d'import CSV -> base SQLite
/db
  └── schema.sql             # création des tables
/api
  └── openapi.yaml           # contrat d'API
/data
  ├── partners.csv
  ├── shipments.csv
  └── containers.csv
```

### 5.3 Points saillants
- **Endpoint /containers** : refuse un code conteneur si le **check digit** est faux.  
- **Endpoint /kpi/demurrage_risk** : renvoie `score`, `days_left`, `docs_completeness`, `message` (`"Alerte J-3"`/`"Alerte J-1"`).  
- **Sécurité MVP** : pas d’authentification (à ajouter pour une V2).

### 5.4 Écrans / IHM
Ce MVP expose une **API JSON**. L’accès se fait via **Postman** ou `curl`. Un **front web** peut être ajouté ultérieurement.

---

## Chapitre 6 — Tests, données & résultats
### 6.1 Jeux de données synthétiques
Le dossier `/data` fournit des **clients**, **dossiers** et **conteneurs** (codes ISO 6346 valides).

### 6.2 Procédure de test
1. D démarrer l’API, **importer** les CSV (`import_data.py`).  
2. Vérifier `GET /shipments` → 8 dossiers.  
3. Interroger `GET /kpi/demurrage_risk?shipment_id=1` → score + alerte.  
4. Tester les **erreurs** : soumettre un conteneur avec **check digit** erroné.

### 6.3 Indicateurs observés (démo)
- Calcul du score cohérent avec ETA/free days.  
- Avertissements J‑3/J‑1 déclenchés selon les dates simulées.  
- Contrôle ISO 6346 efficace (détection d’un chiffre de contrôle faux).

---

## Chapitre 7 — Déploiement, exploitation et sécurité
### 7.1 Exécution locale
- Python 3.10+, `venv`, `pip install -r src/backend/requirements.txt`, `python src/backend/main.py`.  
- Variables : `DB_PATH` (facultatif), par défaut `src/backend/gloryflow.db`.

### 7.2 Données & sauvegardes
- Base SQLite sauvegardable en un fichier.  
- Stockage des documents : prévoir un dossier dédié (ou S3/MinIO).

### 7.3 Sécurité (pistes)
- **RBAC**, **JWT**, **CORS** maîtrisé, **chiffrement** au repos (GED), **journal d’audit**.  
- Séparation **dev/test/prod**, **backups** et **restauration** testée.

---

## Chapitre 8 — Gestion de projet
### 8.1 Planning (8 semaines)
- S1 : cadrage, cartographie AS‑IS / TO‑BE.  
- S2 : conception (DB, API, diagrammes).  
- S3–S4 : dev backend MVP.  
- S5 : module KPI & scoring.  
- S6 : GED/extraction légère.  
- S7 : tests et jeux de données.  
- S8 : rapport, soutenance.

### 8.2 Méthode
- Kanban léger (Todo / Doing / Done), **revues hebdo**, **démo** en fin de sprint.

---

## Chapitre 9 — Bilan, limites et perspectives
### 9.1 Bilan
Le MVP répond à l’essentiel : **centralisation**, **contrôles** et **alerte**. La simplicité du design facilite une **industrialisation** progressive.

### 9.2 Limites
- Pas d’authentification ni d’interface graphique intégrée.  
- Pas d’intégrations temps réel (PORTNET/BADR).  
- OCR limitée (regex).

### 9.3 Perspectives
- Front web (React) + authentification et rôles.  
- Connecteurs EDI autorisés si habilitations.  
- Moteur d’OCR (Tesseract) et extraction assistée.  
- Tableaux de bord temps réel avec agrégations.

---

## Conclusion
GLORYFlow matérialise une **digitalisation pragmatique** du métier de BJ GLORY LOGISTICS. Le prototype offre un **socle** réutilisable : données unifiées, API claire, contrôles critiques (ISO 6346) et **pilotage par risque**. Sa mise en production demanderait des compléments de **sécurité**, **IHM** et **interopérabilité** gouvernée.

---

## Annexes
### A. Exemples d’appels API
- **Santé** : `GET http://localhost:8000/health` → `{"status": "ok"}`  
- **Lister dossiers** : `GET http://localhost:8000/shipments` → `[...]`  
- **Ajouter conteneur** : `POST http://localhost:8000/containers` body :  
```json
{"shipment_id":1, "code":"MSCU1234567", "size":"40HC"}
```
- **Risque** : `GET http://localhost:8000/kpi/demurrage_risk?shipment_id=1` →  
```json
{"shipment_id":1,"score":55,"days_left":2,"docs_completeness":0.67,"message":"Alerte J-3"}
```

### B. Schéma SQL (extrait)
Voir `/db/schema.sql` fourni.

### C. OpenAPI (extrait)
Voir `/api/openapi.yaml` fourni.

### D. Licence
Usage pédagogique dans le cadre du PFA ENSEM.
