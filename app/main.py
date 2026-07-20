import os
import time
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Security, Depends
from fastapi.security import APIKeyHeader
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

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

# Set up server & data structures

UPLOAD_DIR = "saved_recordings"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# In-memory data storage (
incident_database = []
emergency_contacts = [] 

# incoming contacts
class Contact(BaseModel):
    name: str
    phone_number: str



# Endpoint to store/retrieve emergency contacts

@app.post("/api/contacts")
async def add_emergency_contact(contact: Contact):
    """Saves emergency contacts submitted during onboarding."""
    emergency_contacts.append(contact.dict())
    return {"status": "success", "message": f"Contact {contact.name} saved backend side."}

@app.get("/api/contacts")
async def get_emergency_contacts():
    """Retrieves saved contacts so the UI can list or edit them."""
    return {"contacts": emergency_contacts}


#  Endpoint to receive + store audio/GPS

@app.post("/api/incident", dependencies=[Depends(verify_api_key)])
async def receive_incident(
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
            
        # Build the structured log
        incident_log = {
            "id": len(incident_database) + 1,
            "timestamp": timestamp,
            "latitude": latitude,
            "longitude": longitude,
            "audio_file_path": file_path
        }
        
        # Append to our main log collection
        incident_database.append(incident_log)
        
        return {
            "status": "success",
            "message": "Incident audio and GPS coordinates logged successfully on the server.",
            "incident_id": incident_log["id"]
        }
        
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


#  Endpoint to  data
@app.get("/api/incidents", dependencies=[Depends(verify_api_key)])
async def get_all_incidents():
    """Serves the stored history back to Kayla's PIN-gated Incident Log page."""
    return {"incidents": incident_database}