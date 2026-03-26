
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Simple .env parser to avoid 'dotenv' dependency
function getEnv() {
  const envPath = ".env";
  if (!fs.existsSync(envPath)) return process.env;
  const content = fs.readFileSync(envPath, "utf-8");
  const env: any = { ...process.env };
  content.split("\n").forEach(line => {
    const [key, ...val] = line.split("=");
    if (key && val) env[key.trim()] = val.join("=").trim();
  });
  return env;
}

async function checkDb() {
  const env = getEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    console.log("Current keys available:", Object.keys(env).filter(k => k.includes("SUPABASE")));
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);
  console.log("--- Checking Database Status ---");

  const { count: docCount, error: docErr } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true });
  
  if (docErr) console.error("❌ Error fetching documents:", docErr.message);
  else console.log(`📄 Total Documents: ${docCount}`);

  const { count: chunkCount, error: chunkErr } = await supabase
    .from("document_chunks")
    .select("*", { count: "exact", head: true });
  
  if (chunkErr) console.error("❌ Error fetching document_chunks:", chunkErr.message);
  else console.log(`🧩 Total Chunks: ${chunkCount}`);

  console.log("--- Testing RPC Function ---");
  const { data: rpcRes, error: rpcErr } = await supabase.rpc("match_document_chunks_hybrid", {
    query_text: "test",
    query_embedding: new Array(384).fill(0),
    match_count: 1,
    full_text_weight: 1.0,
    semantic_weight: 1.0,
    rrf_k: 50
  });

  if (rpcErr) {
    console.warn("⚠️ RPC FAILED:", rpcErr.message);
    // Try simple call to see if it's the schema
    const { data: schemaTest, error: schemaErr } = await supabase.from("document_chunks").select("id").limit(1);
    if (schemaErr) console.error("❌ Table document_chunks is not accessible:", schemaErr.message);
    else console.log("✅ Table document_chunks is accessible.");
  } else {
    console.log("✅ RPC Function is present and working.");
  }
}

checkDb();
