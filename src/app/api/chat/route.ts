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

  // Convert UI messages to model messages for the AI SDK
  const modelMessages = await convertToModelMessages(messages);

  const SYSTEM = `Eres el Orquestador RAG Corporativo definitivo. Eres un analista experto, amable y profesional.

REGLAS DE INTERACCIÓN:
1. CHARLA CASUAL: Si el usuario te saluda, te pregunta cómo estás, o hace preguntas de cultura general, responde amigablemente SIN usar herramientas.
2. PREGUNTAS SOBRE DOCUMENTOS: 
    - Si el usuario pregunta qué documentos hay o cómo se llama el que subió, usa 'list_documents'.
    - Si pregunta por el contenido o datos específicos, usa 'investigate_database'.
3. NO ALUCINES: Si los documentos no tienen la respuesta, dilo claramente.
4. ESTADO DE CARGA: Si ves un documento en 'list_documents' pero 'investigate_database' no devuelve nada, advierte al usuario que el documento se está indexando aún.
5. RESPUESTA FINAL: SIEMPRE debes proporcionar una respuesta final en texto después de usar una herramienta. NUNCA termines una respuesta con solo el resultado de una herramienta.

FLUJO: Saludo -> Lista Documentos -> Búsqueda de Contenido -> Respuesta Analítica Final.`;

  const result = streamText({
    model: anthropic('claude-3-haiku-20240307') as any,
    system: SYSTEM,
    messages: modelMessages,
    maxSteps: 5,
    tools: {
      investigate_database: tool({
        description: 'Searches the RAG vector database for document content. ONLY use this when the user asks for information from PDF documents or reports. Do NOT use it for greetings or routine conversation.',
        parameters: z.object({
          search_query: z.string().describe('Precise keyword/intent query for vector search.')
        }),
        execute: async (args: Record<string, unknown>) => {
          // Defensive: extract search_query from any possible shape
          const rawQuery = (args as any)?.search_query ?? (args as any)?.query ?? '';
          const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
          console.log('[chat] investigate_database called with query:', JSON.stringify(query));
          
          if (!query) {
            // Fallback: use last user message text as query
            const lastUserMsg = messages.filter(m => m.role === 'user').pop();
            const fallbackQuery = lastUserMsg?.parts
              ?.filter((p: any) => p.type === 'text')
              .map((p: any) => p.text)
              .join(' ') || 'documento';
            console.log('[chat] Using fallback query from last user message:', fallbackQuery);
            const context = await investigatorAgent(fallbackQuery);
            return { status: 'success', context: context || 'No se encontró información relevante.' };
          }
          
          const context = await investigatorAgent(query);
          return {
            status: 'success',
            context: context || 'No se encontró información relevante en los documentos.'
          };
        }
      } as any),
      list_documents: tool({
        description: 'Checks the database for metadata of uploaded files (name, upload date). Call this when the user asks which document they provided.',
        parameters: z.object({}),
        execute: async () => {
          console.log('[chat] list_documents called');
          const { performHybridSearch } = await import('@/features/ai/services/supabase-vector');
          // We can't use performHybridSearch directly since it's for chunks. 
          // We need a simple query to documents table.
          const { createClient } = await import('@supabase/supabase-js');
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          const supabase = createClient(url!, serviceKey!);
          const { data, error } = await supabase.from('documents').select('title, created_at').order('created_at', { ascending: false }).limit(5);
          
          if (error) return { error: error.message };
          return {
             status: 'success',
             documents: data || []
          };
        }
      } as any),
      generate_chart: tool({
        description: 'Generates an Interactive Recharts graphic. Call this ONLY when representing trends, percentages or quantifiable data from retrieved documents.',
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
