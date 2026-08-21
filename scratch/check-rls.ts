import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const env = fs.readFileSync(".env.local", "utf-8");
function getEnv(key: string) {
  const line = env.split(/\r?\n/).find(l => l.includes(key));
  if (!line) return "";
  return line.split("=")[1]?.replace(/["\r]/g, "").trim() || "";
}

const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(url, anonKey);

async function check() {
  const { data: workspaces, error: wErr } = await supabase.from("workspaces").select("*");
  console.log("Anon Workspaces:", workspaces, "Error:", wErr);

  const { data: campaigns, error: cErr } = await supabase.from("campaigns").select("*");
  console.log("Anon Campaigns:", campaigns, "Error:", cErr);
}
check();

