import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../services/secret-manager.js';
import { Firestore } from '@google-cloud/firestore';
import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { JwtPayload } from '@j52/shared';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      deviceId?: string;
      sessionId?: string;
    }
  }
}

// ---- Firestore session store (reused from token-broker) ----

const db = new Firestore({ databaseId: 'voice-assistant' });
const DEVICES_COLLECTION = 'voice_assistant_devices';
const SESSIONS_COLLECTION = 'voice_assistant_sessions';
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

// ---- Device auth helpers ----

export function hashPin(pin: string, salt: string): string {
  return createHash('sha256').update(pin + salt).digest('hex');
}

export function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

export function verifyPin(pin: string, salt: string, storedHash: string): boolean {
  return hashPin(pin, salt) === storedHash;
}

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export interface DeviceRecord {
  deviceId: string;
  deviceName: string;
  pinHash: string;
  salt: string;
  createdAt: Date;
  lastUsedAt: Date;
}

export function createDeviceRecord(deviceName: string, pin: string): DeviceRecord {
  const deviceId = uuidv4();
  const salt = generateSalt();
  const pinHash = hashPin(pin, salt);
  const now = new Date();
  return { deviceId, deviceName, pinHash, salt, createdAt: now, lastUsedAt: now };
}

// ---- Firestore operations ----

export async function storeDevice(device: DeviceRecord): Promise<void> {
  await db.collection(DEVICES_COLLECTION).doc(device.deviceId).set({
    ...device,
    createdAt: device.createdAt.toISOString(),
    lastUsedAt: device.lastUsedAt.toISOString()
  });
}

export async function getDevice(deviceId: string): Promise<DeviceRecord | null> {
  const doc = await db.collection(DEVICES_COLLECTION).doc(deviceId).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  return {
    deviceId: data.deviceId,
    deviceName: data.deviceName,
    pinHash: data.pinHash,
    salt: data.salt,
    createdAt: new Date(data.createdAt),
    lastUsedAt: new Date(data.lastUsedAt)
  };
}

export async function verifyDevicePin(deviceId: string, pin: string): Promise<DeviceRecord | null> {
  const device = await getDevice(deviceId);
  if (!device) return null;
  if (!verifyPin(pin, device.salt, device.pinHash)) return null;
  await db.collection(DEVICES_COLLECTION).doc(deviceId).update({
    lastUsedAt: new Date().toISOString()
  });
  return device;
}

export async function createSession(deviceId: string, sessionId: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_MS);
  await db.collection(SESSIONS_COLLECTION).doc(sessionId).set({
    sessionId, deviceId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  });
  return { sessionId, deviceId, createdAt: now, expiresAt };
}

export async function getValidSession(sessionId: string) {
  const doc = await db.collection(SESSIONS_COLLECTION).doc(sessionId).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  if (new Date(data.expiresAt) < new Date()) {
    await db.collection(SESSIONS_COLLECTION).doc(sessionId).delete();
    return null;
  }
  return data;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.collection(SESSIONS_COLLECTION).doc(sessionId).delete();
}

// ---- Middleware ----

export function requireDeviceCookie(req: Request, res: Response, next: NextFunction): void {
  const deviceId = req.cookies?.device_id || req.body?.deviceId;
  if (!deviceId) {
    res.status(401).json({ error: 'Device not registered', code: 'NO_DEVICE' });
    return;
  }
  req.deviceId = deviceId;
  next();
}

function getSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);
  return req.cookies?.session || null;
}

export async function requireSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    res.status(401).json({ error: 'No session', code: 'NO_SESSION' });
    return;
  }
  try {
    const payload = jwt.verify(sessionToken, getJwtSecret()) as JwtPayload;
    const session = await getValidSession(payload.sessionId);
    if (!session) {
      res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
      return;
    }
    req.sessionId = payload.sessionId;
    req.deviceId = payload.deviceId;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
      return;
    }
    res.status(401).json({ error: 'Invalid session', code: 'INVALID_SESSION' });
  }
}

export function createSessionToken(sessionId: string, deviceId: string): string {
  return jwt.sign({ sessionId, deviceId }, getJwtSecret(), { expiresIn: '24h' });
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/'
};

export const DEVICE_COOKIE_OPTIONS = { ...COOKIE_OPTIONS, maxAge: 365 * 24 * 60 * 60 * 1000 };
export const SESSION_COOKIE_OPTIONS = { ...COOKIE_OPTIONS, maxAge: 24 * 60 * 60 * 1000 };
