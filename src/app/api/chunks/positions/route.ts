import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

// GET /api/chunks/positions
// Returns {id, document_id, x_2d, y_2d} for all chunks belonging to the user.
// Only returns rows where x_2d/y_2d have been computed (non-null).
// Returns empty array (not an error) when columns don't exist yet or no 2D data.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: max 30 requests per user per minute (this endpoint is polled by the visualizer)
  const rl = await rateLimit(`chunks-positions:${user.id}`, 30, 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes.' }, { status: 429 })
  }

  // Get all document IDs belonging to this user
  const { data: docs, error: docsErr } = await supabase
    .from('documents')
    .select('id')
    .eq('user_id', user.id)

  if (docsErr || !docs || docs.length === 0) {
    return NextResponse.json({ positions: [] })
  }

  const docIds = docs.map(d => d.id)

  // Fetch 2D positions — columns may not exist yet (migration not applied)
  const { data, error } = await supabase
    .from('document_chunks')
    .select('id, document_id, x_2d, y_2d')
    .in('document_id', docIds)
    .not('x_2d', 'is', null)
    .not('y_2d', 'is', null)
    .limit(2000)

  if (error) {
    // Columns don't exist yet — return empty gracefully
    return NextResponse.json({ positions: [] })
  }

  return NextResponse.json({ positions: data ?? [] })
}
