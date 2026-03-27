# Estructura del Sistema Multi-Agente RAG Corporativo

Este documento detalla la arquitectura técnica, el flujo de comunicación entre agentes y el stack tecnológico utilizado para el desarrollo de la solución de Inteligencia Artificial.

---

## 🏗️ Arquitectura del Sistema (Mermaid)

El siguiente diagrama ilustra cómo interactúan los diferentes componentes desde que el usuario realiza una consulta hasta que recibe una respuesta verificada y libre de alucinaciones.

```mermaid
graph TD
    %% Estilos de Nodos
    classDef user fill:#f9f,stroke:#333,stroke-width:2px,color:#000
    classDef agent fill:#69f,stroke:#333,stroke-width:2px,color:#fff
    classDef tool fill:#f96,stroke:#333,stroke-width:2px,color:#fff
    classDef db fill:#3c3,stroke:#333,stroke-width:2px,color:#fff
    classDef process fill:#eee,stroke:#333,stroke-dasharray: 5 5,color:#000

    User((👤 Usuario)):::user
    
    subgraph Orchestration ["Orquestación Central (Claude 3 Haiku)"]
        Brain[🧠 Orquestador Principal]:::agent
        Router[🛣️ Semantic Router]:::agent
    end

    subgraph MultiAgentLoop ["Bucle de Re-Reflexión y Calidad"]
        Redactor[✍️ Agente Redactor]:::agent
        Auditor[🔍 Agente Auditor]:::agent
        Loop{¿Pasa Calidad?}:::process
    end

    subgraph RAG_Engine ["Motor de Recuperación (RAG)"]
        Investigator[🕵️ Agente Investigador]:::agent
        Embedder[🔢 Embedding Engine<br/>(Local MiniLM-L6)]:::tool
        Search[🔍 Hybrid Search<br/>BM25 + Cosine]:::tool
    end

    subgraph Data_Layer ["Capa de Datos (Supabase)"]
        VectorDB[(🗃️ pgvector Chunks)]:::db
        MetaDB[(📄 Metadata Docs)]:::db
    end

    %% Flujos
    User -->|Consulta| Brain
    Brain --> Router
    Router -->|Necesita Documentos| Investigator
    
    Investigator --> Embedder
    Embedder --> Search
    Search <-->|Query RPC| VectorDB
    
    Investigator -->|Contexto Recuperado| MultiAgentLoop
    
    Redactor -->|Borrador Respuesta| Auditor
    Auditor --> Loop
    Loop -->|No: Hallucinación| Redactor
    Loop -->|Sí: Verificado| Brain
    
    Brain -->|Respuesta Final + Citaciones| User
    
    %% Herramientas Extra
    Brain -.->|tool: list_documents| MetaDB
    Brain -.->|tool: generate_chart| UI((📊 Visualización))
```

---

## 🔁 Flujo de Comunicación entre Agentes

El sistema opera bajo un modelo de **Orquestación con Auto-Reflexión**. Los agentes no solo ejecutan tareas, sino que se supervisan entre sí:

1.  **Orquestador Principal**: La puerta de entrada que gestiona el estado de la conversación y decide qué herramientas activar.
2.  **Semantic Router**: Clasifica la intención del usuario. Si la pregunta es trivial (ej: "Hola"), responde directamente. Si requiere conocimiento experto, activa el flujo RAG.
3.  **Investigador (RAG)**: Transforma la consulta en vectores matemáticos y realiza una búsqueda híbrida en la base de datos para encontrar los fragmentos más relevantes.
4.  **Bucle Redactor-Auditor**: Es el corazón de la fiabilidad del sistema.
    *   El **Redactor** genera una respuesta basada *únicamente* en el contexto encontrado.
    *   El **Auditor** revisa que cada afirmación esté respaldada por los documentos (evitando inventos o "alucinaciones").
    *   Si el Auditor detecta un error, le devuelve el "feedback" al Redactor para que corrija la respuesta (hasta 3 intentos).

---

## 🗄️ Estructura de la Base de Datos Vectorial

Utilizamos **Supabase** potenciado con la extensión **pgvector** para manejar datos no estructurados de forma eficiente.

| Componente | Descripción |
| :--- | :--- |
| **Documentos** | Almacena los metadatos de los archivos (nombre, extensión, fecha de carga). |
| **Chunks** | Los documentos se dividen en fragmentos de ~1000 caracteres para asegurar que la IA procese información precisa. |
| **Embeddings** | Cada fragmento se convierte en un vector de 384 dimensiones usando el modelo `all-MiniLM-L6-v2`. |
| **Búsqueda Híbrida** | Combinamos búsqueda por palabras clave (BM25) con búsqueda semántica (Coseno) para resultados ultra-precisos. |

---

## 🛠️ Stack Tecnológico

Hemos seleccionado las mejores tecnologías de 2024-2025 para garantizar escalabilidad, velocidad y una experiencia de usuario premium:

### **Frontend & UI**
*   **Next.js 16 (App Router)**: Framework líder para aplicaciones web de alto rendimiento.
*   **React 19**: Biblioteca UI de vanguardia para interfaces reactivas.
*   **Tailwind CSS**: Diseño moderno, limpio y ultra-rápido.
*   **Lucide Icons & Recharts**: Para iconografía elegante y gráficos de datos interactivos.

### **Backend & AI Logic**
*   **Vercel AI SDK v4**: La infraestructura estándar de la industria para aplicaciones de IA.
*   **Anthropic Claude 3 Haiku**: El modelo principal, optimizado para ser extremadamente inteligente y tener baja latencia.
*   **Transformers.js (Xenova)**: Permite generar embeddings en el servidor de forma local, reduciendo costes y latencia de red.
*   **Zod**: Validación estricta de esquemas de datos para asegurar que la IA siempre devuelva formatos correctos (JSON).

### **Infraestructura y Datos**
*   **Supabase (PostgreSQL)**: Base de datos relacional de nivel empresarial.
*   **pgvector**: Extensión vectorial para capacidades avanzadas de búsqueda semántica.
*   **RLS (Row Level Security)**: Seguridad a nivel de fila para proteger los documentos de cada usuario.

---

> [!TIP]
> **Beneficio para el Cliente:** Esta arquitectura garantiza que la IA no "invente" respuestas (hallucinations), sino que actúe como un experto bibliotecario que busca en los documentos reales antes de hablar.
