import type { Signer } from './signer';

/**
 * Configuration for creating a MangroveClient instance.
 */
export interface MangroveConfig {
  /** MCP server URL (e.g. 'https://mangrovemarkets.com/mcp' or 'https://mangrovemarkets.com'). */
  url: string;
  /** Optional Signer for transaction signing. Required for swap() operations. */
  signer?: Signer;
  /** Transport type. 'mcp' (default) uses MCP protocol; 'rest' uses FastAPI REST endpoints. */
  transport?: 'mcp' | 'rest';
  /** Optional Bearer token for authenticated endpoints. */
  apiKey?: string;
}
