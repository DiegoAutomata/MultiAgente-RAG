# PRP-001: Mejoras Proyecto MultiAgente-RAG

> **Estado**: PENDIENTE
> **Fecha**: 2026-04-05
> **Proyecto**: MultiAgente-RAG

---

## Objetivo

Tres mejoras coordinadas al sistema Enterprise RAG Auditor: (1) hacer que VectorDBInspector cargue datos reales de la BD al iniciar — sin depender del flag `documentUploaded`; (2) paralelizar la generación de embeddings en el pipeline de ingesta para reducir el tiempo de indexado de PDFs grandes; (3) corregir otros dos problemas detectados: el inspector no se refresca al eliminar documentos, y los embeddings se generan en serie (1 a 1) en lugar de en batch.

---

## Por Qué

| Problema | Solución |
|----------|----------|
| VectorDBInspector solo se activa cuando `documentUploaded === true` en el store Zustand — si el usuario recarga la página, el visualizador aparece vacío aunque haya documentos en la BD | Cargar documentos reales en `useEffect` al montar, sin condición de store |
| Al eliminar un documento (último o todos), el VectorDBInspector no se actualiza — los clusters quedan visibles | Exponer una función `refreshDocuments` desde el store o levantar el estado a un hook compartido |
| Los embeddings se actualizan uno a uno con un `supabase.update()` individual por chunk (líneas 114-118 de `ingest_pipeline.py`). Para un PDF de 500 chunks esto produce 500 round-trips a la BD | Reemplazar el loop individual por batch updates usando `upsert` con array de rows |
| La pestaña "¿Cómo funciona?" en AgentFlowVisualizer muestra el diagrama pero el código usa emojis hardcodeados (`👤`, `0%`, `📐`, `🔒`) en `ArchitectureDiagram.tsx` — viola la regla "no emojis en código salvo solicitud explícita" | Reemplazar emojis con iconos Lucide consistentes |

**Valor de negocio**: El visualizador de vectores es el elemento visual más llamativo del producto — que aparezca vacío al recargar deteriora la percepción de calidad. La optimización de embeddings reduce tiempos de indexado de ~5 min (500 round-trips) a ~30 s (1 upsert batch).

---

## Qué

### Criterios de Éxito
- [ ] VectorDBInspector muestra documentos y clusters al recargar la página (sin subir nada nuevo)
- [ ] VectorDBInspector se vacía inmediatamente al eliminar documentos (sin recargar página)
- [ ] `ingest_pipeline.py` genera e inserta embeddings en un solo `upsert` batch — no loops de `update()`
- [ ] `ArchitectureDiagram.tsx` usa iconos Lucide en lugar de emojis
- [ ] `npm run typecheck` pasa sin errores nuevos
- [ ] `npm run build` exitoso

### Comportamiento Esperado

**Happy Path — Visualizador:**
1. Usuario abre la app por primera vez en una sesión nueva
2. VectorDBInspector llama `GET /api/documents` en `useEffect` sin condición
3. Si hay documentos indexados, los clusters aparecen automáticamente con colores por documento
4. El usuario elimina el último archivo → el inspector se vacía sin recargar

**Happy Path — Velocidad de indexado:**
1. Usuario sube PDF de 200 páginas (~300 chunks)
2. Fase 1 (parse + insert chunks): igual que hoy, ~10-15 s
3. Fase 2 (embeddings): encode en batch con sentence_transformers → un solo `upsert` en Supabase → ~5-10 s total (vs ~5 min actual)

---

## Contexto

### Referencias
- `src/features/ai/components/VectorDBInspector.tsx` — componente a modificar (carga condicional)
- `src/features/ai/store/rag-store.ts` — store Zustand con `documentUploaded` e `isUploadingDocument`
- `src/features/ai/scripts/ingest_pipeline.py` — función `generate_and_store_embeddings()` líneas 86-120
- `src/features/ai/components/DocumentUpload.tsx` — llama a los endpoints DELETE y necesita notificar al inspector
- `src/features/ai/components/ArchitectureDiagram.tsx` — emojis a reemplazar
- `src/app/api/documents/route.ts` — GET y DELETE de documentos

### Arquitectura Propuesta

**Fase 1 — Inspector siempre activo:**

El problema raíz es que `VectorDBInspector` solo llama al API cuando `hasData = documentUploaded || isUploadingDocument`. Al recargar la página, el store se reinicia a `false` aunque haya datos en BD.

Solución: quitar la condición `if (!hasData) return` del `useEffect` y llamar `GET /api/documents` siempre al montar. Usar el resultado para determinar si mostrar clusters o estado vacío.

```
VectorDBInspector (antes):
  useEffect → solo si hasData → fetch /api/documents

VectorDBInspector (después):
  useEffect → siempre al montar → fetch /api/documents
  hasData = documents.length > 0 || isUploadingDocument
```

Esto también resuelve el refresh al eliminar: DocumentUpload ya llama a `setDocumentUploaded(false)` pero el inspector no re-fetcha. La solución es agregar una función `refreshDocuments` en el store (o un callback) que DocumentUpload pueda llamar, y que VectorDBInspector escuche.

Alternativa más simple (preferida por KISS): agregar un estado `lastRefreshAt: number` al store. DocumentUpload lo actualiza con `Date.now()` tras cualquier DELETE. VectorDBInspector lo incluye en el `useEffect` dependency array y re-fetcha.

**Fase 2 — Batch embeddings en Python:**

```python
# ANTES (500 round-trips):
for chunk_id, emb in zip(ids, embeddings):
    supabase.table("document_chunks").update({"embedding": emb}).eq("id", chunk_id).execute()

# DESPUÉS (1 upsert batch):
BATCH_SIZE = 200  # Supabase permite ~1000 rows por request
rows_to_upsert = [
    {"id": chunk_id, "document_id": rows.data[i]["document_id"],
     "content": rows.data[i]["content"], "chunk_index": rows.data[i]["chunk_index"],
     "embedding": emb}
    for i, (chunk_id, emb) in enumerate(zip(ids, embeddings))
]
for i in range(0, len(rows_to_upsert), BATCH_SIZE):
    supabase.table("document_chunks").upsert(rows_to_upsert[i:i+BATCH_SIZE]).execute()
```

Nota: el upsert necesita todos los campos NOT NULL del schema (al menos `document_id`, `content`, `chunk_index`) para no violar constraints. Leer todos estos campos en el SELECT inicial (ya se hace).

**Fase 3 — ArchitectureDiagram sin emojis:**

Reemplazar `👤` → `<User size={9} />` (ya se importa User en AgentFlowVisualizer, disponible como import), `0%` → texto, `📐` → `<Ruler size={8}/>`, `🔒` → `<Lock size={8}/>`.

### Modelo de Datos (sin cambios)
No se requieren migraciones. Las tablas `documents` y `document_chunks` ya existen con el schema correcto. El upsert batch usa el mismo schema.

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar)

### Fase 1: VectorDBInspector — Carga Inicial Sin Condición
**Objetivo**: El visualizador carga documentos reales desde la BD al montar, independientemente del estado del store Zustand. El usuario puede recargar la página y ver sus documentos indexados.
**Validación**: Abrir la app en una sesión nueva (o simular store vacío) — el inspector muestra los clusters si hay documentos en BD.

### Fase 2: VectorDBInspector — Refresh Tras DELETE
**Objetivo**: Agregar mecanismo de refresh al store que DocumentUpload dispara tras eliminar documentos. VectorDBInspector re-fetcha automáticamente.
**Validación**: Hacer click en "Eliminar último archivo" o "Vaciar base de datos" → clusters desaparecen inmediatamente del visualizador.

### Fase 3: Pipeline Python — Batch Embeddings
**Objetivo**: Reemplazar el loop de 500 `update()` individuales por `upsert` en batches de 200 rows. Reducir tiempo de Fase 2 de ~5 min a ~10 s para PDFs grandes.
**Validación**: Subir PDF de 100+ páginas y medir tiempo total de indexado en logs. Verificar que los embeddings están presentes en BD después.

### Fase 4: ArchitectureDiagram — Iconos Lucide
**Objetivo**: Reemplazar los emojis hardcodeados en `ArchitectureDiagram.tsx` con iconos de Lucide React, siguiendo el patrón del resto del sistema.
**Validación**: Inspección visual del modal "¿Cómo funciona?" — sin emojis, iconos consistentes con el design system.

### Fase 5: Validación Final
**Objetivo**: Sistema funcionando end-to-end con todas las mejoras integradas.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright screenshot confirma VectorDBInspector con datos reales al cargar
- [ ] Logs de ingesta muestran reducción de round-trips en Fase 2

---

## Gotchas

> Cosas críticas a tener en cuenta ANTES de implementar

- [ ] El upsert batch en Supabase requiere todos los campos NOT NULL — asegurar que el SELECT de chunks incluye `document_id`, `content`, `chunk_index` (ya los incluye en la línea 90)
- [ ] Supabase tiene límite de payload por request (~1 MB). Con embeddings de 384 floats × 200 chunks ≈ 300KB — usar BATCH_SIZE=200 es seguro. Si fuera 384-dim float32 × 200 = ~300KB, OK.
- [ ] El `useEffect` del VectorDBInspector actualmente tiene `[hasData]` como dependency. Al quitar la condición y agregar `lastRefreshAt`, hay que incluirlo en el array de dependencias para evitar stale closures
- [ ] DocumentUpload actualiza `documentUploaded` pero VectorDBInspector derivaba `hasData` de eso. Al desacoplar, asegurar que el estado `documents.length > 0` controla correctamente el estado visual (idle vs activo)
- [ ] En ArchitectureDiagram, `<User />` es de Lucide — verificar que el import es de `lucide-react` y no hay conflicto de nombre con el tipo `User` de Supabase auth

## Anti-Patrones

- NO refactorizar el store completo — solo agregar `lastRefreshAt` y su setter
- NO cambiar el modelo de datos ni las migraciones existentes
- NO usar `any` en TypeScript — mantener tipos explícitos
- NO hardcodear IDs de documentos — siempre filtrar por `user_id` (RLS + service key ya lo garantizan)
- NO ignorar el error de Supabase en el upsert batch — log + fallback al método individual si falla

---

## Aprendizajes (Self-Annealing)

> Esta sección CRECE con cada error encontrado durante la implementación.

### [2026-04-05]: Investigación inicial — bottlenecks identificados
- **Hallazgo**: El loop individual de embeddings (500 `update()`) era el mayor bottleneck de velocidad, no el modelo de ML
- **Hallazgo**: VectorDBInspector dependía de un flag de sesión en lugar de datos reales de BD — invisible en sesiones nuevas
- **Aplicar en**: Todo componente que muestre datos persistentes debe cargar desde la BD al montar, no depender de flags de sesión

---

*PRP pendiente aprobación. No se ha modificado código.*