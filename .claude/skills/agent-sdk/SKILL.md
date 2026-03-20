---
name: Anthropic Agent SDK (Python)
description: Habilidad para orquestar agentes avanzados usando el SDK nativo de Anthropic en Python (claude-agent-sdk), integrado a la Fábrica SaaS.
---

# 🤖 Anthropic Agent SDK (Python)

Esta habilidad documenta cómo utilizar el **Agent SDK de Anthropic** (paquete `claude-agent-sdk` instalado en el entorno virtual `venv` local) dentro del ecosistema de la Fábrica SaaS V4. 

## 🛠️ Contexto y Activación
El entorno ya está preparado gracias al script `agent-sdk` del usuario, instalando el paquete de PyPI. El SDK reside en el `venv` local del proyecto.

Para ejecutar cualquier script que use este SDK de forma programática, usa el path absoluto del python del entorno virtual:
`./venv/bin/python tu_script.py`

## 💻 Uso Básico del Cliente (`ClaudeSDKClient`)
El cliente provee un control de bajo nivel para flujos de agentes avanzados, permitiendo streaming e interrupciones dinámicas.

### Ejemplo de Patrón de Orquestación
```python
import asyncio
import os
from claude_agent_sdk.client import ClaudeSDKClient
from claude_agent_sdk.types import AssistantMessage, ResultMessage, TextBlock

async def run_agent():
    # El SDK requiere ANTHROPIC_API_KEY en el entorno
    async with ClaudeSDKClient() as client:
        # Permitir que el agente haga ediciones auto-aprobadas si es necesario
        await client.set_permission_mode('acceptEdits')
        
        await client.query("Analiza la estructura del proyecto y dame un resumen breve.")
        
        async for msg in client.receive_response():
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        print(block.text, end="", flush=True)
            elif isinstance(msg, ResultMessage):
                print(f"\n[Terminado. Costo: ${msg.total_cost_usd:.4f}]")

if __name__ == "__main__":
    asyncio.run(run_agent())
```

## 🧠 Capacidades Avanzadas Descubiertas

1. **Gestión de Servidores MCP:**
   - Puedes monitorear los MCP conectados al entorno usando `await client.get_mcp_status()`.
   - Puedes activar/desactivar MCPs dinámicamente con `await client.toggle_mcp_server(name, enabled)`.
2. **Interrupt & Rewind:**
   - Soporta interrupción de tareas pesadas: `await client.interrupt()`.
   - Permite "rebobinar" los archivos rastreados a un estado anterior: `await client.rewind_files(uuid)`.
3. **Model Switching Dinámico:**
   - Puedes cambiar de modelo en mitad del flujo `await client.set_model("claude-sonnet-4-5")`.

## 🚀 Integración en la Fábrica SaaS (Arquitectura)
Aunque el "Golden Path" de la Fábrica dicta construir en Next.js (TypeScript), la incorporación de este Agent SDK en Python nos permite usar este `venv` como **Motor de Ingesta y Orquestación Pesada (RAG)**. 
Podemos desarrollar scripts Python orquestadores en la carpeta `src/features/ai/scripts` y llamarlos desde Next.js usando Server Actions o Edge Functions que disparen procesos en el VPS local, logrando el híbrido perfecto entre frontend limpio en React y backend potente en Python.
