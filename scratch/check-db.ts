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

async function check() {
  const { data: workspaces } = await supabase.from("workspaces").select("*");
  console.log("Workspaces in DB:", JSON.stringify(workspaces, null, 2));

  const { data: campaigns } = await supabase.from("campaigns").select("id, name, workspace_id, status, email_account_id");
  console.log("Campaigns in DB:", JSON.stringify(campaigns, null, 2));

  const { data: accounts } = await supabase.from("email_accounts").select("id, email_address, workspace_id, status");
  console.log("Email Accounts in DB:", JSON.stringify(accounts, null, 2));
}
check();

