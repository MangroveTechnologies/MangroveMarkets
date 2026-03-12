import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig } from '../config';

describe('loadConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('loads MCP server URL from env', () => {
    vi.stubEnv('MANGROVE_MCP_URL', 'https://mangrovemarkets.com');
    const config = loadConfig();
    expect(config.url).toBe('https://mangrovemarkets.com');
  });

  it('defaults to localhost', () => {
    const config = loadConfig();
    expect(config.url).toBe('http://localhost:8080');
  });

  it('loads transport preference', () => {
    vi.stubEnv('MANGROVE_TRANSPORT', 'rest');
    const config = loadConfig();
    expect(config.transport).toBe('rest');
  });

  it('defaults transport to mcp', () => {
    const config = loadConfig();
    expect(config.transport).toBe('mcp');
  });
});
