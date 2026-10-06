# Déploiement provisoire — Railway (backend) + Vercel (storefront)

Version de recette, privée (mot de passe + noindex), paiement en mode test.
Le code est le même qu'en local : tout passe par les variables d'environnement.

```
Vercel   : storefront Next.js  (repo aderspaces-front)
Railway  : backend Medusa      (repo aderspaces-back, Dockerfile)
           Postgres · Redis · MeiliSearch · MinIO
```

Ordre imposé : **Railway d'abord** (le storefront a besoin de l'URL du backend
et de la clé publiable générée par le seed), Vercel ensuite, puis retour sur
Railway pour les CORS.

## 1. Railway

Créer un projet, région **EU West (Amsterdam)**, puis 5 services.

### Postgres et Redis
`+ New → Database → PostgreSQL`, puis `→ Redis`. Rien à configurer.

### MeiliSearch
`+ New → Docker Image → getmeili/meilisearch:v1.12`, nommer le service `meilisearch`.

| Variable | Valeur |
|---|---|
| `MEILI_MASTER_KEY` | chaîne aléatoire (≥ 32 caractères) |
| `MEILI_ENV` | `production` |

Volume monté sur `/meili_data`. Pas de domaine public.

### MinIO (images produit)
`+ New → Docker Image → minio/minio`, nommer le service `minio`.

| Réglage | Valeur |
|---|---|
| Start command | `minio server /data --console-address :9001` |
| `MINIO_ROOT_USER` | identifiant au choix |
| `MINIO_ROOT_PASSWORD` | chaîne aléatoire |
| Volume | `/data` |
| Networking | *Generate Domain* sur le port **9000** |

Créer le bucket en lecture publique (une fois, depuis ce PC, Docker lancé) :

```sh
docker run --rm --entrypoint sh minio/mc -c "mc alias set r https://<domaine-minio> <ROOT_USER> <ROOT_PASSWORD> && mc mb r/aderspace --ignore-existing && mc anonymous set download r/aderspace"
```

### Backend
`+ New → GitHub Repo → aderspaces-back`. Le `Dockerfile` et `railway.json`
(healthcheck `/health`) sont détectés. *Generate Domain* (port 9000).

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `PORT` | `9000` |
| `BACKEND_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` |
| `JWT_SECRET` | `openssl rand -base64 32` |
| `COOKIE_SECRET` | `openssl rand -base64 32` (autre valeur) |
| `STOREFRONT_URL` | URL Vercel (étape 3) |
| `STORE_CORS` | URL Vercel (étape 3) |
| `ADMIN_CORS` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` |
| `AUTH_CORS` | `https://${{RAILWAY_PUBLIC_DOMAIN}},<URL Vercel>` |
| `MINIO_ENDPOINT` | `http://minio.railway.internal:9000` |
| `MINIO_PUBLIC_URL` | `https://<domaine-minio>/aderspace` |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | identifiants root MinIO |
| `MINIO_BUCKET` | `aderspace` |
| `MEILISEARCH_HOST` | `http://meilisearch.railway.internal:7700` |
| `MEILISEARCH_API_KEY` | la `MEILI_MASTER_KEY` |
| `INVOICE_SELLER_*` | voir `.env.example` |

Laisser `STRIPE_*` et `BREVO_API_KEY` vides : paiement manuel de test, emails
en log. Les migrations tournent à chaque démarrage du conteneur.

### Données initiales
Avec le CLI (`npm i -g @railway/cli`, `railway login`, `railway link`) :

```sh
railway ssh -s <service backend>
# dans le conteneur :
npx medusa exec ./src/scripts/seed.js               # affiche la clé publiable pk_…
npx medusa exec ./src/scripts/backfill-prices.js
npx medusa exec ./src/scripts/backfill-inventory.js
npx medusa exec ./src/scripts/sync-meilisearch.js
npx medusa user -e <email admin> -p <mot de passe fort>
```

Noter la clé `pk_…`. Les images produit s'ajoutent ensuite depuis l'admin
(`https://<domaine-backend>/app`) : le script `add-product-images` lit le repo
storefront, absent du conteneur.

## 2. Vercel

`Add New → Project → aderspaces-front` (framework Next.js détecté, rien à
changer dans les commandes).

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | `https://<domaine-backend>` |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | la clé `pk_…` du seed |
| `NEXT_PUBLIC_STORE_URL` | `https://<projet>.vercel.app` |
| `NEXT_PUBLIC_ASSET_HOST` | `https://<domaine-minio>` |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` | accès à communiquer au client |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` (utilise la version de pnpm du `package.json`) |

Ne pas définir `NEXT_PUBLIC_SITE_INDEXABLE` (site en noindex) ni
`NEXT_OUTPUT_STANDALONE` (réservé au Dockerfile).

Les `NEXT_PUBLIC_*` sont figées au build : tout changement demande un
redéploiement.

## 3. Retour sur Railway

Renseigner `STOREFRONT_URL`, `STORE_CORS` et `AUTH_CORS` avec l'URL Vercel de
production (sans slash final), redéployer le backend.

## Vérifications

- `https://<domaine-backend>/health` → 200 ; `/app` → connexion admin.
- Storefront : demande le mot de passe, liste les produits, recherche, ajout
  au panier, commande en paiement manuel.

## Dépannage

- **« Could not connect to the database while running migrations »** : Medusa
  impose SSL dès que l'hôte n'est pas `localhost`. Si le Postgres ne le
  propose pas, suffixer `DATABASE_URL` avec `?sslmode=disable`.
- **Redis / MinIO / MeiliSearch injoignables en `*.railway.internal`** : le
  service cible doit écouter en IPv6 sur les environnements Railway anciens
  (`MEILI_HTTP_ADDR=[::]:7700`, `--address [::]:9000` pour MinIO,
  `?family=0` en suffixe de `REDIS_URL`).
- **Erreurs CORS dans le navigateur** : `STORE_CORS` / `AUTH_CORS` doivent
  correspondre exactement à l'origine du storefront.

## Avant une vraie mise en production

Clés Stripe live + webhook `POST <backend>/hooks/payment/stripe`, clé Brevo,
mentions légales et `INVOICE_SELLER_*` réelles, domaine définitif,
`NEXT_PUBLIC_SITE_INDEXABLE=true`, retrait de `BASIC_AUTH_*`, sauvegardes
Postgres, modules Redis de Medusa (event bus, workflow engine) à la place des
versions en mémoire.

---

# Variante gratuite : Render (backend) + Neon + Supabase Storage + Vercel

Tout en offre gratuite, sans carte bancaire. Décrit dans `render.yaml`.

```
Render   : backend Medusa (web free, Dockerfile) + Key Value free (Redis)
Neon     : Postgres (free, région Frankfurt)
Supabase : stockage des images (Storage, API S3, 1 Go)
Vercel   : storefront
```

Limites à connaître :
- **Mise en veille** du backend après 15 min sans trafic : la première requête
  suivante prend ~1 min (démarrage + migrations). Ouvrir `/health` avant une démo.
- 512 Mo de RAM : suffisant pour une recette, pas pour de la charge.
- Pas de Shell sur le plan free : seed et scripts se lancent **depuis ce PC**
  contre la base Neon (étape 3).
- Pas de MeiliSearch : `MEILISEARCH_HOST` non défini → la recherche passe par
  Postgres (moins tolérante aux fautes de frappe).
- Supabase met en pause un projet inactif 7 jours (réactivation en un clic).

## 1. Neon
Créer un projet, région **AWS Europe Central (Frankfurt)**, base `aderspace`.
Copier la chaîne de connexion **directe** (décocher *Connection pooling*) :
`postgresql://…@ep-xxx.eu-central-1.aws.neon.tech/aderspace?sslmode=require`.

## 2. Supabase Storage
Créer un projet (région Frankfurt), puis :
- `Storage → New bucket` : `aderspace`, **Public bucket** coché.
- `Project Settings → Storage → S3 Connection` : activer, noter l'endpoint et la
  région, puis `New access key` (Access key ID + Secret).

| Variable | Valeur |
|---|---|
| `MINIO_ENDPOINT` | `https://<ref>.supabase.co/storage/v1/s3` |
| `MINIO_PUBLIC_URL` | `https://<ref>.supabase.co/storage/v1/object/public/aderspace` |
| `MINIO_REGION` | région affichée (ex. `eu-central-1`) |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | la clé S3 créée |

## 3. Données initiales (depuis ce PC)
Dans `backend/`, avec un fichier temporaire `.env.recette` (ignoré par git)
contenant `DATABASE_URL` (Neon) et les `MINIO_*` (Supabase). Garder
`docker compose up -d` lancé : le reste de la config vient du `.env` local
(Redis, Meili locaux). En PowerShell :

```powershell
Get-Content .env.recette | % { $k,$v = $_ -split '=',2; Set-Item "env:$k" $v }
pnpm db:migrate
pnpm seed                 # affiche la clé publiable pk_…
pnpm seed:fix-prices
pnpm seed:fix-inventory
pnpm seed:images          # upload des images du storefront vers Supabase
pnpm exec medusa user -e <email admin> -p <mot de passe fort>
```

Ouvrir un nouveau terminal ensuite (les variables restent sinon définies).

## 4. Render
Pousser sur `main`, puis `New → Blueprint → aderspaces-back`. Renseigner les
variables demandées : `DATABASE_URL` et `MINIO_*` comme ci-dessus ; pour les
URLs encore inconnues, mettre `http://localhost:3000` provisoirement.
Une fois l'URL `https://aderspace-back-xxxx.onrender.com` connue, mettre à
jour `BACKEND_URL` et `ADMIN_CORS`.

## 5. Vercel puis retour sur Render
Vercel comme en section 2, avec `NEXT_PUBLIC_ASSET_HOST=https://<ref>.supabase.co`.
Puis sur Render : `STOREFRONT_URL`, `STORE_CORS` = URL Vercel,
`AUTH_CORS` = `<URL backend>,<URL Vercel>` → *Save, rebuild and deploy*.

## Dépannage spécifique
- **Healthcheck en échec au premier déploiement** : relancer le déploiement
  (démarrage à froid lent sur le plan free).
- **Instance redémarre en boucle (« Out of memory »)** : limite du plan free ;
  vérifier les logs, il n'y a pas d'alternative gratuite plus grosse sur Render.
- **Images en 403** : le bucket Supabase doit être public.
