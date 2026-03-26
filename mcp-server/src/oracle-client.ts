/**
 * HTTP client for the NoSocial Reputation Oracle API.
 */

const DEFAULT_ORACLE_URL = "https://api.nosocial.me";

export class OracleClient {
  private baseUrl: string;

  constructor(oracleUrl?: string) {
    this.baseUrl = (oracleUrl || DEFAULT_ORACLE_URL).replace(/\/$/, "");
  }

  async getAgent(did: string): Promise<AgentProfile | null> {
    const resp = await fetch(`${this.baseUrl}/v1/agents/${encodeURIComponent(did)}`);
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`Oracle error: ${resp.status}`);
    return resp.json();
  }

  async getReputation(did: string): Promise<Reputation | null> {
    const resp = await fetch(`${this.baseUrl}/v1/agents/${encodeURIComponent(did)}/reputation`);
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`Oracle error: ${resp.status}`);
    return resp.json();
  }

  async searchAgents(params: SearchParams): Promise<SearchResult> {
    const query = new URLSearchParams();
    if (params.capability) query.set("capability", params.capability);
    if (params.minReputation != null) query.set("min_reputation", String(params.minReputation));
    if (params.domain) query.set("domain", params.domain);
    if (params.sort) query.set("sort", params.sort);
    if (params.limit) query.set("limit", String(params.limit));

    const resp = await fetch(`${this.baseUrl}/v1/agents/search?${query}`);
    if (!resp.ok) throw new Error(`Oracle error: ${resp.status}`);
    return resp.json();
  }
}

// Types matching the oracle API responses

export interface AgentProfile {
  did: string;
  publicKey: string;
  name: string | null;
  endpoint: string | null;
  a2aCardUrl: string | null;
  registeredAt: string;
  skills: Array<{ id: string; name: string | null }>;
  reputation: Reputation | null;
}

export interface Reputation {
  overall: {
    score: number;
    confidence: number;
    totalInteractions: number;
    updatedAt: string;
  };
  domains: Record<string, DomainScore>;
}

export interface DomainScore {
  score: number;
  confidence: number;
  interactionCount: number;
  trend: number;
}

export interface SearchParams {
  capability?: string;
  minReputation?: number;
  domain?: string;
  sort?: "reputation" | "recent" | "interactions";
  limit?: number;
}

export interface SearchResult {
  agents: Array<{
    did: string;
    name: string | null;
    skills: string[];
    reputation: Record<string, unknown> | null;
    serviceEndpoint: string | null;
    a2aCard: string | null;
  }>;
  total: number;
  hasMore: boolean;
}
