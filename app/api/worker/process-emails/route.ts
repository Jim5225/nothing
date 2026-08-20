import { NextResponse } from "next/server";
import { processEmailQueue } from "@/lib/email/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max duration for serverless processing

export async function POST(req: Request) {
  try {
    // Basic security to prevent random external triggers
    const authHeader = req.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await processEmailQueue();
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Worker error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // Allow GET for easy testing or Vercel cron invocation if preferred, 
  // though POST is strictly better for state-changing operations.
  return POST(req);
}
