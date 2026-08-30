import { defineMiddlewares, authenticate } from "@medusajs/framework/http"

/**
 * Les routes `/admin/*` personnalisées sont déjà protégées automatiquement
 * par Medusa. On force ici l'authentification client sur les routes `/store`
 * qui doivent rejeter les requêtes anonymes.
 */
export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/products/:id/reviews",
      method: "POST",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/orders/:id/invoice",
      method: "GET",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
  ],
})
