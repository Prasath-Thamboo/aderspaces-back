import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createShippingProfilesWorkflow,
  createShippingOptionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateRegionsWorkflow,
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"

// Providers résolus par les modules (cf. medusa-config.ts)
const MANUAL_FULFILLMENT_PROVIDER = "manual_manual"
const SYSTEM_PAYMENT_PROVIDER = "pp_system_default"
const STRIPE_PAYMENT_PROVIDER = "pp_stripe_stripe"

export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve("logger")

  const productService = container.resolve(Modules.PRODUCT)
  const regionService = container.resolve(Modules.REGION)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const storeService = container.resolve(Modules.STORE)
  const taxService = container.resolve(Modules.TAX)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info("Début du seed Aderspace…")

  // ─── 1. Sales Channel ───
  logger.info("Canal de vente…")
  const existingChannels = await salesChannelService.listSalesChannels({ name: "Boutique en ligne" })
  const defaultChannel = existingChannels.length > 0
    ? existingChannels[0]
    : (await salesChannelService.createSalesChannels([
        { name: "Boutique en ligne", description: "Canal principal Aderspace", is_disabled: false },
      ]))[0]

  // ─── 2. Store ───
  const stores = await storeService.listStores()
  if (stores.length > 0) {
    await storeService.updateStores(stores[0].id, {
      name: "Aderspace",
      default_sales_channel_id: defaultChannel.id,
    })
  }

  // ─── 2b. Clé publiable API (storefront) + lien canal de vente ───
  logger.info("Clé publiable API…")
  const apiKeyService = container.resolve(Modules.API_KEY)
  const existingPublishableKeys = await apiKeyService.listApiKeys({ type: "publishable" })
  let publishableKey =
    existingPublishableKeys.find((k) => k.title === "Storefront Aderspace") ??
    existingPublishableKeys[0]

  if (!publishableKey) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          { title: "Storefront Aderspace", type: "publishable", created_by: "seed" },
        ],
      },
    })
    publishableKey = result[0]
  }

  // La clé publiable doit être liée à EXACTEMENT un canal ("Boutique en ligne").
  // Si elle pointe aussi vers le "Default Sales Channel" auto-créé par Medusa,
  // `POST /store/carts` échoue ("multiple associated sales channels").
  {
    const { data: keyGraph } = await query.graph({
      entity: "api_key",
      fields: ["id", "sales_channels.id"],
      filters: { id: publishableKey.id },
    })
    const linkedChannelIds: string[] = (keyGraph[0]?.sales_channels ?? []).map((c: any) => c.id)
    const removeIds = linkedChannelIds.filter((id) => id !== defaultChannel.id)
    const addIds = linkedChannelIds.includes(defaultChannel.id) ? [] : [defaultChannel.id]
    if (addIds.length > 0 || removeIds.length > 0) {
      await linkSalesChannelsToApiKeyWorkflow(container).run({
        input: { id: publishableKey.id, add: addIds, remove: removeIds },
      })
    }
  }

  // ─── 3. Région France (EUR) ───
  logger.info("Région France…")
  const existingRegions = await regionService.listRegions({ name: "France" })
  if (existingRegions.length === 0) {
    await regionService.createRegions([
      { name: "France", currency_code: "eur", countries: ["fr"] },
    ])
  }

  // ─── 4. TVA France (20% standard) ───
  logger.info("TVA France…")
  const taxProviders = await taxService.listTaxProviders()
  // Provider système (`tp_system`) : sans lui sur la région, l'ajout au panier
  // plante dans le calcul de TVA ("Unable to retrieve the tax provider with id: null").
  const taxProviderId =
    taxProviders.find((p: any) => p.id === "tp_system" || p.id.endsWith("_system"))?.id ??
    taxProviders[0]?.id
  const existingTaxRegions = await taxService.listTaxRegions(
    { country_code: "fr" },
    { select: ["id", "provider_id"] }
  )
  if (existingTaxRegions.length === 0) {
    if (taxProviderId) {
      await taxService.createTaxRegions([
        {
          country_code: "fr",
          provider_id: taxProviderId,
          default_tax_rate: {
            name: "TVA France standard",
            rate: 20,
            code: "TVA_FR_20",
          },
        },
      ])
    }
  } else if (taxProviderId) {
    // Rattrape une région créée sans provider par une version antérieure du seed.
    const withoutProvider = existingTaxRegions.filter((r: any) => !r.provider_id)
    for (const r of withoutProvider) {
      await taxService.updateTaxRegions({
        selector: { id: r.id },
        data: { provider_id: taxProviderId },
      } as any)
    }
  }

  // ─── 5. Entrepôt principal ───
  logger.info("Entrepôt principal…")
  const existingLocations = await stockLocationService.listStockLocations({ name: "Entrepôt principal" })
  if (existingLocations.length === 0) {
    await stockLocationService.createStockLocations([
      {
        name: "Entrepôt principal",
        address: {
          address_1: "1 Rue de Rivoli",
          city: "Paris",
          country_code: "FR",
          postal_code: "75001",
        },
      },
    ])
  }
  const [stockLocation] = await stockLocationService.listStockLocations({ name: "Entrepôt principal" })
  const [franceRegion] = await regionService.listRegions({ name: "France" })

  // ─── 5b. Livraison : profil, zone France, options d'expédition ───
  // Nécessaire pour que le checkout propose une méthode de livraison.
  logger.info("Livraison (profil / zone / options)…")
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  // Profil d'expédition par défaut
  let [shippingProfile] = await fulfillmentService.listShippingProfiles({ type: "default" })
  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Profil par défaut", type: "default" }] },
    })
    shippingProfile = result[0]
  }

  // Fulfillment set + zone de service France (une seule fois)
  let [fulfillmentSet] = await fulfillmentService.listFulfillmentSets(
    { name: "Livraison Aderspace" },
    { relations: ["service_zones"] }
  )
  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillmentService.createFulfillmentSets({
      name: "Livraison Aderspace",
      type: "shipping",
      service_zones: [
        { name: "France métropolitaine", geo_zones: [{ country_code: "fr", type: "country" }] },
      ],
    })
    // Rattacher l'entrepôt au fulfillment set + au provider manuel
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: MANUAL_FULFILLMENT_PROVIDER },
    })
  }
  const serviceZone = fulfillmentSet.service_zones[0]

  // Rattacher l'entrepôt au canal de vente (stock visible pour le storefront)
  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [defaultChannel.id] },
  }).catch(() => { /* déjà lié */ })

  // Options d'expédition (prix TTC, même échelle que les produits : montant × 100)
  const existingOptions = await fulfillmentService.listShippingOptions({
    shipping_profile_id: shippingProfile.id,
  })
  const optionNames = new Set(existingOptions.map((o: any) => o.name))
  const optionsToCreate = [
    {
      name: "Livraison standard",
      price: 690,
      type: { label: "Standard", description: "Livraison à domicile sous 3 à 5 jours ouvrés", code: "standard" },
    },
    {
      name: "Livraison mobilier volumineux",
      price: 4900,
      type: { label: "Volumineux", description: "Livraison sur rendez-vous pour les articles volumineux", code: "bulky" },
    },
  ].filter((o) => !optionNames.has(o.name))

  for (const opt of optionsToCreate) {
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: opt.name,
          price_type: "flat",
          provider_id: MANUAL_FULFILLMENT_PROVIDER,
          service_zone_id: serviceZone.id,
          shipping_profile_id: shippingProfile.id,
          type: opt.type,
          prices: [
            { currency_code: "eur", amount: opt.price },
            ...(franceRegion ? [{ region_id: franceRegion.id, amount: opt.price }] : []),
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })
  }

  // ─── 5c. Fournisseurs de paiement de la région France ───
  // pp_system_default : toujours dispo (paiement manuel, permet de tester le tunnel sans Stripe).
  // pp_stripe_stripe : ajouté automatiquement dès que STRIPE_SECRET_KEY est renseignée.
  if (franceRegion) {
    const paymentProviders = [SYSTEM_PAYMENT_PROVIDER]
    if (process.env.STRIPE_SECRET_KEY) {
      paymentProviders.push(STRIPE_PAYMENT_PROVIDER)
    }
    logger.info(`Fournisseurs de paiement région France : ${paymentProviders.join(", ")}`)
    await updateRegionsWorkflow(container).run({
      input: {
        selector: { id: franceRegion.id },
        update: { payment_providers: paymentProviders, is_tax_inclusive: true },
      },
    })
  }

  // ─── 6. Catégories de produits ───
  logger.info("Catégories…")
  const existingCats = await productService.listProductCategories({}, { select: ["id", "handle", "name"] })
  const catHandles = existingCats.map((c: any) => c.handle)

  const catsToCreate = [
    { name: "Mobilier Moderne", handle: "mobilier-moderne", description: "Meubles design scandinave et contemporain pour votre intérieur", is_active: true, is_internal: false, rank: 0 },
    { name: "Imprimantes", handle: "imprimantes", description: "Imprimantes laser et jet d'encre pour la maison et le bureau", is_active: true, is_internal: false, rank: 1 },
    { name: "Encre & Cartouches", handle: "encre-cartouches", description: "Cartouches d'encre et toners compatibles pour toutes marques", is_active: true, is_internal: false, rank: 2 },
  ].filter((c) => !catHandles.includes(c.handle))

  if (catsToCreate.length > 0) {
    await productService.createProductCategories(catsToCreate)
  }

  const allCats = await productService.listProductCategories({}, { select: ["id", "handle", "name"] })
  const catMobilier = allCats.find((c: any) => c.handle === "mobilier-moderne")!
  const catImprimantes = allCats.find((c: any) => c.handle === "imprimantes")!
  const catEncre = allCats.find((c: any) => c.handle === "encre-cartouches")!

  // ─── 7–9. Produits ───
  logger.info("Produits…")
  const existingProducts = await productService.listProducts({})
  const existingHandles = new Set(existingProducts.map((p: any) => p.handle))

  const productsToCreate = [
    // Mobilier
    {
      title: "Canapé Scandinave 3 Places",
      handle: "canape-scandinave-3-places",
      description: "Canapé 3 places au style scandinave épuré, structure en bois de hêtre massif, assise confortable en mousse haute densité. Parfait pour votre salon.",
      category_ids: [catMobilier.id],
      status: "published",
      metadata: { longueur_cm: 220, largeur_cm: 90, hauteur_cm: 85, poids_kg: 45, type_livraison: "volumineux" },
      options: [{ title: "Couleur", values: ["Gris chiné", "Beige naturel"] }],
      variants: [
        { title: "Gris chiné", sku: "CAP-SCAN-3P-GRS", allow_backorder: false, manage_inventory: true, options: { Couleur: "Gris chiné" }, prices: [{ amount: 79900, currency_code: "eur" }] },
        { title: "Beige naturel", sku: "CAP-SCAN-3P-BGE", allow_backorder: false, manage_inventory: true, options: { Couleur: "Beige naturel" }, prices: [{ amount: 79900, currency_code: "eur" }] },
      ],
    },
    {
      title: "Table Basse Chêne Naturel",
      handle: "table-basse-chene-naturel",
      description: "Table basse en chêne massif huilé, pieds en acier noir. Dimensions 120×60×40 cm. Fabrication artisanale française.",
      category_ids: [catMobilier.id],
      status: "published",
      metadata: { longueur_cm: 120, largeur_cm: 60, hauteur_cm: 40, poids_kg: 18, type_livraison: "standard" },
      options: [{ title: "Finition", values: ["Huilé naturel", "Blanchi"] }],
      variants: [
        { title: "Huilé naturel", sku: "TAB-BAS-CHE-NAT", allow_backorder: false, manage_inventory: true, options: { Finition: "Huilé naturel" }, prices: [{ amount: 29900, currency_code: "eur" }] },
        { title: "Blanchi", sku: "TAB-BAS-CHE-BLA", allow_backorder: false, manage_inventory: true, options: { Finition: "Blanchi" }, prices: [{ amount: 32900, currency_code: "eur" }] },
      ],
    },
    {
      title: "Bibliothèque Modulaire",
      handle: "bibliotheque-modulaire",
      description: "Bibliothèque modulaire à composer selon vos besoins, 5 étagères réglables, matière MDF laqué. Hauteur 180 cm.",
      category_ids: [catMobilier.id],
      status: "published",
      metadata: { longueur_cm: 80, largeur_cm: 30, hauteur_cm: 180, poids_kg: 35, type_livraison: "volumineux" },
      options: [{ title: "Coloris", values: ["Blanc mat", "Noir mat", "Chêne"] }],
      variants: [
        { title: "Blanc mat", sku: "BIB-MOD-BLA", allow_backorder: false, manage_inventory: true, options: { Coloris: "Blanc mat" }, prices: [{ amount: 44900, currency_code: "eur" }] },
        { title: "Noir mat", sku: "BIB-MOD-NOI", allow_backorder: false, manage_inventory: true, options: { Coloris: "Noir mat" }, prices: [{ amount: 44900, currency_code: "eur" }] },
        { title: "Chêne", sku: "BIB-MOD-CHE", allow_backorder: false, manage_inventory: true, options: { Coloris: "Chêne" }, prices: [{ amount: 47900, currency_code: "eur" }] },
      ],
    },
    {
      title: "Fauteuil Lounge Velours",
      handle: "fauteuil-lounge-velours",
      description: "Fauteuil lounge enveloppant en velours doux, pied pivotant en laiton brossé. Idéal pour un coin lecture.",
      category_ids: [catMobilier.id],
      status: "published",
      metadata: { longueur_cm: 80, largeur_cm: 85, hauteur_cm: 90, poids_kg: 22, type_livraison: "standard" },
      options: [{ title: "Coloris", values: ["Vert forêt", "Terracotta", "Bleu canard", "Gris perle"] }],
      variants: [
        { title: "Vert forêt", sku: "FAU-LOU-VEL-VRT", allow_backorder: false, manage_inventory: true, options: { Coloris: "Vert forêt" }, prices: [{ amount: 34900, currency_code: "eur" }] },
        { title: "Terracotta", sku: "FAU-LOU-VEL-TER", allow_backorder: false, manage_inventory: true, options: { Coloris: "Terracotta" }, prices: [{ amount: 34900, currency_code: "eur" }] },
        { title: "Bleu canard", sku: "FAU-LOU-VEL-BLE", allow_backorder: false, manage_inventory: true, options: { Coloris: "Bleu canard" }, prices: [{ amount: 34900, currency_code: "eur" }] },
      ],
    },
    // Imprimantes
    {
      title: "HP LaserJet Pro M404dn",
      handle: "hp-laserjet-pro-m404dn",
      description: "Imprimante laser monochrome professionnelle, recto-verso automatique, 38 ppm, réseau Ethernet intégré. Idéale pour les PME.",
      category_ids: [catImprimantes.id],
      status: "published",
      metadata: { marque: "HP", type_impression: "laser", couleur: false, ppm: 38, connectivite: ["USB", "Ethernet"] },
      options: [{ title: "Référence", values: ["Standard"] }],
      variants: [
        { title: "Standard", sku: "HP-LJ-PRO-M404DN", allow_backorder: false, manage_inventory: true, options: { Référence: "Standard" }, prices: [{ amount: 29900, currency_code: "eur" }] },
      ],
    },
    {
      title: "Epson EcoTank ET-2850",
      handle: "epson-ecotank-et-2850",
      description: "Imprimante jet d'encre multifonction couleur avec réservoirs rechargeables. Économique sur le long terme, Wi-Fi intégré.",
      category_ids: [catImprimantes.id],
      status: "published",
      metadata: { marque: "Epson", type_impression: "jet_encre", couleur: true, ppm: 15, connectivite: ["USB", "Wi-Fi"], type_encre: "ecotank" },
      options: [{ title: "Référence", values: ["Standard"] }],
      variants: [
        { title: "Standard", sku: "EPS-ECOTANK-ET2850", allow_backorder: false, manage_inventory: true, options: { Référence: "Standard" }, prices: [{ amount: 34900, currency_code: "eur" }] },
      ],
    },
    {
      title: "Canon PIXMA TS8350a",
      handle: "canon-pixma-ts8350a",
      description: "Imprimante photo couleur 6 encres, Wi-Fi et Bluetooth, compatible AirPrint. Qualité photo professionnelle à domicile.",
      category_ids: [catImprimantes.id],
      status: "published",
      metadata: { marque: "Canon", type_impression: "jet_encre", couleur: true, connectivite: ["USB", "Wi-Fi", "Bluetooth"], type_encre: "cartouche" },
      options: [{ title: "Coloris", values: ["Noir", "Blanc"] }],
      variants: [
        { title: "Noir", sku: "CAN-PIXMA-TS8350A-NOI", allow_backorder: false, manage_inventory: true, options: { Coloris: "Noir" }, prices: [{ amount: 12900, currency_code: "eur" }] },
        { title: "Blanc", sku: "CAN-PIXMA-TS8350A-BLA", allow_backorder: false, manage_inventory: true, options: { Coloris: "Blanc" }, prices: [{ amount: 12900, currency_code: "eur" }] },
      ],
    },
    {
      title: "Brother HL-L3220CW",
      handle: "brother-hl-l3220cw",
      description: "Imprimante laser couleur compacte, Wi-Fi, 18 ppm. Toner de démarrage inclus, idéale pour une utilisation personnelle intensive.",
      category_ids: [catImprimantes.id],
      status: "published",
      metadata: { marque: "Brother", type_impression: "laser", couleur: true, ppm: 18, connectivite: ["USB", "Wi-Fi"], type_encre: "toner" },
      options: [{ title: "Référence", values: ["Standard"] }],
      variants: [
        { title: "Standard", sku: "BRO-HL-L3220CW", allow_backorder: false, manage_inventory: true, options: { Référence: "Standard" }, prices: [{ amount: 24900, currency_code: "eur" }] },
      ],
    },
    // Encre & Cartouches
    {
      title: "Cartouche HP 305XL Noir",
      handle: "cartouche-hp-305xl-noir",
      description: "Cartouche d'encre noire haute capacité HP 305XL. Compatible HP DeskJet 2700, 4100 séries. ~240 pages.",
      category_ids: [catEncre.id],
      status: "published",
      metadata: { marque: "HP", reference: "3YM62AE", couleur: "noir", capacite: "xl", pages_estimees: 240, compatible_modeles: ["HP DeskJet 2700", "HP DeskJet 4100", "HP ENVY 6000"] },
      options: [{ title: "Référence", values: ["HP 305XL Noir"] }],
      variants: [
        { title: "HP 305XL Noir", sku: "HP-305XL-NOI", allow_backorder: false, manage_inventory: true, options: { Référence: "HP 305XL Noir" }, prices: [{ amount: 1999, currency_code: "eur" }] },
      ],
    },
    {
      title: "Cartouche HP 305XL Couleur",
      handle: "cartouche-hp-305xl-couleur",
      description: "Cartouche d'encre tricolore haute capacité HP 305XL. Compatible HP DeskJet 2700, 4100 séries. ~200 pages.",
      category_ids: [catEncre.id],
      status: "published",
      metadata: { marque: "HP", reference: "3YM63AE", couleur: "couleur", capacite: "xl", pages_estimees: 200, compatible_modeles: ["HP DeskJet 2700", "HP DeskJet 4100", "HP ENVY 6000"] },
      options: [{ title: "Référence", values: ["HP 305XL Couleur"] }],
      variants: [
        { title: "HP 305XL Couleur", sku: "HP-305XL-COL", allow_backorder: false, manage_inventory: true, options: { Référence: "HP 305XL Couleur" }, prices: [{ amount: 2199, currency_code: "eur" }] },
      ],
    },
    {
      title: "Bouteille Epson EcoTank 103 Noir",
      handle: "bouteille-epson-ecotank-103-noir",
      description: "Bouteille d'encre noire Epson EcoTank série 103. Rendement très élevé : jusqu'à 4 500 pages. Compatible ET-2850, ET-5150.",
      category_ids: [catEncre.id],
      status: "published",
      metadata: { marque: "Epson", reference: "C13T00S14A", couleur: "noir", type: "bouteille", pages_estimees: 4500, compatible_modeles: ["Epson EcoTank ET-2850", "Epson EcoTank ET-5150"] },
      options: [{ title: "Référence", values: ["EcoTank 103 Noir"] }],
      variants: [
        { title: "EcoTank 103 Noir", sku: "EPS-ECOTANK-103-NOI", allow_backorder: false, manage_inventory: true, options: { Référence: "EcoTank 103 Noir" }, prices: [{ amount: 1499, currency_code: "eur" }] },
      ],
    },
    {
      title: "Pack Epson EcoTank 103 — 3 Couleurs",
      handle: "pack-epson-ecotank-103-couleurs",
      description: "Pack 3 bouteilles EcoTank 103 : Cyan, Magenta, Jaune. Jusqu'à 7 500 pages couleur. Compatible ET-2850, ET-5150.",
      category_ids: [catEncre.id],
      status: "published",
      metadata: { marque: "Epson", reference: "C13T00S54A", type: "pack_bouteilles", pages_estimees: 7500, compatible_modeles: ["Epson EcoTank ET-2850", "Epson EcoTank ET-5150"] },
      options: [{ title: "Référence", values: ["EcoTank 103 Pack 3 couleurs"] }],
      variants: [
        { title: "EcoTank 103 Pack 3 couleurs", sku: "EPS-ECOTANK-103-PACK", allow_backorder: false, manage_inventory: true, options: { Référence: "EcoTank 103 Pack 3 couleurs" }, prices: [{ amount: 3999, currency_code: "eur" }] },
      ],
    },
  ].filter((p) => !existingHandles.has(p.handle))

  if (productsToCreate.length > 0) {
    const created = await productService.createProducts(productsToCreate as any)

    // Rattacher les nouveaux produits au canal de vente (sinon invisibles côté storefront)
    const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)
    await remoteLink.create(
      created.map((product: any) => ({
        [Modules.PRODUCT]: { product_id: product.id },
        [Modules.SALES_CHANNEL]: { sales_channel_id: defaultChannel.id },
      }))
    )
  }

  logger.info("✓ Seed terminé avec succès !")
  logger.info("  → Canal de vente : Boutique en ligne")
  logger.info("  → Région : France (EUR) avec TVA 20%")
  logger.info("  → 3 catégories")
  logger.info("  → 12 produits (4 mobilier, 4 imprimantes, 4 encres)")
  logger.info(`  → Clé publiable (frontend/.env NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY) : ${publishableKey.token}`)
  logger.info("")
  logger.info("Pour créer le compte admin, exécutez :")
  logger.info("  medusa user -e admin@aderspace.fr -p VotreMotDePasse")
}
