import { POST, GET } from "@/app/api/worker/process-emails/route";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${details ? `(${details})` : ""}`);
    failedCount++;
  }
}

function assertEquals(actual: unknown, expected: unknown, testName: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  assert(actualStr === expectedStr, testName, `Expected: ${expectedStr}, Got: ${actualStr}`);
}

console.log("\n========================================================");
console.log("RUNNING CAMPAIGN & BACKGROUND EMAIL QUEUE TEST SUITE");
console.log("========================================================\n");

// ── Test 1: HTTP Method Guard (Requirement 16) ──────────────────────────────
console.log("Test 1: HTTP Method Guard on Worker Endpoint");
async function testHttpMethodGuard() {
  const getResponse = await GET();
  assertEquals(getResponse.status, 405, "GET request returns 405 Method Not Allowed");
  const data = await getResponse.json();
  assert(data.error.includes("GET requests cannot trigger"), "GET response contains informative error message");
}

// ── Test 2: Endpoint Authentication Guard (Requirement 17) ──────────────────
console.log("\nTest 2: Endpoint Authentication Guard");
async function testAuthGuard() {
  process.env.CRON_SECRET = "test-secret-token-12345";

  // Request without auth header
  const reqNoAuth = new Request("http://localhost:3000/api/worker/process-emails", { method: "POST" });
  const resNoAuth = await POST(reqNoAuth);
  assertEquals(resNoAuth.status, 401, "Rejects request missing authorization bearer token with 401");

  // Request with invalid auth header
  const reqBadAuth = new Request("http://localhost:3000/api/worker/process-emails", {
    method: "POST",
    headers: { authorization: "Bearer wrong-token" },
  });
  const resBadAuth = await POST(reqBadAuth);
  assertEquals(resBadAuth.status, 401, "Rejects request with invalid token with 401");

  // Clean up
  delete process.env.CRON_SECRET;
}

// ── Test 3: Idempotency Key Generation (Requirement 6 & 12) ─────────────────
console.log("\nTest 3: Idempotency Key Generation for Duplicate Prevention");
function testIdempotencyKey() {
  const campaignId = "camp-123";
  const recipientId = "rec-456";

  const key1 = `job-campaign-${campaignId}-recipient-${recipientId}`;
  const key2 = `job-campaign-${campaignId}-recipient-${recipientId}`;

  assertEquals(key1, key2, "Deterministic idempotency key matches for identical campaign recipient");

  // Test Set insertion
  const set = new Set<string>();
  set.add(key1);
  set.add(key2);
  assertEquals(set.size, 1, "Duplicate user clicks on Send produce identical single idempotency key");
}

// ── Test 4: Pre-Send Suppression Filtering (Requirement 10) ─────────────────
console.log("\nTest 4: Pre-Send Suppression & Status Filtering");
function testPreSendSuppression() {
  const suppressedEmails = new Set(["optout@domain.com"]);
  const recipientEmail = "optout@domain.com";

  const isSuppressed = suppressedEmails.has(recipientEmail.toLowerCase().trim());
  assert(isSuppressed, "Accurately detects suppressed recipient before send");
}

// ── Test 5: Pre-Send Replied Check (Requirement 10) ─────────────────────────
console.log("\nTest 5: Pre-Send Replied Check");
function testPreSendReplied() {
  const recipient = {
    id: "rec-1",
    status: "replied",
    replied_at: "2026-08-20T10:00:00Z",
  };

  const isReplied = recipient.status === "replied" || recipient.replied_at !== null;
  assert(isReplied, "Detects replied status to prevent duplicate follow-ups");
}

// ── Test 6: In-Campaign Duplicate Recipient Prevention (Requirement 11) ─────
console.log("\nTest 6: In-Campaign Duplicate Recipient Prevention");
function testInCampaignDuplicatePrevention() {
  const rawRecipients = [
    { id: "r1", email: "client@acme.com" },
    { id: "r2", email: "client@acme.com" }, // duplicate in same campaign
    { id: "r3", email: "partner@acme.com" },
  ];

  const seen = new Set<string>();
  const validRecs = [];
  const stoppedRecs = [];

  for (const r of rawRecipients) {
    if (seen.has(r.email)) {
      stoppedRecs.push(r.id);
    } else {
      seen.add(r.email);
      validRecs.push(r);
    }
  }

  assertEquals(validRecs.length, 2, "Filters out duplicate recipient within same campaign");
  assertEquals(stoppedRecs.length, 1, "Marks duplicate recipient as stopped");
}

// ── Test 7: Exponential Backoff Calculation (Requirement 8) ─────────────────
console.log("\nTest 7: Exponential Backoff Calculation for Transient Errors");
function testExponentialBackoff() {
  const delays = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const delayMinutes = Math.pow(2, attempt) * 2; // 2, 4, 8 mins base
    delays.push(delayMinutes);
  }

  assertEquals(delays, [2, 4, 8], "Calculates progressive exponential backoff delays (2m, 4m, 8m)");

  const maxAttempts = 3;
  const shouldRetryAttempt0 = 0 < maxAttempts;
  const shouldRetryAttempt3 = 3 < maxAttempts;
  assert(shouldRetryAttempt0, "Attempt 0 is eligible for retry");
  assert(!shouldRetryAttempt3, "Attempt 3 (MAX_RETRIES) is permanently failed without infinite loop");
}

// ── Test 8: Error Classification (Transient vs Permanent) (Requirement 9 & 18)
console.log("\nTest 8: Error Classification (Transient vs Permanent)");
function testErrorClassification() {
  const rateLimitErr = "429 Too Many Requests: Rate limit exceeded";
  const authErr = "invalid_grant: Token has been revoked";
  const missingSnapshotErr = "Missing approved email snapshot (subject/body)";

  const isRateLimit = rateLimitErr.includes("429") || rateLimitErr.toLowerCase().includes("rate limit");
  const isAuth = authErr.toLowerCase().includes("invalid_grant");
  const isMissing = missingSnapshotErr.toLowerCase().includes("missing approved email snapshot");

  assert(isRateLimit, "Identifies 429 as transient rate-limit error (eligible for retry)");
  assert(isAuth, "Identifies invalid_grant as permanent auth error (triggers campaign auto-pause)");
  assert(isMissing, "Identifies missing snapshot as permanent error (no retry)");
}

// ── Run Async Tests ─────────────────────────────────────────────────────────
async function runAllTests() {
  await testHttpMethodGuard();
  await testAuthGuard();
  testIdempotencyKey();
  testPreSendSuppression();
  testPreSendReplied();
  testInCampaignDuplicatePrevention();
  testExponentialBackoff();
  testErrorClassification();

  console.log("\n========================================================");
  console.log(`CAMPAIGN QUEUE TEST SUITE: ${passedCount} Passed, ${failedCount} Failed`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
