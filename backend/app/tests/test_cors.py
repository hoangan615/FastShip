"""Regression test for a live-testing find: the API had no CORS
middleware at all, so any browser-based client (Expo web, a future ops
web dashboard) was silently blocked by the browser's CORS policy even
though curl/native mobile requests (not subject to CORS) worked fine.
"""


async def test_preflight_request_is_allowed_from_any_origin(api_client):
    response = await api_client.options(
        "/auth/login",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "*"


async def test_actual_response_carries_cors_header(api_client):
    response = await api_client.get("/health", headers={"Origin": "http://localhost:8081"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "*"
