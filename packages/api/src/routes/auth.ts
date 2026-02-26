import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getMasterPassword } from '../services/secret-manager.js';
import {
  createDeviceRecord, isValidPin, storeDevice, verifyDevicePin,
  createSession, deleteSession, requireDeviceCookie, createSessionToken,
  DEVICE_COOKIE_OPTIONS, SESSION_COOKIE_OPTIONS
} from '../middleware/auth.js';

export const authRouter = Router();

// POST /auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { password, pin, deviceName } = req.body;
    if (!password || !pin || !deviceName) {
      res.status(400).json({ error: 'Missing required fields: password, pin, deviceName' });
      return;
    }
    if (password !== getMasterPassword()) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }
    if (!isValidPin(pin)) {
      res.status(400).json({ error: 'PIN must be exactly 6 digits' });
      return;
    }

    const device = createDeviceRecord(deviceName, pin);
    await storeDevice(device);

    const sessionId = uuidv4();
    await createSession(device.deviceId, sessionId);
    const sessionToken = createSessionToken(sessionId, device.deviceId);

    res.cookie('device_id', device.deviceId, DEVICE_COOKIE_OPTIONS);
    res.cookie('session', sessionToken, SESSION_COOKIE_OPTIONS);
    res.json({ success: true, deviceId: device.deviceId, sessionToken, message: 'Device registered' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /auth/login
authRouter.post('/login', requireDeviceCookie, async (req: Request, res: Response) => {
  try {
    const { pin } = req.body;
    const deviceId = req.deviceId!;
    if (!pin || !isValidPin(pin)) {
      res.status(400).json({ error: 'PIN must be exactly 6 digits' });
      return;
    }

    const device = await verifyDevicePin(deviceId, pin);
    if (!device) {
      res.status(401).json({ error: 'Invalid PIN' });
      return;
    }

    const sessionId = uuidv4();
    await createSession(deviceId, sessionId);
    const sessionToken = createSessionToken(sessionId, deviceId);

    res.cookie('session', sessionToken, SESSION_COOKIE_OPTIONS);
    res.json({ success: true, deviceId, deviceName: device.deviceName, sessionToken, message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /auth/logout
authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    const sessionToken = req.cookies?.session;
    if (sessionToken) {
      try {
        const jwt = await import('jsonwebtoken');
        const payload = jwt.default.decode(sessionToken) as { sessionId?: string };
        if (payload?.sessionId) await deleteSession(payload.sessionId);
      } catch { /* best effort */ }
    }
    res.clearCookie('session', { path: '/' });
    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /auth/status
authRouter.get('/status', (req: Request, res: Response) => {
  res.json({
    hasDevice: !!req.cookies?.device_id,
    hasSession: !!req.cookies?.session
  });
});
