import type Database from "better-sqlite3";
import { verifySignature } from "../crypto/signing.js";
import { refreshReputationCache } from "./reputation.js";

const DOMAINS = [
  "task_completion",
  "reliability",
  "information_quality",
  "collaboration",
  "communication",
] as const;

const RATE_LIMIT_WINDOW_MS = 3600_000; // 1 hour
const MAX_REPORTS_PER_PAIR_PER_WINDOW = 5;

export interface InteractionReport {
  id: string;
  reporter: string;
  subject: string;
  timestamp: string;
  domain: string;
  score: number;
  context?: Record<string, unknown>;
  signature: string;
}

/**
 * Submit an interaction report. Validates signature, checks anti-gaming rules,
 * stores the report, and triggers reputation recomputation.
 */
export function submitReport(
  db: Database.Database,
  report: InteractionReport
): { accepted: boolean; error?: string } {
  // 1. Validate domain
  if (!DOMAINS.includes(report.domain as (typeof DOMAINS)[number])) {
    return { accepted: false, error: `Invalid domain: ${report.domain}` };
  }

  // 2. Validate score range
  if (report.score < -1 || report.score > 1) {
    return { accepted: false, error: "Score must be between -1.0 and 1.0" };
  }

  // 3. Self-attestation check
  if (report.reporter === report.subject) {
    return { accepted: false, error: "Cannot submit reports about yourself" };
  }

  // 4. Verify both agents exist
  const reporter = db
    .prepare<[string], { public_key: string }>(
      "SELECT public_key FROM agents WHERE did = ?"
    )
    .get(report.reporter);
  if (!reporter) {
    return { accepted: false, error: "Reporter not registered" };
  }

  const subject = db
    .prepare<[string], { did: string }>("SELECT did FROM agents WHERE did = ?")
    .get(report.subject);
  if (!subject) {
    return { accepted: false, error: "Subject not registered" };
  }

  // 5. Verify signature
  const { signature, ...reportWithoutSig } = report;
  const valid = verifySignature(
    reportWithoutSig as Record<string, unknown>,
    signature,
    reporter.public_key
  );
  if (!valid) {
    return { accepted: false, error: "Invalid signature" };
  }

  // 6. Rate limiting: max reports per reporter-subject pair per window
  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MS
  ).toISOString();
  const recentCount = db
    .prepare<
      [string, string, string],
      { count: number }
    >(
      `SELECT COUNT(*) as count FROM interaction_reports
       WHERE reporter_did = ? AND subject_did = ? AND datetime(received_at) > datetime(?)`
    )
    .get(report.reporter, report.subject, windowStart);

  if (
    recentCount &&
    recentCount.count >= MAX_REPORTS_PER_PAIR_PER_WINDOW
  ) {
    return {
      accepted: false,
      error: `Rate limited: max ${MAX_REPORTS_PER_PAIR_PER_WINDOW} reports per pair per hour`,
    };
  }

  // 7. Check for duplicate report ID
  const existing = db
    .prepare<[string], { id: string }>(
      "SELECT id FROM interaction_reports WHERE id = ?"
    )
    .get(report.id);
  if (existing) {
    return { accepted: false, error: "Duplicate report ID" };
  }

  // 8. Store the report
  db.prepare(
    `INSERT INTO interaction_reports (id, reporter_did, subject_did, timestamp, domain, score, context_json, signature)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    report.id,
    report.reporter,
    report.subject,
    report.timestamp,
    report.domain,
    report.score,
    report.context ? JSON.stringify(report.context) : null,
    report.signature
  );

  // 9. Refresh reputation cache for the subject
  // TODO: batch this — recomputing all domain scores on every report will be
  // slow once an agent has thousands of reports. Move to async/periodic refresh.
  refreshReputationCache(db, report.subject);

  return { accepted: true };
}
