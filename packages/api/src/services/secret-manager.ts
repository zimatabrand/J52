import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'radpowersports-458409';

let cachedSecrets: {
  openAiKey?: string;
  jwtSecret?: string;
  masterPassword?: string;
  picovoiceAccessKey?: string;
  tavilyApiKey?: string;
  databaseUrl?: string;
} = {};

async function accessSecret(secretName: string): Promise<string> {
  const name = `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`;
  const [version] = await client.accessSecretVersion({ name });
  const payload = version.payload?.data;
  if (!payload) throw new Error(`Secret ${secretName} has no payload`);
  return payload.toString();
}

export async function initializeSecrets(): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    cachedSecrets = {
      openAiKey: process.env.OPENAI_API_KEY,
      jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',
      masterPassword: process.env.MASTER_PASSWORD || 'dev-password',
      picovoiceAccessKey: process.env.PICOVOICE_ACCESS_KEY,
      tavilyApiKey: process.env.TAVILY_API_KEY,
      databaseUrl: process.env.DATABASE_URL
    };
    if (cachedSecrets.openAiKey) {
      console.log('Using development environment variables');
      return;
    }
  }

  const [openAiKey, jwtSecret, masterPassword, picovoiceAccessKey] = await Promise.all([
    accessSecret('open_ai_gpt_key'),
    accessSecret('voice_assistant_jwt_secret'),
    accessSecret('voice_assistant_master_password'),
    accessSecret('picovoice-access-key')
  ]);

  cachedSecrets = { openAiKey, jwtSecret, masterPassword, picovoiceAccessKey };

  try {
    cachedSecrets.tavilyApiKey = await accessSecret('tavily-default-api-key');
  } catch { /* optional */ }

  try {
    cachedSecrets.databaseUrl = await accessSecret('j52-database-url');
  } catch { /* will use DATABASE_URL env var */ }
}

export function getOpenAiKey(): string {
  if (!cachedSecrets.openAiKey) throw new Error('OpenAI API key not initialized');
  return cachedSecrets.openAiKey;
}

export function getJwtSecret(): string {
  if (!cachedSecrets.jwtSecret) throw new Error('JWT secret not initialized');
  return cachedSecrets.jwtSecret;
}

export function getMasterPassword(): string {
  if (!cachedSecrets.masterPassword) throw new Error('Master password not initialized');
  return cachedSecrets.masterPassword;
}

export function getPicovoiceAccessKey(): string {
  if (!cachedSecrets.picovoiceAccessKey) throw new Error('Picovoice key not initialized');
  return cachedSecrets.picovoiceAccessKey;
}

export function getTavilyApiKey(): string | null {
  return cachedSecrets.tavilyApiKey || null;
}

export function getDatabaseUrl(): string {
  return cachedSecrets.databaseUrl || process.env.DATABASE_URL || 'postgresql://j52:j52dev@localhost:5432/j52';
}
