# Listing prices

SDK search and listing detail results expose one `price` object:

```ts
listing.price.amount
listing.price.currency
listing.price.chain
```

This replaces `Listing.priceXrp`. Display the currency and chain supplied by Markets; do not infer another currency or convert the amount. `chain: "base"` alone does not distinguish mainnet from testnet.

The SDK requires a currency-qualified server response and rejects missing or malformed prices. It does not map legacy `price_xrp` responses to XRP: older servers used that field for amounts in other currencies too. Upgrade the server if it only returns the legacy field. If both fields occur, `price` is authoritative and the legacy field is not exposed.

The existing `CreateListingParams.priceXrp` input remains unchanged for compatibility with the legacy create-listing request. This change only updates listing responses; it does not add payment or pricing rules to the SDK.


`ListingPrice.network` preserves the server's settlement network, for example
`eip155:8453` (Base mainnet) or `eip155:84532` (Base Sepolia). A missing legacy
network is normalized to `null`; it is never inferred from `chain: "base"`.
Clients must treat that value as unknown rather than advertise a mainnet price.
