"""Full-result API and error metadata using real HTTP transport doubles."""

import concurrent.futures

import httpx
import pytest

from mangrove_markets import APIError, MalformedResponseError, MangroveMarkets

HEADER = {"X-Mangrove-Result-Format": "mcp-v1"}


def client_for(handler):
    return MangroveMarkets(
        base_url="https://fixture.invalid",
        api_key="fixture-key",
        httpx_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )


def test_complete_result_and_domain_error():
    def handler(request):
        assert request.headers["X-Mangrove-Result-Format"] == "mcp-v1"
        return httpx.Response(
            200,
            headers={**HEADER, "Payment-Response": "fixture-receipt"},
            json={
                "content": [
                    {"type": "text", "text": '{"error":true,"code":"UNAVAILABLE"}'},
                    {"type": "image", "data": "aGVsbG8=", "mimeType": "image/png"},
                ],
                "structuredContent": {"result": '{"error":true,"code":"UNAVAILABLE"}'},
                "_meta": {"receipt": "fixture"},
            },
        )

    with client_for(handler) as client:
        response = client.call_tool_result("fixture", {})
    assert response.result.is_error
    assert response.result.data()["code"] == "UNAVAILABLE"
    assert response.result.meta == {"receipt": "fixture"}
    assert len(response.result.content) == 2
    assert response.headers["payment-response"] == "fixture-receipt"


def test_unacknowledged_format_is_not_replayed():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json={"quote_id": "q1"})

    with client_for(handler) as client, pytest.raises(MalformedResponseError, match="do not automatically retry"):
        client.call_tool_result("fixture")
    assert len(calls) == 1


@pytest.mark.parametrize("status", [402, 503])
def test_http_errors_preserve_metadata_without_replaying(status):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(
            status,
            headers={"Payment-Required": "fixture-challenge"},
            json={
                "error": True,
                "code": "PAYMENT_REQUIRED",
                "message": "Payment required",
            },
        )

    with client_for(handler) as client, pytest.raises(APIError) as exc:
        client.call_tool_result("fixture")
    assert len(calls) == 1
    assert exc.value.response_headers["payment-required"] == "fixture-challenge"
    assert exc.value.response_body["code"] == "PAYMENT_REQUIRED"


def test_invalid_payload_diagnostics_do_not_echo_payload():
    with (
        client_for(
            lambda request: httpx.Response(
                200,
                headers=HEADER,
                json={
                    "content": "fixture-private-payload",
                },
            )
        ) as client,
        pytest.raises(MalformedResponseError) as exc,
    ):
        client.call_tool_result("fixture")
    assert "fixture-private-payload" not in str(exc.value)
    assert exc.value.__suppress_context__


def test_concurrent_result_metadata_stays_with_its_request():
    def handler(request):
        name = request.url.path.rsplit("/", 1)[-1]
        return httpx.Response(
            200,
            headers=HEADER,
            json={
                "content": [],
                "structuredContent": {"name": name},
                "_meta": {"request": name},
            },
        )

    with client_for(handler) as client, concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(client.call_tool_result, [f"fixture_{n}" for n in range(20)]))
    for n, response in enumerate(results):
        assert response.result.data()["name"] == f"fixture_{n}"
        assert response.result.meta["request"] == f"fixture_{n}"


def test_invalid_tool_name_never_contacts_server():
    with client_for(lambda request: pytest.fail("Unexpected request")) as client:
        with pytest.raises(ValueError, match="Invalid tool name"):
            client.call_tool_result("../fixture")


def test_wallet_repr_does_not_expose_secret():
    from mangrove_markets.models.wallet import WalletCreateResult

    result = WalletCreateResult(address="fixture-address", secret="fixture-seed", private_key="fixture-key")
    assert "fixture-seed" not in repr(result)
    assert "fixture-key" not in repr(result)
    assert result.secret == "fixture-seed"


def test_full_request_uses_configured_timeout():
    def handler(request):
        assert request.extensions["timeout"]["read"] == 7.0
        return httpx.Response(200, headers=HEADER, json={"content": []})

    with MangroveMarkets(
        base_url="https://fixture.invalid",
        api_key="fixture-key",
        timeout=7.0,
        httpx_client=httpx.Client(transport=httpx.MockTransport(handler)),
    ) as client:
        client.call_tool_result("fixture")


def test_malformed_text_block_is_rejected():
    with (
        client_for(
            lambda request: httpx.Response(
                200,
                headers=HEADER,
                json={
                    "content": [{"type": "text", "text": 123}],
                },
            )
        ) as client,
        pytest.raises(MalformedResponseError),
    ):
        client.call_tool_result("fixture")


@pytest.mark.parametrize("failure", ["missing_ack", "invalid_envelope", "invalid_json"])
def test_format_failures_preserve_receipt_without_replay_or_message_leak(failure):
    calls = []
    body = {"content": "fixture-private-payload"}
    headers = {"Payment-Response": "fixture-receipt"}
    if failure != "missing_ack":
        headers.update(HEADER)

    def handler(request):
        calls.append(request)
        if failure == "invalid_json":
            return httpx.Response(200, headers=headers, content="fixture-private-payload")
        return httpx.Response(200, headers=headers, json=body)

    with client_for(handler) as client, pytest.raises(MalformedResponseError) as exc:
        client.call_tool_result("fixture")
    assert len(calls) == 1
    assert exc.value.status_code == 200
    assert exc.value.response_headers["payment-response"] == "fixture-receipt"
    assert exc.value.response_body == ("fixture-private-payload" if failure == "invalid_json" else body)
    assert "fixture-private-payload" not in str(exc.value)
    assert "fixture-receipt" not in repr(exc.value)
