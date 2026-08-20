import { NextResponse } from "next/server";
import { processReplySync } from "@/lib/email/reply-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 300; 

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await processReplySync();
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Reply sync error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
