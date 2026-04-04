import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool, jsonSchema, convertToModelMessages, stepCountIs, type UIMessage } from 'ai';
import { investigatorAgent } from '@/features/ai/services/rag-agents';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

export async function POST(req: Request) {
  // Validate session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const userId = user.id;

  const body = await req.json();
  const messages: UIMessage[] = body.messages ?? (body.message ? [body.message] : []);

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: 'No messages provided' }), { status: 400 });
  }

  const modelMessages = await convertToModelMessages(messages);

  const SYSTEM = `Eres un asistente corporativo experto, amable y profesional. Tu rol es DOBLE:

ROL 1 — CONVERSACIÓN NATURAL (sin herramientas):
Responde de forma directa y amigable a mensajes conversacionales como:
- Saludos: "Hola", "Buenos días", "¿Cómo estás?", "Buenas tardes"
- Preguntas sobre ti: "¿Qué eres?", "¿Qué puedes hacer?", "¿Cómo funcionas?"
- Agradecimientos: "Gracias", "Perfecto", "Entendido", "Ok"
- Despedidas: "Adiós", "Hasta luego", "Chao"
Para estos mensajes, responde como un asistente amigable. NO uses herramientas. NO busques en la base de datos.

ROL 2 — ANALISTA RAG (con herramientas):
Para CUALQUIER pregunta que busque información, datos, contenido de documentos o conocimiento específico, DEBES usar 'investigate_database' antes de responder.
Ejemplos: regulaciones, normas, leyes, requisitos, límites, velocidades, señales, multas, licencias, procedimientos, vehículos, transporte, tránsito, datos, cifras, porcentajes.

REGLAS PARA EL ROL 2:
1. NUNCA respondas "no tengo acceso" o "no tengo esa información" sin haber llamado primero a 'investigate_database'.
2. DESPUÉS de llamar a 'investigate_database', SIEMPRE genera una respuesta en texto basada en lo encontrado.
3. Si la búsqueda no encuentra nada relevante, dilo claramente PERO primero intenta con otra búsqueda más específica.
4. NUNCA alucines datos. Basa toda respuesta en lo que devuelve 'investigate_database'.

REGLA ABSOLUTA — DATOS NUMÉRICOS:
- Si el usuario pregunta por velocidades, límites, multas, medidas, porcentajes, años, artículos de ley o cualquier cifra numérica: ESE NÚMERO debe aparecer TEXTUALMENTE en el contexto devuelto por 'investigate_database'.
- Si el número NO aparece literalmente en el contexto recuperado, responde exactamente: "No encontré ese dato específico en los documentos. Te recomiendo consultarlo directamente en la fuente oficial."
- PROHIBIDO completar datos numéricos faltantes con conocimiento general o estimaciones. Si encontraste la velocidad mínima pero no la máxima, di solo la mínima y aclara que la máxima no figura en el documento.
- Cuando des un número que SÍ está en el contexto, cita la frase exacta del documento entre comillas para que el usuario pueda verificarlo.

CUÁNDO USAR 'list_documents':
- El usuario pregunta qué archivos o documentos hay disponibles.

FORMATO DE RESPUESTA:
- Escribe ÚNICAMENTE el texto final de la respuesta. Nada más.
- PROHIBIDO usar cualquier etiqueta XML. Esto incluye sin excepción: <resultado>, <respuesta>, <answer>, <function_quality_reflection>, <function_quality_score>, <reflection>, <thinking>, <reasoning>, o CUALQUIER otra etiqueta con < >.
- PROHIBIDO añadir prefijos como "Resultado:", "Respuesta:", "Análisis:" o similares.
- La respuesta debe comenzar directamente con el contenido útil para el usuario.`;

  const result = streamText({
    model: anthropic('claude-3-haiku-20240307') as any,
    system: SYSTEM,
    messages: modelMessages,
    maxTokens: 4096,
    stopWhen: stepCountIs(5),
    tools: {
      investigate_database: tool({
        description: 'MANDATORY: Search the RAG vector database for document content. Call this for ANY question about regulations, rules, limits, speeds, vehicles, traffic, licenses, procedures, or any specific information. Always use this before answering from general knowledge. Pass the user question as-is or as a precise keyword query.',
        inputSchema: jsonSchema<{ search_query: string }>({
          type: 'object',
          properties: {
            search_query: {
              type: 'string',
              description: 'The user query or keywords to search. Be specific and use terms from the question.'
            }
          },
          required: ['search_query'],
          additionalProperties: false
        }),
        execute: async ({ search_query }: { search_query: string }) => {
          const query = (search_query ?? '').trim();
          console.log('[chat] investigate_database called with query:', JSON.stringify(query));
          
          if (!query) {
            // Fallback: use last user message text as query
            const lastUserMsg = messages.filter(m => m.role === 'user').pop();
            const fallbackQuery = lastUserMsg?.parts
              ?.filter((p: any) => p.type === 'text')
              .map((p: any) => p.text)
              .join(' ') || 'documento';
            console.log('[chat] Using fallback query from last user message:', fallbackQuery);
            const context = await investigatorAgent(fallbackQuery, userId);
            return { status: 'success', context: context || 'No se encontró información relevante.' };
          }

          const context = await investigatorAgent(query, userId);
          return {
            status: 'success',
            context: context || 'No se encontró información relevante en los documentos.'
          };
        }
      } as any),
      list_documents: tool({
        description: 'Checks the database for metadata of uploaded files (name, upload date). Call this when the user asks which document they provided.',
        inputSchema: jsonSchema<Record<string, never>>({
          type: 'object',
          properties: {},
          additionalProperties: false
        }),
        execute: async () => {
          console.log('[chat] list_documents called');
          const { createClient } = await import('@supabase/supabase-js');
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          const supabase = createClient(url!, serviceKey!);
          const { data, error } = await supabase
            .from('documents')
            .select('title, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

          if (error) return { error: error.message };
          return {
             status: 'success',
             documents: data || []
          };
        }
      } as any),
      generate_chart: tool({
        description: 'Generates an Interactive Recharts graphic. Call this ONLY when representing trends, percentages or quantifiable data from retrieved documents.',
        inputSchema: jsonSchema<{ title: string; xAxisKey: string; data: { name: string; value: number }[] }>({
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Title of the chart' },
            xAxisKey: { type: 'string', description: 'X axis label' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  value: { type: 'number' }
                },
                required: ['name', 'value'],
                additionalProperties: false
              }
            }
          },
          required: ['title', 'xAxisKey', 'data'],
          additionalProperties: false
        }),
        execute: async ({ title, xAxisKey, data }: { title: string; xAxisKey: string; data: { name: string; value: number }[] }) => {
          // Returns chart data for client-side rendering via GenerativeChart component
          return { title, xAxisKey, data };
        }
      } as any)
    }
  } as any);

  return (result as any).toUIMessageStreamResponse();
}
