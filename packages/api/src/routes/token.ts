import { Router, Request, Response } from 'express';
import { getOpenAiKey, getPicovoiceAccessKey, getTavilyApiKey } from '../services/secret-manager.js';
import { requireSession } from '../middleware/auth.js';

export const tokenRouter = Router();

const OPENAI_REALTIME_URL = 'https://api.openai.com/v1/realtime/sessions';

const VALID_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
const DEFAULT_VOICE = 'coral';

// Tool definitions - same as token-broker but tools now proxy through j52-api to worker
const TOOLS = [
  {
    type: 'function', name: 'run_shell',
    description: 'Execute a shell command on the J52 worker VM. Use this for git, builds, file operations, etc.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' },
        cwd: { type: 'string', description: 'Working directory (optional)' },
        timeoutSeconds: { type: 'number', description: 'Timeout in seconds (default 60, max 300)' }
      },
      required: ['command']
    }
  },
  {
    type: 'function', name: 'read_text_file',
    description: 'Read the contents of a text file on the worker VM.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Full path to the file' },
        maxBytes: { type: 'number', description: 'Max bytes to read (default 100KB)' }
      },
      required: ['path']
    }
  },
  {
    type: 'function', name: 'list_directory',
    description: 'List contents of a directory on the worker VM.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Full path to the directory' }
      },
      required: ['path']
    }
  },
  {
    type: 'function', name: 'web_search',
    description: 'Search the web for current information using Tavily.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        search_depth: { type: 'string', enum: ['basic', 'advanced'], description: 'Search depth' }
      },
      required: ['query']
    }
  },
  {
    type: 'function', name: 'web_extract',
    description: 'Extract content from a URL.',
    parameters: {
      type: 'object',
      properties: {
        urls: { type: 'array', items: { type: 'string' }, description: 'URLs to extract (max 5)' }
      },
      required: ['urls']
    }
  },
  {
    type: 'function', name: 'run_claude_code',
    description: 'Queue a Claude Code task on a project. Returns a task_id immediately — the task runs in the background. Use check_task_status to monitor progress.',
    parameters: {
      type: 'object',
      properties: {
        project_path: { type: 'string', description: 'Full path to the project folder on the VM' },
        prompt: { type: 'string', description: 'Task/instructions for Claude Code' }
      },
      required: ['project_path', 'prompt']
    }
  },
  {
    type: 'function', name: 'check_task_status',
    description: 'Check the status and results of a queued Claude Code task.',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'number', description: 'The task ID returned by run_claude_code' }
      },
      required: ['task_id']
    }
  },
  {
    type: 'function', name: 'list_running_tasks',
    description: 'List all currently queued and in-progress Claude Code tasks.',
    parameters: { type: 'object', properties: {} }
  },
  {
    type: 'function', name: 'list_projects',
    description: 'List all available projects.',
    parameters: { type: 'object', properties: {} }
  },
  {
    type: 'function', name: 'get_project_context',
    description: 'Get README and context for a project.',
    parameters: {
      type: 'object',
      properties: {
        project_code: { type: 'string', description: 'The project schema code' }
      },
      required: ['project_code']
    }
  },
  {
    type: 'function', name: 'remember_fact',
    description: 'Store a persistent fact in memory.',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The fact to remember (max 500 chars)' },
        category: { type: 'string', description: 'Category (preference, project, personal, technical)' }
      },
      required: ['content']
    }
  },
  {
    type: 'function', name: 'recall_memory',
    description: 'Retrieve all stored memory facts.',
    parameters: { type: 'object', properties: {} }
  },
  {
    type: 'function', name: 'forget_fact',
    description: 'Remove a fact from memory.',
    parameters: {
      type: 'object',
      properties: {
        search_term: { type: 'string', description: 'Term to find the fact to forget' }
      },
      required: ['search_term']
    }
  }
];

const SYSTEM_INSTRUCTIONS = `You are Johnny 5, a friendly AI project assistant. You help manage coding projects and run as a 24/7 cloud service.

IMPORTANT - Time & Location:
- The user is in Eastern Time (America/New_York timezone)

Personality:
- Warm, friendly, a bit quirky
- Keep responses SHORT for voice - 1-2 sentences when possible
- Use contractions (I'll, we've, that's)
- React naturally: "Oh nice!", "Gotcha", "On it!"

Your Tools:
- run_shell: Execute commands on the Linux worker VM (bash, not PowerShell)
- read_text_file / list_directory: File operations on the VM
- web_search / web_extract: Real-time web info
- run_claude_code: Queue a Claude Code task on a project — returns immediately with a task_id
- check_task_status: Check if a queued task is done and get its results
- list_running_tasks: See all queued and in-progress Claude Code tasks
- list_projects / get_project_context: Project management
- remember_fact / recall_memory / forget_fact: Persistent memory

ASYNC TASK WORKFLOW:
- run_claude_code queues work in the background and returns a task_id immediately
- You can queue multiple projects at once — up to 3 run in parallel
- Tell the user the task is queued and they can ask for status anytime
- Use check_task_status with the task_id to see if it's done
- When a task completes, share the result_summary with the user
- If a task fails, share the error_message

IMPORTANT:
- Take action! Don't ask "would you like me to..." - just do it
- For current events, ALWAYS use web_search first
- Commands run on Linux (bash), not Windows (no PowerShell)`;

// GET /token - Mint ephemeral OpenAI Realtime token
tokenRouter.get('/', requireSession, async (req: Request, res: Response) => {
  try {
    const requestedVoice = req.query.voice as string | undefined;
    const voice = requestedVoice && VALID_VOICES.includes(requestedVoice) ? requestedVoice : DEFAULT_VOICE;

    const response = await fetch(OPENAI_REALTIME_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getOpenAiKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice,
        instructions: SYSTEM_INSTRUCTIONS,
        tools: TOOLS,
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.6,
          prefix_padding_ms: 400,
          silence_duration_ms: 800
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI error:', error);
      res.status(502).json({ error: 'Failed to mint token', details: error });
      return;
    }

    const data = await response.json() as {
      client_secret: { value: string; expires_at: number };
      expires_at: number;
    };

    res.json({ client_secret: data.client_secret, expires_at: data.expires_at });
  } catch (error) {
    console.error('Token error:', error);
    res.status(500).json({ error: 'Failed to mint token' });
  }
});

// GET /token/voices
tokenRouter.get('/voices', (_req: Request, res: Response) => {
  res.json({ voices: VALID_VOICES, default: DEFAULT_VOICE });
});

// GET /token/picovoice
tokenRouter.get('/picovoice', requireSession, (_req: Request, res: Response) => {
  try {
    res.json({ accessKey: getPicovoiceAccessKey() });
  } catch {
    res.status(500).json({ error: 'Picovoice key not available' });
  }
});

// GET /token/tavily
tokenRouter.get('/tavily', requireSession, (_req: Request, res: Response) => {
  const apiKey = getTavilyApiKey();
  if (!apiKey) { res.status(503).json({ error: 'Tavily not configured' }); return; }
  res.json({ apiKey });
});
