import { NextResponse } from "next/server";
import { processEmailQueue } from "@/lib/email/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max duration for serverless processing

export async function POST(req: Request) {
  try {
    // Validate Bearer authorization secret if configured
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing bearer token." },
        { status: 401 }
      );
    }

    const result = await processEmailQueue();
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[Worker Route Error]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown worker error" },
      { status: 500 }
    );
  }
}

/**
 * Requirement 16: GET requests must NEVER trigger email sending or state-changing operations.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "Method Not Allowed: GET requests cannot trigger state-changing worker execution. Use POST with authorization.",
    },
    { status: 405 }
  );
}
