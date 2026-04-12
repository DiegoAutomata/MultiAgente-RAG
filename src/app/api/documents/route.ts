import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/documents — lista los documentos del usuario autenticado con chunk counts reales
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('documents')
    .select('id, title, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[documents] GET error:', error.message)
    return NextResponse.json({ error: 'Error al obtener documentos.' }, { status: 500 })
  }

  // Fetch chunk counts per document in parallel
  const docs = data ?? []
  const docsWithCounts = await Promise.all(
    docs.map(async (doc) => {
      const { count } = await supabase
        .from('document_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', doc.id)
      return { ...doc, chunk_count: count ?? 0 }
    })
  )

  return NextResponse.json({ documents: docsWithCounts })
}

// DELETE /api/documents — vacía TODOS los documentos del usuario (RLS garantiza solo los suyos)
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS ensures only the user's own documents are deleted
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    console.error('[documents] DELETE error:', error.message)
    return NextResponse.json({ error: 'Error al eliminar documentos.' }, { status: 500 })
  }
  return NextResponse.json({ success: true, message: 'Base de datos vaciada.' })
}
