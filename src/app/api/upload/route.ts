import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export const maxDuration = 300; // 5 minutes allow for huge PDFs in Vercel
export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const tempPath = join('/tmp', file.name.replace(/\s+/g, '_'));
    await writeFile(tempPath, buffer);

    console.log(`Starting background ingestion for ${file.name}...`);
    
    // We run the Python core workflow directly from Node, allowing up to 50MB of stdout buffering
    const command = `./venv/bin/python src/features/ai/scripts/ingest_pipeline.py ${userId} ${tempPath}`;
    
    const { stdout, stderr } = await execAsync(command, { maxBuffer: 1024 * 1024 * 50 });
    console.log("Ingestion output:", stdout);
    if (stderr) console.error("Ingestion stderr logs (might be informational):", stderr);

    return NextResponse.json({ success: true, message: 'Document ingested successfully' });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
