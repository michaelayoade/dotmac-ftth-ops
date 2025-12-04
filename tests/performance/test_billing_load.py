"""
Lightweight billing load validation designed to run inside the integration suite.

The original version of this module defined Locust users and skipped outright when
Locust was not installed.  To keep the same ergonomics for manual load testing while
still exercising the flows in CI, this rewrite exposes helper functions that drive
the important billing operations and provides pytest coverage backed by a minimal
HTTP client stub.

When Locust is available you can still execute the users below with:
    locust -f tests/performance/test_billing_load.py --host=http://localhost:8000
"""

from __future__ import annotations

import json
import random
from collections.abc import Callable, Iterable
from datetime import datetime, timedelta

import pytest

# ------------------------------------------------------------------ #
# Locust compatibility (optional dependency)
# ------------------------------------------------------------------ #

LOCUST_AVAILABLE = True
try:  # pragma: no cover - exercised only when locust is installed
    from locust import HttpUser, between, task  # type: ignore
except ImportError:  # pragma: no cover - fallback used in CI
    LOCUST_AVAILABLE = False

    def between(min_wait: float, max_wait: float):
        """Return a callable compatible with Locust's wait_time interface."""

        def _wait() -> float:
            return random.uniform(min_wait, max_wait)

        return _wait

    def task(weight: int = 1):
        """Decorator used by Locust to mark tasks with optional weighting."""

        def decorator(func):
            func.locust_task_weight = weight  # type: ignore[attr-defined]
            return func

        return decorator

    class HttpUser:  # Minimal stand-in used when Locust is unavailable
        wait_time = staticmethod(lambda: 1.0)

        def __init__(self):
            self.client = None


pytestmark = [
    pytest.mark.integration,
    pytest.mark.performance,
]

# ------------------------------------------------------------------ #
# Helper functions shared by Locust users and tests
# ------------------------------------------------------------------ #

DEFAULT_PASSWORD = "LoadTest123!@#"
INVOICE_IDS = ("1", "2", "3")
UPGRADE_PRICE_IDS = ("3", "5")
TEST_CARDS = (
    "4242424242424242",  # Visa
    "5555555555554444",  # Mastercard
    "4000000000003220",  # 3D Secure
)
WEBHOOK_EVENTS = (
    "invoice.payment_succeeded",
    "customer.subscription.updated",
    "invoice.created",
    "payment_method.attached",
    "customer.updated",
)


def login_and_get_headers(client, *, rng=random) -> dict[str, str]:
    """Authenticate via the API and return Authorization headers."""
    username_suffix = rng.randint(1000, 9999)
    username = f"loadtest_user_{username_suffix}"
    password = DEFAULT_PASSWORD

    login_payload = {"username": username, "password": password}
    response = client.post("/api/v1/auth/login", json=login_payload)
    if response.status_code != 200:
        client.post(
            "/api/v1/auth/register",
            json={
                "username": username,
                "email": f"{username}@example.com",
                "password": password,
            },
        )
        response = client.post("/api/v1/auth/login", json=login_payload)

    token = response.json().get("access_token", "")
    return {"Authorization": f"Bearer {token}"} if token else {}


def get_current_subscription(client, headers, *, rng=None, now=None):
    return client.get(
        "/api/v1/billing/subscription",
        headers=headers,
        name="Get Current Subscription",
    )


def get_billing_usage(client, headers, *, rng=None, now=None):
    return client.get(
        "/api/v1/billing/usage",
        headers=headers,
        name="Get Billing Usage",
    )


def list_invoices(client, headers, *, rng=None, now=None):
    return client.get(
        "/api/v1/billing/invoices?page=1&limit=10",
        headers=headers,
        name="List Invoices",
    )


def get_payment_methods(client, headers, *, rng=None, now=None):
    return client.get(
        "/api/v1/billing/payment-methods",
        headers=headers,
        name="Get Payment Methods",
    )


def view_invoice_detail(client, headers, *, rng=random, now=None):
    invoice_id = rng.choice(INVOICE_IDS)
    return client.get(
        f"/api/v1/billing/invoices/{invoice_id}",
        headers=headers,
        name="View Invoice Detail",
    )


def download_invoice_pdf(client, headers, *, rng=random, now=None):
    invoice_id = rng.choice(INVOICE_IDS)
    with client.get(
        f"/api/v1/billing/invoices/{invoice_id}/pdf",
        headers=headers,
        name="Download Invoice PDF",
        catch_response=True,
    ) as response:
        if response.status_code == 200:
            response.success()
        else:
            response.failure(f"PDF download failed: {response.status_code}")
        return response.status_code


def subscription_upgrade_preview(client, headers, *, rng=random, now=None):
    new_price_id = rng.choice(UPGRADE_PRICE_IDS)
    return client.post(
        "/api/v1/billing/subscription/preview-upgrade",
        json={"price_id": new_price_id},
        headers=headers,
        name="Preview Subscription Upgrade",
    )


def add_payment_method(client, headers, *, rng=random, now=None):
    exp_month = rng.randint(1, 12)
    exp_year = rng.randint(2024, 2029)
    cvc = str(rng.randint(100, 999))
    card_number = rng.choice(TEST_CARDS)
    card_holder = f"Test User {rng.randint(1, 100)}"

    return client.post(
        "/api/v1/billing/payment-methods",
        json={
            "card_number": card_number,
            "exp_month": exp_month,
            "exp_year": exp_year,
            "cvc": cvc,
            "name": card_holder,
        },
        headers=headers,
        name="Add Payment Method",
    )


def generate_revenue_report(
    client, headers, *, rng=None, now: Callable[[], datetime] | None = None
):
    now_fn = now or datetime.now
    end_date = now_fn()
    start_date = end_date - timedelta(days=30)

    return client.get(
        f"/api/v1/billing/reports/revenue?"
        f"start_date={start_date.strftime('%Y-%m-%d')}"
        f"&end_date={end_date.strftime('%Y-%m-%d')}",
        headers=headers,
        name="Generate Revenue Report",
    )


def process_webhook_event(client, *, rng=random, now: Callable[[], datetime] | None = None):
    timestamp = int((now or datetime.now)().timestamp())
    event_type = rng.choice(WEBHOOK_EVENTS)
    payload = {
        "id": f"evt_load_{rng.randint(100000, 999999)}",
        "object": "event",
        "type": event_type,
        "data": {
            "object": {
                "id": f"obj_{rng.randint(100000, 999999)}",
                "customer": f"cus_{rng.randint(100000, 999999)}",
            }
        },
    }
    signature = f"t={timestamp},v1={rng.randint(100000, 999999)}"

    return client.post(
        "/api/v1/webhooks/stripe",
        data=json.dumps(payload),
        headers={"Stripe-Signature": signature},
        name="Process Webhook",
    )


# ------------------------------------------------------------------ #
# Locust user definitions (still available for manual execution)
# ------------------------------------------------------------------ #


class BillingLoadTestUser(HttpUser):  # pragma: no cover - exercised via Locust
    """Simulates user behaviour for billing operations under load."""

    wait_time = between(0.5, 2)  # Reduced wait time for higher throughput

    def on_start(self):
        self.headers = login_and_get_headers(self.client)

    @task(20)  # Increased weight for high-frequency read operation
    def ts_get_current_subscription(self):
        get_current_subscription(self.client, self.headers)

    @task(15)
    def ts_get_billing_usage(self):
        get_billing_usage(self.client, self.headers)

    @task(10)
    def ts_list_invoices(self):
        list_invoices(self.client, self.headers)

    @task(4)
    def ts_get_payment_methods(self):
        get_payment_methods(self.client, self.headers)

    @task(3)
    def ts_view_invoice_detail(self):
        view_invoice_detail(self.client, self.headers)

    @task(2)
    def ts_download_invoice_pdf(self):
        download_invoice_pdf(self.client, self.headers)

    @task(2)
    def ts_subscription_upgrade_preview(self):
        subscription_upgrade_preview(self.client, self.headers)

    @task(1)
    def ts_add_payment_method(self):
        add_payment_method(self.client, self.headers)

    @task(1)
    def ts_generate_revenue_report(self):
        generate_revenue_report(self.client, self.headers)


class WebhookLoadTestUser(HttpUser):  # pragma: no cover - exercised via Locust
    """Simulates high-volume webhook processing."""

    wait_time = between(0.1, 0.5)

    @task
    def ts_process_webhook(self):
        process_webhook_event(self.client)


# ------------------------------------------------------------------ #
# In-suite behavioural tests using a deterministic HTTP client stub
# ------------------------------------------------------------------ #


class DummyResponse:
    def __init__(self, status_code: int = 200, payload: dict | None = None):
        self.status_code = status_code
        self._payload = payload or {}
        self.success_called = False
        self.failure_message: str | None = None

    def json(self):
        return self._payload

    def success(self):
        self.success_called = True
        self.failure_message = None

    def failure(self, message: str):
        self.success_called = False
        self.failure_message = message

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class DummyClient:
    """Record HTTP interactions and return queued responses."""

    def __init__(self, responses: Iterable[DummyResponse] | None = None):
        self._responses = list(responses or [])
        self.calls: list[tuple[str, str, dict]] = []

    def _next(self) -> DummyResponse:
        if self._responses:
            resp = self._responses.pop(0)
            if isinstance(resp, DummyResponse):
                return resp
        return DummyResponse()

    def post(self, path: str, **kwargs):
        self.calls.append(("POST", path, kwargs))
        return self._next()

    def get(self, path: str, **kwargs):
        self.calls.append(("GET", path, kwargs))
        response = self._next()
        return response


class DeterministicRandom:
    """Deterministic stand-in for functions that rely on randomness."""

    def __init__(self):
        self._int_values = iter([1111, 2222, 3333, 4444, 5555, 6666])

    def randint(self, a: int, b: int) -> int:
        try:
            return next(self._int_values)
        except StopIteration:
            return a

    def choice(self, sequence):
        return sequence[0]


def test_login_and_get_headers_success():
    client = DummyClient(responses=[DummyResponse(200, {"access_token": "token-abc"})])

    headers = login_and_get_headers(client, rng=DeterministicRandom())

    assert headers == {"Authorization": "Bearer token-abc"}
    assert client.calls[0][0] == "POST"
    assert client.calls[0][1] == "/api/v1/auth/login"


def test_login_and_get_headers_register_flow():
    client = DummyClient(
        responses=[
            DummyResponse(401, {"detail": "Unauthorized"}),
            DummyResponse(201, {}),
            DummyResponse(200, {"access_token": "token-def"}),
        ]
    )

    headers = login_and_get_headers(client, rng=DeterministicRandom())

    assert headers == {"Authorization": "Bearer token-def"}
    methods = [call[0] for call in client.calls]
    paths = [call[1] for call in client.calls]
    assert methods == ["POST", "POST", "POST"]
    assert paths == [
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/login",
    ]


@pytest.mark.parametrize(
    ("helper", "expected_method", "expected_path"),
    [
        (get_current_subscription, "GET", "/api/v1/billing/subscription"),
        (get_billing_usage, "GET", "/api/v1/billing/usage"),
        (list_invoices, "GET", "/api/v1/billing/invoices?page=1&limit=10"),
        (get_payment_methods, "GET", "/api/v1/billing/payment-methods"),
        (view_invoice_detail, "GET", "/api/v1/billing/invoices/1"),
        (
            subscription_upgrade_preview,
            "POST",
            "/api/v1/billing/subscription/preview-upgrade",
        ),
        (add_payment_method, "POST", "/api/v1/billing/payment-methods"),
    ],
)
def test_billing_task_routes(helper, expected_method, expected_path):
    client = DummyClient()
    headers = {"Authorization": "Bearer token"}

    helper(client, headers, rng=DeterministicRandom(), now=lambda: datetime(2025, 1, 1))

    method, path, _ = client.calls[-1]
    assert method == expected_method
    assert path == expected_path


def test_generate_revenue_report_query_parameters():
    client = DummyClient()
    headers = {"Authorization": "Bearer token"}
    now_fn = lambda: datetime(2025, 1, 1)  # noqa: E731

    generate_revenue_report(client, headers, rng=DeterministicRandom(), now=now_fn)

    _, path, _ = client.calls[-1]
    assert path == "/api/v1/billing/reports/revenue?start_date=2024-12-02&end_date=2025-01-01"


def test_download_invoice_pdf_success():
    response = DummyResponse(200)
    client = DummyClient(responses=[response])
    headers = {"Authorization": "Bearer token"}

    status = download_invoice_pdf(client, headers, rng=DeterministicRandom())

    assert status == 200
    assert response.success_called is True
    assert response.failure_message is None


def test_download_invoice_pdf_failure_sets_failure_message():
    response = DummyResponse(500)
    client = DummyClient(responses=[response])
    headers = {"Authorization": "Bearer token"}

    status = download_invoice_pdf(client, headers, rng=DeterministicRandom())

    assert status == 500
    assert response.success_called is False
    assert response.failure_message == "PDF download failed: 500"


def test_process_webhook_event_posts_expected_payload():
    client = DummyClient()
    rng = DeterministicRandom()
    now_fn = lambda: datetime(2025, 1, 1, 12, 0, 0)  # noqa: E731

    process_webhook_event(client, rng=rng, now=now_fn)

    method, path, kwargs = client.calls[-1]
    assert method == "POST"
    assert path == "/api/v1/webhooks/stripe"
    assert "Stripe-Signature" in kwargs["headers"]

    payload = json.loads(kwargs["data"])
    assert payload["object"] == "event"
    assert payload["type"] in WEBHOOK_EVENTS
