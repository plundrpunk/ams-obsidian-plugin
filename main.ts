import {
  App,
  ButtonComponent,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  normalizePath,
  requestUrl,
  debounce,
} from "obsidian";

type MemoryTier = "episodic" | "semantic" | "procedural";
type EntityType = "concept" | "event" | "procedure" | "entity" | "agent" | "blackboard";
type SearchScope = "personal" | "agent" | "global";

interface AMSMemoryRecord {
  memory_id: string;
  file_path: string;
  entity_type: string;
  memory_tier: string;
  creation_timestamp: string;
  last_accessed: string;
  last_modified: string;
  importance: number;
  access_count: number;
  source_agent?: string | null;
  source_type: string;
  activity_id?: string | null;
  status: string;
  ttl_days?: number | null;
  expiry_date?: string | null;
  content_hash?: string | null;
  confidence_score?: number | null;
  tags?: string[] | null;
  memory_metadata?: Record<string, unknown> | null;
}

interface AMSMemoryWithContent extends AMSMemoryRecord {
  content: string;
  full_content: string;
}

interface AMSSearchResult {
  memory: AMSMemoryRecord;
  relevance_score: number;
  content_snippet: string;
}

interface AMSSearchResponse {
  results: AMSSearchResult[];
  query: string;
  total_results: number;
}

interface AMSKnowledgeMapResponse {
  memory_id: string;
  content: string;
  map_version: number;
  last_updated: string | null;
  token_count: number;
}

interface AMSMemoryLink {
  id: string;
  source_memory_id: string;
  target_memory_id: string;
  relationship_type: string;
  strength: number;
  created_by: string;
  created_at: string;
  last_accessed: string;
  access_count: number;
  link_metadata?: Record<string, unknown> | null;
  source_title?: string | null;
  target_title?: string | null;
  source_tier?: string | null;
  target_tier?: string | null;
}

interface AMSMemoryLinksResponse {
  memory_id: string;
  outgoing: AMSMemoryLink[];
  incoming: AMSMemoryLink[];
  total_outgoing: number;
  total_incoming: number;
}

interface AMSSyncStats {
  files_synced: number;
  conflicts_detected: number;
  errors: number;
  vault_to_db: number;
  db_to_vault: number;
  updated: number;
  wikilinks_synced: number;
  duration_seconds: number;
  tier_breakdown: Record<string, number>;
}

interface AMSSyncResponse {
  status: string;
  message: string;
  stats?: AMSSyncStats;
  tier_breakdown?: Record<string, number>;
  total_synced?: number;
}

interface AMSPluginSettings {
  apiBaseUrl: string;
  apiKey: string;
  sourceAgent: string;
  defaultMemoryTier: MemoryTier;
  defaultEntityType: EntityType;
  defaultImportance: number;
  defaultSearchScope: SearchScope;
  defaultSearchLimit: number;
  openCreatedNote: boolean;
  knowledgeMapNotePath: string;
  openKnowledgeMapAfterSync: boolean;
  onboardingCompleted: boolean;
}

interface CaptureDraft {
  title: string;
  content: string;
  memoryTier: MemoryTier;
  entityType: EntityType;
  importance: number;
  tags: string[];
  sourcePath?: string;
  selectionOnly: boolean;
}

interface SearchOptions {
  scope?: SearchScope;
  memoryTier?: MemoryTier | "";
  limit?: number;
}

const DEFAULT_SETTINGS: AMSPluginSettings = {
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
  onboardingCompleted: false,
};

const MEMORY_TIERS: MemoryTier[] = ["episodic", "semantic", "procedural"];
const ENTITY_TYPES: EntityType[] = [
  "concept",
  "event",
  "procedure",
  "entity",
  "agent",
  "blackboard",
];
const SEARCH_SCOPES: SearchScope[] = ["personal", "agent", "global"];

function clampImportance(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SETTINGS.defaultImportance;
  }

  return Math.min(1, Math.max(0, value));
}

function normalizeApiBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function deriveTitleFromPath(filePath: string): string {
  const name = filePath.split("/").pop() ?? filePath;
  return name.replace(/\.md$/i, "").replace(/_/g, " ");
}

function toCsv(tags: string[] | null | undefined): string {
  return (tags ?? []).join(", ");
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function encodeFilePathForUrl(filePath: string): string {
  return filePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function estimateTokenCount(content: string): number {
  return Math.max(1, Math.floor(content.length / 4));
}

function stripFrontmatter(content: string): string {
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

function isUsableMemoryContent(content: string | null | undefined): content is string {
  if (!content) {
    return false;
  }

  return content.trim() !== "[Content unavailable - vault file missing]";
}

export default class AMSMemoryCompanionPlugin extends Plugin {
  settings: AMSPluginSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addRibbonIcon("search", "Search AMS memories", () => {
      void this.openSearchModal();
    });

    this.addCommand({
      id: "ams-search-memories",
      name: "AMS: Search memories",
      callback: () => {
        void this.openSearchModal();
      },
    });

    this.addCommand({
      id: "ams-search-selection",
      name: "AMS: Search using current selection",
      callback: () => {
        const selectedText = this.getSelectedText();
        if (!selectedText) {
          new Notice("Select text in a markdown note first.");
          return;
        }

        void this.openSearchModal(selectedText);
      },
    });

    this.addCommand({
      id: "ams-capture-current-note",
      name: "AMS: Capture current note to AMS",
      callback: () => {
        void this.openCaptureModal(false);
      },
    });

    this.addCommand({
      id: "ams-capture-selection",
      name: "AMS: Capture current selection to AMS",
      callback: () => {
        void this.openCaptureModal(true);
      },
    });

    this.addCommand({
      id: "ams-sync-current-note",
      name: "AMS: Sync current note with AMS",
      callback: () => {
        void this.syncCurrentNote();
      },
    });

    this.addCommand({
      id: "ams-sync-knowledge-map",
      name: "AMS: Refresh knowledge graph note",
      callback: () => {
        void this.syncKnowledgeMapNote(true);
      },
    });

    this.addCommand({
      id: "ams-full-sync",
      name: "AMS: Sync all AMS memories into Obsidian",
      callback: () => {
        void this.runInitialSync();
      },
    });

    this.addSettingTab(new AMSSettingTab(this.app, this));

    if (!this.settings.onboardingCompleted) {
      window.setTimeout(() => {
        new AMSOnboardingModal(this.app, this).open();
      }, 300);
    }
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loaded,
      apiBaseUrl: normalizeApiBaseUrl(loaded?.apiBaseUrl ?? DEFAULT_SETTINGS.apiBaseUrl),
      defaultImportance: clampImportance(
        Number(loaded?.defaultImportance ?? DEFAULT_SETTINGS.defaultImportance),
      ),
      defaultSearchLimit: Number(loaded?.defaultSearchLimit ?? DEFAULT_SETTINGS.defaultSearchLimit),
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  requestSaveSettings = debounce(
    () => {
      void this.saveSettings();
    },
    1000,
    true
  );

  getActiveMarkdownView(): MarkdownView | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      new Notice("Open a markdown note first.");
      return null;
    }

    return view;
  }

  getSelectedText(): string {
    const view = this.getActiveMarkdownView();
    if (!view) {
      return "";
    }

    return view.editor.getSelection().trim();
  }

  async openSearchModal(initialQuery = ""): Promise<void> {
    if (!this.ensureConfigured()) {
      return;
    }

    new SearchModal(this.app, this, initialQuery).open();
  }

  async openCaptureModal(selectionOnly: boolean): Promise<void> {
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
      new Notice(selectionOnly ? "Select text first." : "The current note is empty.");
      return;
    }

    const frontmatterTier = String(frontmatter?.memory_tier ?? "").toLowerCase();
    const frontmatterEntity = String(frontmatter?.entity_type ?? "").toLowerCase();
    const frontmatterImportance = Number(frontmatter?.importance ?? NaN);
    const frontmatterTags = frontmatter?.tags;

    const draft: CaptureDraft = {
      title: selectionOnly ? `${file.basename} excerpt` : file.basename,
      content: noteContent,
      memoryTier: MEMORY_TIERS.includes(frontmatterTier as MemoryTier)
        ? (frontmatterTier as MemoryTier)
        : this.settings.defaultMemoryTier,
      entityType: ENTITY_TYPES.includes(frontmatterEntity as EntityType)
        ? (frontmatterEntity as EntityType)
        : this.settings.defaultEntityType,
      importance: Number.isFinite(frontmatterImportance)
        ? clampImportance(frontmatterImportance)
        : this.settings.defaultImportance,
      tags: Array.isArray(frontmatterTags)
        ? frontmatterTags.map((tag) => String(tag))
        : typeof frontmatterTags === "string"
          ? parseTags(frontmatterTags)
          : [],
      sourcePath: file.path,
      selectionOnly,
    };

    new CaptureMemoryModal(this.app, this, draft).open();
  }

  async searchMemories(query: string, options: SearchOptions = {}): Promise<AMSSearchResponse> {
    return this.apiRequest<AMSSearchResponse>("/api/v1/memories/search", {
      method: "POST",
      body: {
        query,
        limit: options.limit ?? this.settings.defaultSearchLimit,
        scope: options.scope ?? this.settings.defaultSearchScope,
        memory_tier: options.memoryTier || undefined,
      },
    });
  }

  async getMemory(memoryId: string): Promise<AMSMemoryWithContent> {
    return this.apiRequest<AMSMemoryWithContent>(`/api/v1/memories/${encodeURIComponent(memoryId)}`);
  }

  async createMemory(draft: CaptureDraft): Promise<AMSMemoryRecord> {
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
        captured_at: new Date().toISOString(),
      },
    };

    return this.apiRequest<AMSMemoryRecord>("/api/v1/memories/", {
      method: "POST",
      body: payload,
    });
  }

  async syncFile(filePath: string): Promise<{ status: string; message: string }> {
    return this.apiRequest<{ status: string; message: string }>(
      `/api/v1/sync/file/${encodeFilePathForUrl(filePath)}`,
      {
        method: "POST",
      },
    );
  }

  async getKnowledgeMap(): Promise<AMSKnowledgeMapResponse> {
    try {
      return await this.apiRequest<AMSKnowledgeMapResponse>("/knowledge-map/current");
    } catch (primaryError) {
      const searchResponse = await this.apiRequest<AMSSearchResponse>("/api/v1/memories/search", {
        method: "POST",
        body: {
          query: "knowledge map",
          limit: 10,
          scope: "global",
          tags: ["knowledge-map"],
        },
      });

      const candidates = searchResponse.results
        .filter((result) => (result.memory.tags ?? []).includes("knowledge-map"))
        .sort((left, right) => {
          const archivePenalty = (value: string) => (value.startsWith("99_Archive/") ? -1 : 0);
          const conflictPenalty = (value: string) => (value.includes("sync-conflict") ? -1 : 0);
          const leftScore =
            archivePenalty(left.memory.file_path) +
            conflictPenalty(left.memory.file_path) +
            Date.parse(left.memory.creation_timestamp);
          const rightScore =
            archivePenalty(right.memory.file_path) +
            conflictPenalty(right.memory.file_path) +
            Date.parse(right.memory.creation_timestamp);
          return rightScore - leftScore;
        });

      for (const candidate of candidates) {
        const apiMemory = await this.tryGetMemory(candidate.memory.memory_id);
        const apiContent = apiMemory?.content;
        const localContent = await this.readVaultNoteContent(candidate.memory.file_path);
        const resolvedContent = isUsableMemoryContent(apiContent)
          ? apiContent
          : isUsableMemoryContent(localContent)
            ? localContent
            : null;

        if (!resolvedContent) {
          continue;
        }

        const rawVersion = apiMemory?.memory_metadata?.map_version ?? candidate.memory.memory_metadata?.map_version;
        const mapVersion =
          typeof rawVersion === "number" ? rawVersion : Number(rawVersion ?? 1) || 1;

        return {
          memory_id: candidate.memory.memory_id,
          content: resolvedContent,
          map_version: mapVersion,
          last_updated: candidate.memory.last_modified,
          token_count: estimateTokenCount(resolvedContent),
        };
      }

      throw primaryError;
    }
  }

  async getMemoryLinks(memoryId: string): Promise<AMSMemoryLinksResponse> {
    return this.apiRequest<AMSMemoryLinksResponse>(
      `/api/v1/memories/${encodeURIComponent(memoryId)}/links?direction=both`,
    );
  }

  async triggerFullSync(): Promise<AMSSyncResponse> {
    return this.apiRequest<AMSSyncResponse>("/api/v1/sync/trigger", {
      method: "POST",
    });
  }

  async testConnection(): Promise<boolean> {
    if (!this.ensureConfigured()) {
      return false;
    }

    try {
      await this.apiRequest("/api/v1/memories/stats");
      new Notice("AMS connection succeeded.");
      return true;
    } catch (error) {
      new Notice(this.classifyError(error));
      return false;
    }
  }

  async previewMemory(memoryId: string): Promise<void> {
    try {
      const memory = await this.getMemory(memoryId);
      new MemoryPreviewModal(this.app, this, memory).open();
    } catch (error) {
      new Notice(this.formatError(error));
    }
  }

  async openOrPreviewMemory(result: AMSSearchResult): Promise<void> {
    const opened = await this.openVaultNote(result.memory.file_path);
    if (!opened) {
      await this.previewMemory(result.memory.memory_id);
    }
  }

  async openGraphForMemory(result: AMSSearchResult): Promise<void> {
    try {
      const links = await this.getMemoryLinks(result.memory.memory_id);
      new MemoryGraphModal(this.app, this, result, links).open();
    } catch (error) {
      new Notice(this.formatError(error));
    }
  }

  async openVaultNote(filePath: string): Promise<boolean> {
    const normalized = normalizePath(filePath);
    const target = this.app.vault.getAbstractFileByPath(normalized);
    if (!(target instanceof TFile)) {
      new Notice(`Note not found in this vault: ${filePath}`);
      return false;
    }

    await this.app.workspace.getLeaf(true).openFile(target);
    return true;
  }

  async insertWikiLink(filePath: string): Promise<void> {
    const view = this.getActiveMarkdownView();
    if (!view) {
      return;
    }

    const linkTarget = filePath.replace(/\.md$/i, "");
    view.editor.replaceSelection(`[[${linkTarget}]]`);
    new Notice("Inserted AMS note link.");
  }

  async syncCurrentNote(): Promise<void> {
    if (!this.ensureConfigured()) {
      return;
    }

    const view = this.getActiveMarkdownView();
    const file = view?.file;
    if (!file) {
      return;
    }

    new Notice(`Syncing ${file.path} to AMS...`);

    try {
      const result = await this.syncFile(file.path);
      new Notice(result.message || "Sync completed.");
    } catch (error) {
      new Notice(this.formatError(error));
    }
  }

  async syncKnowledgeMapNote(openAfterSync = true): Promise<void> {
    if (!this.ensureConfigured()) {
      return;
    }

    new Notice("Refreshing AMS knowledge graph note...");

    try {
      const map = await this.getKnowledgeMap();
      const file = await this.upsertVaultNote(
        this.settings.knowledgeMapNotePath,
        this.renderKnowledgeMapNote(map),
      );

      new Notice(`Knowledge graph note updated: ${file.path}`);
      if (openAfterSync || this.settings.openKnowledgeMapAfterSync) {
        await this.app.workspace.getLeaf(true).openFile(file);
      }
    } catch (error) {
      new Notice(this.formatError(error));
    }
  }

  async runInitialSync(): Promise<void> {
    if (!this.ensureConfigured()) {
      return;
    }

    new Notice("Syncing AMS memories into Obsidian. This can take a while on first run...");

    try {
      const result = await this.triggerFullSync();

      // Show detailed sync summary modal instead of a simple toast
      if (result.stats || result.total_synced !== undefined) {
        new SyncSummaryModal(this.app, result).open();
      } else {
        new Notice(result.message || "AMS sync completed.");
      }

      await this.syncKnowledgeMapNote(false);
    } catch (error) {
      new Notice(this.classifyError(error));
    }
  }

  ensureConfigured(): boolean {
    if (!normalizeApiBaseUrl(this.settings.apiBaseUrl)) {
      new Notice("Set the AMS API base URL in plugin settings first.");
      return false;
    }

    return true;
  }

  buildApiUrl(path: string): string {
    return `${normalizeApiBaseUrl(this.settings.apiBaseUrl)}${path}`;
  }

  renderKnowledgeMapNote(map: AMSKnowledgeMapResponse): string {
    const updatedAt = map.last_updated ?? new Date().toISOString();
    return [
      "---",
      "source: ams-memory-companion",
      `ams_memory_id: ${map.memory_id}`,
      `ams_map_version: ${map.map_version}`,
      `ams_synced_at: ${new Date().toISOString()}`,
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
      "",
    ].join("\n");
  }

  formatError(error: unknown): string {
    return this.classifyError(error);
  }

  classifyError(error: unknown): string {
    if (!(error instanceof Error)) {
      return "AMS request failed (unknown error).";
    }

    const msg = error.message.toLowerCase();

    // Network / connectivity errors
    if (
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("econnrefused") ||
      msg.includes("connection refused") ||
      msg.includes("net::err") ||
      msg.includes("fetch failed") ||
      msg.includes("unable to connect")
    ) {
      return `AMS server unreachable at ${this.settings.apiBaseUrl}. Is AMS running? Check the URL in plugin settings.`;
    }

    // Timeout
    if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("aborted")) {
      return "AMS request timed out. The server may be overloaded or the sync is taking longer than expected.";
    }

    // Auth errors
    if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("authentication")) {
      return "AMS authentication failed. Check your API key in plugin settings.";
    }

    if (msg.includes("403") || msg.includes("forbidden")) {
      return "AMS access denied. Your API key may lack the required permissions.";
    }

    // Rate limiting
    if (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many")) {
      return "AMS rate limit reached. Wait a moment and try again.";
    }

    // Sync disabled
    if (msg.includes("503") || msg.includes("sync is disabled") || msg.includes("service unavailable")) {
      return "AMS bidirectional sync is disabled on the server. Enable it in .env (ENABLE_BIDIRECTIONAL_SYNC=true) and restart.";
    }

    // Server errors
    if (msg.includes("500") || msg.includes("internal server")) {
      return "AMS server error. Check the AMS backend logs for details.";
    }

    // Fallback: show the original message
    return `AMS error: ${error.message}`;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.settings.apiKey.trim()) {
      headers["X-API-Key"] = this.settings.apiKey.trim();
    }

    if (this.settings.sourceAgent.trim()) {
      headers["X-Agent-ID"] = this.settings.sourceAgent.trim();
    }

    return headers;
  }

  private async apiRequest<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
    } = {},
  ): Promise<T> {
    const hasBody = options.body !== undefined;
    const response = await requestUrl({
      url: this.buildApiUrl(path),
      method: options.method ?? "GET",
      headers: this.buildHeaders(),
      body: hasBody ? JSON.stringify(options.body) : undefined,
      contentType: hasBody ? "application/json" : undefined,
      throw: false,
    });

    if (response.status >= 400) {
      const detail = this.extractErrorDetail(response.text);
      throw new Error(detail || `Request failed with HTTP ${response.status}`);
    }

    if (response.json !== undefined) {
      return response.json as T;
    }

    if (response.text) {
      return JSON.parse(response.text) as T;
    }

    return {} as T;
  }

  private async tryGetMemory(memoryId: string): Promise<AMSMemoryWithContent | null> {
    try {
      return await this.getMemory(memoryId);
    } catch (_error) {
      return null;
    }
  }

  private async readVaultNoteContent(filePath: string): Promise<string | null> {
    const normalized = normalizePath(filePath);
    const target = this.app.vault.getAbstractFileByPath(normalized);
    if (!(target instanceof TFile)) {
      return null;
    }

    const rawContent = await this.app.vault.cachedRead(target);
    return stripFrontmatter(rawContent).trim();
  }

  private async ensureFolderExists(folderPath: string): Promise<void> {
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

  private async upsertVaultNote(filePath: string, content: string): Promise<TFile> {
    const normalized = normalizePath(filePath);
    const lastSlash = normalized.lastIndexOf("/");
    const folderPath = lastSlash >= 0 ? normalized.slice(0, lastSlash) : "";
    await this.ensureFolderExists(folderPath);

    const existing = this.app.vault.getAbstractFileByPath(normalized);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
      return existing;
    }

    return this.app.vault.create(normalized, content);
  }

  private extractErrorDetail(responseText: string): string {
    try {
      const parsed = JSON.parse(responseText) as {
        detail?: string | { message?: string; reason?: string };
        error?: string;
        message?: string;
      };

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
}

class SearchModal extends Modal {
  private readonly plugin: AMSMemoryCompanionPlugin;
  private query: string;
  private searchScope: SearchScope;
  private memoryTier: MemoryTier | "" = "";
  private limit: number;
  private resultsEl!: HTMLDivElement;

  constructor(app: App, plugin: AMSMemoryCompanionPlugin, initialQuery: string) {
    super(app);
    this.plugin = plugin;
    this.query = initialQuery;
    this.searchScope = plugin.settings.defaultSearchScope;
    this.limit = plugin.settings.defaultSearchLimit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ams-modal");

    contentEl.createEl("h2", { text: "Search AMS Memories" });

    new Setting(contentEl)
      .setName("Query")
      .setDesc("Search AMS using hybrid vector and keyword search.")
      .addText((text) => {
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
      this.searchScope = scopeSelect.value as SearchScope;
    });

    const tierField = filtersEl.createDiv({ cls: "ams-field" });
    tierField.createEl("label", { text: "Tier" });
    const tierSelect = tierField.createEl("select");
    tierSelect.add(new Option("all", "", true, true));
    MEMORY_TIERS.forEach((tier) => {
      tierSelect.add(new Option(tier, tier, false, false));
    });
    tierSelect.addEventListener("change", () => {
      this.memoryTier = tierSelect.value as MemoryTier | "";
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
    new ButtonComponent(actionsEl)
      .setButtonText("Close")
      .onClick(() => {
        this.close();
      });

    new ButtonComponent(actionsEl)
      .setButtonText("Search")
      .setCta()
      .onClick(() => {
        void this.performSearch();
      });

    this.resultsEl = contentEl.createDiv({ cls: "ams-results" });
    this.renderEmptyState("Run a search to see matching memories.");

    if (this.query) {
      void this.performSearch();
    }
  }

  private renderEmptyState(message: string): void {
    this.resultsEl.empty();
    this.resultsEl.createDiv({ cls: "ams-empty-state", text: message });
  }

  private async performSearch(): Promise<void> {
    if (!this.query) {
      this.renderEmptyState("Enter a query first.");
      return;
    }

    this.renderEmptyState("Searching AMS...");

    try {
      const response = await this.plugin.searchMemories(this.query, {
        scope: this.searchScope,
        memoryTier: this.memoryTier,
        limit: this.limit,
      });
      this.renderResults(response.results);
    } catch (error) {
      this.renderEmptyState(this.plugin.formatError(error));
    }
  }

  private renderResults(results: AMSSearchResult[]): void {
    this.resultsEl.empty();

    if (!results.length) {
      this.renderEmptyState("No memories matched this search.");
      return;
    }

    // ⚡ Bolt: Batch DOM insertions to prevent N repaints/reflows during render
    const fragment = document.createDocumentFragment();

    results.forEach((result) => {
      const card = fragment.createDiv({ cls: "ams-result-card" });
      const header = card.createDiv({ cls: "ams-result-header" });
      header.createEl("h3", {
        cls: "ams-result-title",
        text: deriveTitleFromPath(result.memory.file_path),
      });

      const meta = header.createDiv({ cls: "ams-result-meta" });
      meta.createSpan({
        cls: "ams-pill",
        text: result.memory.memory_tier,
      });
      meta.createSpan({
        cls: "ams-pill",
        text: `${Math.round(result.relevance_score * 100)}% match`,
      });
      meta.createSpan({
        cls: "ams-pill",
        text: `importance ${result.memory.importance.toFixed(2)}`,
      });

      card.createDiv({
        cls: "ams-result-path",
        text: result.memory.file_path,
      });
      card.createEl("p", {
        cls: "ams-result-snippet",
        text: result.content_snippet || "No snippet available.",
      });

      const actions = card.createDiv({ cls: "ams-result-actions" });
      new ButtonComponent(actions)
        .setButtonText("Open")
        .onClick(() => {
          void this.plugin.openOrPreviewMemory(result);
        });

      new ButtonComponent(actions)
        .setButtonText("Preview")
        .onClick(() => {
          void this.plugin.previewMemory(result.memory.memory_id);
        });

      new ButtonComponent(actions)
        .setButtonText("Graph")
        .onClick(() => {
          void this.plugin.openGraphForMemory(result);
        });

      new ButtonComponent(actions)
        .setButtonText("Insert Link")
        .onClick(() => {
          void this.plugin.insertWikiLink(result.memory.file_path);
        });
    });

    this.resultsEl.appendChild(fragment);
  }
}

class CaptureMemoryModal extends Modal {
  private readonly plugin: AMSMemoryCompanionPlugin;
  private readonly draft: CaptureDraft;
  private isSubmitting = false;

  constructor(app: App, plugin: AMSMemoryCompanionPlugin, draft: CaptureDraft) {
    super(app);
    this.plugin = plugin;
    this.draft = draft;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ams-modal");

    contentEl.createEl("h2", {
      text: this.draft.selectionOnly ? "Capture Selection To AMS" : "Capture Note To AMS",
    });

    new Setting(contentEl)
      .setName("Title")
      .setDesc("The memory title stored by AMS.")
      .addText((text) => {
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
        new Option(tier, tier, tier === this.draft.memoryTier, tier === this.draft.memoryTier),
      );
    });
    tierSelect.addEventListener("change", () => {
      this.draft.memoryTier = tierSelect.value as MemoryTier;
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
          entity === this.draft.entityType,
        ),
      );
    });
    entitySelect.addEventListener("change", () => {
      this.draft.entityType = entitySelect.value as EntityType;
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

    new Setting(contentEl)
      .setName("Tags")
      .setDesc("Comma-separated tags stored with the memory.")
      .addText((text) => {
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
    new ButtonComponent(actionsEl)
      .setButtonText("Cancel")
      .onClick(() => {
        this.close();
      });

    new ButtonComponent(actionsEl)
      .setButtonText("Save To AMS")
      .setCta()
      .onClick(() => {
        void this.submit();
      });
  }

  private async submit(): Promise<void> {
    if (this.isSubmitting) {
      return;
    }

    if (!this.draft.title.trim()) {
      new Notice("Title is required.");
      return;
    }

    if (!this.draft.content.trim()) {
      new Notice("Content is required.");
      return;
    }

    this.isSubmitting = true;
    new Notice("Saving memory to AMS...");

    try {
      const created = await this.plugin.createMemory(this.draft);
      new Notice(`Memory created: ${deriveTitleFromPath(created.file_path)}`);
      this.close();

      if (this.plugin.settings.openCreatedNote) {
        await this.plugin.openVaultNote(created.file_path);
      }
    } catch (error) {
      new Notice(this.plugin.formatError(error));
    } finally {
      this.isSubmitting = false;
    }
  }
}

class MemoryPreviewModal extends Modal {
  private readonly plugin: AMSMemoryCompanionPlugin;
  private readonly memory: AMSMemoryWithContent;

  constructor(app: App, plugin: AMSMemoryCompanionPlugin, memory: AMSMemoryWithContent) {
    super(app);
    this.plugin = plugin;
    this.memory = memory;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ams-modal");

    contentEl.createEl("h2", {
      text: deriveTitleFromPath(this.memory.file_path),
    });

    contentEl.createDiv({
      cls: "ams-preview-meta",
      text: `${this.memory.memory_tier} | ${this.memory.file_path}`,
    });

    const content = contentEl.createEl("pre", { cls: "ams-preview-content" });
    content.textContent = this.memory.full_content || this.memory.content;

    const actionsEl = contentEl.createDiv({ cls: "ams-button-row" });
    new ButtonComponent(actionsEl)
      .setButtonText("Close")
      .onClick(() => {
        this.close();
      });

    new ButtonComponent(actionsEl)
      .setButtonText("Insert Link")
      .onClick(() => {
        void this.plugin.insertWikiLink(this.memory.file_path);
      });

    new ButtonComponent(actionsEl)
      .setButtonText("Open Note")
      .setCta()
      .onClick(() => {
        void this.plugin.openVaultNote(this.memory.file_path);
      });
  }
}

class MemoryGraphModal extends Modal {
  private readonly plugin: AMSMemoryCompanionPlugin;
  private readonly result: AMSSearchResult;
  private readonly links: AMSMemoryLinksResponse;

  constructor(
    app: App,
    plugin: AMSMemoryCompanionPlugin,
    result: AMSSearchResult,
    links: AMSMemoryLinksResponse,
  ) {
    super(app);
    this.plugin = plugin;
    this.result = result;
    this.links = links;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ams-modal");

    contentEl.createEl("h2", {
      text: `${deriveTitleFromPath(this.result.memory.file_path)} Graph`,
    });

    contentEl.createDiv({
      cls: "ams-preview-meta",
      text: `${this.links.total_outgoing} outgoing | ${this.links.total_incoming} incoming`,
    });

    this.renderLinkSection(contentEl, "Outgoing Links", this.links.outgoing, "outgoing");
    this.renderLinkSection(contentEl, "Incoming Links", this.links.incoming, "incoming");

    const actionsEl = contentEl.createDiv({ cls: "ams-button-row" });
    new ButtonComponent(actionsEl)
      .setButtonText("Close")
      .onClick(() => {
        this.close();
      });
  }

  private renderLinkSection(
    container: HTMLElement,
    heading: string,
    links: AMSMemoryLink[],
    direction: "outgoing" | "incoming",
  ): void {
    container.createEl("h3", { text: heading });

    if (!links.length) {
      container.createDiv({
        cls: "ams-empty-state",
        text: `No ${direction} links.`,
      });
      return;
    }

    const resultsEl = container.createDiv({ cls: "ams-results" });

    // ⚡ Bolt: Batch DOM insertions to prevent N repaints/reflows during render
    const fragment = document.createDocumentFragment();

    links.forEach((link) => {
      const card = fragment.createDiv({ cls: "ams-result-card" });
      const header = card.createDiv({ cls: "ams-result-header" });
      const title =
        direction === "outgoing"
          ? link.target_title ?? link.target_memory_id
          : link.source_title ?? link.source_memory_id;
      header.createEl("h4", { cls: "ams-result-title", text: title });

      const meta = header.createDiv({ cls: "ams-result-meta" });
      meta.createSpan({ cls: "ams-pill", text: link.relationship_type });
      meta.createSpan({
        cls: "ams-pill",
        text: `strength ${link.strength.toFixed(2)}`,
      });
      const tier = direction === "outgoing" ? link.target_tier : link.source_tier;
      if (tier) {
        meta.createSpan({ cls: "ams-pill", text: tier });
      }

      const actions = card.createDiv({ cls: "ams-result-actions" });
      new ButtonComponent(actions)
        .setButtonText("Preview")
        .onClick(() => {
          const targetId =
            direction === "outgoing" ? link.target_memory_id : link.source_memory_id;
          void this.plugin.previewMemory(targetId);
        });
    });

    resultsEl.appendChild(fragment);
  }
}

class AMSSettingTab extends PluginSettingTab {
  private readonly plugin: AMSMemoryCompanionPlugin;

  constructor(app: App, plugin: AMSMemoryCompanionPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "AMS Memory Companion" });

    new Setting(containerEl)
      .setName("AMS API base URL")
      .setDesc("Base URL for your AMS backend, usually http://localhost:3001")
      .addText((text) => {
        text.setPlaceholder("http://localhost:3001");
        text.setValue(this.plugin.settings.apiBaseUrl);
        text.onChange((value) => {
          this.plugin.settings.apiBaseUrl = normalizeApiBaseUrl(value);
          this.plugin.requestSaveSettings();
        });
      });

    new Setting(containerEl)
      .setName("AMS API key")
      .setDesc("Optional unless AMS authentication is enabled.")
      .addText((text) => {
        text.inputEl.type = "password";
        text.setPlaceholder("Paste API key");
        text.setValue(this.plugin.settings.apiKey);
        text.onChange((value) => {
          this.plugin.settings.apiKey = value.trim();
          this.plugin.requestSaveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Source agent")
      .setDesc("Sent as source_agent and X-Agent-ID for AMS logging.")
      .addText((text) => {
        text.setValue(this.plugin.settings.sourceAgent);
        text.onChange((value) => {
          this.plugin.settings.sourceAgent = value.trim() || "obsidian-plugin";
          this.plugin.requestSaveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Default memory tier")
      .setDesc("Preselected when capturing notes or selections.")
      .addDropdown((dropdown) => {
        MEMORY_TIERS.forEach((tier) => dropdown.addOption(tier, tier));
        dropdown.setValue(this.plugin.settings.defaultMemoryTier);
        dropdown.onChange((value) => {
          this.plugin.settings.defaultMemoryTier = value as MemoryTier;
          this.plugin.requestSaveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Default entity type")
      .setDesc("Preselected when capturing notes or selections.")
      .addDropdown((dropdown) => {
        ENTITY_TYPES.forEach((entity) => dropdown.addOption(entity, entity));
        dropdown.setValue(this.plugin.settings.defaultEntityType);
        dropdown.onChange((value) => {
          this.plugin.settings.defaultEntityType = value as EntityType;
          this.plugin.requestSaveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Default importance")
      .setDesc("Value between 0 and 1 used for new memories.")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text.inputEl.max = "1";
        text.inputEl.step = "0.05";
        text.setValue(String(this.plugin.settings.defaultImportance));
        text.onChange((value) => {
          this.plugin.settings.defaultImportance = clampImportance(Number(value));
          this.plugin.requestSaveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Default search scope")
      .setDesc("Search visibility scope used by the search modal.")
      .addDropdown((dropdown) => {
        SEARCH_SCOPES.forEach((scope) => dropdown.addOption(scope, scope));
        dropdown.setValue(this.plugin.settings.defaultSearchScope);
        dropdown.onChange((value) => {
          this.plugin.settings.defaultSearchScope = value as SearchScope;
          this.plugin.requestSaveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Default search limit")
      .setDesc("Maximum results fetched by default.")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.max = "100";
        text.setValue(String(this.plugin.settings.defaultSearchLimit));
        text.onChange((value) => {
          const parsed = Number(value);
          this.plugin.settings.defaultSearchLimit = Math.min(100, Math.max(1, parsed || 10));
          this.plugin.requestSaveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Open created note automatically")
      .setDesc("Open the AMS-created vault note after capture if it exists in this vault.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.openCreatedNote);
        toggle.onChange((value) => {
          this.plugin.settings.openCreatedNote = value;
          this.plugin.requestSaveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Knowledge graph note path")
      .setDesc("Local note path used for the synced AMS knowledge map.")
      .addText((text) => {
        text.setPlaceholder("AMS/Knowledge Graph.md");
        text.setValue(this.plugin.settings.knowledgeMapNotePath);
        text.onChange((value) => {
          this.plugin.settings.knowledgeMapNotePath = value.trim() || "AMS/Knowledge Graph.md";
          this.plugin.requestSaveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Open knowledge graph after refresh")
      .setDesc("Open the local knowledge graph note after syncing it from AMS.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.openKnowledgeMapAfterSync);
        toggle.onChange((value) => {
          this.plugin.settings.openKnowledgeMapAfterSync = value;
          this.plugin.requestSaveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Connection check")
      .setDesc("Verify the plugin can talk to AMS using the current settings.")
      .addButton((button) => {
        button.setButtonText("Test connection").onClick(() => {
          void this.plugin.testConnection();
        });
      })
      .addButton((button) => {
        button.setButtonText("Initial sync").onClick(() => {
          void this.plugin.runInitialSync();
        });
      })
      .addExtraButton((button) => {
        button.setIcon("git-branch");
        button.setTooltip("Refresh knowledge graph");
        button.onClick(() => {
          void this.plugin.syncKnowledgeMapNote(true);
        });
      });
  }
}

class SyncSummaryModal extends Modal {
  private readonly syncResult: AMSSyncResponse;

  constructor(app: App, syncResult: AMSSyncResponse) {
    super(app);
    this.syncResult = syncResult;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ams-modal");

    contentEl.createEl("h2", { text: "AMS Sync Complete" });

    const stats = this.syncResult.stats;
    const totalSynced = this.syncResult.total_synced ?? 0;

    if (totalSynced === 0 && (!stats || stats.errors === 0)) {
      contentEl.createEl("p", {
        text: "Everything is already in sync. No changes were needed.",
      });
    } else {
      const summaryEl = contentEl.createDiv({ cls: "ams-sync-summary" });

      if (stats) {
        if (stats.db_to_vault > 0) {
          summaryEl.createDiv({
            text: `${stats.db_to_vault} memories exported to vault as notes`,
          });
        }
        if (stats.vault_to_db > 0) {
          summaryEl.createDiv({
            text: `${stats.vault_to_db} vault notes imported to AMS database`,
          });
        }
        if (stats.updated > 0) {
          summaryEl.createDiv({
            text: `${stats.updated} existing files updated`,
          });
        }
        if (stats.wikilinks_synced > 0) {
          summaryEl.createDiv({
            text: `${stats.wikilinks_synced} notes with wikilinks synced`,
          });
        }
        if (stats.conflicts_detected > 0) {
          summaryEl.createDiv({
            text: `${stats.conflicts_detected} conflicts detected and resolved`,
          });
        }
        if (stats.errors > 0) {
          summaryEl.createDiv({
            cls: "ams-sync-errors",
            text: `${stats.errors} errors occurred during sync`,
          });
        }

        // Tier breakdown
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
            text: `Completed in ${stats.duration_seconds.toFixed(1)}s`,
          });
        }
      }
    }

    const actionsEl = contentEl.createDiv({ cls: "ams-button-row" });
    new ButtonComponent(actionsEl)
      .setButtonText("Done")
      .setCta()
      .onClick(() => {
        this.close();
      });
  }
}

class AMSOnboardingModal extends Modal {
  private readonly plugin: AMSMemoryCompanionPlugin;
  private apiBaseUrl: string;
  private apiKey: string;

  constructor(app: App, plugin: AMSMemoryCompanionPlugin) {
    super(app);
    this.plugin = plugin;
    this.apiBaseUrl = plugin.settings.apiBaseUrl;
    this.apiKey = plugin.settings.apiKey;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ams-modal");

    contentEl.createEl("h2", { text: "Set Up AMS Memory Companion" });

    contentEl.createEl("p", {
      text: "Connect Obsidian to your AMS backend. Once connected, the initial sync will materialize every AMS memory as a note in your vault, complete with wikilinks for Obsidian Graph View.",
    });

    const stepsEl = contentEl.createDiv({ cls: "ams-onboarding-steps" });
    stepsEl.createEl("div", {
      text: "1. Enter your AMS server URL (default: http://localhost:3001)",
    });
    stepsEl.createEl("div", {
      text: "2. Add your API key if authentication is enabled",
    });
    stepsEl.createEl("div", {
      text: '3. Click "Save + Initial Sync" to pull all memories into your vault',
    });

    new Setting(contentEl)
      .setName("AMS API base URL")
      .setDesc("Usually http://localhost:3001")
      .addText((text) => {
        text.setPlaceholder("http://localhost:3001");
        text.setValue(this.apiBaseUrl);
        text.onChange((value) => {
          this.apiBaseUrl = normalizeApiBaseUrl(value);
        });
      });

    new Setting(contentEl)
      .setName("AMS API key")
      .setDesc("Optional unless AMS authentication is enabled.")
      .addText((text) => {
        text.inputEl.type = "password";
        text.setValue(this.apiKey);
        text.onChange((value) => {
          this.apiKey = value.trim();
        });
      });

    this.statusEl = contentEl.createDiv({ cls: "ams-onboarding-status" });

    const actions = contentEl.createDiv({ cls: "ams-button-row" });
    new ButtonComponent(actions)
      .setButtonText("Save")
      .onClick(() => {
        void this.saveOnly();
      });

    new ButtonComponent(actions)
      .setButtonText("Save + Initial Sync")
      .setCta()
      .onClick(() => {
        void this.saveAndSync();
      });
  }

  private statusEl!: HTMLDivElement;

  private showStatus(message: string, isError = false): void {
    this.statusEl.empty();
    this.statusEl.createDiv({
      cls: isError ? "ams-onboarding-error" : "ams-onboarding-info",
      text: message,
    });
  }

  private async persistSettings(): Promise<void> {
    this.plugin.settings.apiBaseUrl = normalizeApiBaseUrl(this.apiBaseUrl);
    this.plugin.settings.apiKey = this.apiKey;
    this.plugin.settings.onboardingCompleted = true;
    await this.plugin.saveSettings();
  }

  private async saveOnly(): Promise<void> {
    await this.persistSettings();
    await this.plugin.testConnection();
    this.close();
  }

  private async saveAndSync(): Promise<void> {
    await this.persistSettings();

    this.showStatus("Testing connection...");
    const connected = await this.plugin.testConnection();
    if (!connected) {
      this.showStatus(
        `Could not reach AMS at ${this.apiBaseUrl}. Is the server running?`,
        true,
      );
      // Don't mark onboarding complete if connection fails
      this.plugin.settings.onboardingCompleted = false;
      await this.plugin.saveSettings();
      return;
    }

    this.showStatus("Connected. Checking AMS for existing memories...");

    // Check if AMS has any memories before syncing
    try {
      const searchResult = await this.plugin.searchMemories("*", { limit: 1 });
      if (searchResult.total_results === 0) {
        this.showStatus(
          "AMS has no memories yet. You can start by capturing notes from Obsidian using the " +
            '"AMS: Capture current note" command, or create memories via the AMS API. ' +
            "The plugin is ready to use.",
        );
        this.close();
        return;
      }

      this.showStatus(
        `Found ${searchResult.total_results} memories in AMS. Starting sync...`,
      );
    } catch (_checkError) {
      // Search may fail if no memories exist; proceed with sync anyway
      this.showStatus("Starting sync...");
    }

    await this.plugin.runInitialSync();
    this.close();
  }
}
