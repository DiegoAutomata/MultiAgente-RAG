import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import path from 'path';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.id;

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    // Save file to /tmp
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/\s+/g, '_');
    const tempPath = join('/tmp', safeName);
    await writeFile(tempPath, buffer);

    console.log(`[upload] Saved ${safeName} (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Launching full ingest pipeline...`);

    const projectRoot = path.resolve(process.cwd());
    const scriptPath = join(projectRoot, 'src/features/ai/scripts/ingest_pipeline.py');
    const pythonBin = process.env.PYTHON_BIN || '/home/diego/.venvs/saas-rag/bin/python';

    // Launch full pipeline in background: parse (pdfplumber) + chunk + insert + embeddings
    const child = spawn(pythonBin, [scriptPath, userId, tempPath], {
      detached: true,
      stdio: 'ignore',
      cwd: projectRoot,
    });
    child.unref();

    console.log(`[upload] Pipeline PID ${child.pid} launched. Returning 200 immediately.`);

    return NextResponse.json({
      success: true,
      filename: safeName,
      message: 'Document received. Indexing in background (~1 min for large files).',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[upload] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
