import { GmailProvider } from "../lib/email/gmail-provider";
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
  const accountId = "07e1fbbe-159f-4893-9cee-3308a10b1bd5";
  const provider = new GmailProvider(accountId, supabase);

  console.log("Sending real email from veltrixaisolutions1@gmail.com to jimjaaj@gmail.com...");
  const result = await provider.sendEmail({
    to: "jimjaaj@gmail.com",
    subject: "Live Test from Veltrix",
    body: "Hello Jim! Your email sending engine is now fully functional and operational.",
  });

  console.log("SEND RESULT:", JSON.stringify(result, null, 2));
}
test();

