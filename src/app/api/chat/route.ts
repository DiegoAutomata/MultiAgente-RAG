import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool, convertToModelMessages, stepCountIs, type UIMessage } from 'ai';
import { z } from 'zod';
import { investigatorAgent } from '@/features/ai/services/rag-agents';

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  const messages: UIMessage[] = body.messages ?? (body.message ? [body.message] : []);

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: 'No messages provided' }), { status: 400 });
  }

  const modelMessages = await convertToModelMessages(messages);

  const SYSTEM = `Eres el Orquestador RAG Corporativo definitivo. Eres un analista experto, amable y profesional.

REGLA FUNDAMENTAL — LEE ESTO PRIMERO:
Tienes documentos cargados en tu base de datos vectorial. Tu misión principal es responder preguntas USANDO esos documentos. NUNCA respondas con conocimiento general cuando la pregunta puede estar cubierta por los documentos.

CUÁNDO NO USAR HERRAMIENTAS (excepciones muy estrechas):
- Saludos puros: "Hola", "Buenos días", "¿Cómo estás?"
- Preguntas sobre ti mismo: "¿Qué eres?", "¿Qué puedes hacer?"
- Agradecimientos: "Gracias", "Perfecto"

CUÁNDO USAR 'investigate_database' — OBLIGATORIO:
- CUALQUIER pregunta sobre regulaciones, normas, leyes, requisitos, límites, velocidades, señales, multas, licencias, procedimientos
- CUALQUIER pregunta sobre vehículos, motocicletas, transporte, tránsito, circulación
- CUALQUIER pregunta que busque datos, cifras, porcentajes, información específica
- CUALQUIER pregunta sobre el contenido de los documentos
- EN CASO DE DUDA: usa 'investigate_database'. Siempre es mejor buscar que inventar.

CUÁNDO USAR 'list_documents':
- El usuario pregunta qué archivos o documentos hay disponibles
- El usuario pregunta cómo se llama el documento que subió
- Opcionalmente, antes de buscar contenido, para saber qué documentos existen

REGLAS CRÍTICAS:
1. NUNCA respondas "no tengo acceso" o "no tengo esa información" sin haber llamado primero a 'investigate_database'. Si no buscaste, no puedes saber si está o no.
2. DESPUÉS de llamar a 'investigate_database', SIEMPRE genera una respuesta en texto basada en lo encontrado.
3. Si la búsqueda no encuentra nada relevante, dilo claramente PERO primero intenta con otra búsqueda más específica.
4. NUNCA alucines datos. Basa toda respuesta en lo que devuelve 'investigate_database'.

FLUJO CORRECTO para preguntas de contenido:
1. Llama a 'investigate_database' con la consulta precisa del usuario
2. Analiza los resultados
3. Responde con base ÚNICAMENTE en esos resultados

FORMATO DE RESPUESTA:
- Escribe directamente la respuesta en texto natural. NUNCA uses etiquetas XML como <resultado>, </resultado>, <respuesta>, <answer> ni similares.
- No añadas prefijos como "Resultado:", "Respuesta:" o similares. Ve directo al contenido.`;

  const result = streamText({
    model: anthropic('claude-3-haiku-20240307') as any,
    system: SYSTEM,
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    tools: {
      investigate_database: tool({
        description: 'MANDATORY: Search the RAG vector database for document content. Call this for ANY question about regulations, rules, limits, speeds, vehicles, traffic, licenses, procedures, or any specific information. Always use this before answering from general knowledge. Pass the user question as-is or as a precise keyword query.',
        parameters: z.object({
          search_query: z.string().describe('The user query or keywords to search. Be specific and use terms from the question (e.g., "velocidad máxima motocicleta vía urbana", "requisitos licencia conducir").')
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
        }),
        execute: async ({ title, xAxisKey, data }) => {
          // Returns chart data for client-side rendering via GenerativeChart component
          return { title, xAxisKey, data };
        }
      } as any)
    }
  } as any);

  return (result as any).toUIMessageStreamResponse();
}
