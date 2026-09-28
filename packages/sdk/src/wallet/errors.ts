/** AI tool outputs must not carry private keys or discard newly generated keys. */
export class LocalWalletCustodyRequiredError extends Error {
  readonly code = 'LOCAL_CUSTODY_REQUIRED';

  constructor() {
    super('Create the wallet in a local wallet manager that securely stores its keys. ' +
      'This plugin has no local custody integration and cannot return wallet secrets in tool results.');
    this.name = 'LocalWalletCustodyRequiredError';
  }
}
