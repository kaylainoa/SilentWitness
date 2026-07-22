import os
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def get_auth_headers():
    api_key = os.getenv("FASTAPI_API_KEY", "test_key")
    return {"X-API-KEY": api_key}


# -------------------------------------------------------------------
# Core API & Authentication Tests (1 - 8)
# -------------------------------------------------------------------

def test_get_incidents_unauthorized():
    """Test 1: Missing X-API-KEY header returns 403 Forbidden."""
    response = client.get("/api/incidents")
    assert response.status_code == 403


def test_get_incidents_authorized():
    """Test 2: Request with valid X-API-KEY header succeeds and returns dict."""
    response = client.get("/api/incidents", headers=get_auth_headers())
    assert response.status_code == 200
    data = response.json()
    assert "incidents" in data
    assert isinstance(data["incidents"], list)


def test_set_and_get_contacts_api():
    """Test 3: POST and GET /api/contacts endpoints."""
    headers = get_auth_headers()
    payload = {"contacts": [{"name": "Charlie", "phone_number": "+3333333333"}]}
    
    post_res = client.post("/api/contacts", json=payload, headers=headers)
    assert post_res.status_code in (200, 201)

    get_res = client.get("/api/contacts")
    assert get_res.status_code == 200


def test_upload_incident_api():
    """Test 4: Uploading emergency audio recording and coordinates."""
    headers = get_auth_headers()
    dummy_audio = b"dummy audio content"
    files = {"audio_file": ("recording.m4a", dummy_audio, "audio/m4a")}
    data = {"latitude": "37.7749", "longitude": "-122.4194"}

    response = client.post("/api/incident", data=data, files=files, headers=headers)
    if response.status_code == 422:
        # Fallback if field name is 'file'
        files = {"file": ("recording.m4a", dummy_audio, "audio/m4a")}
        response = client.post("/api/incident", data=data, files=files, headers=headers)

    assert response.status_code in (200, 201)


def test_register_push_token_api():
    """Test 5: Registering a valid push token returns success."""
    headers = get_auth_headers()
    payload = {"token": "ExponentPushToken[123]", "push_token": "ExponentPushToken[123]"}
    response = client.post("/api/push-token", json=payload, headers=headers)
    assert response.status_code in (200, 201)


def test_get_contacts_public():
    """Test 6: Fetching contacts without headers returns 200 OK."""
    response = client.get("/api/contacts")
    assert response.status_code == 200


def test_docs_accessible():
    """Test 7: OpenAPI documentation route is accessible."""
    response = client.get("/docs")
    assert response.status_code == 200


def test_openapi_schema():
    """Test 8: OpenAPI schema is generated properly."""
    response = client.get("/openapi.json")
    assert response.status_code == 200


# -------------------------------------------------------------------
# Error Handling & Validation Tests (9 - 10)
# -------------------------------------------------------------------

def test_get_incident_audio_not_found():
    """Test 9: Requesting audio for a non-existent incident returns 404."""
    headers = get_auth_headers()
    response = client.get("/api/incident/999999/audio", headers=headers)
    assert response.status_code == 404


def test_upload_incident_missing_file():
    """Test 10: Uploading an incident without an audio file returns 422 Unprocessable Entity."""
    headers = get_auth_headers()
    payload = {"latitude": "37.7749", "longitude": "-122.4194"}
    response = client.post("/api/incident", data=payload, headers=headers)
    assert response.status_code == 422