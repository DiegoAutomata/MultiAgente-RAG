import Anthropic from '@anthropic-ai/sdk';
import { investigatorAgent } from '@/features/ai/services/rag-agents';

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildTools(): Anthropic.Tool[] {
  return [
    {
      name: 'investigate_database',
      description: 'Searches the corporate RAG database using hybrid search (BM25 + Cosine similarity) to extract top-K contexts based on the user question.',
      input_schema: {
        type: 'object' as const,
        properties: {
          search_query: { type: 'string', description: 'The core semantic intent of what the user is looking for.' }
        },
        required: ['search_query']
      }
    },
    {
      name: 'generate_chart',
      description: 'Generates an Interactive Recharts graphic natively on the Frontend UI. Call this when representing quantifiable lists or trends.',
      input_schema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: 'Title of the chart' },
          xAxisKey: { type: 'string', description: 'X axis label' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, value: { type: 'number' } },
              required: ['name', 'value']
            }
          }
        },
        required: ['title', 'xAxisKey', 'data']
      }
    }
  ];
}

export async function POST(req: Request) {
  const body = await req.json();

  let rawMessages: Anthropic.MessageParam[] = [];
  if (body.messages) {
    rawMessages = body.messages
      .filter((m: any) => m.content)
      .map((m: any) => ({ role: m.role, content: m.content }));
  } else if (body.message) {
    rawMessages = [{ role: body.message.role, content: body.message.content }];
  } else {
    return new Response('Invalid request body', { status: 400 });
  }

  const SYSTEM = `Eres el Orquestador RAG Corporativo definitivo: un Redactor y Analista fiable y seguro.
Tu objetivo es responder la pregunta del usuario usando EXCLUSIVAMENTE datos de nuestra base de datos vectorial.

FLUJO DE TRABAJO:
1. Si el usuario pide datos corporativos, normas, documentos o métricas, llama INMEDIATAMENTE a investigate_database.
2. Revisa cuidadosamente el contexto. Si no está disponible, di que no lo sabes según los docs.
3. Si el usuario quiere ver datos de forma visual (métricas, cantidades), llama a generate_chart. NO generes tablas markdown ni código.
4. Proporciona tu respuesta final concisa analizando los datos. No alucines.`;

  const stream = await client.messages.stream({
    model: 'claude-3-haiku-20240307',
    max_tokens: 4096,
    system: SYSTEM,
    messages: rawMessages,
    tools: buildTools(),
  });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            // Vercel AI SDK Protocol: 0:JSON_STRING\n
            const chunk = "0:" + JSON.stringify(event.delta.text) + "\n";
            controller.enqueue(new TextEncoder().encode(chunk));
          }

          // Handle tool use results inline
          if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
            const toolName = event.content_block.name;
            const chunkString = "\\n[⚙️ Usando herramienta: " + toolName + "]\\n";
            const chunk = "0:" + JSON.stringify(chunkString) + "\n";
            controller.enqueue(new TextEncoder().encode(chunk));
          }
        }
      } catch (err: any) {
        const chunk = "3:" + JSON.stringify(err.message) + "\n";
        controller.enqueue(new TextEncoder().encode(chunk));
      } finally {
        controller.enqueue(new TextEncoder().encode('e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n'));
        controller.close();
      }
    }
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Vercel-AI-Data-Stream': 'v1',
      'X-Content-Type-Options': 'nosniff',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    }
  });
}
