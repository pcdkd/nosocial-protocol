import Database from "better-sqlite3";

export function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      did TEXT PRIMARY KEY,
      public_key TEXT NOT NULL UNIQUE,
      name TEXT,
      endpoint TEXT,
      a2a_card_url TEXT,
      operator_name TEXT,
      operator_contact TEXT,
      operator_homepage TEXT,
      registered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS agent_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_did TEXT NOT NULL REFERENCES agents(did) ON DELETE CASCADE,
      skill_id TEXT NOT NULL,
      skill_name TEXT,
      UNIQUE(agent_did, skill_id)
    );

    CREATE INDEX IF NOT EXISTS idx_agent_skills_skill_id ON agent_skills(skill_id);

    CREATE TABLE IF NOT EXISTS interaction_reports (
      id TEXT PRIMARY KEY,
      reporter_did TEXT NOT NULL REFERENCES agents(did),
      subject_did TEXT NOT NULL REFERENCES agents(did),
      timestamp TEXT NOT NULL,
      domain TEXT NOT NULL CHECK(domain IN ('task_completion', 'reliability', 'information_quality', 'collaboration', 'communication')),
      score REAL NOT NULL CHECK(score >= -1.0 AND score <= 1.0),
      context_json TEXT,
      signature TEXT NOT NULL,
      received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      CHECK(reporter_did != subject_did)
    );

    CREATE INDEX IF NOT EXISTS idx_reports_subject ON interaction_reports(subject_did, domain);
    CREATE INDEX IF NOT EXISTS idx_reports_reporter ON interaction_reports(reporter_did);
    CREATE INDEX IF NOT EXISTS idx_reports_timestamp ON interaction_reports(timestamp);
    CREATE INDEX IF NOT EXISTS idx_reports_pair ON interaction_reports(reporter_did, subject_did);

    CREATE TABLE IF NOT EXISTS reputation_cache (
      agent_did TEXT NOT NULL REFERENCES agents(did) ON DELETE CASCADE,
      domain TEXT NOT NULL,
      score REAL NOT NULL,
      confidence REAL NOT NULL,
      interaction_count INTEGER NOT NULL,
      trend REAL NOT NULL DEFAULT 0.0,
      computed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      PRIMARY KEY (agent_did, domain)
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      agent_did TEXT NOT NULL,
      challenge TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      expires_at TEXT NOT NULL
    );
  `);
}
