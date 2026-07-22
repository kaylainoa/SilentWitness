import os
import json
import time
import urllib.request
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Security, Depends, Query, BackgroundTasks
from fastapi.security import APIKeyHeader
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

import db

load_dotenv()

app = FastAPI()

db.init_db()

# --- Transcription + AI tagging (stretch feature) ------------------------
# After an incident is saved we transcribe the 15s clip with a local Whisper
# model (faster-whisper — free, offline, no API key) and ask Claude to produce
# a short tag + one-line description. Both run in the BACKGROUND so the
# /api/incident response (and the emergency alert) are never delayed.

# Lazily-loaded Whisper model — the "base" model is a good speed/accuracy
# balance on CPU for short clips. Loaded once on first use.
_whisper_model = None

def _get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
    return _whisper_model


def transcribe_audio(file_path: str) -> str:
    """Transcribe an audio file to text using local faster-whisper."""
    try:
        model = _get_whisper_model()
        segments, _info = model.transcribe(file_path)
        return " ".join(segment.text.strip() for segment in segments).strip()
    except Exception as e:
        print(f"[Transcribe] Failed for {file_path}: {e}")
        return ""


def generate_tag(transcript: str) -> str:
    """Ask Claude for a short category tag + one-line description of the clip.

    Requires ANTHROPIC_API_KEY in the backend .env. Returns "" if unavailable
    so the incident still works without AI tagging.
    """
    if not transcript:
        return ""
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("[Tag] ANTHROPIC_API_KEY not set — skipping AI tag.")
        return ""

    try:
        import anthropic

        client = anthropic.Anthropic()
        prompt = (
            "This is a transcript of a 15-second audio clip captured by a personal "
            "safety app when a loud noise or distress was detected. In ONE short line, "
            "give a category tag followed by a brief description, like "
            "\"Argument — raised voices, 'get away from me'\" or "
            "\"Ambient noise — no clear speech\". Transcript:\n\n"
            f"{transcript}"
        )
        response = client.messages.create(
            model="claude-opus-4-8",
            max_tokens=100,
            messages=[{"role": "user", "content": prompt}],
        )
        return next((b.text for b in response.content if b.type == "text"), "").strip()
    except Exception as e:
        print(f"[Tag] Claude request failed: {e}")
        return ""


def process_incident_audio(incident_id: int, file_path: str):
    """Background job: transcribe the clip, tag it, and save both to the DB."""
    transcript = transcribe_audio(file_path)
    tag = generate_tag(transcript)
    db.set_incident_analysis(incident_id, transcript, tag)
    print(f"[Analysis] Incident #{incident_id}: tag={tag!r}")

# --- Expo Push alert config (Task 4) -------------------------------------
# We use Expo Push Notifications instead of SMS: free, unlimited, and native to
# an Expo app. The mobile app registers a push token (see /api/push-token
# below); when an incident comes in we POST to Expo's push service to alert
# every registered device.
EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send"


def send_push_alerts(latitude: str, longitude: str):
    """Send an Expo push notification to every registered device."""
    push_tokens = db.get_push_tokens()
    if not push_tokens:
        print("[Push] No push tokens registered — skipping alerts.")
        return

    maps_link = f"https://maps.google.com/?q={latitude},{longitude}"
    for token in push_tokens:
        message = {
            "to": token,
            "title": "SilentWitness alert",
            "body": f"A possible emergency was detected. Location: {maps_link}",
            "sound": "default",
            "data": {"latitude": latitude, "longitude": longitude},
        }
        try:
            req = urllib.request.Request(
                EXPO_PUSH_ENDPOINT,
                data=json.dumps(message).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                print(f"[Push] Sent to {token[:20]}...: {resp.status}")
        except Exception as e:
            print(f"[Push] Failed to send to {token[:20]}...: {e}")


# --- Twilio SMS alert config -----------------------------------------------
# Texts every saved emergency contact when an incident is logged. Requires a
# Twilio account — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and
# TWILIO_FROM_NUMBER in app/.env. Until those are set, this safely no-ops.
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER")


def send_sms_alerts(latitude: str, longitude: str):
    """Text every saved emergency contact via Twilio when an incident is logged."""
    contacts = db.get_contacts()
    if not contacts:
        print("[SMS] No emergency contacts saved — skipping SMS alerts.")
        return

    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER):
        print("[SMS] Twilio not configured (missing env vars) — skipping SMS alerts.")
        return

    from twilio.rest import Client as TwilioClient

    client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    maps_link = f"https://maps.google.com/?q={latitude},{longitude}"
    for contact in contacts:
        try:
            message = client.messages.create(
                body=f"SilentWitness alert: a possible emergency was detected. Location: {maps_link}",
                from_=TWILIO_FROM_NUMBER,
                to=contact["phone_number"],
            )
            print(f"[SMS] Sent to {contact['name']} ({contact['phone_number']}): {message.sid}")
        except Exception as e:
            print(f"[SMS] Failed to send to {contact['name']}: {e}")


# Define the name of the header the frontend must send (e.g., X-API-KEY)
API_KEY_NAME = "X-API-KEY"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

# Get the secret key you created in Step 1
SECRET_API_KEY = os.getenv("FASTAPI_API_KEY")

# This function checks if the frontend sent the correct key
async def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != SECRET_API_KEY:
        raise HTTPException(
            status_code=403,
            detail="Could not validate credentials. Invalid API Key."
        )
    return api_key

# Same check, but also accepts the key as a `?api_key=` query param. Native
# audio players load a plain string URL and can't be relied on to attach
# custom headers, so the audio-streaming route needs this instead of the
# header-only version above.
async def verify_api_key_flexible(
    header_key: str = Depends(api_key_header),
    query_key: Optional[str] = Query(default=None, alias="api_key"),
):
    key = header_key or query_key
    if key != SECRET_API_KEY:
        raise HTTPException(
            status_code=403,
            detail="Could not validate credentials. Invalid API Key."
        )
    return key

# Set up server & data structures

UPLOAD_DIR = "saved_recordings"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# incoming contacts
class ContactIn(BaseModel):
    name: str
    phone_number: str


class ContactsPayload(BaseModel):
    contacts: list[ContactIn]


# Endpoint to store/retrieve emergency contacts

@app.post("/api/contacts")
async def set_emergency_contacts(payload: ContactsPayload):
    """Replaces the saved contact list with what the app currently has (called
    whenever the profile's emergency contacts change)."""
    db.replace_contacts([c.dict() for c in payload.contacts])
    return {"status": "success", "count": len(payload.contacts)}

@app.get("/api/contacts")
async def get_emergency_contacts():
    """Retrieves saved contacts so the UI can list or edit them."""
    return {"contacts": db.get_contacts()}


# Endpoint for the app to register its Expo push token (Task 4)

class PushToken(BaseModel):
    token: str

@app.post("/api/push-token")
async def register_push_token(payload: PushToken):
    """The app calls this on startup to register for emergency push alerts."""
    db.add_push_token(payload.token)
    return {"status": "success", "registered": len(db.get_push_tokens())}


#  Endpoint to receive + store audio/GPS

@app.post("/api/incident", dependencies=[Depends(verify_api_key)])
async def receive_incident(
    background_tasks: BackgroundTasks,
    latitude: str = Form(...),
    longitude: str = Form(...),
    audio_file: UploadFile = File(...)
):
    """
    Receives incoming payload from the app during an emergency event.
    """
    try:
        # Create unique filename with timestamp
        timestamp = int(time.time())
        filename = f"incident_{timestamp}_{audio_file.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)

        # Save the audio file directly onto the server storage
        with open(file_path, "wb") as buffer:
            buffer.write(await audio_file.read())

        # Persist the incident so it survives server restarts.
        incident_id = db.insert_incident(timestamp, latitude, longitude, file_path)

        # Task 4: fire push + SMS alerts to everyone registered/saved.
        send_push_alerts(latitude, longitude)
        send_sms_alerts(latitude, longitude)

        # Stretch: transcribe + AI-tag the clip in the background so the
        # response (and the alert above) are returned immediately.
        background_tasks.add_task(process_incident_audio, incident_id, file_path)

        return {
            "status": "success",
            "message": "Incident audio and GPS coordinates logged successfully on the server.",
            "incident_id": incident_id
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


#  Endpoint to  data
@app.get("/api/incidents", dependencies=[Depends(verify_api_key)])
async def get_all_incidents():
    """Serves the stored history back to Kayla's PIN-gated Incident Log page."""
    return {"incidents": db.get_incidents()}


# Endpoint to stream back a single incident's saved audio clip.
@app.api_route(
    "/api/incident/{incident_id}/audio",
    methods=["GET", "HEAD"],
    dependencies=[Depends(verify_api_key_flexible)],
)
async def get_incident_audio(incident_id: int):
    incident = db.get_incident(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    file_path = incident["audio_file_path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")

    # Use the registered MIME type for .m4a/AAC (audio/mp4). "audio/m4a" is
    # non-standard and native players (iOS AVPlayer / Android ExoPlayer) sniff
    # format by MIME/extension — with a non-standard type AND no file extension
    # in the URL, the clip downloads but the decoder refuses to play it.
    return FileResponse(file_path, media_type="audio/mp4", content_disposition_type="inline")
