import { processEmailQueue } from "../lib/email/worker";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const env = fs.readFileSync(".env.local", "utf-8");
function getEnv(key: string) {
  const line = env.split(/\r?\n/).find(l => l.includes(key));
  if (!line) return "";
  return line.split("=")[1]?.replace(/["\r]/g, "").trim() || "";
}

process.env.GOOGLE_CLIENT_ID = getEnv("GOOGLE_CLIENT_ID");
process.env.GOOGLE_CLIENT_SECRET = getEnv("GOOGLE_CLIENT_SECRET");
process.env.NEXT_PUBLIC_SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
process.env.SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  // Set campaign to approved so worker processes it
  const campaignId = "f9271b01-1ea7-473d-a669-ab2999960f5b";
  await supabase.from("campaigns").update({ status: "approved" }).eq("id", campaignId);
  
  // Set the jobs back to queued
  await supabase.from("email_jobs").update({ status: "queued", attempt_count: 0 }).eq("workspace_id", "730d177a-c3c0-407a-9bd8-4d905a8832de");

  console.log("Processing email queue...");
  const result = await processEmailQueue(supabase);
  console.log("QUEUE PROCESSING RESULT:", JSON.stringify(result, null, 2));

  const { data: updatedJobs } = await supabase.from("email_jobs").select("*");
  console.log("UPDATED JOBS:", JSON.stringify(updatedJobs, null, 2));
}
test();

