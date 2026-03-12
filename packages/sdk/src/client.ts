import type { MangroveConfig } from './types/config';
import type { Transport } from './types/transport';
import type { SwapParams, SwapResult } from './types/dex';
import { McpTransport } from './transport/mcp';
import { RestTransport } from './transport/rest';
import { DexService } from './dex/service';
import { SwapOrchestrator } from './dex/swap';

/** Combined DEX API surface exposing both low-level tools and high-level swap(). */
interface DexClientApi extends DexService {
  swap(params: SwapParams): Promise<SwapResult>;
}

/**
 * Main entry point for the MangroveMarkets SDK. Provides access to DEX, marketplace,
 * and wallet services through a pluggable transport layer.
 */
export class MangroveClient {
  private transport: Transport;
  private _dex: DexService;
  private _swapOrchestrator?: SwapOrchestrator;
  private config: MangroveConfig;

  /**
   * Create a MangroveClient. Uses MCP transport by default; pass transport: 'rest' for REST fallback.
   * @param config - Client configuration (url, signer, transport, apiKey).
   */
  constructor(config: MangroveConfig) {
    this.config = config;

    if (config.transport === 'rest') {
      this.transport = new RestTransport(config.url, config.apiKey);
    } else {
      this.transport = new McpTransport(config.url, config.apiKey);
    }

    this._dex = new DexService(this.transport);

    if (config.signer) {
      this._swapOrchestrator = new SwapOrchestrator(this._dex, config.signer, this.transport);
    }
  }

  /**
   * Access DEX operations. Includes low-level methods (getQuote, prepareSwap, approveToken,
   * broadcast, txStatus) and high-level swap() orchestration.
   * Calling swap() requires a Signer in the config.
   */
  get dex(): DexClientApi {
    const service = this._dex;
    const orchestrator = this._swapOrchestrator;

    return new Proxy(service, {
      get(target, prop) {
        if (prop === 'swap') {
          if (!orchestrator) {
            throw new Error('Signer required for swap(). Pass a signer in MangroveConfig.');
          }
          return orchestrator.swap.bind(orchestrator);
        }
        const value = (target as any)[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as DexClientApi;
  }

  /** Open the transport connection. Must be called before making any tool calls. */
  async connect(): Promise<void> {
    await this.transport.connect();
  }

  /** Close the transport connection and release resources. */
  async disconnect(): Promise<void> {
    await this.transport.disconnect();
  }
}
