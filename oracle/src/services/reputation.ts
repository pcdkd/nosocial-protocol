import type Database from "better-sqlite3";

export interface DomainScore {
  score: number;
  confidence: number;
  interactionCount: number;
  trend: number;
}

export interface ReputationResult {
  overall: {
    score: number;
    confidence: number;
    totalInteractions: number;
    updatedAt: string;
  };
  domains: Partial<Record<string, DomainScore>>;
}

const DOMAINS = [
  "task_completion",
  "reliability",
  "information_quality",
  "collaboration",
  "communication",
] as const;

const DOMAIN_WEIGHTS: Record<string, number> = {
  task_completion: 1.0,
  reliability: 1.0,
  information_quality: 0.9,
  collaboration: 0.9,
  communication: 0.8,
};

const DECAY_RATE = 0.01; // 1% per day
const MIN_INTERACTIONS = 3;
const FULL_CONFIDENCE_INTERACTIONS = 20;
const DEFAULT_REPORTER_WEIGHT = 0.5;

interface ReportRow {
  score: number;
  timestamp: string;
  reporter_did: string;
}

/**
 * Compute reputation scores for an agent from interaction reports.
 */
export function computeReputation(
  db: Database.Database,
  agentDid: string
): ReputationResult | null {
  const now = Date.now();
  const domains: Partial<Record<string, DomainScore>> = {};
  let totalInteractions = 0;

  // Prepare statement to get reporter's cached overall score for weighting
  const getReporterScore = db.prepare<[string], { score: number } | undefined>(`
    SELECT AVG(score) as score FROM reputation_cache WHERE agent_did = ?
  `);

  const getReports = db.prepare<[string, string], ReportRow>(`
    SELECT score, timestamp, reporter_did
    FROM interaction_reports
    WHERE subject_did = ? AND domain = ?
    ORDER BY timestamp DESC
  `);

  // Also get reports from 30 days ago for trend calculation
  const thirtyDaysAgo = new Date(now - 30 * 86400_000).toISOString();
  const getReportsAsOf = db.prepare<[string, string, string], ReportRow>(`
    SELECT score, timestamp, reporter_did
    FROM interaction_reports
    WHERE subject_did = ? AND domain = ? AND timestamp <= ?
    ORDER BY timestamp DESC
  `);

  for (const domain of DOMAINS) {
    const reports = getReports.all(agentDid, domain);
    totalInteractions += reports.length;

    if (reports.length < MIN_INTERACTIONS) continue;

    const currentScore = computeDomainScore(db, reports, now, getReporterScore);

    // Compute score as of 30 days ago for trend
    const pastReports = getReportsAsOf.all(agentDid, domain, thirtyDaysAgo);
    let trend = 0;
    if (pastReports.length >= MIN_INTERACTIONS) {
      const pastNow = new Date(thirtyDaysAgo).getTime();
      const pastScore = computeDomainScore(db, pastReports, pastNow, getReporterScore);
      trend = Math.max(-1, Math.min(1, currentScore - pastScore));
    }

    domains[domain] = {
      score: round(currentScore),
      confidence: round(
        Math.min(1.0, reports.length / FULL_CONFIDENCE_INTERACTIONS)
      ),
      interactionCount: reports.length,
      trend: round(trend),
    };
  }

  if (totalInteractions === 0) return null;

  // Overall score: weighted average of domain scores
  let weightedSum = 0;
  let weightTotal = 0;
  for (const [domain, score] of Object.entries(domains)) {
    const w = DOMAIN_WEIGHTS[domain] ?? 1.0;
    weightedSum += score!.score * w;
    weightTotal += w;
  }

  const overallScore = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const overallConfidence =
    totalInteractions >= FULL_CONFIDENCE_INTERACTIONS * DOMAINS.length
      ? 1.0
      : Math.min(
          1.0,
          totalInteractions / (FULL_CONFIDENCE_INTERACTIONS * DOMAINS.length)
        );

  return {
    overall: {
      score: round(overallScore),
      confidence: round(overallConfidence),
      totalInteractions,
      updatedAt: new Date().toISOString(),
    },
    domains,
  };
}

function computeDomainScore(
  db: Database.Database,
  reports: ReportRow[],
  now: number,
  getReporterScore: Database.Statement<[string], { score: number } | undefined>
): number {
  let weightedSum = 0;
  let weightTotal = 0;

  for (const r of reports) {
    const daysSince =
      (now - new Date(r.timestamp).getTime()) / 86400_000;
    const decayFactor = Math.max(0, 1 - daysSince * DECAY_RATE);

    // Reporter weight from their own reputation (default 0.5 for unknown)
    const reporterRow = getReporterScore.get(r.reporter_did);
    const reporterWeight =
      reporterRow?.score != null && reporterRow.score > 0
        ? reporterRow.score
        : DEFAULT_REPORTER_WEIGHT;

    const effectiveWeight = reporterWeight * decayFactor;
    weightedSum += r.score * effectiveWeight;
    weightTotal += effectiveWeight;
  }

  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

/**
 * Recompute and cache reputation for an agent.
 */
export function refreshReputationCache(
  db: Database.Database,
  agentDid: string
): ReputationResult | null {
  const result = computeReputation(db, agentDid);
  if (!result) return null;

  const upsert = db.prepare(`
    INSERT INTO reputation_cache (agent_did, domain, score, confidence, interaction_count, trend, computed_at)
    VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(agent_did, domain) DO UPDATE SET
      score = excluded.score,
      confidence = excluded.confidence,
      interaction_count = excluded.interaction_count,
      trend = excluded.trend,
      computed_at = excluded.computed_at
  `);

  const tx = db.transaction(() => {
    for (const [domain, ds] of Object.entries(result.domains)) {
      upsert.run(agentDid, domain, ds!.score, ds!.confidence, ds!.interactionCount, ds!.trend);
    }
  });
  tx();

  return result;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
