import { defineConfig, loadEnv } from "@medusajs/framework/config"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

export default defineConfig({
  admin: {
    // Admin disponible à http://localhost:9000/app
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
              bucket: process.env.MINIO_BUCKET || "maisonprint",
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

    // ─── Paiement Stripe (SCA / 3D Secure) ───
    // Activer une fois les clés Stripe renseignées (Phase 2)
    ...(process.env.STRIPE_SECRET_KEY
      ? [
          {
            resolve: "@medusajs/medusa/payment",
            options: {
              providers: [
                {
                  resolve: "@medusajs/payment-stripe",
                  id: "stripe",
                  options: {
                    apiKey: process.env.STRIPE_SECRET_KEY,
                    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
                    // Forcer la capture automatique + 3DS
                    capture: true,
                    automatic_payment_methods: true,
                  },
                },
              ],
            },
          },
        ]
      : []),

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

    // ─── Notifications email Brevo (Phase 2) ───
    // Le provider Brevo sera un module custom dans src/modules/brevo
    // ...(process.env.BREVO_API_KEY ? [{
    //   resolve: "@medusajs/medusa/notification",
    //   options: {
    //     providers: [{
    //       resolve: "./src/modules/brevo",
    //       id: "brevo",
    //       options: {
    //         channels: ["email"],
    //         apiKey: process.env.BREVO_API_KEY,
    //         from: { email: process.env.BREVO_FROM_EMAIL, name: process.env.BREVO_FROM_NAME },
    //       },
    //     }],
    //   },
    // }] : []),
  ],
})
