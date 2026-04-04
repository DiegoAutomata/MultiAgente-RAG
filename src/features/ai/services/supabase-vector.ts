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
 * Uses the service_role key to bypass RLS, but applies explicit user_id filtering
 * to ensure multi-tenant data isolation.
 *
 * Strategy:
 * 1. Resolve the user's document IDs (if userId provided)
 * 2. Try RPC function + post-filter by user docs
 * 3. Fallback: Direct table query with text matching (ilike) + user filter
 * 4. Last resort: Fetch recent chunks filtered by user
 */
export async function performHybridSearch(
  queryText: string,
  queryEmbedding: number[],
  matchCount: number = 10,
  userId?: string
) {
  const supabase = createAdminClient();

  // Resolve user's document IDs for tenant isolation
  let userDocIds: string[] | null = null;
  if (userId) {
    const { data: userDocs, error: docsError } = await supabase
      .from("documents")
      .select("id")
      .eq("user_id", userId);

    if (docsError) {
      console.warn("[search] Could not fetch user document IDs:", docsError.message);
    } else {
      userDocIds = userDocs?.map((d: { id: string }) => d.id) ?? [];
      console.log(`[search] User ${userId} has ${userDocIds.length} documents`);

      if (userDocIds.length === 0) {
        console.log("[search] User has no documents, returning empty results");
        return [];
      }
    }
  }

  // Strategy 1: RPC with DB-level user filtering via filter_user_id
  try {
    const { data, error } = await supabase.rpc("match_document_chunks_hybrid", {
      query_text: queryText,
      query_embedding: queryEmbedding,
      match_count: matchCount,
      full_text_weight: 1.0,
      semantic_weight: 1.0,
      rrf_k: 50,
      filter_user_id: userId ?? null,
    });

    if (!error && data && data.length > 0) {
      // Filter out chunks below minimum similarity threshold (RRF score)
      // RRF scores are small by nature (~0.01–0.02); 0.005 removes true noise
      const MIN_SIMILARITY = 0.005;
      const filtered = data.filter((r: { similarity: number }) => r.similarity >= MIN_SIMILARITY);
      console.log(`[search] RPC returned ${filtered.length}/${data.length} results above threshold`);
      if (filtered.length > 0) {
        return filtered as Array<{
          id: string;
          document_id: string;
          content: string;
          similarity: number;
        }>;
      }
    }

    if (error) {
      console.warn("[search] RPC failed:", error.message);
    }
  } catch (rpcErr) {
    console.warn("[search] RPC threw exception:", rpcErr);
  }

  // Strategy 2: Direct text search using ilike filtered by user's documents
  const searchTerms = queryText
    .toLowerCase()
    .replace(/[¿?¡!]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 3)
    .slice(0, 8);

  console.log("[search] Falling back to direct search with terms:", searchTerms);

  const matchedChunks: Map<string, { id: string; document_id: string; content: string; score: number }> = new Map();

  for (const term of searchTerms) {
    let query = supabase
      .from("document_chunks")
      .select("id, document_id, content")
      .ilike("content", `%${term}%`)
      .limit(5);

    if (userDocIds) {
      query = query.in("document_id", userDocIds);
    }

    const { data: matchData } = await query;

    if (matchData) {
      matchData.forEach((row: { id: string; document_id: string; content: string }) => {
        if (!matchedChunks.has(row.id)) {
          matchedChunks.set(row.id, { ...row, score: 1 });
        } else {
          matchedChunks.get(row.id)!.score += 1;
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
      similarity: 0.9 / (i + 1),
    }));
  }

  // Strategy 3: Last resort — return recent chunks filtered by user
  console.warn("[search] No keyword matches. Fetching recent chunks as fallback...");
  let lastResortQuery = supabase
    .from("document_chunks")
    .select("id, document_id, content")
    .order("chunk_index", { ascending: true })
    .limit(matchCount);

  if (userDocIds) {
    lastResortQuery = lastResortQuery.in("document_id", userDocIds);
  }

  const { data: allData, error: allError } = await lastResortQuery;

  if (allError) {
    console.error("[search] All search strategies failed:", allError.message);
    return [];
  }

  console.log(`[search] Fallback returned ${allData?.length ?? 0} chunks`);
  return (allData ?? []).map((row: { id: string; document_id: string; content: string }, i: number) => ({
    ...row,
    similarity: 1.0 / (i + 1),
  }));
}
