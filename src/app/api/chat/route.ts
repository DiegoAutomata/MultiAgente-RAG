import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool, convertToModelMessages, type UIMessage } from 'ai';
import { z } from 'zod';
import { investigatorAgent } from '@/features/ai/services/rag-agents';

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();

  // DEBUG: log the actual body to understand SDK v6 body shape
  console.log('[chat] body keys:', Object.keys(body));
  console.log('[chat] messages type:', typeof body.messages, 'length:', body.messages?.length);
  console.log('[chat] message type:', typeof body.message);

  // AI SDK v6 useChat may send either:
  //   { messages: UIMessage[] }  (full history)
  //   or { message: UIMessage, messages: UIMessage[], id: string }
  // We handle both cases defensively.
  const messages: UIMessage[] = body.messages ?? (body.message ? [body.message] : []);

  if (messages.length === 0) {
    console.error('[chat] No messages found in body:', body);
    return new Response(JSON.stringify({ error: 'No messages provided' }), { status: 400 });
  }

  // Convert UIMessage[] → ModelMessage[] (required by streamText in SDK v6)
  // UIMessage has toolInvocations (frontend format); streamText needs ModelMessage format.
  const modelMessages = await convertToModelMessages(messages);

  const SYSTEM = `Eres el Orquestador RAG Corporativo definitivo: un Redactor y Analista corporativo fiable y seguro.
Tu objetivo es responder la pregunta del usuario usando datos de nuestra base de datos vectorial cuando sea necesario o solicitado.

FLUJO DE TRABAJO:
1. Si el usuario pide datos corporativos, normas, información, documentos o métricas, llama a investigate_database.
2. Revisa cuidadosamente el contexto devuelto. Si no está disponible, di que no lo sabes según los docs.
3. Si el usuario quiere ver datos de forma visual (métricas, cantidades, o reportes financieros), llama a generate_chart con los datos exactos que obtuviste de la base de datos.
4. Proporciona tu respuesta resolviendo la duda del usuario usando EXCLUSIVAMENTE el contexto y las herramientas. No alucines información fuera de tus herramientas.`;

  const result = streamText({
    model: anthropic('claude-3-haiku-20240307') as any,
    system: SYSTEM,
    messages: modelMessages as any,
    maxSteps: 5,
    tools: {
      investigate_database: tool({
        description: 'Searches the corporate RAG database using hybrid search (BM25 + Cosine similarity) to extract top-K contexts based on the user question.',
        parameters: z.object({
          search_query: z.string().describe('The core semantic intent of what the user is looking for. Keep it concise.')
        }),
        execute: async ({ search_query }: { search_query: string }) => {
          const context = await investigatorAgent(search_query);
          return {
            status: 'success',
            context: context || 'No context found in corporate documents.'
          };
        }
      } as any),
      generate_chart: tool({
        description: 'Generates an Interactive Recharts graphic natively on the Frontend UI. Call this when representing quantifiable lists or trends.',
        parameters: z.object({
          title: z.string().describe('Title of the chart'),
          xAxisKey: z.string().describe('X axis label'),
          data: z.array(
            z.object({
              name: z.string(),
              value: z.number()
            })
          )
        })
      } as any)
    }
  } as any);

  return (result as any).toUIMessageStreamResponse();
}
