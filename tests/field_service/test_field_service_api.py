from datetime import datetime, timedelta

import pytest

pytestmark = pytest.mark.integration


def test_list_technicians_pagination(test_client):
    res = test_client.get("/api/v1/field-service/technicians?limit=1&offset=0")
    assert res.status_code == 200
    body = res.json()
    assert "technicians" in body
    assert "total" in body
    assert body["page"] == 1
    assert body["page_size"] == 1


def test_list_schedules_alias_and_pagination(test_client):
    res = test_client.get("/api/v1/scheduling/technicians/schedules?limit=5&offset=0")
    assert res.status_code == 200
    body = res.json()
    assert "schedules" in body
    assert "total" in body
    assert "page" in body and body["page"] >= 1
    assert body["page_size"] == 5

    res_alias = test_client.get("/api/v1/scheduling/schedules?limit=3&offset=0")
    assert res_alias.status_code == 200
    alias_body = res_alias.json()
    assert "schedules" in alias_body
    assert alias_body["page_size"] == 3


def test_list_assignments_filters_and_pagination(test_client):
    start = datetime.now().isoformat()
    end = (datetime.now() + timedelta(days=1)).isoformat()
    res = test_client.get(
        f"/api/v1/scheduling/assignments?dateFrom={start}&dateTo={end}&limit=2&offset=0"
    )
    assert res.status_code == 200
    body = res.json()
    assert "assignments" in body
    assert "total" in body
    assert "page" in body
    assert body["page_size"] == 2

    res_status = test_client.get(
        "/api/v1/scheduling/assignments?status_filter=scheduled,confirmed&limit=1&offset=0"
    )
    assert res_status.status_code == 200
    assert "assignments" in res_status.json()
