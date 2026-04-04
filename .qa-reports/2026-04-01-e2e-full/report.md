# QA Report: Enterprise RAG Auditor — E2E Completo

**Date**: 2026-04-01  
**Status**: PARTIALLY_FUNCTIONAL — Bloqueantes críticos para producción

---

## Resumen Ejecutivo

La app tiene una UI sólida y una arquitectura de agentes bien diseñada. Sin embargo, tiene **3 bloqueantes críticos** que impiden llegar a producción y **8 issues importantes** que deben resolverse antes del lanzamiento.

---

## Test Steps

| # | Ruta | Resultado | Screenshot |
|---|------|-----------|------------|
| 1 | `/` (Home) | PASS — Carga bien, UI premium | `screenshots/01-home.png` |
| 2 | `/login` | PASS — Form correcto | `screenshots/02-login.png` |
| 3 | `/signup` | PASS — Form correcto | `screenshots/03-signup.png` |
| 4 | `/dashboard` | FAIL — Página vacía placeholder | `screenshots/04-dashboard.png` |
| 5 | `/ai` | FAIL — 404 (ruta no existe) | `screenshots/05-ai-page.png` |
| 6 | `/` Upload docs | FAIL — Pipeline Python falla (ver CRÍTICO-1) | — |
| 7 | `/` Chat | PARTIAL — Funciona si hay docs; `list_documents` falla (ver CRÍTICO-1) | — |

---

## CRÍTICOS (Bloqueantes — deben resolverse antes de producción)

### CRÍTICO-1: `SUPABASE_SERVICE_ROLE_KEY` está vacía

**Impacto**: El sistema RAG no funciona sin esta key.

- El pipeline de ingesta Python (`ingest_pipeline.py`) imprime `WARNING: Missing SUPABASE_SERVICE_ROLE_KEY` y asigna `supabase = None`. Los documentos nunca se guardan en la DB.
- El tool `list_documents` en `/api/chat/route.ts` llama a `createClient(url!, serviceKey!)` con serviceKey vacía → crash en runtime.
- `supabase-vector.ts` también falla en `createAdminClient()` lanzando un Error explícito.

**Fix**: Agregar la Service Role Key de Supabase Dashboard → Settings → API en `.env.local`.

---

### CRÍTICO-2: Las APIs de chat y upload NO requieren autenticación

**Impacto**: Cualquier persona sin login puede abusar los endpoints principales.

El middleware excluye explícitamente estas rutas del matcher:
```
'/((?!_next/static|_next/image|favicon.ico|api/auth|api/upload|api/chat|...).*)'
```

Consecuencias:
- `POST /api/chat` → Consumo de tokens de Anthropic sin control (cada mensaje genera 4-6 API calls a Claude Haiku)
- `POST /api/upload` → Cualquiera puede subir archivos al pipeline de ingesta
- Sin rate limiting adicional, esto es un vector de ataque de costos (billing attack)

**Fix**: Agregar validación de sesión al inicio de ambos route handlers, o moverlos fuera de la exclusión del middleware. Agregar rate limiting (upstash/ratelimit o similar).

---

### CRÍTICO-3: Upload tiene "dummy user" como fallback de seguridad

**Impacto**: Datos de múltiples usuarios se mezclan en un solo tenant falso.

En `src/app/api/upload/route.ts`:
```typescript
if (!userId) {
  // Fallback dummy user for demo mode (Valid Supabase user)
  userId = '60f831a2-d501-4405-9600-915709179c79';
}
```

Si alguien llama el endpoint sin `userId` (posible dado CRÍTICO-2), todos sus documentos van al mismo "usuario demo". También la función de búsqueda (`supabase-vector.ts`) usa service_role key que bypassea RLS → retorna chunks de TODOS los usuarios, no solo del usuario actual.

**Fix**: Validar sesión en el upload handler y rechazar con 401 si no hay userId. Agregar filtro `user_id` en las queries de búsqueda.

---

## IMPORTANTES (Deben resolverse antes del lanzamiento)

### IMP-1: Dashboard completamente vacío

`/dashboard` muestra solo el texto "Implementa componentes desde features/dashboard/components/" — es el placeholder del template. No hay ningún componente implementado. El middleware no redirige a `/` desde `/dashboard`.

**Fix**: Implementar el dashboard o redirigir a `/`.

---

### IMP-2: `PYTHON_BIN` hardcodeado a path de dev local

En `.env.local`:
```
PYTHON_BIN=/home/diego/.venvs/saas-rag/bin/python
```

Y en el upload route:
```typescript
const pythonBin = process.env.PYTHON_BIN || '/home/diego/.venvs/saas-rag/bin/python';
```

En producción (Vercel) no hay acceso a `/home/diego/.venvs/`. El proceso spawn fallará silenciosamente.

**Fix**: El pipeline Python no puede correr en Vercel Functions. Opciones: (a) usar un worker externo (Railway/Cloud Run), (b) migrar la ingesta a una Edge Function de Supabase, (c) usar la SDK de Anthropic directamente desde Node.js para parsing.

---

### IMP-3: VectorDBInspector es puramente cosmético

El componente genera 45 puntos con posiciones y textos **aleatorios** — no refleja los chunks reales de la DB. El tooltip muestra vectores falsos (`Math.random()`). El texto "Motor de Indización HNSW: Establecido y Auditado" es marketing, no estado real del sistema.

**Fix para producción**: Mostrar estadísticas reales (total de chunks, documentos indexados, última fecha de ingesta) vía `/api/documents`.

---

### IMP-4: Texto "Fase 5 (B2B Demo)" hardcodeado en la UI

En `src/app/page.tsx`:
```tsx
<p>Phase: <span className="text-white">Fase 5 (B2B Demo)</span></p>
<p>Model: <span className="text-white">Claude 4.6 Sonnet</span></p>
```

El modelo que realmente se usa en el código es `claude-3-haiku-20240307`, no Sonnet 4.6. Esto es confuso y/o engañoso para el cliente.

---

### IMP-5: `alert()` nativo para errores de UX

`DocumentUpload.tsx` usa `alert()` (líneas 38, 57, 60) para mostrar errores. En producción esto es inaceptable — la UI ya tiene un sistema de `showMessage()` implementado correctamente. Los alerts interrumpen el UX y no se pueden estilizar.

**Fix**: Reemplazar todos los `alert()` por llamadas a `showMessage()`.

---

### IMP-6: Sin página 404 personalizada

Al navegar a `/ai` (que no existe), Next.js muestra su 404 genérico sin los estilos de la app. Desgasta la credibilidad del producto ante un cliente.

**Fix**: Crear `src/app/not-found.tsx` con el design system del proyecto.

---

### IMP-7: `AgentFlowVisualizer` importado pero nunca renderizado

El componente existe en `src/features/ai/components/AgentFlowVisualizer.tsx` pero no está incluido en ninguna página. Si se supone que debe mostrar el flujo de agentes (Router → Investigator → Redactor → Auditor), es una feature de valor que está desaprovechada.

---

### IMP-8: Sin `.env.example` ni documentación de variables de entorno

Las variables requeridas son:
- `NEXT_PUBLIC_SUPABASE_URL` ✅
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅  
- `SUPABASE_SERVICE_ROLE_KEY` ❌ VACÍA
- `ANTHROPIC_API_KEY` ✅
- `NEXT_PUBLIC_SITE_URL` ✅
- `PYTHON_BIN` ⚠️ Hardcodeado a dev
- `LLAMA_CLOUD_API_KEY` (opcional)
- `VOYAGE_API_KEY` (opcional)

No existe `.env.example`. Cualquier desarrollador o cliente que clone el repo no sabrá qué configurar.

---

## Arquitectura de Agentes — Evaluación

La arquitectura multi-agente es sólida conceptualmente:

```
User Query
    ↓
Semantic Router (Haiku) → casual | retrieval
    ↓ [retrieval path]
Investigator Agent → Xenova embeddings → Hybrid Search (RPC + ilike fallback)
    ↓
Redactor Agent (Haiku) → JSON estructurado con answer + citations + confidence
    ↓
Auditor Agent (Haiku) → Validación anti-alucinación
    ↓ [si falla, max 2 reintentos con feedback]
Respuesta final al usuario
```

**Puntos fuertes**:
- Loop de auto-corrección Redactor → Auditor es una pattern robusta
- Búsqueda híbrida con 3 estrategias de fallback (RPC → ilike → brute force)
- Embeddings locales con Xenova (sin costo de API)

**Puntos débiles**:
- 4-6 llamadas a Claude Haiku por mensaje de chat → latencia alta (~8-15s) + costo
- El `runCorporateRAG` orquestador existe pero NO se usa en el `/api/chat` — el chat llama directo a `investigatorAgent`. El loop Redactor/Auditor no está activo.
- Embeddings con `all-MiniLM-L6-v2` (384 dims) pueden no coincidir con los vectores almacenados en Supabase si se usó un modelo diferente al indexar.

---

## Checklist: ¿Listo para producción?

| Criterio | Estado |
|----------|--------|
| Auth (login/signup/logout) | ✅ Funciona |
| Protección de rutas (middleware) | ✅ Funciona |
| Upload de documentos | ❌ Falla (SUPABASE_SERVICE_ROLE_KEY vacía + Python no portable) |
| Chat RAG | ⚠️ Parcial (funciona si hay docs; list_documents falla) |
| Seguridad de APIs | ❌ /api/chat y /api/upload sin auth |
| Aislamiento multi-tenant | ❌ Búsqueda retorna docs de todos los usuarios |
| Dashboard | ❌ Vacío |
| Rate limiting | ❌ No existe |
| Error handling UX | ⚠️ Usa alert() en varios lugares |
| Variables de entorno | ❌ Incompletas |
| Deploy en Vercel | ❌ Pipeline Python no es compatible |

---

## Prioridad de Fixes

**Sprint 1 (Bloqueantes — sin esto no funciona nada)**:
1. Agregar `SUPABASE_SERVICE_ROLE_KEY`
2. Agregar auth check en `/api/chat` y `/api/upload`
3. Agregar filtro `user_id` en `performHybridSearch`

**Sprint 2 (Antes de mostrar a clientes)**:
4. Resolver la portabilidad del pipeline Python (worker externo o reescritura en Node)
5. Reemplazar `alert()` por `showMessage()`
6. Quitar textos de "demo" y modelo incorrecto de la UI
7. Crear página 404 personalizada
8. Crear `.env.example`

**Sprint 3 (Calidad de producto)**:
9. Implementar Dashboard o redirigir
10. Hacer VectorDBInspector con datos reales
11. Activar el loop Redactor/Auditor en el chat
12. Agregar rate limiting (Upstash)
13. Integrar AgentFlowVisualizer en la UI

---

## Screenshots

- `screenshots/01-home.png` — Landing page / app principal
- `screenshots/02-login.png` — Página de login
- `screenshots/03-signup.png` — Página de registro
- `screenshots/04-dashboard.png` — Dashboard vacío (placeholder)
- `screenshots/05-ai-page.png` — 404 al intentar navegar a /ai
- `screenshots/07-home-full.png` — App completa (full page)
