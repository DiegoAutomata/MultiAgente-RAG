import { performHybridSearch } from "./supabase-vector";

class EmbeddingPipeline {
  static task = 'feature-extraction';
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance: any = null;

  static async getInstance() {
    if (this.instance === null) {
      // Dynamic import: runs lazily inside an async function so any load
      // failure (WASM/ONNX missing in serverless) is caught by the caller's
      // try/catch instead of crashing the whole module at import time.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      // @ts-ignore — @xenova/transformers has no official TS types
      const { pipeline } = await import('@xenova/transformers');
      this.instance = await pipeline(this.task as any, this.model);
    }
    return this.instance;
  }
}

async function generateQueryEmbedding(text: string): Promise<number[]> {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    console.warn("[embedding] Empty or invalid text, returning fallback vector");
    return new Array(384).fill(1e-7);
  }
  try {
    const embedder = await EmbeddingPipeline.getInstance();
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (error) {
    console.error("[embedding] Local embedding failed:", error);
    return new Array(384).fill(1e-7);
  }
}

/**
 * Investigator Agent: Generates query embedding and performs hybrid search.
 * Returns retrieved context as a formatted string for the LLM.
 */
export async function investigatorAgent(query: string, userId?: string): Promise<string> {
  const start = Date.now();
  console.log(`[investigator] Query: "${query}" (user: ${userId ?? 'anonymous'})`);

  try {
    const queryEmbedding = await generateQueryEmbedding(query);
    const results = await performHybridSearch(query, queryEmbedding, 15, userId);

    console.log(`[investigator] ${results.length} results in ${Date.now() - start}ms`);

    if (results.length === 0) {
      return "No se encontraron fragmentos relevantes en la base de datos para esta consulta.";
    }

    return results
      .slice(0, 15)
      .map((r, i) => `[Doc ${i + 1}]:\n${r.content}`)
      .join("\n\n---\n\n");
  } catch (error) {
    console.error("[investigator] Error during retrieval:", error);
    return "Ocurrió un error al intentar consultar la base de datos de documentos.";
  }
}
