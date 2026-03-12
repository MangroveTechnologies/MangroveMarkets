import { describe, it, expect } from 'vitest';
import { handleStatus } from '../commands/status';
import { handleConnect } from '../commands/connect';

describe('handleStatus', () => {
  it('returns connected status', () => {
    const result = handleStatus({ url: 'https://mangrovemarkets.com', transport: 'mcp' }, true);
    expect(result).toEqual({
      url: 'https://mangrovemarkets.com',
      transport: 'mcp',
      connected: true,
    });
  });

  it('returns disconnected status', () => {
    const result = handleStatus({ url: 'http://localhost:8080', transport: 'rest' }, false);
    expect(result).toEqual({
      url: 'http://localhost:8080',
      transport: 'rest',
      connected: false,
    });
  });
});

describe('handleConnect', () => {
  it('returns connect result with transport', () => {
    const result = handleConnect('https://mangrovemarkets.com', 'rest');
    expect(result).toEqual({ url: 'https://mangrovemarkets.com', transport: 'rest' });
  });

  it('defaults transport to mcp', () => {
    const result = handleConnect('https://mangrovemarkets.com');
    expect(result).toEqual({ url: 'https://mangrovemarkets.com', transport: 'mcp' });
  });
});
