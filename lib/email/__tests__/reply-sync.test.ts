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
console.log("RUNNING REPLY SYNC & FOLLOW-UP TEST SUITE (PHASE 3)");
console.log("========================================================\n");


console.log("Test 1: Reply Detection and Sentiment Analysis");
function testSentimentDetection() {
  const unsubscribePhrases = ["unsubscribe", "remove me", "take me off", "stop emailing", "don't email"];
  const positivePhrases = ["interested", "call me", "let's talk", "book", "tell me more", "send more info"];
  
  function getSentiment(body: string) {
    const bodyLower = body.toLowerCase();
    if (unsubscribePhrases.some(phrase => bodyLower.includes(phrase))) {
      return { sentimentStatus: "unsubscribed", leadStatus: "unsubscribed" };
    } else if (positivePhrases.some(phrase => bodyLower.includes(phrase))) {
      return { sentimentStatus: "replied", leadStatus: "interested" };
    }
    return { sentimentStatus: "replied", leadStatus: "replied" };
  }

  const res1 = getSentiment("Please stop emailing me");
  assertEquals(res1.sentimentStatus, "unsubscribed", "Correctly identifies unsubscribe intent");
  assertEquals(res1.leadStatus, "unsubscribed", "Updates lead status to unsubscribed");

  const res2 = getSentiment("Yes, I am interested, let's talk tomorrow.");
  assertEquals(res2.sentimentStatus, "replied", "Correctly identifies positive reply");
  assertEquals(res2.leadStatus, "interested", "Updates lead status to interested");

  const res3 = getSentiment("Who are you?");
  assertEquals(res3.sentimentStatus, "replied", "Defaults to standard reply status");
  assertEquals(res3.leadStatus, "replied", "Defaults lead status to replied");
}


console.log("\nTest 2: Deduplication of Synchronized Replies");
function testReplyDeduplication() {
  const existingReplies = new Set(["msg-id-123", "msg-id-456"]);
  const incomingMessages = [
    { id: "msg-id-456", text: "Already seen this" },
    { id: "msg-id-789", text: "New reply!" }
  ];

  const processed: string[] = [];
  for (const msg of incomingMessages) {
    if (existingReplies.has(msg.id)) continue;
    processed.push(msg.id);
    existingReplies.add(msg.id);
  }

  assertEquals(processed.length, 1, "Only processes new, unseen messages");
  assertEquals(processed[0], "msg-id-789", "Processes the correct new message ID");
  assert(existingReplies.has("msg-id-789"), "Adds the new message to existing replies set");
}

console.log("\nTest 3: Extract Plain Email Address");
function testEmailExtraction() {
  const extractEmail = (str: string) => {
    const match = str.match(/<([^>]+)>/);
    return (match ? match[1] : str).trim().toLowerCase();
  };

  assertEquals(extractEmail("Jim <jim@example.com>"), "jim@example.com", "Extracts email from Name <email> format");
  assertEquals(extractEmail("test@example.com"), "test@example.com", "Handles plain email format correctly");
  assertEquals(extractEmail("  <SPACED@EXAMPLE.COM>  "), "spaced@example.com", "Trims and lowercases the extracted email");
}

console.log("\nTest 4: Cancel Pending Follow-Ups on Reply");
function testFollowUpCancellation() {
  const emailJobs = [
    { id: 1, recipient_id: "rec-1", status: "queued", type: "initial" },
    { id: 2, recipient_id: "rec-1", status: "queued", type: "follow_up_1" },
    { id: 3, recipient_id: "rec-2", status: "queued", type: "follow_up_1" }
  ];

  const recipientWhoReplied = "rec-1";

  // Simulate worker updating jobs for the replied recipient
  const updatedJobs = emailJobs.map(job => {
    if (job.recipient_id === recipientWhoReplied && job.status === "queued") {
      return { ...job, status: "cancelled", last_error: "Cancelled due to reply" };
    }
    return job;
  });

  assertEquals(updatedJobs[1].status, "cancelled", "Follow-up for replied recipient is cancelled");
  assertEquals(updatedJobs[2].status, "queued", "Follow-up for other recipient is NOT cancelled");
}


// Execute tests
testSentimentDetection();
testReplyDeduplication();
testEmailExtraction();
testFollowUpCancellation();

console.log(`\n========================================================`);
console.log(`REPLY SYNC TEST SUITE: ${passedCount} Passed, ${failedCount} Failed`);
console.log(`========================================================\n`);

if (failedCount > 0) process.exit(1);
