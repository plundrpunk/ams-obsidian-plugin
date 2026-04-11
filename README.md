# AMS Memory Companion

Obsidian plugin for the AI Agent Memory System backend. It gives Obsidian a fast path into the existing AMS API instead of relying only on background vault sync.

## What It Does

- Search AMS memories from Obsidian
- Preview search results and open the underlying AMS note in the vault
- Inspect a memory's graph neighborhood from search results
- Sync the live AMS knowledge map into a local Obsidian note for graph-view navigation
- Capture the current note or current editor selection into AMS
- Trigger AMS sync for the current note
- Configure API URL, API key, defaults, and connection test from Obsidian settings

## Commands

- `AMS: Search memories`
- `AMS: Search using current selection`
- `AMS: Capture current note to AMS`
- `AMS: Capture current selection to AMS`
- `AMS: Sync current note with AMS`
- `AMS: Refresh knowledge graph note`

## One-Click Install

If your `.env` already has `OBSIDIAN_VAULT_PATH`, run:

```bash
just obsidian-plugin-install
```

For a live dev install that symlinks the built files instead of copying them:

```bash
just obsidian-plugin-install-symlink
```

## Build

```bash
cd obsidian-plugin
npm install
npm run build
```

That produces:

- `main.js`
- `manifest.json`
- `styles.css`

## Install In Obsidian

1. Build the plugin.
2. Create the plugin folder in your vault:

```bash
mkdir -p "/path/to/your/vault/.obsidian/plugins/ams-memory-companion"
cp main.js manifest.json styles.css "/path/to/your/vault/.obsidian/plugins/ams-memory-companion/"
```

3. Open Obsidian.
4. Go to `Settings -> Community plugins`.
5. Enable `AMS Memory Companion`.
6. Open the plugin settings and configure:
   - AMS API base URL, usually `http://localhost:3001`
   - API key, if AMS auth is enabled
   - Default memory tier/entity type/importance
   - Knowledge graph note path, if you want it somewhere other than `AMS/Knowledge Graph.md`

## Expected Backend Endpoints

The plugin uses these existing AMS routes:

- `POST /api/v1/memories/search`
- `GET /api/v1/memories/{memory_id}`
- `POST /api/v1/memories/`
- `POST /api/v1/sync/file/{file_path}`
- `GET /api/v1/memories/stats` for connection testing
- `GET /knowledge-map/current`
- `GET /api/v1/memories/{memory_id}/links`

## Notes

- The plugin opens AMS-created notes by their returned `file_path`, so it works best when Obsidian is pointed at the same vault configured in `OBSIDIAN_VAULT_PATH`.
- The knowledge graph note is written as a normal Obsidian note, so its wikilinks can participate in Obsidian graph view immediately after refresh.
- If AMS authentication is enabled, set the API key in plugin settings so requests send `X-API-Key`.
