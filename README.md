# MaisonPrint — Backend (Medusa v2)

API e-commerce et back-office d'administration pour MaisonPrint.

## Stack

- **Framework** : Medusa v2 (Node.js + TypeScript)
- **Base de données** : PostgreSQL 16
- **Cache / Jobs** : Redis 7
- **Stockage fichiers** : MinIO (dev) → S3/Cloudflare R2 (prod)
- **Recherche** : MeiliSearch
- **Paiement** : Stripe (SCA / 3D Secure)
- **Emails** : Brevo (Phase 2)

## Prérequis

- Node.js >= 20
- pnpm >= 9
- Docker Desktop

## Installation

### 1. Cloner le dépôt et installer les dépendances

```bash
git clone https://github.com/VOTRE_ORG/maisonprint-backend.git
cd maisonprint-backend
pnpm install
```

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env
# Éditer .env selon votre configuration
```

Les valeurs par défaut dans `.env.example` fonctionnent directement avec le Docker Compose local.

### 3. Démarrer les services Docker (PostgreSQL, Redis, MeiliSearch, MinIO)

```bash
docker compose up -d
```

Vérifier que tous les services sont `healthy` :

```bash
docker compose ps
```

### 4. Lancer les migrations

```bash
pnpm db:migrate
```

### 5. Seeder la base de données

```bash
pnpm seed
```

Cela crée :
- 3 catégories (Mobilier, Imprimantes, Encre & Cartouches)
- 12 produits réalistes avec variantes et prix en EUR
- Une région France avec TVA 20%
- Un canal de vente par défaut

### 6. Créer le compte administrateur

```bash
pnpm medusa user -e admin@maisonprint.fr -p VotreMotDePasse123!
```

### 7. Démarrer le serveur de développement

```bash
pnpm dev
```

Le backend est accessible sur :
- **API** : http://localhost:9000
- **Admin** : http://localhost:9000/app

## Commandes

| Commande | Description |
|---|---|
| `pnpm dev` | Démarrage en mode développement (hot reload) |
| `pnpm build` | Build de production |
| `pnpm start` | Démarrage en production |
| `pnpm db:migrate` | Exécuter les migrations |
| `pnpm seed` | Seeder la base de données |
| `pnpm lint` | Vérification TypeScript |

## Variables d'environnement

Voir `.env.example` pour la documentation complète de chaque variable.

| Variable | Description | Obligatoire |
|---|---|---|
| `DATABASE_URL` | URL PostgreSQL | Oui |
| `REDIS_URL` | URL Redis | Oui |
| `JWT_SECRET` | Secret JWT (min. 32 chars en prod) | Oui |
| `COOKIE_SECRET` | Secret cookie (min. 32 chars en prod) | Oui |
| `STORE_CORS` | URL(s) autorisées pour le storefront | Oui |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (Phase 2) | Non |
| `BREVO_API_KEY` | Clé API Brevo (Phase 2) | Non |

## Architecture des modules

```
src/
├── api/          # Routes API custom
├── modules/      # Modules Medusa custom
│   └── brevo/    # Provider email Brevo (Phase 2)
├── jobs/         # Tâches planifiées
├── subscribers/  # Abonnements aux événements
├── workflows/    # Workflows Medusa
└── scripts/
    └── seed.ts   # Données de test
```

## Accès aux services locaux

| Service | URL | Identifiants |
|---|---|---|
| Medusa Admin | http://localhost:9000/app | admin@maisonprint.fr |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin123 |
| MeiliSearch | http://localhost:7700 | masterKeyDevOnlyChangeInProd |
| PostgreSQL | localhost:5432 | maisonprint / maisonprint_pwd |
