import { processEmailQueue } from "../lib/email/worker";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const env = fs.readFileSync(".env.local", "utf-8");
function getEnv(key: string) {
  const line = env.split(/\r?\n/).find(l => l.includes(key));
  if (!line) return "";
  return line.split("=")[1]?.replace(/["\r]/g, "").trim() || "";
}

const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const key = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const supabase = createClient(url, key);

async function run() {
  console.log("=== RUNNING processEmailQueue() DIRECTLY ===");
  try {
    const result = await processEmailQueue(supabase);
    console.log("Worker Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Worker Threw Error:", err);
  }
}
run();

