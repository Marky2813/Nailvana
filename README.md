# Nailvana

A tiny desktop buddy for the moments when your fingers wander to your mouth.

Nailvana is for people who bite their nails, chew their cuticles, pick at skin, or catch themselves doing that very specific "wait, why is my hand in my mouth again?" thing. It sits quietly in your system tray and gives you a gentle nudge when it notices the habit starting.

No shame. No streak anxiety. Just a soft little reminder.

## What it does

- Watches for hand-to-mouth movement when you turn Active mode on
- Sends a small desktop nudge when the habit lingers
- Keeps the UI calm, orange, and intentionally low drama
- Runs locally on your device
- Keeps your camera feed on your computer

## Privacy

Nailvana uses your camera only for local detection. The MediaPipe models are bundled with the app, so your face and camera feed are not sent to the web for processing.

## Download

Get the latest build from GitHub Releases:

https://github.com/Marky2813/Nailvana/releases/latest

The app is not signed yet, so Windows or macOS may show a warning during install. That is expected for now.

## Landing page

https://marky2813.github.io/Nailvana/

## Development

```sh
bun install
bun run dev
bun run dev:landing
```

## Build

```sh
bun run build
bun run build:landing
bun run dist:win
bun run dist:mac
bun run dist:linux
```

Cloud builds for Windows, macOS, and Linux are handled by GitHub Actions in `.github/workflows/build.yml`.
