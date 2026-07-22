# SilentWitness — Team Setup

A calculator-disguised personal safety app. Loud noise or a secret PIN triggers a
silent 15-second recording + GPS, uploads it to the backend, alerts contacts, and
(on the backend) transcribes the clip and generates an AI tag.

## One-time setup

```bash
# 1. Install dependencies
npm install
python3 -m venv .venv
.venv/bin/pip install -r "app/requirements.txt "   # note the trailing space in the filename

# 2. Create your env files from the templates
cp app/.env.example app/.env      # backend
cp .env.example .env              # frontend
```

Then edit the two files:

- **`app/.env`** — leave `FASTAPI_API_KEY=FASTAPI_P3` as-is. Nothing else needed.
- **`.env`** — set `EXPO_PUBLIC_BACKEND_URL` to the backend's IP. Find yours with
  `ipconfig getifaddr en0` (macOS). Use the LAN IP, not `localhost`, so phones can reach it.

## Running it

```bash
# Terminal 1 — backend
cd app && ../.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2 — app
npx expo start          # scan the QR with Expo Go (phone on same Wi-Fi)
```

## Do we need any API keys?

No. Transcription (faster-whisper) and tagging (a local keyword classifier) both
run on the backend with no external API and no signup. Anyone can run the whole
thing — teammates just point `EXPO_PUBLIC_BACKEND_URL` at the backend's IP.

## Testing without a phone

Open `http://localhost:8000/docs` in a browser (FastAPI Swagger UI):
- `POST /api/incident` — upload an audio file (set header `X-API-KEY: FASTAPI_P3`)
- `GET /api/incidents` — see stored incidents, transcripts, and tags

## Notes

- First transcription downloads the Whisper model (~30–60s), then it's cached and fast.
- Auto loud-noise detection is currently off (`AUTO_SPIKE_DETECTION_ENABLED` in
  `hooks/use-spike-detection.ts`); trigger a recording with your PIN + `=` instead.
- Push notifications need an EAS dev build — they don't fire in Expo Go.
