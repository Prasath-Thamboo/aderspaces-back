export const PRODUCTS_INDEX = "products"

function getMeiliConfig() {
  return {
    host: process.env.MEILISEARCH_HOST || "http://localhost:7700",
    apiKey: process.env.MEILISEARCH_API_KEY || "",
  }
}

function meiliHeaders(): Record<string, string> {
  const { apiKey } = getMeiliConfig()
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  }
}

export async function meiliIndexDocuments(index: string, documents: object[]): Promise<void> {
  const { host } = getMeiliConfig()
  await fetch(`${host}/indexes/${index}/documents`, {
    method: "POST",
    headers: meiliHeaders(),
    body: JSON.stringify(documents),
  })
}

export async function meiliDeleteDocument(index: string, id: string): Promise<void> {
  const { host } = getMeiliConfig()
  await fetch(`${host}/indexes/${index}/documents/${id}`, {
    method: "DELETE",
    headers: meiliHeaders(),
  })
}

export async function meiliSearch(
  index: string,
  q: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<{ hits: object[]; estimatedTotalHits: number }> {
  const { host } = getMeiliConfig()
  const res = await fetch(`${host}/indexes/${index}/search`, {
    method: "POST",
    headers: meiliHeaders(),
    body: JSON.stringify({ q, limit: opts.limit ?? 20, offset: opts.offset ?? 0 }),
  })
  if (!res.ok) throw new Error(`MeiliSearch error: ${res.status}`)
  return res.json() as Promise<{ hits: object[]; estimatedTotalHits: number }>
}

export async function meiliUpdateSettings(index: string, settings: object): Promise<void> {
  const { host } = getMeiliConfig()
  await fetch(`${host}/indexes/${index}/settings`, {
    method: "PATCH",
    headers: meiliHeaders(),
    body: JSON.stringify(settings),
  })
}
