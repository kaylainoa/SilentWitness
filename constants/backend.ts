// Backend connection config.
//
// NOTE: In an Expo app this key is bundled into the client, so it is NOT truly
// secret. This is fine for a hackathon/demo but should be replaced with a real
// auth flow (or a per-device token) before any production use.

// The API key the FastAPI backend expects in the `X-API-KEY` header.
// Must match FASTAPI_API_KEY in the backend's .env.
export const API_KEY = 'FASTAPI_P3';

// Where the FastAPI backend is running.
//
// IMPORTANT: `localhost` refers to the phone itself, not your computer. When
// testing on a real device (Expo Go), replace this with your computer's LAN IP,
// e.g. 'http://192.168.1.42:8000'. Run `ipconfig getifaddr en0` on macOS to find it.
export const BACKEND_URL = 'http://192.168.0.101:8000';

// Full endpoint for uploading an incident (audio + GPS).
export const INCIDENT_ENDPOINT = `${BACKEND_URL}/api/incident`;

// Endpoint to fetch the stored incident history (the "audio logs").
export const INCIDENTS_ENDPOINT = `${BACKEND_URL}/api/incidents`;

// Endpoint to stream back a single incident's saved audio clip. The API key
// is passed as a query param (not a header) because native audio players
// load this as a plain URL string and can't be relied on to attach headers.
export function incidentAudioUrl(incidentId: number) {
  return `${BACKEND_URL}/api/incident/${incidentId}/audio?api_key=${API_KEY}`;
}

// Endpoint where the app registers its Expo push token for emergency alerts.
export const PUSH_TOKEN_ENDPOINT = `${BACKEND_URL}/api/push-token`;

// Endpoint the app syncs its saved emergency contacts to, so the backend can
// alert them (push/SMS) when an incident comes in.
export const CONTACTS_ENDPOINT = `${BACKEND_URL}/api/contacts`;
