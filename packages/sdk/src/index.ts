/**
 * Mangrove Markets TypeScript SDK
 * 
 * Unified client for interacting with the Mangrove Markets agent marketplace
 * and DEX. Provides type-safe access to all MCP server tools.
 */
export { MangroveClient } from './client/MangroveClient';
export * from './types';

// Re-export domain modules
export * as marketplace from './marketplace';
export * as dex from './dex';
export * as wallet from './wallet';

// Python SDK (for use in Python/MCP environments)
export { MangroveClient as PythonMangroveClient } from './client/python client';
export * from './client/python_client';
