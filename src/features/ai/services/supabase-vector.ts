"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Executes a Hybrid Search combining BM25 (Full Text) and Cosine Similarity (Vector)
 * using Reciprocal Rank Fusion on the `match_document_chunks_hybrid` RPC.
 */
export async function performHybridSearch(
  queryText: string,
  queryEmbedding: number[],
  matchCount: number = 10
) {
  const cookieStore = await cookies();

  // Create an authenticated Supabase client to ensure RLS (Row Level Security) is applied correctly.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: unknown }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            );
          } catch {
            // Ignored when called from Server Components during render phase
          }
        },
      },
    }
  );

  const { data, error } = await supabase.rpc("match_document_chunks_hybrid", {
    query_text: queryText,
    query_embedding: queryEmbedding,
    match_count: matchCount,
    full_text_weight: 1.0,
    semantic_weight: 1.0,
    rrf_k: 50,
  });

  if (error) {
    console.error("Hybrid Search Error:", error);
    throw new Error("Failed to perform hybrid search in vector database.");
  }

  return data as Array<{
    id: string;
    document_id: string;
    content: string;
    similarity: number;
  }>;
}
