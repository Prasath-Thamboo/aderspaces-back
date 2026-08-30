import { defineConfig, loadEnv } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

export default defineConfig({
  admin: {
    backendUrl: process.env.BACKEND_URL || "http://localhost:9000",
  },

  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,

    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret-change-in-prod",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret-change-in-prod",
    },
  },

  modules: [
    // ─── Stockage fichiers / images (MinIO en dev, R2/S3 en prod) ───
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/file-s3",
            id: "minio",
            options: {
              file_url: process.env.MINIO_PUBLIC_URL,
              access_key_id: process.env.MINIO_ACCESS_KEY,
              secret_access_key: process.env.MINIO_SECRET_KEY,
              region: process.env.MINIO_REGION || "us-east-1",
              bucket: process.env.MINIO_BUCKET || "aderspace",
              endpoint: process.env.MINIO_ENDPOINT,
              // Requis pour MinIO (URLs path-style, pas virtual-hosted)
              additional_client_config: {
                forcePathStyle: true,
              },
            },
          },
        ],
      },
    },

    // ─── Paiement ───
    // Le module est toujours chargé : il fournit `pp_system_default` (paiement
    // manuel) qui permet de tester le tunnel de commande sans Stripe.
    // Le provider Stripe (SCA / 3D Secure) s'ajoute automatiquement dès que
    // STRIPE_SECRET_KEY est renseignée dans .env — rien d'autre à faire.
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          ...(process.env.STRIPE_SECRET_KEY
            ? [
                {
                  resolve: "@medusajs/payment-stripe",
                  id: "stripe",
                  options: {
                    apiKey: process.env.STRIPE_SECRET_KEY,
                    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
                    // Capture automatique + méthodes de paiement dynamiques (3DS)
                    capture: true,
                    automatic_payment_methods: true,
                  },
                },
              ]
            : []),
        ],
      },
    },

    // ─── Fulfillment manuel (placeholder Phase 2) ───
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            resolve: "@medusajs/fulfillment-manual",
            id: "manual",
          },
        ],
      },
    },

    // ─── Modules métier Aderspace ───
    // Avis produits (achat vérifié + modération admin).
    { resolve: "./src/modules/product-review" },
    // Compatibilité entre produits, pilotable depuis l'admin.
    { resolve: "./src/modules/product-compatibility" },
    // Factures PDF conformes (numérotation séquentielle FR).
    { resolve: "./src/modules/invoice" },

    // ─── Notifications email Brevo ───
    ...(process.env.BREVO_API_KEY && !process.env.BREVO_API_KEY.startsWith("VOTRE") ? [{
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [{
          resolve: "./src/modules/brevo",
          id: "brevo",
          options: {
            channels: ["email"],
            apiKey: process.env.BREVO_API_KEY,
            from: { email: process.env.BREVO_FROM_EMAIL || "noreply@aderspace.fr", name: process.env.BREVO_FROM_NAME || "Aderspace" },
          },
        }],
      },
    }] : []),
  ],
})
