import { readFile, readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import type { FileReadRequest, DirectoryListRequest } from '@j52/shared';

const MAX_READ_BYTES = 100_000;

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  extension: string;
}

export class FileOpsTool {
  async readFile(request: FileReadRequest): Promise<string> {
    const maxBytes = request.maxBytes || MAX_READ_BYTES;
    const buffer = Buffer.alloc(maxBytes);
    const { open } = await import('fs/promises');
    const handle = await open(request.path, 'r');
    try {
      const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
      return buffer.slice(0, bytesRead).toString('utf-8');
    } finally {
      await handle.close();
    }
  }

  async listDirectory(request: DirectoryListRequest): Promise<FileInfo[]> {
    const entries = await readdir(request.path, { withFileTypes: true });
    const results: FileInfo[] = [];

    for (const entry of entries.slice(0, 200)) {
      const fullPath = join(request.path, entry.name);
      try {
        const stats = await stat(fullPath);
        results.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          size: stats.size,
          modified: stats.mtime.toISOString(),
          extension: entry.isDirectory() ? '' : extname(entry.name)
        });
      } catch {
        results.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          size: 0,
          modified: '',
          extension: ''
        });
      }
    }

    return results;
  }
}
