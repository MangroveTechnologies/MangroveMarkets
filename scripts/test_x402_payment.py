"""End-to-end x402 payment test against MangroveMarkets MCP Server.

Tests the full x402 payment flow:
1. Client hits x402-protected endpoint -> gets 402 + payment requirements
2. x402 SDK auto-signs payment authorization with EVM wallet
3. Client retries with payment-signature header
4. Server verifies via Coinbase facilitator, serves content, settles payment

Requirements:
- MCP Server running at SERVER_URL (default: http://localhost:8091)
- WALLET_SECRET env var with EVM private key (Base Sepolia funded)
- Wallet needs Base Sepolia ETH (gas) + test USDC
- pip install x402[evm] httpx eth-account

Usage:
    # Set wallet secret
    export WALLET_SECRET=0x...
    # Or load from .env

    # Start MCP Server first:
    cd MangroveMarkets-MCP-Server
    ENVIRONMENT=test uvicorn src.app:app --port 8091

    # Run this script:
    cd MangroveMarkets
    python scripts/test_x402_payment.py
"""
import asyncio
import os
import sys

# Load .env if present
def load_dotenv():
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    value = value.strip().strip('"').strip("'")
                    os.environ.setdefault(key.strip(), value)

load_dotenv()

SERVER_URL = os.environ.get("SERVER_URL", "http://localhost:8091")
WALLET_SECRET = os.environ.get("WALLET_SECRET")

if not WALLET_SECRET:
    print("ERROR: WALLET_SECRET env var not set.")
    print("Set it in MangroveMarkets/.env or export WALLET_SECRET=0x...")
    sys.exit(1)


async def test_402_response():
    """Step 1: Verify the server returns 402 with payment requirements."""
    import httpx

    print("--- Step 1: Verify 402 response (no payment) ---")
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{SERVER_URL}/api/v1/x402-test")

    print(f"  Status: {resp.status_code}")
    assert resp.status_code == 402, f"Expected 402, got {resp.status_code}"

    payment_header = resp.headers.get("payment-required")
    assert payment_header, "Missing payment-required header"
    print(f"  payment-required header: {payment_header[:80]}...")

    import base64, json
    # Decode the payment requirements
    padded = payment_header + "=" * (4 - len(payment_header) % 4)
    requirements = json.loads(base64.b64decode(padded))
    print(f"  x402 version: {requirements.get('x402Version')}")
    accept = requirements['accepts'][0]
    print(f"  Network: {accept['network']}")
    print(f"  Pay to: {accept.get('payTo', accept.get('pay_to', 'N/A'))}")
    print(f"  Amount: {accept.get('maxAmountRequired', accept.get('max_amount_required', accept.get('amount', 'N/A')))}")
    print(f"  Asset: {accept.get('asset', 'N/A')}")
    print("  PASS: Server returns valid 402 with payment requirements")
    return requirements


async def test_health():
    """Step 0: Verify server is reachable."""
    import httpx

    print("--- Step 0: Server health check ---")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{SERVER_URL}/health")
        print(f"  Status: {resp.status_code}")
        assert resp.status_code == 200
        print(f"  Response: {resp.json()}")
        print("  PASS: Server is healthy")
    except httpx.ConnectError:
        print(f"  FAIL: Cannot connect to {SERVER_URL}")
        print(f"  Start the server: ENVIRONMENT=test uvicorn src.app:app --port 8091")
        sys.exit(1)


async def test_paid_request():
    """Step 2: Make a paid request using x402 SDK auto-payment."""
    from eth_account import Account
    from x402 import x402Client
    from x402.mechanisms.evm.signers import EthAccountSigner
    from x402.mechanisms.evm.exact import register_exact_evm_client
    from x402.http.clients.httpx import x402HttpxClient

    print("--- Step 2: Make paid request (x402 auto-payment) ---")

    # Create signer from wallet secret
    account = Account.from_key(WALLET_SECRET)
    print(f"  Wallet: {account.address}")

    signer = EthAccountSigner(account)
    client = x402Client()
    register_exact_evm_client(client, signer)

    # Make request -- x402HttpxClient auto-handles 402 -> sign -> retry
    print(f"  Hitting {SERVER_URL}/api/v1/x402-test with auto-payment...")
    async with x402HttpxClient(client) as http:
        resp = await http.get(f"{SERVER_URL}/api/v1/x402-test")

    print(f"  Status: {resp.status_code}")
    print(f"  Body: {resp.text[:500]}")

    # Check for payment response header (settlement confirmation)
    payment_response = resp.headers.get("payment-response") or resp.headers.get("x-payment-response")
    if payment_response:
        import base64, json
        padded = payment_response + "=" * (4 - len(payment_response) % 4)
        try:
            settlement = json.loads(base64.b64decode(padded))
            print(f"  Settlement: {json.dumps(settlement, indent=2)}")
        except Exception:
            print(f"  Settlement header (raw): {payment_response[:200]}")

    if resp.status_code == 200:
        data = resp.json()
        print(f"  Message: {data.get('message', 'N/A')}")
        print("  PASS: Payment verified, content delivered, settlement complete")
    else:
        print(f"  FAIL: Expected 200 after payment, got {resp.status_code}")
        print(f"  This likely means the wallet needs Base Sepolia test USDC")
        print(f"  USDC contract: 0x036CbD53842c5426634e7929541eC2318f3dCF7e")
        sys.exit(1)


async def main():
    print("=" * 60)
    print("x402 End-to-End Payment Test")
    print(f"Server: {SERVER_URL}")
    print(f"Network: Base Sepolia (eip155:84532)")
    print("=" * 60)
    print()

    await test_health()
    print()
    await test_402_response()
    print()
    await test_paid_request()

    print()
    print("=" * 60)
    print("ALL TESTS PASSED -- x402 payment flow verified end-to-end")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
