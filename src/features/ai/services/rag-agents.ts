
import { generateText, generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { performHybridSearch } from "./supabase-vector";

/**
 * 1. Semantic Router: Decides if the user query needs document retrieval or is casual.
 */
export async function semanticRouter(query: string): Promise<"casual" | "retrieval"> {
  const { object } = await generateObject({
    model: anthropic("claude-3-5-haiku-20241022"),
    schema: z.object({
      intent: z.enum(["casual", "retrieval"]),
      reasoning: z.string(),
    }),
    prompt: `Analyze the user query: "${query}"
If it asks about specific corporate policies, internal documents, exact figures, reports, or deep knowledge, output "retrieval".
If it is a casual greeting or a general, unrelated question, output "casual".`,
  });
  return object.intent;
}

/**
 * Creates embeddings via Voyage AI (Anthropic's recommended partner for vectors)
 */
async function generateQueryEmbedding(text: string): Promise<number[]> {
  const voyageKey = process.env.VOYAGE_API_KEY;
  if (!voyageKey) {
    throw new Error("VOYAGE_API_KEY missing");
  }

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${voyageKey}`,
    },
    body: JSON.stringify({
      input: text,
      model: "voyage-3",
      input_type: "query",
    }),
  });

  const data = await res.json();
  return data.data[0].embedding;
}

/**
 * 2. Investigator Agent: Retrieves context and reranks it (simulated reranking for now, taking top-3).
 */
export async function investigatorAgent(query: string): Promise<string> {
  const queryEmbedding = await generateQueryEmbedding(query);
  // Perform Hybrid Search (BM25 + Cosine similarity via RRF)
  const results = await performHybridSearch(query, queryEmbedding, 15);

  if (results.length === 0) {
    return "";
  }

  // Reranking step (In a real scenario, use Voyage Reranker endpoint, but here we just take the top 5 highly confident results)
  const topContexts = results.slice(0, 5).map((r, i) => `[Doc ${i + 1}]:\n${r.content}`).join("\n\n---\n\n");
  return topContexts;
}

/**
 * Types & Schmeas for the Strict JSON Output
 */
export const ResponseSchema = z.object({
  answer: z.string().describe("The comprehensive and definitive answer directly extracted from the documents."),
  citations: z.array(z.string()).describe("A list of exact quotes or references from the documents that prove the answer."),
  confidence: z.enum(["High", "Medium", "Low"]).describe("Confidence level based on retrieved context vs query."),
});

type ResponseType = z.infer<typeof ResponseSchema>;

/**
 * 3. Redactor Agent: Writes the content strictly using structured JSON outputs based solely on context.
 */
export async function redactorAgent(query: string, context: string, feedback?: string): Promise<ResponseType> {
  let prompt = `You are the RAG Redactor. Write an accurate answer based ONLY on the provided context. If the context does not answer the question, state that you cannot answer. Do not use external knowledge. 
Context:
${context}
===
Query: ${query}`;

  if (feedback) {
    prompt += `\n\n[WARNING: AUDITOR REJECTED PREVIOUS DRAFT] 
AUDITOR FEEDBACK: ${feedback} 
Please fix your previous draft based on this strict feedback.`;
  }

  const { object } = await generateObject({
    model: anthropic("claude-4-6-sonnet-latest"), // we use sonnet 4.6 for heavy reasoning
    schema: ResponseSchema,
    prompt: prompt,
  });

  return object;
}

/**
 * 4. Auditor Agent: Validates the Redactor's draft against the original context to prevent hallucination.
 * Returns { passed: boolean, feedback: string }
 */
export async function auditorAgent(query: string, context: string, draft: ResponseType): Promise<{ passed: boolean; feedback: string }> {
  const { object } = await generateObject({
    model: anthropic("claude-3-5-haiku-20241022"),
    schema: z.object({
      hallucination_detected: z.boolean(),
      reasoning: z.string().describe("Explain why the draft is accurate or if it hallucinates."),
      missing_info: z.string().optional().describe("If the draft missed crucial info from the context."),
    }),
    prompt: `You are the strict Corporate Auditor. Review the Redactor's draft response against the specific Context provided.
Context:
${context}
===
Query: ${query}
===
Redactor Draft Answer:
${draft.answer}
Citations provided: ${draft.citations.join(" | ")}

Analyze if the Redactor hallucinated details NOT present in the Context, or if the citations are wrong. 
If hallucination is detected, hallucination_detected MUST be true, and reasoning must explain the flaw.
If it is strictly accurate, hallucination_detected is false.`,
  });

  return {
    passed: !object.hallucination_detected,
    feedback: object.reasoning,
  };
}

/**
 * ORCHESTRATOR: Brings all the agents together in a Self-Reflection Loop
 */
export async function runCorporateRAG(query: string) {
  console.log(`[RAG] Routing query: "${query}"`);
  
  // 1. Semantic Router
  const intent = await semanticRouter(query);
  if (intent === "casual") {
    console.log("[RAG] Casual mode path");
    const { text } = await generateText({
      model: anthropic("claude-4-6-sonnet-latest"),
      prompt: `You are a helpful assistant. Reply friendly and casually to: ${query}`,
    });
    return { type: "casual", answer: text };
  }

  console.log("[RAG] Retrieval mode path -> Invoking Investigator");
  
  // 2. Investigator
  const context = await investigatorAgent(query);
  if (!context.trim()) {
    return { type: "retrieval", answer: "No se encontró información relevante en nuestra base de datos corporativa.", citations: [], confidence: "Low" };
  }

  // 3. Loop: Redactor & Auditor
  const MAX_RETRIES = 2; // self-reflection limit
  let currentDraft: ResponseType | null = null;
  let feedback = "";

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    console.log(`[RAG] Redactor Draft Attempt ${attempt}`);
    currentDraft = await redactorAgent(query, context, feedback);

    console.log(`[RAG] Auditor Reviewing Attempt ${attempt}`);
    const auditRes = await auditorAgent(query, context, currentDraft);
    
    if (auditRes.passed) {
      console.log(`[RAG] Auditor APPROVED Attempt ${attempt}!`);
      return {
        type: "retrieval",
        ...currentDraft,
      };
    } else {
      console.warn(`[RAG] Auditor REJECTED Attempt ${attempt}. Reason:`, auditRes.feedback);
      feedback = auditRes.feedback; // Feed this back to Redactor
    }
  }

  // If we run out of retries, we return the last draft but mark it as flagged, or just return an error.
  console.error(`[RAG] Auditor consistently rejected drafts. Emitting Fallback.`);
  return {
    type: "retrieval",
    answer: "El Auditor bloqueó la respuesta final debido a posibles inconsistencias con los documentos y se superó el límite de reintentos.",
    citations: [],
    confidence: "Low",
    flagged: true,
  };
}
