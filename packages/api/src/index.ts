import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { tokenRouter } from './routes/token.js';
import { projectsRouter } from './routes/projects.js';
import { sessionsRouter } from './routes/sessions.js';
import { tasksRouter } from './routes/tasks.js';
import { memoryRouter } from './routes/memory.js';
import { initializeSecrets } from './services/secret-manager.js';
import { initializeDb } from './db/pool.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'j52-api', timestamp: new Date().toISOString() });
});

// Routes - auth & token (ported from token-broker)
app.use('/auth', authRouter);
app.use('/token', tokenRouter);

// Routes - CRUD
app.use('/projects', projectsRouter);
app.use('/sessions', sessionsRouter);
app.use('/tasks', tasksRouter);
app.use('/memory', memoryRouter);

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await initializeSecrets();
    console.log('Secrets initialized');

    // DB init is non-fatal - auth/token routes work without it
    await initializeDb();

    app.listen(PORT, () => {
      console.log(`j52-api listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

start();
