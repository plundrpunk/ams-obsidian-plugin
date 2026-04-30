## 2026-04-27 - DocumentFragment for Obsidian Modals
**Learning:** Obsidian modals typically render lists of elements (like search results or graphs) sequentially to a parent DOM node, causing multiple reflows/repaints per render. The Obsidian `Node` interface polyfills `createDiv`/`createEl` on `DocumentFragment`s as well, so we can use standard DOM batching techniques without losing the clean Obsidian DOM builder API.
**Action:** When rendering lists of items in custom Modals (Search, Graphs), build the items inside a `document.createDocumentFragment()` and append the fragment to the container once at the end.

## 2024-04-30 - Debouncing Settings Saves in Obsidian
**Learning:** In Obsidian plugins, calling `saveData()` triggers disk I/O writes for `data.json`. Triggering this from frequent UI events like `onChange` handlers for text inputs causes performance bottlenecks and UI lag.
**Action:** Always debounce calls to `saveData()` when hooked up to frequent events. Create a debounced method like `requestSaveSettings = debounce(() => void this.saveSettings(), 1000, true)` and use it in event handlers.
