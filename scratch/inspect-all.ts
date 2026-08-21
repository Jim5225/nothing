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

async function inspect() {
  const { data: campaigns } = await supabase.from("campaigns").select("*");
  console.log("--- ALL CAMPAIGNS ---");
  console.log(JSON.stringify(campaigns, null, 2));

  const { data: accounts } = await supabase.from("email_accounts").select("*");
  console.log("--- ALL EMAIL ACCOUNTS ---");
  console.log(JSON.stringify(accounts, null, 2));

  const { data: jobs } = await supabase.from("email_jobs").select("*").order("created_at", { ascending: false }).limit(10);
  console.log("--- LATEST 10 EMAIL JOBS ---");
  console.log(JSON.stringify(jobs, null, 2));

  const { data: recipients } = await supabase.from("campaign_recipients").select("*, leads(*)").limit(10);
  console.log("--- SAMPLE 10 RECIPIENTS ---");
  console.log(JSON.stringify(recipients, null, 2));
}
inspect();

