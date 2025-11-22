
# Rapport de stage de fin d’année
**Titre :** GLORYFlow — Digitalisation du suivi des dossiers de transit et gestion proactive du risque de surestaries avec interface web  
**Étudiant :** *Anas EL JAZOULI* — ENSEM (Génie Logiciel & Digitalisation)  
**Entreprise d’accueil :** **BJ GLORY LOGISTICS SARL AU**, Casablanca (Philips Business Center, 304 Bd Mohamed V, Bureau N°510)  
**Période :** 1er juillet 2025 — 31 août 2025  
**Encadrante entreprise :** Mme **Lamiaa MAFHOUME** (Gérante)  
**Encadrant académique :** (à compléter)

---

## Résumé
Ce rapport présente la conception et la réalisation de **GLORYFlow**, une solution logicielle légère composée d’une **API REST (Flask)** et d’une **interface web** (HTML/CSS/JavaScript) visant à **centraliser les dossiers de transit** d’une PME marocaine (BJ GLORY LOGISTICS), **fiabiliser** certaines validations (codes conteneurs **ISO 6346**), **orchestrer** un mini‐workflow documentaire (BL, Invoice, Packing List) et **anticiper le risque de surestaries** via un **score** et des **alertes J‑3/J‑1**.  
Le périmètre respecte l’écosystème marocain : **PORTNET** (guichet unique du commerce extérieur) et **ADII/BADR** (système douanier) restent opérés par des personnes habilitées ; GLORYFlow **n’implémente aucune intégration directe** à ces SI et privilégie des **imports/exports CSV** ainsi qu’une **traçabilité** rigoureuse.  
Les résultats sur des données simulées indiquent une meilleure **visibilité opérationnelle**, une **priorisation** des dossiers à risque et une **projection** de gains : réduction de l’exposition aux surestaries (–15 % estimés) et amélioration de la productivité (+20 % estimée). La solution est **modulaire** et prête à être enrichie (authentification, upload de fichiers, front React, PostgreSQL/MinIO, EDI avec habilitations).

**Mots‐clés :** Commissionnaire de transport, PortNet, Douane, BADR, Dossier import/export, ISO 6346, Demurrage/Surestaries, KPI, Flask, SQLite, Web UI, API REST, Digitalisation.

---

## Remerciements
Je tiens à remercier **BJ GLORY LOGISTICS** pour l’accueil et la disponibilité, en particulier **Mme Btissam** pour son accompagnement. Mes remerciements vont également au corps professoral de l’**ENSEM** pour l’encadrement et les retours méthodologiques tout au long du projet.

---

## Table des matières
1. **Introduction**  
2. **Présentation de BJ GLORY LOGISTICS & écosystème**  
   2.1. L’entreprise et son rôle dans la chaîne logistique  
   2.2. PortNet, ADII/BADR et cadre national de digitalisation  
3. **Problématique & objectifs**  
4. **Étude de l’existant (As‑Is)**  
   4.1. Acteurs, documents, jalons  
   4.2. Irritants observés et risques associés  
5. **Cahier des charges & exigences**  
   5.1. Fonctionnelles  
   5.2. Non fonctionnelles  
6. **Conception**  
   6.1. Architecture cible  
   6.2. Modèle de données  
   6.3. Contrat d’API & règles métier  
7. **Réalisation**  
   7.1. Backend Flask (endpoints, validations, scoring)  
   7.2. Interface web (UX/UI, composants, parcours)  
   7.3. Données de démonstration & seed  
8. **Tests & validation**  
   8.1. Cas de tests unitaires et manuels  
   8.2. Résultats & métriques (simulés)  
9. **Sécurité, conformité & gouvernance**  
10. **Gestion de projet** (planning, risques & parades)  
11. **Limites & perspectives**  
12. **Conclusion**  
13. **Bibliographie**  
14. **Annexes**

---

## 1. Introduction
Le secteur de la logistique est profondément transformé par la **digitalisation**. Pour un **commissionnaire de transport**, la valeur ajoutée réside autant dans la capacité à **coordonner des acteurs** (armateurs, terminaux, douanes, transporteurs routiers) que dans la **maîtrise du calendrier** (ETA, free days, cut‑offs, disponibilités). Or, dans les PME, l’information opérationnelle reste souvent **éparpillée** : e‑mails, fichiers Excel, photos WhatsApp, imprimés.  
Cette dispersion entraîne un manque de **traçabilité**, une **visibilité limitée** sur les dépendances (documents à réunir, étapes à franchir), et in fine un **risque financier** : **surestaries** (demurrage) et **detention** facturées par les armateurs et terminaux lorsque les conteneurs dépassent leurs franchises.  
L’objectif de ce stage est de proposer un **socle applicatif** simple, auditable et extensible pour **centraliser** les dossiers, **fiabiliser** certaines validations, **évaluer le risque** et **outiller la décision** — tout en respectant le cadre marocain (PORTNET, ADII/BADR).

---

## 2. Présentation de BJ GLORY LOGISTICS & écosystème

### 2.1. L’entreprise
**BJ GLORY LOGISTICS** est une société basée à **Casablanca** exerçant des activités de **commissionnaire de transport**. L’entreprise coordonne les opérations d’import/export de ses clients : collecte des documents, suivi du navire, formalités (via des déclarants habilités), enlèvement des conteneurs et livraison finale. Elle évolue dans un tissu d’acteurs divers (armateurs, terminaux/MA, douane, transporteurs).

### 2.2. PortNet, ADII/BADR et cadre national
Le **Guichet Unique PORTNET** constitue la **colonne vertébrale** de la dématérialisation des formalités du commerce extérieur au Maroc. Il fédère la communauté portuaire (armateurs, consignataires, opérateurs, autorités). La **douane (ADII)** opère son système **BADR**, interfacé avec la communauté à travers des services en ligne.  
Ces systèmes sont **réglementés** et **sécurisés**. Toute **intégration applicative** (API/EDI) suppose des **habilitations**. Dans ce stage, GLORYFlow **n’envoie pas de messages** à PortNet/BADR ; il **prépare** et **trace** l’information et propose des **exports/ imports CSV** permettant un rapprochement manuel contrôlé.

---

## 3. Problématique & objectifs

### 3.1. Problématique
- Dossiers de transit dispersés ; absence de **vue unifiée**.  
- Manque de **visibilité** sur les **free days** et jalons (main levée, gate‑out).  
- Suivi documentaire (BL, invoice, packing list) **incomplet**.  
- Absence d’un **indicateur de risque** simple et partagé.  
- **KPI** (temps de cycle, retards, coûts potentiels) difficiles à produire.

### 3.2. Objectifs
1. **Centraliser** les dossiers et documents clefs.  
2. Mettre en place un **workflow** minimal standardisable.  
3. Créer un **score de risque de surestaries** avec alertes **J‑3/J‑1**.  
4. Produire des **KPI** opérationnels et des exports CSV.  
5. Respecter **sécurité & conformité** (pas d’intégration non autorisée aux SI nationaux).

---

## 4. Étude de l’existant (As‑Is)

### 4.1. Acteurs et documents
- **Clients importateurs** : donnent mandat et documents (BL, facture, packing list).  
- **Armateurs/consignataires** : BL d’origine, ETA, free days, mise à disposition.  
- **Déclarants / Douane (ADII)** : déclaration BADR, droits/taxes, main levée.  
- **Autorités portuaires / MAGASINS & AIRES** : passage portuaire, gate‑out.  
- **Transporteurs routiers** : retrait et livraison.

### 4.2. Flux et jalons
1. **Pré‑alerte** : réception BL/facture/PL, démarrage du dossier.  
2. **Déclaration** : saisie BADR, paiement, **main levée**.  
3. **Opérations portuaires** : main courante, rendez‑vous, **enlèvement**.  
4. **Gate‑out** et **livraison**.  
5. **Archivage** (souvent hétérogène).

### 4.3. Irritants
- **Éparpillement** de l’information (mails/Excel/WhatsApp).  
- Dépassement des **free days** faute d’anticipation.  
- **Dépendances documentaires** non tracées.  
- **Absence de KPI** consolidés.

---

## 5. Cahier des charges & exigences

### 5.1. Fonctionnelles
- **Dossiers (shipments)** : référence interne, direction (import/export), ports (POL, POD), navire, **ETA**, **free days**, incoterm, client.  
- **Conteneurs** : n° conteneur **ISO 6346** (validation check‑digit), taille/type.  
- **Documents** : BL / Invoice / Packing List / DUM / Main Levée / Autre (GED légère).  
- **Workflow & tâches** : jalons, échéances et **alertes J‑3/J‑1**.  
- **KPI** : temps de cycle, dossiers à risque, complétude documentaire.  
- **Exports CSV** et **journal d’audit** minimal.

### 5.2. Non fonctionnelles
- **Simplicité** : PoC robuste, portable, sans dépendances lourdes.  
- **Sécurité** : séparation front/back, rôles basiques, gestion des secrets.  
- **Évolutivité** : modules, API stable, migration possible vers PostgreSQL/MinIO.  
- **Testabilité** : endpoints isolés, données seed, Postman.

---

## 6. Conception

### 6.1. Architecture cible
- **Frontend** : site statique (HTML/CSS/JS) servi par Flask.  
- **Backend** : **Flask** (API REST), contrôles métier, calcul du score.  
- **Base de données** : **SQLite** en PoC ; migration PostgreSQL envisagée.  
- **Stockage** : système de fichiers ; évolutif vers S3/MinIO.  
- **Interop** : imports/exports **CSV** ; pas d’appels directs à PortNet/BADR.

### 6.2. Modèle de données (extrait)
- `partners(id, name, type, email, phone)`  
- `shipments(id, reference, direction, mode, customer_id, incoterm, pol, pod, vessel, eta, free_days, created_at)`  
- `containers(id, shipment_id, code, size, tare_kg, status)`  
- `documents(id, shipment_id, type, filename, uploaded_at, extracted_json)`  
- `tasks(id, shipment_id, title, due_date, done, created_at)`  
- `risk_scores(id, shipment_id, score, days_left, docs_completeness, computed_at)`

### 6.3. Contrat d’API & règles métier
- `GET/POST /shipments` ; `GET/PATCH /shipments/{id}`.  
- `POST /containers` (contrôle **ISO 6346** : format + check‑digit).  
- `GET/POST /documents` (présence documentaire).  
- `POST /admin/seed` (chargement des CSV de démo).  
- `GET /kpi/demurrage_risk?shipment_id=ID` → `{score, days_left, docs_completeness, message}`.  
**Règles** : la **complétude** s’évalue sur `{BL, Invoice, PackingList}` ; **score** augmente quand `days_left` diminue et quand la complétude est faible.

---

## 7. Réalisation

### 7.1. Backend Flask
- **Organisation** : `src/backend/main.py`, `db/schema.sql`.  
- **Initialisation** : création automatique de `gloryflow.db` à la première exécution.  
- **Endpoints** : listés ci‑dessus ; retours JSON ; gestion des erreurs de saisie.  
- **Validation ISO 6346** : implémentation du calcul **check‑digit** par pondération (2^position) et mapping lettres (A=10, B=12, …).  
- **Scoring** : `days_left = (ETA + free_days) – today` ; `completeness = |docs_presents ∩ required| / 3` ; `score = f(days_left, completeness)` ; messages **J‑3/J‑1**.

### 7.2. Interface web (UX/UI)
- **Technologies** : HTML5 + CSS moderne + JavaScript (fetch API). Aucune bibliothèque externe.  
- **Écrans** :
  - **Tableau des dossiers** : référence, route (`POL → POD`), ETA, free days, actions.  
  - **Panneau latéral** : résultat du **score** (liste lisible), **état documentaire** (badges rouge/vert) avec ajout instantané (POST `/documents`), **formulaire conteneur** (POST `/containers`).  
  - **Formulaire Nouveau dossier** : création immédiate (POST `/shipments`).  
  - **Bouton Seed** : peupler la base depuis `/data/*.csv` (POST `/admin/seed`).  
- **Ergonomie** : composants sobres, responsive, retours visuels clairs ; design “dashboard” adapté à un agent d’exploitation.

### 7.3. Données de démonstration
- **Shipments** (8 dossiers) avec **ETA** répartis, **free days** variés, **routes** réalistes.  
- **Containers** avec de **vrais check‑digits** conformes ISO 6346.  
- **Partners** (client, armateur, transporteur, BJ GLORY).

---

## 8. Tests & validation

### 8.1. Cas de tests
- **Conteneur** : code invalide (longueur / absence de ‘U’ / check‑digit erroné) → **rejet** (HTTP 400).  
- **Risque** : cas limites `days_left <= 0`, `days_left ∈ {1,3}`, `days_left >> 10` ; complétude `{0/3, 1/3, 2/3, 3/3}`.  
- **Seed** : base vide vs base déjà renseignée ; idempotence (retour “already seeded”).  
- **UI** : création dossier → apparition en tête de liste ; ajout doc → variation du score.

### 8.2. Résultats (simulés)
- Alertes **J‑3/J‑1** déclenchées correctement.  
- Les dossiers avec `docs_completeness=0` et `days_left<=3` obtiennent un score élevé (priorité).  
- Gains estimés (à confirmer sur données réelles) : **–15 %** d’exposition aux surestaries, **+20 %** de productivité par agent.

---

## 9. Sécurité, conformité & gouvernance
- **Même origine** (UI servie par Flask) → pas de CORS ni de fuites de cookie.  
- **RBAC** minimal à implémenter pour une mise en prod (Opérations / Déclarant / Direction).  
- **Journal d’audit** à compléter (création, modification, téléchargement de docs).  
- **Données** : chiffrement au repos conseillé (S3/MinIO ultérieur), secrets via `.env`.  
- **Conformité** : pas d’intégration PortNet/BADR sans **habilitations** ; **exports CSV** uniquement.

---

## 10. Gestion de projet
- **Planning (8 semaines)** : cadrage → conception → MVP backend → scoring/KPI → UI → tests → rapport/soutenance.  
- **Risques** : disponibilité des données réelles (paré par des **données synthétiques**), évolution réglementaire, montée de charge (mitigée par la **migration PostgreSQL** envisagée).  
- **Outils** : Git, Postman, éditeur de code, scripts de seed.

---

## 11. Limites & perspectives
- **Front** minimal (pas de tableau de bord graphique, pas d’authent).  
- **GED/OCR** rudimentaires ; pas d’upload réel de fichiers (seulement la “présence” documentaire).  
- **Intégration** PortNet/BADR volontairement absente (conformité).  
**Perspectives** : React/Vue, authentification/autorisation (JWT/SSO), upload de fichiers + OCR, calendrier SLA/jours fériés, reporting graphique, PostgreSQL + MinIO, intégration EDI **avec habilitations**.

---

## 12. Conclusion
GLORYFlow fournit un **socle pragmatique** pour structurer la **donnée opérationnelle** d’un commissionnaire de transport et instaurer une **culture de pilotage**. Le couple **API + UI** prouve qu’avec une **architecture simple** on peut adresser des irritants concrets : visibilité du risque, complétude documentaire, standardisation des étapes. La solution est **évolutive** et prête à être industrialisée selon les besoins de BJ GLORY LOGISTICS.

---

## 13. Bibliographie (générique)
- Littérature et guides sur les **guichets uniques** et la facilitation des échanges.  
- Norme **ISO 6346** (identification des conteneurs intermodaux).  
- Documentation **Flask** (framework web Python) & **SQLite**.

---

## 14. Annexes

### Annexe A — Schéma SQL (extrait)
```sql
CREATE TABLE shipments (...);
CREATE TABLE containers (...);
CREATE TABLE documents (...);
```
*(voir fichier `db/schema.sql` pour le détail complet).*

### Annexe B — Endpoints d’API (extrait)
- `GET /health`  
- `GET/POST /shipments` ; `GET/PATCH /shipments/{id}`  
- `POST /containers`  
- `GET/POST /documents`  
- `POST /admin/seed`  
- `GET /kpi/demurrage_risk?shipment_id=ID`

### Annexe C — Parcours UI (pas à pas)
1. **Charger données démo**.  
2. **Risque** → lecture score & jours restants.  
3. **Docs** → ajouter BL/Invoice/Packing List.  
4. **Ajouter conteneur** (ISO 6346).  
5. **Nouveau dossier**.

### Annexe D — Sécurité & conformité (extraits de politique interne)
- Rôles, journal d’audit, conservation de documents, anonymisation pour démonstration.

