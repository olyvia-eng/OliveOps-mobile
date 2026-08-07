# OliveOps Mobile

Focused React Native + Expo field app for OliveOps employees.

## Current Status

Milestone 1 scaffold is complete:

- Expo + TypeScript app foundation
- Expo Router screen skeleton
- Central API client and endpoint modules
- Secure session storage service (Expo SecureStore)
- Connectivity detection and request guard utilities
- Lightweight state layer for auth and clocking context

## MVP Scope (Initial)

- Employee login
- Persistent secure session
- Current clocked-in/clocked-out status
- Select assigned job
- Clock in / clock out
- Optional notes
- Photo upload through existing presigned S3 flow
- Today's time entries
- This week's total hours

## Run

1. Install dependencies:

```bash
npm install
```

2. Start Expo:

```bash
npm run start
```

## Environment

Create a `.env` file (or export env vars) before launching Expo:

```bash
EXPO_PUBLIC_API_BASE_URL=https://app.oliveops.ca
```

Optional local-device override (development only):

```bash
EXPO_PUBLIC_ALLOW_LOCALHOST_FOR_DEVICE=true
```

Notes:

- Do not use `localhost` on physical devices unless the override is explicitly enabled.
- For local backend testing on a phone, use your machine LAN IP (example: `http://192.168.1.40:3000`).
- For Vercel preview or production, point `EXPO_PUBLIC_API_BASE_URL` to that deployed URL.

The mobile app reuses the existing OliveOps backend APIs and does not include a second backend.
