export type SessionStatus = 'active' | 'paused' | 'completed' | 'error' | 'terminated';

export interface AiSession {
  sessionId: number;
  schemaCode: string;
  parentSessionId: number | null;
  aiProvider: string;
  role: string;
  sessionName: string | null;
  model: string | null;
  status: SessionStatus;
  tokenCountIn: number;
  tokenCountOut: number;
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
}

export interface CreateSessionInput {
  schemaCode: string;
  aiProvider: string;
  role?: string;
  sessionName?: string;
  model?: string;
  parentSessionId?: number;
}

export type IoType = 'input' | 'output' | 'system' | 'error';

export interface ChatMessage {
  logId: number;
  sessionId: number;
  ioType: IoType;
  content: string;
  contentFormat: string;
  tokenCount: number | null;
  modelUsed: string | null;
  processingTimeMs: number | null;
  metadata: Record<string, unknown> | null;
  sequenceNumber: number;
  createdAt: string;
}
