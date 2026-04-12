import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import path from 'path';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

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

    // Rate limit: max 5 uploads per user per hour
    const rl = await rateLimit(`upload:${userId}`, 5, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Límite de subidas alcanzado. Máximo 5 documentos por hora.' },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    // Validate file size (max 200MB)
    const MAX_SIZE = 200 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Archivo demasiado grande. Máximo 200MB.' }, { status: 413 });
    }

    // Layer 1: extension allowlist
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'txt'].includes(ext ?? '')) {
      return NextResponse.json({ error: 'Solo se permiten archivos PDF o TXT.' }, { status: 415 });
    }

    // Layer 2: MIME type check (defense against accidental wrong files)
    const ALLOWED_MIME: Record<string, string> = {
      pdf: 'application/pdf',
      txt: 'text/plain',
    };
    if (file.type && file.type !== ALLOWED_MIME[ext ?? '']) {
      return NextResponse.json({ error: 'El tipo de archivo no coincide con la extensión.' }, { status: 415 });
    }

    // Read file into buffer first (needed for magic bytes check)
    const buffer = Buffer.from(await file.arrayBuffer());

    // Layer 3: magic bytes — PDFs always start with %PDF (cannot be spoofed without breaking the parser)
    if (ext === 'pdf') {
      const magic = buffer.slice(0, 4).toString('ascii');
      if (magic !== '%PDF') {
        return NextResponse.json({ error: 'El archivo no es un PDF válido.' }, { status: 415 });
      }
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempPath = join('/tmp', `${randomUUID()}-${safeName}`);
    await writeFile(tempPath, buffer);

    console.log(`[upload] Saved ${safeName} (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Launching full ingest pipeline...`);

    const projectRoot = path.resolve(process.cwd());
    const scriptPath = join(projectRoot, 'src/features/ai/scripts/ingest_pipeline.py');
    const pythonBin = process.env.PYTHON_BIN || 'python3';

    // Allowlist: only recognizable python binary names/paths are accepted
    const PYTHON_ALLOWLIST = [
      /^python3?$/,
      /^\/usr\/(local\/)?bin\/python3?(\.\d+)?$/,
      /^\/home\/[a-zA-Z0-9_-]+\/\.venvs\/[a-zA-Z0-9_.-]+\/bin\/python3?$/,
      /^\/opt\/[a-zA-Z0-9_.-]+\/bin\/python3?$/,
    ];
    if (!PYTHON_ALLOWLIST.some(pattern => pattern.test(pythonBin))) {
      console.error('[upload] Rejected PYTHON_BIN value:', pythonBin);
      return NextResponse.json({ error: 'Error de configuración del servidor.' }, { status: 500 });
    }

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
    return NextResponse.json({ error: 'Error interno al procesar el archivo.' }, { status: 500 });
  }
}
