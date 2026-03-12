import { describe, it, expect, vi } from 'vitest';
import { getMangroveClient, resetClient } from '../lib/client';

vi.mock('@mangrovemarkets/sdk', () => ({
  MangroveClient: class MockMangroveClient {
    constructor(public config: any) {}
    async connect() {}
    async disconnect() {}
  },
}));

describe('getMangroveClient', () => {
  it('returns a singleton instance', () => {
    resetClient();
    const a = getMangroveClient({ url: 'http://localhost:8080' });
    const b = getMangroveClient({ url: 'http://localhost:8080' });
    expect(a).toBe(b);
  });

  it('creates a new instance after reset', () => {
    const a = getMangroveClient({ url: 'http://localhost:8080' });
    resetClient();
    const b = getMangroveClient({ url: 'http://localhost:8080' });
    expect(a).not.toBe(b);
  });
});
