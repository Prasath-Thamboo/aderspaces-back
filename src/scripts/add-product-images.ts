import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { readFile } from "fs/promises"
import path from "path"

/**
 * Associe des images aux produits meubles à partir des fichiers déposés dans
 * `frontend/public/images/`. Les fichiers sont uploadés via le module File
 * (MinIO en dev, R2/S3 en prod — cf. medusa-config.ts), donc les images
 * deviennent de vraies médias Medusa (rien de couplé au storefront).
 *
 *   pnpm exec medusa exec ./src/scripts/add-product-images.ts
 *   pnpm exec medusa exec ./src/scripts/add-product-images.ts --force   # ré-uploade même si le produit a déjà des images
 *
 * Le 1er fichier de chaque liste sert de `thumbnail`.
 */

// Dossier source : le `public/images` du storefront (repo voisin).
const IMAGES_DIR = path.resolve(__dirname, "../../../frontend/public/images")

// handle produit -> fichiers (ordre = ordre d'affichage ; [0] = vignette)
const PRODUCT_IMAGES: Record<string, string[]> = {
  "canape-scandinave-3-places": ["medias (1).jpg", "medias (7).jpg", "medias (3).jpg"],
  "table-basse-chene-naturel": ["Produit (3).png", "medias (2).jpg", "medias (4).jpg"],
  "bibliotheque-modulaire": ["Produit (1).png", "comode.jpg"],
  "fauteuil-lounge-velours": ["Produit (2).png", "medias (6).jpg", "medias (5).jpg"],
}

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
}

// "Produit (1).png" -> "produit-1.png"
const slugifyFilename = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase()
  const base = path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `${base}${ext}`
}

export default async function addProductImages({ container, args }: ExecArgs) {
  const logger = container.resolve("logger")
  const productService = container.resolve(Modules.PRODUCT)
  const fileService = container.resolve(Modules.FILE)

  const force = (args ?? []).includes("--force")

  for (const [handle, files] of Object.entries(PRODUCT_IMAGES)) {
    const [product] = await productService.listProducts(
      { handle },
      { select: ["id", "title", "thumbnail"], relations: ["images"] }
    )

    if (!product) {
      logger.warn(`Produit introuvable pour le handle "${handle}" — ignoré.`)
      continue
    }

    if (!force && (product.images?.length ?? 0) > 0) {
      logger.info(
        `"${product.title}" a déjà ${product.images!.length} image(s) — ignoré (utilise --force pour réécrire).`
      )
      continue
    }

    const uploadedUrls: string[] = []
    for (const filename of files) {
      const abs = path.join(IMAGES_DIR, filename)
      let content: Buffer
      try {
        content = await readFile(abs)
      } catch {
        logger.warn(`  x fichier absent : ${abs} — ignoré.`)
        continue
      }

      const ext = path.extname(filename).toLowerCase()
      const [uploaded] = await fileService.createFiles([
        {
          filename: `produits/${handle}/${slugifyFilename(filename)}`,
          mimeType: MIME_BY_EXT[ext] ?? "application/octet-stream",
          content: content.toString("base64"),
        },
      ])
      uploadedUrls.push(uploaded.url)
      logger.info(`  ok ${filename} -> ${uploaded.url}`)
    }

    if (uploadedUrls.length === 0) {
      logger.warn(`Aucune image uploadée pour "${product.title}" — produit non modifié.`)
      continue
    }

    await updateProductsWorkflow(container).run({
      input: {
        products: [
          {
            id: product.id,
            images: uploadedUrls.map((url) => ({ url })),
            thumbnail: uploadedUrls[0],
          },
        ],
      },
    })
    logger.info(`-> "${product.title}" : ${uploadedUrls.length} image(s), thumbnail = ${uploadedUrls[0]}`)
  }

  logger.info("add-product-images : terminé.")
}
