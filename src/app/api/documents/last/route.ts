import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/documents/last — elimina el último documento subido por el usuario
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: docs, error: fetchError } = await supabase
    .from('documents')
    .select('id, title')
    .order('created_at', { ascending: false })
    .limit(1)

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!docs || docs.length === 0) {
    return NextResponse.json({ error: 'No hay documentos para eliminar.' }, { status: 404 })
  }

  const lastDoc = docs[0]
  const { error: deleteError } = await supabase
    .from('documents')
    .delete()
    .eq('id', lastDoc.id)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
  return NextResponse.json({ success: true, deleted: lastDoc.title })
}
