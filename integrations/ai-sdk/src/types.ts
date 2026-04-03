export interface NoSocialOptions {
  oracleUrl?: string;
  agentName?: string;
  keysDir?: string;
  autoRegister?: boolean;
  onError?: (error: unknown) => void;
}

export interface ReportPayload {
  id: string;
  reporter: string;
  subject: string;
  timestamp: string;
  domain: "task_completion" | "reliability" | "information_quality" | "collaboration" | "communication";
  score: number;
  context?: Record<string, unknown>;
  signature?: string;
}
