```markdown
#  SilentWitness

SilentWitness is a personal safety mobile and backend application that automatically detects emergency sounds and silently sends real-time location and audio evidence to emergency contacts via Expo Push Notifications when seconds matter most.

---

##  Project Overview

Victims of violent or dangerous situations are often physically prevented or terrified to make an explicit 911 call in front of an aggressor. Traditional safety apps fail if a user cannot safely pull out their phone, unlock it, and press a button.

SilentWitness solves this by operating behind a fully functional calculator disguise while actively monitoring ambient audio for emergency distress signals (such as acoustic spikes or screams) without requiring phone interaction. When triggered, the system captures audio evidence, retrieves live GPS coordinates, and dispatches instant alerts directly to emergency contacts using the Expo Push Notification service.

---

##  Key Features

* ** Stealth Calculator UI:** Functions as a fully working calculator in plain sight while gating sensitive screens (contacts, incident logs) behind user PIN verification.
* ** Sound Activation:** Monitors locally for acoustic volume spikes to trigger emergency recording hands-free.
* ** Instant Expo Push Alerts:** Automatically notifies designated emergency contacts with a link to live GPS location and 15-second audio recordings.
* ** Secure Evidence Logging:** Saves emergency audio clips directly to an isolated server directory with restricted streaming access.
* ** Protected API Endpoints:** Secures server endpoints using strict `X-API-KEY` header authentication.

---

##  Tech Stack

* **Frontend:** React Native, Expo, Expo Location, Expo AV, Expo Notifications
* **Backend:** Python 3.10+, FastAPI, Uvicorn, SQLite
* **Testing:** Pytest, HTTPX

---

## Getting Started

### Prerequisites
* **Node.js** (v18+) & **npm**
* **Python** (v3.10+)
* **Expo Go App** installed on your mobile device (iOS/Android)

---

###  Backend Setup (FastAPI)

1. **Clone the Repository:**
   ```bash
   git clone [https://github.com/kaylainoa/SilentWitness.git](https://github.com/kaylainoa/SilentWitness.git)
   cd SilentWitness

```

2. **Install Python Dependencies:**
```bash
pip install -r requirements.txt

```


3. **Configure Environment Variables:**
Create a `.env` file in the root directory:
```env
FASTAPI_API_KEY=your_secret_api_key

```


4. **Start the Backend Server:**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

```


5. **Run Unit Tests:**
```bash
PYTHONPATH=. python -m pytest app/test_main.py

```



---

###  Mobile App Setup (React Native / Expo)

1. **Install Frontend Dependencies:**
```bash
npm install

```


2. **Start the Expo Development Server:**
```bash
npx expo start

```


3. **Run on Device:**
* Scan the generated QR code using the **Expo Go** app on Android or the **Camera app** on iOS.



---

##  API Reference

All backend requests require the `X-API-KEY` header unless noted otherwise.

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/incident` | Uploads emergency audio clip and GPS coordinates |
| `GET` | `/api/incidents` | Retrieves all past recorded incident logs |
| `GET` | `/api/incident/{id}/audio` | Streams audio clip for a specific incident |
| `POST` | `/api/contacts` | Replaces saved emergency contact list |
| `GET` | `/api/contacts` | Retrieves saved emergency contacts |
| `POST` | `/api/push-token` | Registers Expo push token for alerts |

---

##  Project Structure

```
SilentWitness/
│
├── app/                  # Python Backend (FastAPI)
│   ├── main.py           # API routes & push notification handlers
│   ├── db.py             # SQLite database helper functions
│   └── test_main.py      # Automated Pytest unit test suite
│
├── saved_recordings/     # Isolated server storage for incident audio
├── assets/               # App icons & images
├── requirements.txt      # Python dependencies
├── package.json          # Node / React Native dependencies
└── README.md

```

```

```