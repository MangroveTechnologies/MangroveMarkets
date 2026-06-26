// Main client
export { MangroveClient } from './client';

// Types
export type {
  MangroveConfig,
  Quote,
  UnsignedTransaction,
  EvmUnsignedTransaction,
  XrplUnsignedTransaction,
  XrplTxPayload,
  BroadcastResult,
  TransactionStatus,
  SwapResult,
  SwapParams,
  QuoteParams,
  ApproveParams,
  BroadcastParams,
  SwapStatusParams,
  BillingMode,
  Transport,
  ToolCallResult,
  Signer,
  TokenBalance,
  GasPrice,
  TokenInfo,
  PortfolioValue,
  ChainInfo,
  WalletCreateResult,
  BalanceResult,
  TransactionHistoryResult,
  ChainInfoParams,
  CreateWalletParams,
  BalanceParams,
  TransactionsParams,
  XrplBalance,
  XrplSendParams,
  XrplTransactionRecord,
  XrplTransactionHistory,
  XrplFaucetResult,
  Listing,
  Offer,
  Rating,
  SearchResult,
  CreateListingParams,
  SearchParams,
  MakeOfferParams,
  AcceptOfferParams,
  ConfirmDeliveryParams,
  RateParams,
  CreateListingResult,
  EscrowCreateParams,
  EscrowActionParams,
} from './types';

// Services
export { DexService } from './dex';
export { OneInchService } from './oneinch';
export { WalletService } from './wallet';
export { MarketplaceService } from './marketplace';

// CEX (Kraken, client-side / bring-your-own-key)
export { KrakenClient } from './cex';
export {
  CexError,
  CredentialsRequiredError,
  InvalidCredentialsError,
  PermissionDeniedError,
  OrderMinNotMetError,
  CostMinNotMetError,
  TickSizeInvalidError,
  InsufficientBalanceError,
  ValidationFailedError,
  PairNotFoundError,
  RateLimitedError,
  VenueUnavailableError,
  InvalidNonceError,
  UnknownCexError,
  mapError,
  translateErrors,
  signRequest,
} from './cex';
export type {
  CexErrorEnvelope,
  KrakenClientConfig,
  KrakenTier,
  OrderType as CexOrderType,
  OrderSide as CexOrderSide,
  TimeInForce as CexTimeInForce,
  OrderStatus as CexOrderStatus,
  AssetInfo as CexAssetInfo,
  PairInfo as CexPairInfo,
  AssetBalance as CexAssetBalance,
  AccountBalance as CexAccountBalance,
  TradeBalance as CexTradeBalance,
  CloseOrder as CexCloseOrder,
  OrderRequest as CexOrderRequest,
  OrderReceipt as CexOrderReceipt,
  OrderDetail as CexOrderDetail,
  TradeDetail as CexTradeDetail,
  PairFeeInfo as CexPairFeeInfo,
  TradeVolumeInfo as CexTradeVolumeInfo,
  Ticker as CexTicker,
  OhlcCandle as CexOhlcCandle,
  OhlcSeries as CexOhlcSeries,
  OrderBookLevel as CexOrderBookLevel,
  OrderBook as CexOrderBook,
  PublicTrade as CexPublicTrade,
  RecentTrades as CexRecentTrades,
  VenueStatus as CexVenueStatus,
  CancelResult as CexCancelResult,
} from './cex';

// Signers
export { EthersSigner } from './signer/ethers';
export { XrplSigner } from './signer/xrpl';

// Escrow monitor
export { EscrowMonitor } from './marketplace/escrow-monitor';
export type { EscrowState } from './marketplace/escrow-monitor';

// Transports
export { McpTransport } from './transport/mcp';
export { RestTransport } from './transport/rest';
