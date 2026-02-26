export interface DeviceRecord {
  deviceId: string;
  deviceName: string;
  pinHash: string;
  salt: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface AuthSession {
  sessionId: string;
  deviceId: string;
  createdAt: string;
  expiresAt: string;
}

export interface JwtPayload {
  sessionId: string;
  deviceId: string;
  iat: number;
  exp: number;
}

export interface RegisterRequest {
  password: string;
  pin: string;
  deviceName: string;
}

export interface LoginRequest {
  pin: string;
  deviceId?: string;
}

export interface AuthResponse {
  success: boolean;
  deviceId?: string;
  deviceName?: string;
  sessionToken?: string;
  message: string;
}

export interface AuthStatus {
  hasDevice: boolean;
  hasSession: boolean;
}
