"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AMSMemoryCompanionPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  apiBaseUrl: "http://localhost:3001",
  apiKey: "",
  sourceAgent: "obsidian-plugin",
  defaultMemoryTier: "episodic",
  defaultEntityType: "concept",
  defaultImportance: 0.6,
  defaultSearchScope: "personal",
  defaultSearchLimit: 10,
  openCreatedNote: true,
  knowledgeMapNotePath: "AMS/Knowledge Graph.md",
  openKnowledgeMapAfterSync: true,
  onboardingCompleted: false
};
var MEMORY_TIERS = ["episodic", "semantic", "procedural"];
var ENTITY_TYPES = [
  "concept",
  "event",
  "procedure",
  "entity",
  "agent",
  "blackboard"
];
var SEARCH_SCOPES = ["personal", "agent", "global"];
function clampImportance(value) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SETTINGS.defaultImportance;
  }
  return Math.min(1, Math.max(0, value));
}
function normalizeApiBaseUrl(value) {
  return value.trim().replace(/\/+$/, "");
}
function deriveTitleFromPath(filePath) {
  const name = filePath.split("/").pop() ?? filePath;
  return name.replace(/\.md$/i, "").replace(/_/g, " ");
}
function toCsv(tags) {
  return (tags ?? []).join(", ");
}
function parseTags(raw) {
  return raw.split(",").map((tag) => tag.trim()).filter(Boolean);
}
function encodeFilePathForUrl(filePath) {
  return filePath.split("/").filter(Boolean).map((segment) => encodeURIComponent(segment)).join("/");
}
function estimateTokenCount(content) {
  return Math.max(1, Math.floor(content.length / 4));
}
function stripFrontmatter(content) {
  if (!content.startsWith("---\n")) {
    return content;
  }
  const marker = "\n---\n";
  const endIndex = content.indexOf(marker, 4);
  if (endIndex === -1) {
    return content;
  }
  return content.slice(endIndex + marker.length);
}
function isUsableMemoryContent(content) {
  if (!content) {
    return false;
  }
  return content.trim() !== "[Content unavailable - vault file missing]";
}
var AMSMemoryCompanionPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    // ⚡ Bolt: Debounce disk writes to prevent UI lag on rapid setting changes
    this.requestSaveData = (0, import_obsidian.debounce)(
      () => {
        void this.saveData(this.settings);
      },
      1e3,
      true
    );
  }
  async onload() {
    await this.loadSettings();
    this.addRibbonIcon("search", "Search AMS memories", () => {
      void this.openSearchModal();
    });
    this.addCommand({
      id: "ams-search-memories",
      name: "AMS: Search memories",
      callback: () => {
        void this.openSearchModal();
      }
    });
    this.addCommand({
      id: "ams-search-selection",
      name: "AMS: Search using current selection",
      callback: () => {
        const selectedText = this.getSelectedText();
        if (!selectedText) {
          new import_obsidian.Notice("Select text in a markdown note first.");
          return;
        }
        void this.openSearchModal(selectedText);
      }
    });
    this.addCommand({
      id: "ams-capture-current-note",
      name: "AMS: Capture current note to AMS",
      callback: () => {
        void this.openCaptureModal(false);
      }
    });
    this.addCommand({
      id: "ams-capture-selection",
      name: "AMS: Capture current selection to AMS",
      callback: () => {
        void this.openCaptureModal(true);
      }
    });
    this.addCommand({
      id: "ams-sync-current-note",
      name: "AMS: Sync current note with AMS",
      callback: () => {
        void this.syncCurrentNote();
      }
    });
    this.addCommand({
      id: "ams-sync-knowledge-map",
      name: "AMS: Refresh knowledge graph note",
      callback: () => {
        void this.syncKnowledgeMapNote(true);
      }
    });
    this.addCommand({
      id: "ams-full-sync",
      name: "AMS: Sync all AMS memories into Obsidian",
      callback: () => {
        void this.runInitialSync();
      }
    });
    this.addSettingTab(new AMSSettingTab(this.app, this));
    if (!this.settings.onboardingCompleted) {
      window.setTimeout(() => {
        new AMSOnboardingModal(this.app, this).open();
      }, 300);
    }
  }
  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loaded,
      apiBaseUrl: normalizeApiBaseUrl(loaded?.apiBaseUrl ?? DEFAULT_SETTINGS.apiBaseUrl),
      defaultImportance: clampImportance(
        Number(loaded?.defaultImportance ?? DEFAULT_SETTINGS.defaultImportance)
      ),
      defaultSearchLimit: Number(loaded?.defaultSearchLimit ?? DEFAULT_SETTINGS.defaultSearchLimit)
    };
  }
  async saveSettings() {
    this.requestSaveData();
  }
  async saveSettingsImmediate() {
    await this.saveData(this.settings);
  }
  getActiveMarkdownView() {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
    if (!view) {
      new import_obsidian.Notice("Open a markdown note first.");
      return null;
    }
    return view;
  }
  getSelectedText() {
    const view = this.getActiveMarkdownView();
    if (!view) {
      return "";
    }
    return view.editor.getSelection().trim();
  }
  async openSearchModal(initialQuery = "") {
    if (!this.ensureConfigured()) {
      return;
    }
    new SearchModal(this.app, this, initialQuery).open();
  }
  async openCaptureModal(selectionOnly) {
    if (!this.ensureConfigured()) {
      return;
    }
    const view = this.getActiveMarkdownView();
    if (!view || !view.file) {
      return;
    }
    const file = view.file;
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const selectedText = view.editor.getSelection().trim();
    const noteContent = selectionOnly ? selectedText : view.editor.getValue().trim();
    if (!noteContent) {
      new import_obsidian.Notice(selectionOnly ? "Select text first." : "The current note is empty.");
      return;
    }
    const frontmatterTier = String(frontmatter?.memory_tier ?? "").toLowerCase();
    const frontmatterEntity = String(frontmatter?.entity_type ?? "").toLowerCase();
    const frontmatterImportance = Number(frontmatter?.importance ?? NaN);
    const frontmatterTags = frontmatter?.tags;
    const draft = {
      title: selectionOnly ? `${file.basename} excerpt` : file.basename,
      content: noteContent,
      memoryTier: MEMORY_TIERS.includes(frontmatterTier) ? frontmatterTier : this.settings.defaultMemoryTier,
      entityType: ENTITY_TYPES.includes(frontmatterEntity) ? frontmatterEntity : this.settings.defaultEntityType,
      importance: Number.isFinite(frontmatterImportance) ? clampImportance(frontmatterImportance) : this.settings.defaultImportance,
      tags: Array.isArray(frontmatterTags) ? frontmatterTags.map((tag) => String(tag)) : typeof frontmatterTags === "string" ? parseTags(frontmatterTags) : [],
      sourcePath: file.path,
      selectionOnly
    };
    new CaptureMemoryModal(this.app, this, draft).open();
  }
  async searchMemories(query, options = {}) {
    return this.apiRequest("/api/v1/memories/search", {
      method: "POST",
      body: {
        query,
        limit: options.limit ?? this.settings.defaultSearchLimit,
        scope: options.scope ?? this.settings.defaultSearchScope,
        memory_tier: options.memoryTier || void 0
      }
    });
  }
  async getMemory(memoryId) {
    return this.apiRequest(`/api/v1/memories/${encodeURIComponent(memoryId)}`);
  }
  async createMemory(draft) {
    const payload = {
      title: draft.title,
      content: draft.content,
      memory_tier: draft.memoryTier,
      entity_type: draft.entityType,
      importance: clampImportance(draft.importance),
      source_agent: this.settings.sourceAgent || "obsidian-plugin",
      tags: draft.tags,
      metadata: {
        source: "obsidian-plugin",
        source_note_path: draft.sourcePath ?? null,
        capture_mode: draft.selectionOnly ? "selection" : "note",
        captured_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
    return this.apiRequest("/api/v1/memories/", {
      method: "POST",
      body: payload
    });
  }
  async syncFile(filePath) {
    return this.apiRequest(
      `/api/v1/sync/file/${encodeFilePathForUrl(filePath)}`,
      {
        method: "POST"
      }
    );
  }
  async getKnowledgeMap() {
    try {
      return await this.apiRequest("/knowledge-map/current");
    } catch (primaryError) {
      const searchResponse = await this.apiRequest("/api/v1/memories/search", {
        method: "POST",
        body: {
          query: "knowledge map",
          limit: 10,
          scope: "global",
          tags: ["knowledge-map"]
        }
      });
      const candidates = searchResponse.results.filter((result) => (result.memory.tags ?? []).includes("knowledge-map")).sort((left, right) => {
        const archivePenalty = (value) => value.startsWith("99_Archive/") ? -1 : 0;
        const conflictPenalty = (value) => value.includes("sync-conflict") ? -1 : 0;
        const leftScore = archivePenalty(left.memory.file_path) + conflictPenalty(left.memory.file_path) + Date.parse(left.memory.creation_timestamp);
        const rightScore = archivePenalty(right.memory.file_path) + conflictPenalty(right.memory.file_path) + Date.parse(right.memory.creation_timestamp);
        return rightScore - leftScore;
      });
      for (const candidate of candidates) {
        const apiMemory = await this.tryGetMemory(candidate.memory.memory_id);
        const apiContent = apiMemory?.content;
        const localContent = await this.readVaultNoteContent(candidate.memory.file_path);
        const resolvedContent = isUsableMemoryContent(apiContent) ? apiContent : isUsableMemoryContent(localContent) ? localContent : null;
        if (!resolvedContent) {
          continue;
        }
        const rawVersion = apiMemory?.memory_metadata?.map_version ?? candidate.memory.memory_metadata?.map_version;
        const mapVersion = typeof rawVersion === "number" ? rawVersion : Number(rawVersion ?? 1) || 1;
        return {
          memory_id: candidate.memory.memory_id,
          content: resolvedContent,
          map_version: mapVersion,
          last_updated: candidate.memory.last_modified,
          token_count: estimateTokenCount(resolvedContent)
        };
      }
      throw primaryError;
    }
  }
  async getMemoryLinks(memoryId) {
    return this.apiRequest(
      `/api/v1/memories/${encodeURIComponent(memoryId)}/links?direction=both`
    );
  }
  async triggerFullSync() {
    return this.apiRequest("/api/v1/sync/trigger", {
      method: "POST"
    });
  }
  async testConnection() {
    if (!this.ensureConfigured()) {
      return false;
    }
    try {
      await this.apiRequest("/api/v1/memories/stats");
      new import_obsidian.Notice("AMS connection succeeded.");
      return true;
    } catch (error) {
      new import_obsidian.Notice(this.classifyError(error));
      return false;
    }
  }
  async previewMemory(memoryId) {
    try {
      const memory = await this.getMemory(memoryId);
      new MemoryPreviewModal(this.app, this, memory).open();
    } catch (error) {
      new import_obsidian.Notice(this.formatError(error));
    }
  }
  async openOrPreviewMemory(result) {
    const opened = await this.openVaultNote(result.memory.file_path);
    if (!opened) {
      await this.previewMemory(result.memory.memory_id);
    }
  }
  async openGraphForMemory(result) {
    try {
      const links = await this.getMemoryLinks(result.memory.memory_id);
      new MemoryGraphModal(this.app, this, result, links).open();
    } catch (error) {
      new import_obsidian.Notice(this.formatError(error));
    }
  }
  async openVaultNote(filePath) {
    const normalized = (0, import_obsidian.normalizePath)(filePath);
    const target = this.app.vault.getAbstractFileByPath(normalized);
    if (!(target instanceof import_obsidian.TFile)) {
      new import_obsidian.Notice(`Note not found in this vault: ${filePath}`);
      return false;
    }
    await this.app.workspace.getLeaf(true).openFile(target);
    return true;
  }
  async insertWikiLink(filePath) {
    const view = this.getActiveMarkdownView();
    if (!view) {
      return;
    }
    const linkTarget = filePath.replace(/\.md$/i, "");
    view.editor.replaceSelection(`[[${linkTarget}]]`);
    new import_obsidian.Notice("Inserted AMS note link.");
  }
  async syncCurrentNote() {
    if (!this.ensureConfigured()) {
      return;
    }
    const view = this.getActiveMarkdownView();
    const file = view?.file;
    if (!file) {
      return;
    }
    new import_obsidian.Notice(`Syncing ${file.path} to AMS...`);
    try {
      const result = await this.syncFile(file.path);
      new import_obsidian.Notice(result.message || "Sync completed.");
    } catch (error) {
      new import_obsidian.Notice(this.formatError(error));
    }
  }
  async syncKnowledgeMapNote(openAfterSync = true) {
    if (!this.ensureConfigured()) {
      return;
    }
    new import_obsidian.Notice("Refreshing AMS knowledge graph note...");
    try {
      const map = await this.getKnowledgeMap();
      const file = await this.upsertVaultNote(
        this.settings.knowledgeMapNotePath,
        this.renderKnowledgeMapNote(map)
      );
      new import_obsidian.Notice(`Knowledge graph note updated: ${file.path}`);
      if (openAfterSync || this.settings.openKnowledgeMapAfterSync) {
        await this.app.workspace.getLeaf(true).openFile(file);
      }
    } catch (error) {
      new import_obsidian.Notice(this.formatError(error));
    }
  }
  async runInitialSync() {
    if (!this.ensureConfigured()) {
      return;
    }
    new import_obsidian.Notice("Syncing AMS memories into Obsidian. This can take a while on first run...");
    try {
      const result = await this.triggerFullSync();
      if (result.stats || result.total_synced !== void 0) {
        new SyncSummaryModal(this.app, result).open();
      } else {
        new import_obsidian.Notice(result.message || "AMS sync completed.");
      }
      await this.syncKnowledgeMapNote(false);
    } catch (error) {
      new import_obsidian.Notice(this.classifyError(error));
    }
  }
  ensureConfigured() {
    if (!normalizeApiBaseUrl(this.settings.apiBaseUrl)) {
      new import_obsidian.Notice("Set the AMS API base URL in plugin settings first.");
      return false;
    }
    return true;
  }
  buildApiUrl(path) {
    return `${normalizeApiBaseUrl(this.settings.apiBaseUrl)}${path}`;
  }
  renderKnowledgeMapNote(map) {
    const updatedAt = map.last_updated ?? (/* @__PURE__ */ new Date()).toISOString();
    return [
      "---",
      "source: ams-memory-companion",
      `ams_memory_id: ${map.memory_id}`,
      `ams_map_version: ${map.map_version}`,
      `ams_synced_at: ${(/* @__PURE__ */ new Date()).toISOString()}`,
      "---",
      "",
      "# AMS Knowledge Graph",
      "",
      `- Map version: ${map.map_version}`,
      `- Last updated: ${updatedAt}`,
      `- Token count: ${map.token_count}`,
      "",
      "## Live Map",
      "",
      map.content.trim(),
      ""
    ].join("\n");
  }
  formatError(error) {
    return this.classifyError(error);
  }
  classifyError(error) {
    if (!(error instanceof Error)) {
      return "AMS request failed (unknown error).";
    }
    const msg = error.message.toLowerCase();
    if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("econnrefused") || msg.includes("connection refused") || msg.includes("net::err") || msg.includes("fetch failed") || msg.includes("unable to connect")) {
      return `AMS server unreachable at ${this.settings.apiBaseUrl}. Is AMS running? Check the URL in plugin settings.`;
    }
    if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("aborted")) {
      return "AMS request timed out. The server may be overloaded or the sync is taking longer than expected.";
    }
    if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("authentication")) {
      return "AMS authentication failed. Check your API key in plugin settings.";
    }
    if (msg.includes("403") || msg.includes("forbidden")) {
      return "AMS access denied. Your API key may lack the required permissions.";
    }
    if (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many")) {
      return "AMS rate limit reached. Wait a moment and try again.";
    }
    if (msg.includes("503") || msg.includes("sync is disabled") || msg.includes("service unavailable")) {
      return "AMS bidirectional sync is disabled on the server. Enable it in .env (ENABLE_BIDIRECTIONAL_SYNC=true) and restart.";
    }
    if (msg.includes("500") || msg.includes("internal server")) {
      return "AMS server error. Check the AMS backend logs for details.";
    }
    return `AMS error: ${error.message}`;
  }
  buildHeaders() {
    const headers = {
      Accept: "application/json"
    };
    if (this.settings.apiKey.trim()) {
      headers["X-API-Key"] = this.settings.apiKey.trim();
    }
    if (this.settings.sourceAgent.trim()) {
      headers["X-Agent-ID"] = this.settings.sourceAgent.trim();
    }
    return headers;
  }
  async apiRequest(path, options = {}) {
    const hasBody = options.body !== void 0;
    const response = await (0, import_obsidian.requestUrl)({
      url: this.buildApiUrl(path),
      method: options.method ?? "GET",
      headers: this.buildHeaders(),
      body: hasBody ? JSON.stringify(options.body) : void 0,
      contentType: hasBody ? "application/json" : void 0,
      throw: false
    });
    if (response.status >= 400) {
      const detail = this.extractErrorDetail(response.text);
      throw new Error(detail || `Request failed with HTTP ${response.status}`);
    }
    if (response.json !== void 0) {
      return response.json;
    }
    if (response.text) {
      return JSON.parse(response.text);
    }
    return {};
  }
  async tryGetMemory(memoryId) {
    try {
      return await this.getMemory(memoryId);
    } catch (_error) {
      return null;
    }
  }
  async readVaultNoteContent(filePath) {
    const normalized = (0, import_obsidian.normalizePath)(filePath);
    const target = this.app.vault.getAbstractFileByPath(normalized);
    if (!(target instanceof import_obsidian.TFile)) {
      return null;
    }
    const rawContent = await this.app.vault.cachedRead(target);
    return stripFrontmatter(rawContent).trim();
  }
  async ensureFolderExists(folderPath) {
    if (!folderPath || folderPath === ".") {
      return;
    }
    const existing = this.app.vault.getAbstractFileByPath(folderPath);
    if (existing) {
      return;
    }
    const segments = folderPath.split("/").filter(Boolean);
    let currentPath = "";
    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      if (!this.app.vault.getAbstractFileByPath(currentPath)) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }
  async upsertVaultNote(filePath, content) {
    const normalized = (0, import_obsidian.normalizePath)(filePath);
    const lastSlash = normalized.lastIndexOf("/");
    const folderPath = lastSlash >= 0 ? normalized.slice(0, lastSlash) : "";
    await this.ensureFolderExists(folderPath);
    const existing = this.app.vault.getAbstractFileByPath(normalized);
    if (existing instanceof import_obsidian.TFile) {
      await this.app.vault.modify(existing, content);
      return existing;
    }
    return this.app.vault.create(normalized, content);
  }
  extractErrorDetail(responseText) {
    try {
      const parsed = JSON.parse(responseText);
      if (typeof parsed.detail === "string") {
        return parsed.detail;
      }
      if (parsed.detail && typeof parsed.detail === "object") {
        return parsed.detail.message ?? parsed.detail.reason ?? JSON.stringify(parsed.detail);
      }
      return parsed.message ?? parsed.error ?? responseText;
    } catch (_error) {
      return responseText;
    }
  }
};
var SearchModal = class extends import_obsidian.Modal {
  constructor(app, plugin, initialQuery) {
    super(app);
    this.memoryTier = "";
    this.plugin = plugin;
    this.query = initialQuery;
    this.searchScope = plugin.settings.defaultSearchScope;
    this.limit = plugin.settings.defaultSearchLimit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ams-modal");
    contentEl.createEl("h2", { text: "Search AMS Memories" });
    new import_obsidian.Setting(contentEl).setName("Query").setDesc("Search AMS using hybrid vector and keyword search.").addText((text) => {
      text.setPlaceholder("What are you looking for?");
      text.setValue(this.query);
      text.inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void this.performSearch();
        }
      });
      text.onChange((value) => {
        this.query = value.trim();
      });
    });
    const filtersEl = contentEl.createDiv({ cls: "ams-inline-grid" });
    const scopeField = filtersEl.createDiv({ cls: "ams-field" });
    scopeField.createEl("label", { text: "Scope" });
    const scopeSelect = scopeField.createEl("select");
    SEARCH_SCOPES.forEach((scope) => {
      scopeSelect.add(new Option(scope, scope, scope === this.searchScope, scope === this.searchScope));
    });
    scopeSelect.addEventListener("change", () => {
      this.searchScope = scopeSelect.value;
    });
    const tierField = filtersEl.createDiv({ cls: "ams-field" });
    tierField.createEl("label", { text: "Tier" });
    const tierSelect = tierField.createEl("select");
    tierSelect.add(new Option("all", "", true, true));
    MEMORY_TIERS.forEach((tier) => {
      tierSelect.add(new Option(tier, tier, false, false));
    });
    tierSelect.addEventListener("change", () => {
      this.memoryTier = tierSelect.value;
    });
    const limitField = filtersEl.createDiv({ cls: "ams-field" });
    limitField.createEl("label", { text: "Limit" });
    const limitInput = limitField.createEl("input", { type: "number" });
    limitInput.min = "1";
    limitInput.max = "100";
    limitInput.value = String(this.limit);
    limitInput.addEventListener("change", () => {
      this.limit = Math.min(100, Math.max(1, Number(limitInput.value) || 10));
      limitInput.value = String(this.limit);
    });
    const actionsEl = contentEl.createDiv({ cls: "ams-button-row" });
    new import_obsidian.ButtonComponent(actionsEl).setButtonText("Close").onClick(() => {
      this.close();
    });
    new import_obsidian.ButtonComponent(actionsEl).setButtonText("Search").setCta().onClick(() => {
      void this.performSearch();
    });
    this.resultsEl = contentEl.createDiv({ cls: "ams-results" });
    this.renderEmptyState("Run a search to see matching memories.");
    if (this.query) {
      void this.performSearch();
    }
  }
  renderEmptyState(message) {
    this.resultsEl.empty();
    this.resultsEl.createDiv({ cls: "ams-empty-state", text: message });
  }
  async performSearch() {
    if (!this.query) {
      this.renderEmptyState("Enter a query first.");
      return;
    }
    this.renderEmptyState("Searching AMS...");
    try {
      const response = await this.plugin.searchMemories(this.query, {
        scope: this.searchScope,
        memoryTier: this.memoryTier,
        limit: this.limit
      });
      this.renderResults(response.results);
    } catch (error) {
      this.renderEmptyState(this.plugin.formatError(error));
    }
  }
  renderResults(results) {
    this.resultsEl.empty();
    if (!results.length) {
      this.renderEmptyState("No memories matched this search.");
      return;
    }
    const fragment = document.createDocumentFragment();
    results.forEach((result) => {
      const card = fragment.createDiv({ cls: "ams-result-card" });
      const header = card.createDiv({ cls: "ams-result-header" });
      header.createEl("h3", {
        cls: "ams-result-title",
        text: deriveTitleFromPath(result.memory.file_path)
      });
      const meta = header.createDiv({ cls: "ams-result-meta" });
      meta.createSpan({
        cls: "ams-pill",
        text: result.memory.memory_tier
      });
      meta.createSpan({
        cls: "ams-pill",
        text: `${Math.round(result.relevance_score * 100)}% match`
      });
      meta.createSpan({
        cls: "ams-pill",
        text: `importance ${result.memory.importance.toFixed(2)}`
      });
      card.createDiv({
        cls: "ams-result-path",
        text: result.memory.file_path
      });
      card.createEl("p", {
        cls: "ams-result-snippet",
        text: result.content_snippet || "No snippet available."
      });
      const actions = card.createDiv({ cls: "ams-result-actions" });
      new import_obsidian.ButtonComponent(actions).setButtonText("Open").onClick(() => {
        void this.plugin.openOrPreviewMemory(result);
      });
      new import_obsidian.ButtonComponent(actions).setButtonText("Preview").onClick(() => {
        void this.plugin.previewMemory(result.memory.memory_id);
      });
      new import_obsidian.ButtonComponent(actions).setButtonText("Graph").onClick(() => {
        void this.plugin.openGraphForMemory(result);
      });
      new import_obsidian.ButtonComponent(actions).setButtonText("Insert Link").onClick(() => {
        void this.plugin.insertWikiLink(result.memory.file_path);
      });
    });
    this.resultsEl.appendChild(fragment);
  }
};
var CaptureMemoryModal = class extends import_obsidian.Modal {
  constructor(app, plugin, draft) {
    super(app);
    this.isSubmitting = false;
    this.plugin = plugin;
    this.draft = draft;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ams-modal");
    contentEl.createEl("h2", {
      text: this.draft.selectionOnly ? "Capture Selection To AMS" : "Capture Note To AMS"
    });
    new import_obsidian.Setting(contentEl).setName("Title").setDesc("The memory title stored by AMS.").addText((text) => {
      text.setValue(this.draft.title);
      text.onChange((value) => {
        this.draft.title = value;
      });
    });
    const fieldsEl = contentEl.createDiv({ cls: "ams-inline-grid" });
    const tierField = fieldsEl.createDiv({ cls: "ams-field" });
    tierField.createEl("label", { text: "Memory tier" });
    const tierSelect = tierField.createEl("select");
    MEMORY_TIERS.forEach((tier) => {
      tierSelect.add(
        new Option(tier, tier, tier === this.draft.memoryTier, tier === this.draft.memoryTier)
      );
    });
    tierSelect.addEventListener("change", () => {
      this.draft.memoryTier = tierSelect.value;
    });
    const entityField = fieldsEl.createDiv({ cls: "ams-field" });
    entityField.createEl("label", { text: "Entity type" });
    const entitySelect = entityField.createEl("select");
    ENTITY_TYPES.forEach((entity) => {
      entitySelect.add(
        new Option(
          entity,
          entity,
          entity === this.draft.entityType,
          entity === this.draft.entityType
        )
      );
    });
    entitySelect.addEventListener("change", () => {
      this.draft.entityType = entitySelect.value;
    });
    const importanceField = fieldsEl.createDiv({ cls: "ams-field" });
    importanceField.createEl("label", { text: "Importance" });
    const importanceInput = importanceField.createEl("input", { type: "number" });
    importanceInput.min = "0";
    importanceInput.max = "1";
    importanceInput.step = "0.05";
    importanceInput.value = this.draft.importance.toFixed(2);
    importanceInput.addEventListener("change", () => {
      this.draft.importance = clampImportance(Number(importanceInput.value));
      importanceInput.value = this.draft.importance.toFixed(2);
    });
    new import_obsidian.Setting(contentEl).setName("Tags").setDesc("Comma-separated tags stored with the memory.").addText((text) => {
      text.setValue(toCsv(this.draft.tags));
      text.onChange((value) => {
        this.draft.tags = parseTags(value);
      });
    });
    const contentField = contentEl.createDiv({ cls: "ams-field" });
    contentField.createEl("label", { text: "Content" });
    const textarea = contentField.createEl("textarea", { cls: "ams-textarea" });
    textarea.value = this.draft.content;
    textarea.addEventListener("input", () => {
      this.draft.content = textarea.value;
    });
    const actionsEl = contentEl.createDiv({ cls: "ams-button-row" });
    new import_obsidian.ButtonComponent(actionsEl).setButtonText("Cancel").onClick(() => {
      this.close();
    });
    new import_obsidian.ButtonComponent(actionsEl).setButtonText("Save To AMS").setCta().onClick(() => {
      void this.submit();
    });
  }
  async submit() {
    if (this.isSubmitting) {
      return;
    }
    if (!this.draft.title.trim()) {
      new import_obsidian.Notice("Title is required.");
      return;
    }
    if (!this.draft.content.trim()) {
      new import_obsidian.Notice("Content is required.");
      return;
    }
    this.isSubmitting = true;
    new import_obsidian.Notice("Saving memory to AMS...");
    try {
      const created = await this.plugin.createMemory(this.draft);
      new import_obsidian.Notice(`Memory created: ${deriveTitleFromPath(created.file_path)}`);
      this.close();
      if (this.plugin.settings.openCreatedNote) {
        await this.plugin.openVaultNote(created.file_path);
      }
    } catch (error) {
      new import_obsidian.Notice(this.plugin.formatError(error));
    } finally {
      this.isSubmitting = false;
    }
  }
};
var MemoryPreviewModal = class extends import_obsidian.Modal {
  constructor(app, plugin, memory) {
    super(app);
    this.plugin = plugin;
    this.memory = memory;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ams-modal");
    contentEl.createEl("h2", {
      text: deriveTitleFromPath(this.memory.file_path)
    });
    contentEl.createDiv({
      cls: "ams-preview-meta",
      text: `${this.memory.memory_tier} | ${this.memory.file_path}`
    });
    const content = contentEl.createEl("pre", { cls: "ams-preview-content" });
    content.textContent = this.memory.full_content || this.memory.content;
    const actionsEl = contentEl.createDiv({ cls: "ams-button-row" });
    new import_obsidian.ButtonComponent(actionsEl).setButtonText("Close").onClick(() => {
      this.close();
    });
    new import_obsidian.ButtonComponent(actionsEl).setButtonText("Insert Link").onClick(() => {
      void this.plugin.insertWikiLink(this.memory.file_path);
    });
    new import_obsidian.ButtonComponent(actionsEl).setButtonText("Open Note").setCta().onClick(() => {
      void this.plugin.openVaultNote(this.memory.file_path);
    });
  }
};
var MemoryGraphModal = class extends import_obsidian.Modal {
  constructor(app, plugin, result, links) {
    super(app);
    this.plugin = plugin;
    this.result = result;
    this.links = links;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ams-modal");
    contentEl.createEl("h2", {
      text: `${deriveTitleFromPath(this.result.memory.file_path)} Graph`
    });
    contentEl.createDiv({
      cls: "ams-preview-meta",
      text: `${this.links.total_outgoing} outgoing | ${this.links.total_incoming} incoming`
    });
    this.renderLinkSection(contentEl, "Outgoing Links", this.links.outgoing, "outgoing");
    this.renderLinkSection(contentEl, "Incoming Links", this.links.incoming, "incoming");
    const actionsEl = contentEl.createDiv({ cls: "ams-button-row" });
    new import_obsidian.ButtonComponent(actionsEl).setButtonText("Close").onClick(() => {
      this.close();
    });
  }
  renderLinkSection(container, heading, links, direction) {
    container.createEl("h3", { text: heading });
    if (!links.length) {
      container.createDiv({
        cls: "ams-empty-state",
        text: `No ${direction} links.`
      });
      return;
    }
    const resultsEl = container.createDiv({ cls: "ams-results" });
    const fragment = document.createDocumentFragment();
    links.forEach((link) => {
      const card = fragment.createDiv({ cls: "ams-result-card" });
      const header = card.createDiv({ cls: "ams-result-header" });
      const title = direction === "outgoing" ? link.target_title ?? link.target_memory_id : link.source_title ?? link.source_memory_id;
      header.createEl("h4", { cls: "ams-result-title", text: title });
      const meta = header.createDiv({ cls: "ams-result-meta" });
      meta.createSpan({ cls: "ams-pill", text: link.relationship_type });
      meta.createSpan({
        cls: "ams-pill",
        text: `strength ${link.strength.toFixed(2)}`
      });
      const tier = direction === "outgoing" ? link.target_tier : link.source_tier;
      if (tier) {
        meta.createSpan({ cls: "ams-pill", text: tier });
      }
      const actions = card.createDiv({ cls: "ams-result-actions" });
      new import_obsidian.ButtonComponent(actions).setButtonText("Preview").onClick(() => {
        const targetId = direction === "outgoing" ? link.target_memory_id : link.source_memory_id;
        void this.plugin.previewMemory(targetId);
      });
    });
    resultsEl.appendChild(fragment);
  }
};
var AMSSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "AMS Memory Companion" });
    new import_obsidian.Setting(containerEl).setName("AMS API base URL").setDesc("Base URL for your AMS backend, usually http://localhost:3001").addText((text) => {
      text.setPlaceholder("http://localhost:3001");
      text.setValue(this.plugin.settings.apiBaseUrl);
      text.onChange(async (value) => {
        this.plugin.settings.apiBaseUrl = normalizeApiBaseUrl(value);
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("AMS API key").setDesc("Optional unless AMS authentication is enabled.").addText((text) => {
      text.inputEl.type = "password";
      text.setPlaceholder("Paste API key");
      text.setValue(this.plugin.settings.apiKey);
      text.onChange(async (value) => {
        this.plugin.settings.apiKey = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Source agent").setDesc("Sent as source_agent and X-Agent-ID for AMS logging.").addText((text) => {
      text.setValue(this.plugin.settings.sourceAgent);
      text.onChange(async (value) => {
        this.plugin.settings.sourceAgent = value.trim() || "obsidian-plugin";
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Default memory tier").setDesc("Preselected when capturing notes or selections.").addDropdown((dropdown) => {
      MEMORY_TIERS.forEach((tier) => dropdown.addOption(tier, tier));
      dropdown.setValue(this.plugin.settings.defaultMemoryTier);
      dropdown.onChange(async (value) => {
        this.plugin.settings.defaultMemoryTier = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Default entity type").setDesc("Preselected when capturing notes or selections.").addDropdown((dropdown) => {
      ENTITY_TYPES.forEach((entity) => dropdown.addOption(entity, entity));
      dropdown.setValue(this.plugin.settings.defaultEntityType);
      dropdown.onChange(async (value) => {
        this.plugin.settings.defaultEntityType = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Default importance").setDesc("Value between 0 and 1 used for new memories.").addText((text) => {
      text.inputEl.type = "number";
      text.inputEl.min = "0";
      text.inputEl.max = "1";
      text.inputEl.step = "0.05";
      text.setValue(String(this.plugin.settings.defaultImportance));
      text.onChange(async (value) => {
        this.plugin.settings.defaultImportance = clampImportance(Number(value));
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Default search scope").setDesc("Search visibility scope used by the search modal.").addDropdown((dropdown) => {
      SEARCH_SCOPES.forEach((scope) => dropdown.addOption(scope, scope));
      dropdown.setValue(this.plugin.settings.defaultSearchScope);
      dropdown.onChange(async (value) => {
        this.plugin.settings.defaultSearchScope = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Default search limit").setDesc("Maximum results fetched by default.").addText((text) => {
      text.inputEl.type = "number";
      text.inputEl.min = "1";
      text.inputEl.max = "100";
      text.setValue(String(this.plugin.settings.defaultSearchLimit));
      text.onChange(async (value) => {
        const parsed = Number(value);
        this.plugin.settings.defaultSearchLimit = Math.min(100, Math.max(1, parsed || 10));
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Open created note automatically").setDesc("Open the AMS-created vault note after capture if it exists in this vault.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.openCreatedNote);
      toggle.onChange(async (value) => {
        this.plugin.settings.openCreatedNote = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Knowledge graph note path").setDesc("Local note path used for the synced AMS knowledge map.").addText((text) => {
      text.setPlaceholder("AMS/Knowledge Graph.md");
      text.setValue(this.plugin.settings.knowledgeMapNotePath);
      text.onChange(async (value) => {
        this.plugin.settings.knowledgeMapNotePath = value.trim() || "AMS/Knowledge Graph.md";
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Open knowledge graph after refresh").setDesc("Open the local knowledge graph note after syncing it from AMS.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.openKnowledgeMapAfterSync);
      toggle.onChange(async (value) => {
        this.plugin.settings.openKnowledgeMapAfterSync = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Connection check").setDesc("Verify the plugin can talk to AMS using the current settings.").addButton((button) => {
      button.setButtonText("Test connection").onClick(() => {
        void this.plugin.testConnection();
      });
    }).addButton((button) => {
      button.setButtonText("Initial sync").onClick(() => {
        void this.plugin.runInitialSync();
      });
    }).addExtraButton((button) => {
      button.setIcon("git-branch");
      button.setTooltip("Refresh knowledge graph");
      button.onClick(() => {
        void this.plugin.syncKnowledgeMapNote(true);
      });
    });
  }
};
var SyncSummaryModal = class extends import_obsidian.Modal {
  constructor(app, syncResult) {
    super(app);
    this.syncResult = syncResult;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ams-modal");
    contentEl.createEl("h2", { text: "AMS Sync Complete" });
    const stats = this.syncResult.stats;
    const totalSynced = this.syncResult.total_synced ?? 0;
    if (totalSynced === 0 && (!stats || stats.errors === 0)) {
      contentEl.createEl("p", {
        text: "Everything is already in sync. No changes were needed."
      });
    } else {
      const summaryEl = contentEl.createDiv({ cls: "ams-sync-summary" });
      if (stats) {
        if (stats.db_to_vault > 0) {
          summaryEl.createDiv({
            text: `${stats.db_to_vault} memories exported to vault as notes`
          });
        }
        if (stats.vault_to_db > 0) {
          summaryEl.createDiv({
            text: `${stats.vault_to_db} vault notes imported to AMS database`
          });
        }
        if (stats.updated > 0) {
          summaryEl.createDiv({
            text: `${stats.updated} existing files updated`
          });
        }
        if (stats.wikilinks_synced > 0) {
          summaryEl.createDiv({
            text: `${stats.wikilinks_synced} notes with wikilinks synced`
          });
        }
        if (stats.conflicts_detected > 0) {
          summaryEl.createDiv({
            text: `${stats.conflicts_detected} conflicts detected and resolved`
          });
        }
        if (stats.errors > 0) {
          summaryEl.createDiv({
            cls: "ams-sync-errors",
            text: `${stats.errors} errors occurred during sync`
          });
        }
        const tiers = this.syncResult.tier_breakdown ?? stats.tier_breakdown;
        if (tiers && Object.keys(tiers).length > 0) {
          summaryEl.createEl("h4", { text: "By memory tier" });
          const tierList = summaryEl.createDiv({ cls: "ams-tier-breakdown" });
          for (const [tier, count] of Object.entries(tiers)) {
            if (count > 0) {
              tierList.createDiv({ text: `${tier}: ${count}` });
            }
          }
        }
        if (stats.duration_seconds > 0) {
          summaryEl.createDiv({
            cls: "ams-sync-duration",
            text: `Completed in ${stats.duration_seconds.toFixed(1)}s`
          });
        }
      }
    }
    const actionsEl = contentEl.createDiv({ cls: "ams-button-row" });
    new import_obsidian.ButtonComponent(actionsEl).setButtonText("Done").setCta().onClick(() => {
      this.close();
    });
  }
};
var AMSOnboardingModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.apiBaseUrl = plugin.settings.apiBaseUrl;
    this.apiKey = plugin.settings.apiKey;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ams-modal");
    contentEl.createEl("h2", { text: "Set Up AMS Memory Companion" });
    contentEl.createEl("p", {
      text: "Connect Obsidian to your AMS backend. Once connected, the initial sync will materialize every AMS memory as a note in your vault, complete with wikilinks for Obsidian Graph View."
    });
    const stepsEl = contentEl.createDiv({ cls: "ams-onboarding-steps" });
    stepsEl.createEl("div", {
      text: "1. Enter your AMS server URL (default: http://localhost:3001)"
    });
    stepsEl.createEl("div", {
      text: "2. Add your API key if authentication is enabled"
    });
    stepsEl.createEl("div", {
      text: '3. Click "Save + Initial Sync" to pull all memories into your vault'
    });
    new import_obsidian.Setting(contentEl).setName("AMS API base URL").setDesc("Usually http://localhost:3001").addText((text) => {
      text.setPlaceholder("http://localhost:3001");
      text.setValue(this.apiBaseUrl);
      text.onChange((value) => {
        this.apiBaseUrl = normalizeApiBaseUrl(value);
      });
    });
    new import_obsidian.Setting(contentEl).setName("AMS API key").setDesc("Optional unless AMS authentication is enabled.").addText((text) => {
      text.inputEl.type = "password";
      text.setValue(this.apiKey);
      text.onChange((value) => {
        this.apiKey = value.trim();
      });
    });
    this.statusEl = contentEl.createDiv({ cls: "ams-onboarding-status" });
    const actions = contentEl.createDiv({ cls: "ams-button-row" });
    new import_obsidian.ButtonComponent(actions).setButtonText("Save").onClick(() => {
      void this.saveOnly();
    });
    new import_obsidian.ButtonComponent(actions).setButtonText("Save + Initial Sync").setCta().onClick(() => {
      void this.saveAndSync();
    });
  }
  showStatus(message, isError = false) {
    this.statusEl.empty();
    this.statusEl.createDiv({
      cls: isError ? "ams-onboarding-error" : "ams-onboarding-info",
      text: message
    });
  }
  async persistSettings() {
    this.plugin.settings.apiBaseUrl = normalizeApiBaseUrl(this.apiBaseUrl);
    this.plugin.settings.apiKey = this.apiKey;
    this.plugin.settings.onboardingCompleted = true;
    await this.plugin.saveSettingsImmediate();
  }
  async saveOnly() {
    await this.persistSettings();
    await this.plugin.testConnection();
    this.close();
  }
  async saveAndSync() {
    await this.persistSettings();
    this.showStatus("Testing connection...");
    const connected = await this.plugin.testConnection();
    if (!connected) {
      this.showStatus(
        `Could not reach AMS at ${this.apiBaseUrl}. Is the server running?`,
        true
      );
      this.plugin.settings.onboardingCompleted = false;
      await this.plugin.saveSettingsImmediate();
      return;
    }
    this.showStatus("Connected. Checking AMS for existing memories...");
    try {
      const searchResult = await this.plugin.searchMemories("*", { limit: 1 });
      if (searchResult.total_results === 0) {
        this.showStatus(
          'AMS has no memories yet. You can start by capturing notes from Obsidian using the "AMS: Capture current note" command, or create memories via the AMS API. The plugin is ready to use.'
        );
        this.close();
        return;
      }
      this.showStatus(
        `Found ${searchResult.total_results} memories in AMS. Starting sync...`
      );
    } catch (_checkError) {
      this.showStatus("Starting sync...");
    }
    await this.plugin.runInitialSync();
    this.close();
  }
};
