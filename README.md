# OliveOps Mobile

Mobile app for OliveOps — enables employees to clock in/out from iOS and Android devices.

## Tech Stack

- [React Native](https://reactnative.dev/) via [Expo](https://expo.dev/)
- Supports iOS and Android

## Getting Started

### Prerequisites

- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Expo Go app on your iOS or Android device (for development)

### Install

```bash
npm install
```

### Run

```bash
# Start the development server
npm start

# Android
npm run android

# iOS (macOS required for native build; use Expo Go otherwise)
npm run ios
```

### Test

```bash
npm test
```

## Features

- **Clock In / Clock Out** — Tap the button to record your start and end time.
- **Shift History** — View a list of recent shifts with timestamps and total duration.
