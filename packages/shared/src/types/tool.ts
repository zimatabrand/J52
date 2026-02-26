export interface ToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCall {
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  output?: string;
  error?: string;
  executionTimeMs?: number;
}

export interface ShellExecRequest {
  command: string;
  cwd?: string;
  timeoutSeconds?: number;
}

export interface ShellExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export interface FileReadRequest {
  path: string;
  maxBytes?: number;
}

export interface DirectoryListRequest {
  path: string;
}

export interface WebSearchRequest {
  query: string;
  searchDepth?: 'basic' | 'advanced';
}

export interface ClaudeCodeRequest {
  projectPath: string;
  prompt: string;
  timeoutSeconds?: number;
}

export interface ClaudeCodeResult {
  output: string;
  exitCode: number;
  timedOut: boolean;
}
