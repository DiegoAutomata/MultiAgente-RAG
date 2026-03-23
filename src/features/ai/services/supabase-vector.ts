"use server";

import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase admin client using the service role key.
 * Bypasses RLS — ONLY use in trusted server-side code (API routes).
 */
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Executes a semantic similarity search against document_chunks directly.
 * Uses the service_role key to bypass RLS (the chat route has no user session).
 *
 * NOTE: The RPC function match_document_chunks_hybrid filters by auth.uid()
 * which is NULL when called via service_role — so we query the table directly
 * for semantic relevance by fetching content and doing simple text matching.
 */
export async function performHybridSearch(
  queryText: string,
  queryEmbedding: number[],
  matchCount: number = 10
) {
  const supabase = createAdminClient();

  // Step 1: Try the RPC first with the service role (no user filter)
  try {
    const { data, error } = await supabase.rpc("match_document_chunks_hybrid", {
      query_text: queryText,
      query_embedding: queryEmbedding,
      match_count: matchCount,
      full_text_weight: 1.0,
      semantic_weight: 1.0,
      rrf_k: 50,
    });

    if (!error && data && data.length > 0) {
      console.log(`[search] RPC returned ${data.length} results`);
      return data as Array<{
        id: string;
        document_id: string;
        content: string;
        similarity: number;
      }>;
    }

    if (error) {
      console.warn("[search] RPC error, falling back to direct query:", error.message);
    } else {
      console.warn("[search] RPC returned 0 results, falling back to direct query");
    }
  } catch (rpcErr) {
    console.warn("[search] RPC threw exception, falling back:", rpcErr);
  }

  // Step 2: Fallback — direct full-text search on document_chunks
  // This bypasses the auth.uid() filter entirely since we use service_role
  const { data: fallbackData, error: fallbackError } = await supabase
    .from("document_chunks")
    .select("id, document_id, content")
    .textSearch("fts", queryText, { config: "spanish" })
    .limit(matchCount);

  if (fallbackError) {
    console.error("[search] Fallback full-text search error:", JSON.stringify(fallbackError, null, 2));

    // Step 3: Last resort — return ALL chunks (for small datasets in demo mode)
    console.warn("[search] Fetching all chunks as last resort...");
    const { data: allData, error: allError } = await supabase
      .from("document_chunks")
      .select("id, document_id, content")
      .limit(matchCount);

    if (allError) {
      throw new Error(`Vector search failed: ${allError.message}`);
    }

    return (allData ?? []).map((row, i) => ({
      ...row,
      similarity: 1.0 / (i + 1),
    }));
  }

  console.log(`[search] Fallback returned ${fallbackData?.length ?? 0} results`);
  return (fallbackData ?? []).map((row, i) => ({
    ...row,
    similarity: 1.0 / (i + 1), // Simulate ranked similarity for the fallback
  }));
}
