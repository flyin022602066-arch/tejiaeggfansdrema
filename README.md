# Eggfans Drama Studio

Eggfans Drama Studio is a local AI-assisted short-drama production workspace. It turns scripts into structured episodes, characters, scenes, props, storyboards, reference assets, generated videos, and final merged exports.

## Current Capabilities

- Script editing, AI rewriting, extraction, and storyboard breakdown.
- Character, scene, and prop asset management with style presets.
- Persistent model selection for text, image, scene-image, and video workflows.
- Eggfans image and video gateway adapters, including SD video models.
- SD video constraints: 4-30 seconds, 720p, up to 30 images, 10 videos, and 10 audio references.
- URI or public-URL reference mode for video generation.
- Uguu/Eggfans image-host uploads for public reference URLs.
- Virtual asset groups and provider asset URIs for character references.
- Local media storage, task tracking, video polling, and episode merging.
- Optional Electron desktop shell branded as Eggfans.

## Repository Layout

```text
backend/   Hono + TypeScript API, SQLite/Drizzle, AI services and adapters
frontend/  Nuxt 3 + Vue 3 application
desktop/   Electron desktop shell and packaging scripts
configs/   Example configuration templates
docs/      Project documentation
```

## Local Development

Install dependencies in each package, then run the services from the repository root:

```powershell
npm run dev:backend
npm run dev:frontend
npm run dev:desktop
```

The desktop command builds the bundled backend and opens the Eggfans window. The backend uses local SQLite and local filesystem storage; Docker is not required.

Generated images (including storyboards and character/scene/prop assets) are automatically copied to `output/assets/`. Generated clips and merged episode videos are copied to `output/videos/`. The folders are created when the first result is ready; the original files remain in `data/static/` for playback. In a packaged desktop installation, `output/` is placed under Eggfans' writable user-data directory instead of the protected installation directory. Set `HUOBAO_OUTPUT_DIR` to override the destination for a standalone backend.

Useful checks:

```powershell
cd backend
npm run typecheck

cd ..\frontend
npm run build
```

## Configuration

Provider keys and model settings are stored in the local SQLite application database through the Settings page. Do not commit API keys, `.env` files, databases, generated media, or runtime logs.

The source repository intentionally excludes `data/` runtime databases and media. Keep those files in a separate local backup location.

## Backup Repository

This repository is the source-code backup for the private Eggfans Drama Studio project. Runtime data and credentials remain local and are not part of the Git backup.
