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

async function testQuery() {
  const campaignId = "f9271b01-1ea7-473d-a669-ab2999960f5b";
  const workspaceId = "730d177a-c3c0-407a-9bd8-4d905a8832de";

  const { data: campaign, error: campError } = await supabase
    .from("campaigns")
    .select("*, email_accounts(status), email_templates:template_id(*)")
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId)
    .single();

  console.log("Query Result Campaign:", JSON.stringify(campaign, null, 2));
  console.log("Query Error:", campError);
}
testQuery();

