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

Set the API base URL in `app.json` under `expo.extra.apiBaseUrl`.

The mobile app is designed to reuse the existing OliveOps backend APIs and does not include a second backend.
