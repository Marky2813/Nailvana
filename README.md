# Nailvana

Nailvana is a calm, judgment-free desktop companion for nail-biting awareness. It runs from the system tray, watches locally when Active, and gently nudges you when your hand stays near your mouth.

## Development

```sh
bun install
bun run dev          # Electron tray app
bun run dev:landing  # Landing page at http://localhost:5124/landing.html
```

## Build

```sh
bun run build              # Tray app UI
bun run build:landing      # Landing page (GitHub Pages)
bun run dist:win           # Windows installer
bun run dist:mac           # macOS installer
bun run dist:linux         # Linux AppImage
```

## Links

- **Repo:** https://github.com/Marky2813/Nailvana
- **Landing page (after deploy):** https://marky2813.github.io/Nailvana/landing.html
