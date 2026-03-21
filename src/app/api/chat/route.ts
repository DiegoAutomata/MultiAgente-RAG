import { streamText, tool, ModelMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { investigatorAgent } from '@/features/ai/services/rag-agents';

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();

  // AI SDK v6: Manually map messages to ModelMessage[] to ensure strict type compliance
  let messages: ModelMessage[] = [];
  
  if (body.messages) {
    // Strip out non-core properties like toolInvocations to prevent validation crashes
    messages = body.messages.filter((m: any) => m.content).map((m: any) => ({
      role: m.role,
      content: m.content
    }));
  } else if (body.message) {
    messages = [{
      role: body.message.role,
      content: body.message.content
    }];
  } else {
    return new Response('Invalid request body', { status: 400 });
  }

  const result = streamText({
    model: anthropic('claude-3-5-sonnet-latest'),
    messages,
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
            console.log("[Tool Call] -> generate_chart:", params.title);
            return params;
        }
      }),
    }
  });

  return (result as any).toUIMessageStreamResponse();
}
