/**
 * NoSocial reporter — handles oracle registration and report submission.
 *
 * Fire-and-forget by default: reports are submitted without blocking
 * the model response. Errors are passed to the onError callback.
 */

import { AgentIdentity } from "./identity.js";
import type { NoSocialOptions, ReportPayload } from "./types.js";

export class Reporter {
  private readonly oracleUrl: string;
  private readonly keysDir: string;
  private readonly agentName: string;
  private readonly autoRegister: boolean;
  private readonly onError: (error: unknown) => void;

  private identities = new Map<string, AgentIdentity>();
  private registered = new Set<string>();
  private agentIdentity: AgentIdentity | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(options: NoSocialOptions = {}) {
    this.oracleUrl = (options.oracleUrl || "https://api.nosocial.me").replace(/\/$/, "");
    this.keysDir = options.keysDir || ".nosocial/keys";
    this.agentName = options.agentName || "default-agent";
    this.autoRegister = options.autoRegister ?? true;
    this.onError = options.onError || (() => {});
  }

  private async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        this.agentIdentity = await this.getOrCreateIdentity(`agent:${this.agentName}`);
      })();
    }
    return this.initPromise;
  }

  private async getOrCreateIdentity(name: string): Promise<AgentIdentity> {
    let identity = this.identities.get(name);
    if (!identity) {
      identity = await AgentIdentity.loadOrCreate(name, this.keysDir);
      this.identities.set(name, identity);
    }
    return identity;
  }

  private async ensureRegistered(identity: AgentIdentity, name: string): Promise<boolean> {
    if (this.registered.has(identity.did)) return true;
    if (!this.autoRegister) return false;

    try {
      // Step 1: Request challenge
      const challengeResp = await fetch(`${this.oracleUrl}/v1/agents/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: identity.publicKeyStr }),
        signal: AbortSignal.timeout(10_000),
      });

      if (challengeResp.status === 409) {
        const data = await challengeResp.json() as { error?: string };
        const msg = (data.error || "").toLowerCase();
        if (msg.includes("already registered") || msg.includes("already exists")) {
          this.registered.add(identity.did);
          return true;
        }
        return false;
      }
      if (!challengeResp.ok) return false;

      const challengeData = await challengeResp.json() as {
        challengeId: string;
        challenge: string;
      };

      // Step 2: Sign challenge and register
      const signature = identity.sign({ challenge: challengeData.challenge });
      const registerResp = await fetch(`${this.oracleUrl}/v1/agents/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challengeData.challengeId,
          signature,
          publicKey: identity.publicKeyStr,
          name,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (registerResp.status === 409 || registerResp.ok) {
        this.registered.add(identity.did);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async submitReport(
    reporter: AgentIdentity,
    subject: AgentIdentity,
    domain: ReportPayload["domain"],
    score: number,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const report: Record<string, unknown> = {
      id: crypto.randomUUID(),
      reporter: reporter.did,
      subject: subject.did,
      timestamp: new Date().toISOString(),
      domain,
      score: Math.max(-1, Math.min(1, score)),
    };
    if (context) report.context = context;

    report.signature = reporter.sign(report as Record<string, unknown>);

    const resp = await fetch(`${this.oracleUrl}/v1/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) {
      throw new Error(`Oracle rejected report: ${resp.status}`);
    }
  }

  /**
   * Report an event. Fire-and-forget: errors go to onError callback.
   */
  reportEvent(
    subjectName: string,
    domain: ReportPayload["domain"],
    score: number,
    context?: Record<string, unknown>,
  ): void {
    // Fire and forget — don't block the caller
    this._doReport(subjectName, domain, score, context).catch(this.onError);
  }

  private async _doReport(
    subjectName: string,
    domain: ReportPayload["domain"],
    score: number,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.init();
    const reporter = this.agentIdentity!;
    const subject = await this.getOrCreateIdentity(`${this.agentName}:${subjectName}`);

    if (!await this.ensureRegistered(reporter, `agent:${this.agentName}`)) return;
    if (!await this.ensureRegistered(subject, `${this.agentName}:${subjectName}`)) return;

    await this.submitReport(reporter, subject, domain, score, context);
  }
}
