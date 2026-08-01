# jg-codex-ui

A local, DeepSeek-ready web interface for Codex CLI. It adds a compact Chinese-first chat UI, paste-to-upload, per-task file cards, task-name persistence, and a per-conversation artifact view.

## What is included

- DeepSeek model defaults
- Image and file paste/upload, including local file or folder paths
- Attachment cards that travel with sent messages
- Persistent task names and restored sidebar state
- Per-conversation artifact panel
- Optional local artifact and file-path bridge services

## Quick start

```powershell
npm install
$env:DEEPSEEK_API_KEY = "your_key_here"
npm start
```

Open `http://127.0.0.1:8787`.

For file/folder paths outside the workspace, run this in a second terminal:

```powershell
npm run bridge
```

## Privacy

This repository intentionally excludes API keys, user settings, uploaded files, chat history, personal paths, and runtime data. Put secrets in environment variables only.

## Notes

This project builds on `@very_aq/codex-cli-web`; retain upstream license notices when redistributing.
