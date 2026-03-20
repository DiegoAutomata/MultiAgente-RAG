// @ts-nocheck
import { streamText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { investigatorAgent } from '@/features/ai/services/rag-agents';

export const maxDuration = 60; // Allow 60 seconds (since RAG takes time)

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic('claude-4-6-sonnet-latest'),
    messages,
    // @ts-ignore
    maxSteps: 5, // Crucial for Multi-Agent loop over tools
    system: `You are the ultimate Corporate Multi-Agent RAG Orchestrator acting as a reliable, secure Redactor and Analyst. 
Your objective is to answer the user's question truthfully, securely, and using ONLY data extracted from our vectorial database.

ROUTING LOGIC / WORKFLOW:
1. If the user asks for corporate data, policies, documents, or metrics, IMMEDIATELY call the tool \`investigate_database\`.
2. Wait for the tool output to receive the contextual chunk texts.
3. Review the context carefully. If the information isn't there, say you don't know based on corporate docs.
4. If the user wants to see data visually (metrics, quantities, comparative values) or if the answer naturally forms a list of metrics, you MUST call the \`generate_chart\` tool. DO NOT output a markdown table or code. Let the Generative UI handle the visual.
5. Provide your final concise text answer analyzing the data. Don't hallucinate.`,
    tools: {
      investigate_database: tool({
        description: 'Searches the corporate RAG database using hybrid search (BM25 + Cosine similarity) to extract top-K contexts based on the user question.',
        parameters: z.object({ search_query: z.string().describe("The core semantic intent of what the user is looking for.") }),
        execute: async ({ search_query }) => {
            console.log("[Tool Call] -> investigate_database:", search_query);
            const context = await investigatorAgent(search_query);
            return { rawContext: context || "No context found in database for this query." };
        }
      }),
      generate_chart: tool({
        description: 'Generates an Interactive Recharts graphic natively on the Frontend UI. Call this when representing quantifiable lists or trends.',
        parameters: z.object({
          title: z.string().describe("The descriptive title for the chart."),
          xAxisKey: z.string().describe("The label for the x-axis items"),
          data: z.array(z.object({ name: z.string(), value: z.number() })).describe("The array of data points to plot")
        }),
        execute: async (params) => {
            // Generative UI: By returning params directly, useChat intercepts it as 'result' state 
            // and we map it directly to our React Recharts component without stringifying.
            console.log("[Tool Call] -> generate_chart:", params.title);
            return params;
        }
      }),
    }
  });

  // @ts-ignore
  return result.toDataStreamResponse();
}
