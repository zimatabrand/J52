export interface MemoryFact {
  factId: number;
  content: string;
  category: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryFactInput {
  content: string;
  category?: string;
  source?: string;
}

export interface AuditLogEntry {
  logId: number;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface UserSettings {
  settingId: number;
  userId: string;
  key: string;
  value: string;
  updatedAt: string;
}
