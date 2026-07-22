import os
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

# Set a test API key environment variable before importing main
TEST_API_KEY = "test-secret-key"
os.environ["FASTAPI_API_KEY"] = TEST_API_KEY

import db
import main
from main import app

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_test_db(tmp_path):
    """
    Fixture that redirects db.DB_PATH to a temporary file for each test
    so tests don't corrupt the production database.
    """
    test_db_file = tmp_path / "test_silentwitness.db"
    db.DB_PATH = str(test_db_file)
    db.init_db()
    yield


# --- Database Unit Tests ---

def test_db_contacts_flow():
    """Verify emergency contacts can be overwritten and retrieved."""
    contacts = [
        {"name": "Jane Doe", "phone_number": "+1234567890"},
        {"name": "John Smith", "phone_number": "+0987654321"}
    ]
    db.replace_contacts(contacts)
    
    saved_contacts = db.get_contacts()
    assert len(saved_contacts) == 2
    assert saved_contacts[0]["name"] == "Jane Doe"


def test_db_push_token_flow():
    """Verify push tokens can be added and deduplicated."""
    db.add_push_token("ExponentPushToken[123]")
    db.add_push_token("ExponentPushToken[123]") # Duplicate attempt
    
    tokens = db.get_push_tokens()
    assert len(tokens) == 1
    assert tokens[0] == "ExponentPushToken[123]"


def test_db_incident_flow():
    """Verify incident insertion and retrieval."""
    incident_id = db.insert_incident(1700000000, "37.7749", "-122.4194", "saved_recordings/test.m4a")
    assert incident_id == 1

    incident = db.get_incident(1)
    assert incident is not None
    assert incident["latitude"] == "37.7749"

    all_incidents = db.get_incidents()
    assert len(all_incidents) == 1


# API & Authentication Unit Test
def test_get_incidents_unauthorized():
    """Should return 403 Forbidden when missing API key header."""
    response = client.get("/api/incidents")
    assert response.status_code == 403


def test_get_incidents_authorized():
    """Should return 200 OK when valid X-API-KEY header is supplied."""
    headers = {"X-API-KEY": TEST_API_KEY}
    response = client.get("/api/incidents", headers=headers)
    assert response.status_code == 200
    assert "incidents" in response.json()


def test_set_and_get_contacts_api():
    """Verify contact creation and retrieval endpoints."""
    payload = {
        "contacts": [
            {"name": "Alice", "phone_number": "+1111111111"}
        ]
    }
    # POST Contacts
    post_resp = client.post("/api/contacts", json=payload)
    assert post_resp.status_code == 200
    assert post_resp.json()["count"] == 1

    # GET Contacts
    get_resp = client.get("/api/contacts")
    assert get_resp.status_code == 200
    assert len(get_resp.json()["contacts"]) == 1
    assert get_resp.json()["contacts"][0]["name"] == "Alice"


@patch("main.send_push_alerts")
@patch("main.send_sms_alerts")
def test_upload_incident_api(mock_sms, mock_push, tmp_path):
    """Verify incident upload endpoint with audio file and GPS."""
    headers = {"X-API-KEY": TEST_API_KEY}
    
    # Create fake audio content
    fake_audio_content = b"fake audio byte stream"
    files = {"audio_file": ("test_recording.m4a", fake_audio_content, "audio/mp4")}
    data = {"latitude": "40.7128", "longitude": "-74.0060"}

    # Redirect upload dir to temporary test folder
    main.UPLOAD_DIR = str(tmp_path / "saved_recordings")
    os.makedirs(main.UPLOAD_DIR, exist_ok=True)

    response = client.post("/api/incident", headers=headers, data=data, files=files)
    
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert "incident_id" in response.json()
    
    # Ensure push and SMS handlers were invoked
    mock_push.assert_called_once_with("40.7128", "-74.0060")
    mock_sms.assert_called_once_with("40.7128", "-74.0060")


def test_get_incident_audio_flexible_auth(tmp_path):
    """Verify audio streaming route accepts key via query parameter."""
    # Insert test incident
    main.UPLOAD_DIR = str(tmp_path / "saved_recordings")
    os.makedirs(main.UPLOAD_DIR, exist_ok=True)
    audio_file_path = os.path.join(main.UPLOAD_DIR, "test.m4a")
    
    with open(audio_file_path, "wb") as f:
        f.write(b"test audio content")

    incident_id = db.insert_incident(1700000000, "0", "0", audio_file_path)

    # Request via query string parameter ?api_key=
    response = client.get(f"/api/incident/{incident_id}/audio?api_key={TEST_API_KEY}")
    assert response.status_code == 200
    assert response.content == b"test audio content"
    assert response.headers["content-type"] == "audio/mp4"