import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    let userId = formData.get('userId') as string;

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    if (!userId) {
      // Fallback dummy user for demo mode (Valid Supabase user)
      userId = '60f831a2-d501-4405-9600-915709179c79';
    }

    // Save file to /tmp
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/\s+/g, '_');
    const tempPath = join('/tmp', safeName);
    await writeFile(tempPath, buffer);

    console.log(`[upload] Saved file to ${tempPath}. Launching ingestion pipeline in background...`);

    // Resolve project root so the script path is always correct regardless of CWD
    const projectRoot = path.resolve(process.cwd());
    const scriptPath = join(projectRoot, 'src/features/ai/scripts/ingest_pipeline.py');
    const pythonBin = process.env.PYTHON_BIN || '/home/diego/.venvs/saas-rag/bin/python';

    // Spawn detached so it survives beyond the HTTP response
    const child = spawn(pythonBin, [scriptPath, userId, tempPath], {
      detached: true,
      stdio: 'ignore',
      cwd: projectRoot,
    });
    child.unref(); // Allow Node to exit without waiting for this child

    console.log(`[upload] Ingestion process launched (PID ${child.pid}). Returning 200 immediately.`);

    return NextResponse.json({
      success: true,
      message: 'Document received and indexing in background. This takes 2-5 minutes.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[upload] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
