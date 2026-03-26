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
 * Performs a hybrid search against document_chunks.
 * Uses the service_role key to bypass RLS.
 * 
 * Strategy:
 * 1. Try RPC function (if it exists and works)
 * 2. Fallback: Direct table query with text matching (ilike)
 * 3. Last resort: Fetch all chunks ordered by index
 */
export async function performHybridSearch(
  queryText: string,
  queryEmbedding: number[],
  matchCount: number = 10
) {
  const supabase = createAdminClient();

  // Strategy 1: Try the RPC function
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
      console.warn("[search] RPC failed:", error.message);
    } else {
      console.warn("[search] RPC returned 0 results, trying direct search");
    }
  } catch (rpcErr) {
    console.warn("[search] RPC threw exception:", rpcErr);
  }

  // Strategy 2: Direct text search using ilike (works regardless of FTS config)
  // Build search terms from the query, ignoring common stop words
  const searchTerms = queryText
    .toLowerCase()
    .replace(/[¿?¡!]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 3) // Only useful keywords
    .slice(0, 8); 

  console.log("[search] Falling back to direct search with terms:", searchTerms);

  const matchedChunks: Map<string, any> = new Map();

  for (const term of searchTerms) {
    const { data: matchData } = await supabase
      .from("document_chunks")
      .select("id, document_id, content")
      .ilike("content", `%${term}%`)
      .limit(5);

    if (matchData) {
      matchData.forEach(row => {
        if (!matchedChunks.has(row.id)) {
          matchedChunks.set(row.id, { ...row, score: 1 });
        } else {
          matchedChunks.get(row.id).score += 1;
        }
      });
    }
  }

  if (matchedChunks.size > 0) {
    const results = Array.from(matchedChunks.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, matchCount);
    
    console.log(`[search] Direct search aggregated ${results.length} results`);
    return results.map((r, i) => ({
      ...r,
      similarity: 0.9 / (i + 1), // Standard similarity score for fallback
    }));
  }

  // Strategy 3: Last resort — return recent chunks (for small datasets in demo mode)
  console.warn("[search] No keyword matches. Fetching recent chunks as fallback...");
  const { data: allData, error: allError } = await supabase
    .from("document_chunks")
    .select("id, document_id, content")
    .order("chunk_index", { ascending: true })
    .limit(matchCount);

  if (allError) {
    console.error("[search] All search strategies failed:", allError.message);
    return [];
  }

  console.log(`[search] Fallback returned ${allData?.length ?? 0} chunks`);
  return (allData ?? []).map((row, i) => ({
    ...row,
    similarity: 1.0 / (i + 1),
  }));
}
