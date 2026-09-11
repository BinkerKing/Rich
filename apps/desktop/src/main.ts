import { app, BrowserWindow, shell, dialog, Menu, Tray, nativeImage, globalShortcut, screen, ipcMain } from "electron";
import { existsSync, mkdirSync, statSync, readdirSync, copyFileSync, appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import http from "node:http";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

// File-based logger so we can see what happened when launched from .app bundle
// (where stdout is swallowed). Always logs to /tmp/ke-desktop.log.
const LOG_PATH = "/tmp/ke-desktop.log";
function flog(msg: string) {
  try { appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
}
// Tee console.log/error → file.
const _origLog = console.log;
const _origErr = console.error;
console.log = (...a: unknown[]) => { flog(a.map(String).join(" ")); _origLog(...a); };
console.error = (...a: unknown[]) => { flog("ERROR " + a.map(String).join(" ")); _origErr(...a); };
process.on("uncaughtException", (e) => { flog("uncaughtException " + (e instanceof Error ? e.stack || e.message : String(e))); });
process.on("unhandledRejection", (e) => { flog("unhandledRejection " + String(e)); });
flog("main.cjs loaded");

function openExternalTarget(url: string): void {
  if (url.startsWith("file://")) {
    try {
      const path = fileURLToPath(url);
      void shell.openPath(path).then((error) => {
        if (error) flog(`openPath failed ${path}: ${error}`);
      });
    } catch (error) {
      flog(`openPath invalid file url ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }
  void shell.openExternal(url).catch((error) => {
    flog(`openExternal failed ${url}: ${error instanceof Error ? error.message : String(error)}`);
  });
}

function openRichExternalUrl(url: string): boolean {
  if (!url.startsWith("rich://open-external")) return false;
  try {
    const parsed = new URL(url);
    const target = parsed.searchParams.get("url");
    if (target) openExternalTarget(target);
  } catch (error) {
    flog(`invalid rich external url ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return true;
}

function handleRichWindowCommand(url: string, win: BrowserWindow): boolean {
  if (!url.startsWith("rich://window/")) return false;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "toggle-maximize") {
      toggleWindowMaximize(win);
      return true;
    }
  } catch (error) {
    flog(`invalid rich window url ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return false;
}

function toggleWindowMaximize(win: BrowserWindow): void {
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
}

function setTopDragRegionMode(win: BrowserWindow, mode: "drag" | "no-drag"): void {
  win.webContents.executeJavaScript(`document.getElementById("rich-window-drag-region")?.style.setProperty("-webkit-app-region", "${mode}")`)
    .catch(() => { /* renderer can be gone while reloading */ });
}

// CJS-friendly module dir. esbuild outputs CJS so `__dirname` is available
// directly; we don't need ESM's fileURLToPath dance.
declare const __dirname: string;

/**
 * Electron main process for Rich desktop (the private AI assistant).
 *
 * On launch:
 *   1. Fix PATH so GUI-launched child processes (codex / claude-code CLI)
 *      can be located via `which`.
 *   2. Move data dir to ~/Library/Application Support/Rich/data
 *      (auto-migrate from the legacy Know Everything userData dir, or any
 *      in-repo data/ on first run, if present).
 *   3. Boot the bundled Hono server on a free localhost port; tell it to
 *      serve the prebuilt web bundle from the same port.
 *   4. Open a BrowserWindow pointed at http://127.0.0.1:<port>/.
 *
 * Closing the last window quits the app (mac convention notwithstanding —
 * users expect a single-window tool here).
 */

// ----- Step 1: PATH augmentation -----------------------------------------
// macOS GUI apps don't inherit the user's shell PATH, so brew-installed
// codex / claude-code wouldn't be found. We resolve PATH from a login shell
// once at startup and stamp it onto process.env.
function ensureUserShellPath() {
  if (process.platform !== "darwin" && process.platform !== "linux") return;
  try {
    const shell = process.env.SHELL || "/bin/zsh";
    const out = execFileSync(shell, ["-ilc", "echo $PATH"], { timeout: 3000, encoding: "utf8" });
    const pathFromShell = (out.split("\n").pop() || out).trim();
    if (pathFromShell && pathFromShell.includes("/")) {
      // Merge with what we already have, deduping.
      const merged = new Set<string>();
      for (const p of pathFromShell.split(":")) if (p) merged.add(p);
      for (const p of (process.env.PATH || "").split(":")) if (p) merged.add(p);
      // Add a few well-known places defensively (brew on arm Mac / intel Mac).
      for (const p of ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"]) merged.add(p);
      process.env.PATH = Array.from(merged).join(":");
    }
  } catch {
    // Best-effort. Worst case, user sees the existing "codex CLI not found"
    // error and can set KE_CODEX_BIN manually.
  }
}

function unquoteEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function expandHome(value: string): string {
  const home = app.getPath("home");
  return value
    .replaceAll("$HOME", home)
    .replaceAll("${HOME}", home)
    .replace(/^~/, home);
}

function loadEnvFile(envPath: string) {
  if (!existsSync(envPath)) return false;
  try {
    const content = readFileSync(envPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = expandHome(unquoteEnvValue(rawValue));
    }
    if (!process.env.DATABASE_URL && process.env.RICH_DB_URL) {
      process.env.DATABASE_URL = process.env.RICH_DB_URL;
    }
    if (!process.env.KE_STORAGE && process.env.DATABASE_URL) {
      process.env.KE_STORAGE = "postgres";
    }
    flog(`env loaded: ${envPath}`);
    return true;
  } catch (e) {
    console.warn(`[ke-desktop] env load failed: ${envPath}`, e);
    return false;
  }
}

function loadRichCloudEnv() {
  const loadedCount = [
    ".rich-cloud-postgres.env",
    ".rich-ai.env",
  ].filter(file => loadEnvFile(join(app.getPath("home"), file))).length;

  if (loadedCount > 0) {
    if (!process.env.DATABASE_URL && process.env.RICH_DB_URL) {
      process.env.DATABASE_URL = process.env.RICH_DB_URL;
    }
    if (!process.env.KE_STORAGE && process.env.DATABASE_URL) {
      process.env.KE_STORAGE = "postgres";
    }
  }
}

// ----- Step 2: Resolve / migrate data directory --------------------------
function userDataDir(): string {
  // app.getPath("userData") is the OS-conventional per-app data dir.
  // On macOS: ~/Library/Application Support/<productName>.
  return join(app.getPath("userData"), "data");
}

/** Backfill the userData/data directory on first launch.
 *
 *  Sources, in priority order:
 *    1. The previous "Know Everything" userData dir (the app rebranded to
 *       Rich; we want existing users to keep their 50 MB of knowledge).
 *    2. The in-repo `data/` directory, for upgrading the dev workflow to
 *       the packaged app. */
function migrateInRepoDataIfNeeded(targetDir: string) {
  if (existsSync(targetDir)) {
    // Already populated — skip.
    try {
      if (readdirSync(targetDir).length > 0) return;
    } catch { /* fall through to recreate */ }
  }
  // Candidate sources, tried in order. First non-empty directory wins.
  const here = __dirname;
  const legacyUserData = join(
    app.getPath("appData"),
    "Know Everything",
    "data",
  );
  const candidates = [
    legacyUserData,                      // previous brand's userData/data
    resolve(here, "../../../data"),       // monorepo dev layout
    resolve(here, "../../../../data"),   // alternative depth
  ];
  for (const src of candidates) {
    try {
      if (!existsSync(src) || !statSync(src).isDirectory()) continue;
      const files = readdirSync(src);
      if (files.length === 0) continue;
      // Copy recursively.
      mkdirSync(targetDir, { recursive: true });
      copyDirSync(src, targetDir);
      console.log(`[ke-desktop] migrated data from ${src} → ${targetDir}`);
      return;
    } catch (e) {
      console.warn("[ke-desktop] data migration probe failed", e);
    }
  }
  mkdirSync(targetDir, { recursive: true });
}

function copyDirSync(src: string, dst: string) {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dst, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else if (entry.isFile()) copyFileSync(s, d);
  }
}

function appIconPath(): string | undefined {
  const candidates = [
    process.resourcesPath ? join(process.resourcesPath, "app-icon.png") : "",
    resolve(__dirname, "../assets/app-icon.png"),
  ];
  return candidates.find((p) => p && existsSync(p));
}

function setDockIconIfAvailable() {
  if (process.platform !== "darwin" || !app.dock) return;
  try {
    const result = (app as unknown as { setActivationPolicy?: (policy: "regular" | "accessory" | "prohibited") => boolean }).setActivationPolicy?.("regular");
    app.dock.show();
    flog(`dock regular policy applied, result=${String(result)}`);
  } catch (error) {
    flog(`dock show failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const iconPath = appIconPath();
  if (!iconPath) return;
  const icon = nativeImage.createFromPath(iconPath);
  if (!icon.isEmpty()) app.dock.setIcon(icon);
}

function ensureDockApplication(context: string) {
  if (process.platform !== "darwin" || !app.dock) return;
  try {
    const result = (app as unknown as { setActivationPolicy?: (policy: "regular" | "accessory" | "prohibited") => boolean }).setActivationPolicy?.("regular");
    app.dock.show();
    flog(`dock ensured ${context}, result=${String(result)}`);
  } catch (error) {
    flog(`dock ensure failed ${context}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ----- Step 3: Boot the server -------------------------------------------
async function findFreePort(start = 31515): Promise<number> {
  for (let p = start; p < start + 200; p++) {
    if (await tryPort(p)) return p;
  }
  throw new Error("no free port found in 31515..31714");
}
function tryPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = http.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "127.0.0.1");
  });
}

async function bootServer(port: number) {
  const here = __dirname;
  // The bundled server is at dist/server.cjs alongside this main.cjs.
  // Web bundle is in apps/web/dist/ (when running unpacked) or copied into
  // the asar resources directory.
  const webDist = process.resourcesPath && existsSync(join(process.resourcesPath, "web-dist"))
    ? join(process.resourcesPath, "web-dist")
    : resolve(here, "../../web/dist");

  process.env.PORT = String(port);
  process.env.KE_DATA_DIR = userDataDir();
  process.env.KE_WEB_DIST = webDist;
  process.env.KE_AUTO_START = "1";
  // Point AI manuals dir at the bundled resources/ai when packaged,
  // otherwise fall back to the in-repo ai/ (dev mode).
  if (process.resourcesPath && existsSync(join(process.resourcesPath, "ai"))) {
    process.env.KE_AI_DIR = join(process.resourcesPath, "ai");
  }

  // Load the bundled server. Setting KE_AUTO_START=1 above triggers its
  // bottom-of-file startup branch (the ESM-main-module guard doesn't fire
  // when bundled into Electron's CJS context).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(join(here, "server.cjs"));
    console.log(`[ke-desktop] server booting on port ${port}, data=${process.env.KE_DATA_DIR}, webDist=${webDist}`);
  } catch (e) {
    const msg = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
    console.error("[ke-desktop] server require() failed:", msg);
    throw e;
  }
}

// ----- Step 4: Window ----------------------------------------------------
type WindowLayoutMode = "desktop" | "pad" | "fullscreen";
type RememberedWindowLayoutMode = Exclude<WindowLayoutMode, "fullscreen">;
type MainWindowState = {
  bounds: Electron.Rectangle;
  maximized: boolean;
  dockedSide?: EdgeDockSide;
  dockedCollapsed?: boolean;
  layoutMode?: WindowLayoutMode;
  desktopBounds?: Electron.Rectangle;
  padBounds?: Electron.Rectangle;
};
const MAIN_WINDOW_WIDTH = 1480;
const MAIN_WINDOW_HEIGHT = 920;
const MAIN_WINDOW_MIN_WIDTH = 1100;
const MAIN_WINDOW_MIN_HEIGHT = 700;
const PAD_WINDOW_WIDTH = 840;
const PAD_WINDOW_HEIGHT = 630;
const PAD_WINDOW_MIN_WIDTH = 720;
const PAD_WINDOW_MIN_HEIGHT = 540;

function windowMinimums(mode: WindowLayoutMode) {
  return mode === "pad"
    ? { width: PAD_WINDOW_MIN_WIDTH, height: PAD_WINDOW_MIN_HEIGHT }
    : { width: MAIN_WINDOW_MIN_WIDTH, height: MAIN_WINDOW_MIN_HEIGHT };
}

function mainWindowStatePath(): string {
  return join(userDataDir(), "window-state.json");
}

function restoreMainWindowState(): MainWindowState | null {
  try {
    const saved = JSON.parse(readFileSync(mainWindowStatePath(), "utf8")) as Partial<MainWindowState>;
    const bounds = saved.bounds;
    if (!bounds || ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) return null;
    const layoutMode: RememberedWindowLayoutMode = saved.layoutMode === "pad" ? "pad" : "desktop";
    const minimums = windowMinimums(layoutMode);
    const display = screen.getDisplayMatching(bounds);
    const workArea = display.workArea;
    const width = Math.min(Math.max(minimums.width, bounds.width), workArea.width);
    const height = Math.min(Math.max(minimums.height, bounds.height), workArea.height);
    const dockedSide: EdgeDockSide | undefined = saved.dockedSide === "left" || saved.dockedSide === "right"
      ? saved.dockedSide
      : undefined;
    return {
      bounds: {
        x: dockedSide === "left"
          ? workArea.x
          : dockedSide === "right"
            ? workArea.x + workArea.width - width
            : Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - width),
        y: Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - height),
        width,
        height,
      },
      maximized: saved.maximized === true,
      layoutMode,
      ...(saved.desktopBounds && [saved.desktopBounds.x, saved.desktopBounds.y, saved.desktopBounds.width, saved.desktopBounds.height].every(Number.isFinite)
        ? { desktopBounds: saved.desktopBounds }
        : {}),
      ...(saved.padBounds && [saved.padBounds.x, saved.padBounds.y, saved.padBounds.width, saved.padBounds.height].every(Number.isFinite)
        ? { padBounds: saved.padBounds }
        : {}),
      ...(dockedSide ? { dockedSide, dockedCollapsed: saved.dockedCollapsed === true } : {}),
    };
  } catch {
    return null;
  }
}

function saveMainWindowState(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  try {
    mkdirSync(userDataDir(), { recursive: true });
    const bounds = edgeDockState && !win.isVisible() ? edgeDockState.bounds : win.getNormalBounds();
    if (richWindowLayoutMode === "pad") richPadBounds = bounds;
    const state: MainWindowState = {
      bounds,
      maximized: win.isMaximized(),
      layoutMode: richLastWindowedLayoutMode,
      ...(richDesktopBounds ? { desktopBounds: richDesktopBounds } : {}),
      ...(richPadBounds ? { padBounds: richPadBounds } : {}),
      ...(!win.isMaximized() && edgeDockState
        ? { dockedSide: edgeDockState.side, dockedCollapsed: edgeDockIsCollapsed }
        : {}),
    };
    writeFileSync(mainWindowStatePath(), JSON.stringify(state));
  } catch (error) {
    flog(`window state save failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function setupMainWindowStatePersistence(win: BrowserWindow): void {
  let saveTimer: NodeJS.Timeout | null = null;
  const scheduleSave = () => {
    if (edgeDockIsAnimating) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveMainWindowState(win);
    }, 180);
  };
  win.on("move", scheduleSave);
  win.on("resize", scheduleSave);
  win.on("maximize", scheduleSave);
  win.on("unmaximize", scheduleSave);
  win.on("close", () => saveMainWindowState(win));
  win.on("closed", () => { if (saveTimer) clearTimeout(saveTimer); });
}

async function openMainWindow(port: number): Promise<BrowserWindow> {
  const icon = appIconPath();
  const savedState = restoreMainWindowState();
  const savedLayoutMode: RememberedWindowLayoutMode = savedState?.layoutMode === "pad" ? "pad" : "desktop";
  richWindowLayoutMode = savedLayoutMode;
  richLastWindowedLayoutMode = savedLayoutMode;
  richDesktopBounds = savedState?.desktopBounds ?? null;
  richPadBounds = savedState?.padBounds ?? (savedState?.layoutMode === "pad" ? savedState.bounds : null);
  const minimums = windowMinimums(richWindowLayoutMode);
  const win = new BrowserWindow({
    width: savedState?.bounds.width ?? MAIN_WINDOW_WIDTH,
    height: savedState?.bounds.height ?? MAIN_WINDOW_HEIGHT,
    minWidth: minimums.width,
    minHeight: minimums.height,
    ...(savedState ? { x: savedState.bounds.x, y: savedState.bounds.y } : {}),
    title: "Rich",
    backgroundColor: "#09090a",
    // Keep the title bar chromeless. Native window buttons are hidden below
    // so every Rich screen uses the same clean top-left corner.
    titleBarStyle: "hiddenInset",
    maximizable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, "preload.cjs"),
    },
    ...(icon ? { icon } : {}),
    show: false,
  });
  if (process.platform === "darwin") win.setWindowButtonVisibility(false);
  win.setSkipTaskbar(false);
  win.once("ready-to-show", () => {
    ensureDockApplication("main ready-to-show");
    if (process.platform === "darwin") app.show();
    if (savedState?.maximized) win.maximize();
    if (savedState?.dockedCollapsed && edgeDockState) {
      edgeDockIsCollapsed = true;
      showEdgeDockGlow();
    } else {
      win.show();
    }
    setTimeout(() => ensureDockApplication("main shown"), 500);
  });

  // macOS dock-icon UX: pressing the red close button should HIDE the window
  // rather than destroy it. The dock-icon `activate` handler then re-shows
  // this same window. Without this, the user closes the window, clicks Rich
  // in the dock, and gets either nothing (overlay window holding `activate`
  // condition open) or a brand-new window + brand-new server (data loss).
  win.on("close", (event) => {
    if (process.platform === "darwin" && !(app as unknown as { isQuitting?: boolean }).isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
  const onToggleMaximize = (event: Electron.IpcMainEvent) => {
    if (event.sender === win.webContents) toggleWindowMaximize(win);
  };
  const onSetLayoutMode = (event: Electron.IpcMainEvent, mode: unknown) => {
    if (event.sender !== win.webContents || (mode !== "desktop" && mode !== "pad")) return;
    setRichWindowLayoutMode(win, mode);
  };
  ipcMain.on("rich-window:toggle-maximize", onToggleMaximize);
  ipcMain.on("rich-window:set-layout-mode", onSetLayoutMode);
  const exportDeliveryPlan = async (event: Electron.IpcMainInvokeEvent, payload: unknown) => {
    if (event.sender !== win.webContents || !payload || typeof payload !== "object") return false;
    const value = payload as { gantt?: unknown; tableRows?: unknown; filename?: unknown };
    const gantt = value.gantt as { today?: unknown; dates?: unknown; rows?: unknown } | undefined;
    if (!gantt || typeof gantt.today !== "string" || !Array.isArray(gantt.dates) || !Array.isArray(gantt.rows) || !Array.isArray(value.tableRows)) return false;
    const result = await dialog.showSaveDialog(win, {
      defaultPath: join(app.getPath("downloads"), typeof value.filename === "string" ? value.filename : "交付计划.xlsx"),
      filters: [{ name: "Excel 工作簿", extensions: ["xlsx"] }],
    });
    if (result.canceled || !result.filePath) return false;
    const workbook = new ExcelJS.Workbook();
    const ganttSheet = workbook.addWorksheet("甘特图");
    const today = gantt.today;
    const dates = gantt.dates.filter((date): date is string => typeof date === "string");
    const rows = gantt.rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
    ganttSheet.columns = [{ width: 46 }, { width: 14 }, { width: 10 }, ...dates.map(() => ({ width: 5 }))];
    ganttSheet.mergeCells("A1:A2"); ganttSheet.mergeCells("B1:B2"); ganttSheet.mergeCells("C1:C2");
    ganttSheet.getCell("A1").value = "WBS / 任务名称"; ganttSheet.getCell("B1").value = "负责人"; ganttSheet.getCell("C1").value = "进度";
    let monthStart = 0;
    while (monthStart < dates.length) {
      const month = dates[monthStart]!.slice(0, 7);
      let monthEnd = monthStart;
      while (dates[monthEnd + 1]?.startsWith(month)) monthEnd += 1;
      const first = 4 + monthStart; const last = 4 + monthEnd;
      ganttSheet.mergeCells(1, first, 1, last);
      ganttSheet.getCell(1, first).value = `${Number(month.slice(5))}月`;
      monthStart = monthEnd + 1;
    }
    dates.forEach((date, index) => { ganttSheet.getCell(2, index + 4).value = `${date === gantt.today ? "今天\n" : ""}${date.slice(5).replace("-", "/")}`; });
    const darkHeader = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF101318" } };
    for (let row = 1; row <= 2; row += 1) ganttSheet.getRow(row).eachCell({ includeEmpty: true }, cell => { cell.fill = darkHeader; cell.font = { name: "PingFang SC", size: 10, bold: true, color: { argb: "FFE2E8F0" } }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.border = { top: { style: "thin", color: { argb: "FF26364D" } }, left: { style: "thin", color: { argb: "FF26364D" } }, bottom: { style: "thin", color: { argb: "FF26364D" } }, right: { style: "thin", color: { argb: "FF26364D" } } }; });
    ganttSheet.getRow(1).height = 24; ganttSheet.getRow(2).height = 34;
    const phaseRanges = new Map<number, Record<string, unknown>>();
    rows.forEach(row => { if (row.kind === "phase" && typeof row.phaseIndex === "number") phaseRanges.set(row.phaseIndex, row); });
    const phaseColors = ["FF234A82", "FF23695A", "FF51348A", "FF765326"];
    const inRange = (date: string, start?: unknown, end?: unknown) => typeof start === "string" && typeof end === "string" && date >= start && date <= end;
    rows.forEach((item, index) => {
      const row = ganttSheet.getRow(index + 3); const phase = phaseRanges.get(typeof item.phaseIndex === "number" ? item.phaseIndex : -1);
      const title = `${"　".repeat(Math.min(4, typeof item.depth === "number" ? item.depth : 0))}${typeof item.wbsCode === "string" && item.wbsCode ? `${item.wbsCode} ` : ""}${String(item.title || "")}`;
      row.values = [title, String(item.owner || "—"), item.kind === "milestone" ? "节点" : item.kind === "risk" ? "风险" : `${Number(item.progress || 0)}%`];
      row.height = 22;
      row.eachCell({ includeEmpty: true }, cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF050505" } }; cell.font = { name: "PingFang SC", size: 10, color: { argb: "FFE2E8F0" } }; cell.alignment = { vertical: "middle", wrapText: true }; });
      dates.forEach((date, dateIndex) => {
        const cell = row.getCell(dateIndex + 4); const phaseEnd = phase?.baselineDueDate || phase?.dueDate || phase?.startDate;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF050505" } };
        if (phase && inRange(date, phase.startDate, phaseEnd)) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: phaseColors[(Number(item.phaseIndex) || 0) % phaseColors.length]! } };
        const plannedEnd = item.baselineDueDate || item.dueDate || item.startDate;
        const delayEnd = typeof item.dueDate === "string" && item.dueDate > String(plannedEnd)
          ? item.dueDate
          : !item.dueDate && String(plannedEnd) < today ? today : undefined;
        const renderedEnd = delayEnd || plannedEnd;
        if (item.kind === "milestone" && date === plannedEnd) { cell.value = "⚑"; cell.font = { name: "PingFang SC", size: 12, color: { argb: "FFFBBF24" } }; }
        else if (item.kind === "risk" && inRange(date, item.startDate || plannedEnd, plannedEnd)) { cell.value = "⚠"; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE11D48" } }; }
        else if (item.kind === "task" && inRange(date, item.startDate || renderedEnd, renderedEnd)) {
          const taskStartIndex = dates.findIndex(candidate => candidate >= String(item.startDate || plannedEnd));
          let taskEndIndex = -1;
          for (let index = dates.length - 1; index >= 0; index -= 1) if (dates[index]! <= String(plannedEnd)) { taskEndIndex = index; break; }
          const completeDateIndex = taskStartIndex + Math.ceil((taskEndIndex - taskStartIndex + 1) * Math.min(100, Math.max(0, Number(item.progress || 0))) / 100) - 1;
          const taskStyle = item.status === "blocked" ? { fill: "FFFB7185", border: "FFFDA4AF" } : item.status === "done" ? { fill: "FF00A878", border: "FF6EE7B7" } : item.status === "todo" ? { fill: "FF718096", border: "FFCBD5E1" } : { fill: dateIndex <= completeDateIndex ? "FF00A878" : "FF718096", border: "FF6EE7B7" };
          const isDelay = Boolean(delayEnd && date > String(plannedEnd));
          cell.fill = isDelay
            ? { type: "pattern", pattern: "darkTrellis", fgColor: { argb: "FFFB7185" }, bgColor: { argb: "FFE11D48" } }
            : { type: "pattern", pattern: "solid", fgColor: { argb: taskStyle.fill } };
          cell.border = { top: { style: "medium", color: { argb: isDelay ? "FFE11D48" : taskStyle.border } }, bottom: { style: "medium", color: { argb: isDelay ? "FFE11D48" : taskStyle.border } }, left: dateIndex === taskStartIndex ? { style: "medium", color: { argb: taskStyle.border } } : undefined, right: dateIndex === taskEndIndex ? { style: "medium", color: { argb: taskStyle.border } } : undefined };
        }
      });
      if (item.kind === "phase" || item.kind === "group") row.eachCell(cell => { cell.font = { name: "PingFang SC", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; });
    });
    rows.forEach((group, groupIndex) => {
      if (group.kind !== "group" || typeof group.depth !== "number") return;
      const start = group.startDate; const end = group.baselineDueDate || group.dueDate || group.startDate;
      const startDateIndex = typeof start === "string" ? dates.findIndex(date => date >= start) : -1;
      let endDateIndex = -1;
      if (typeof end === "string") for (let index = dates.length - 1; index >= 0; index -= 1) if (dates[index]! <= end) { endDateIndex = index; break; }
      if (startDateIndex < 0 || endDateIndex < startDateIndex) return;
      let lastRowIndex = groupIndex;
      for (let index = groupIndex + 1; index < rows.length && Number(rows[index]!.depth) > group.depth; index += 1) lastRowIndex = index;
      const top = groupIndex + 3; const bottom = lastRowIndex + 3; const left = startDateIndex + 4; const right = endDateIndex + 4;
      const color = ["FF38BDF8", "FFB15CFF", "FFF59E0B", "FF34D399"][Math.max(0, Number(group.depth) - 1) % 4]!;
      for (let rowNumber = top; rowNumber <= bottom; rowNumber += 1) {
        for (let columnNumber = left; columnNumber <= right; columnNumber += 1) {
          const cell = ganttSheet.getCell(rowNumber, columnNumber);
          cell.border = { top: rowNumber === top ? { style: "mediumDashed", color: { argb: color } } : undefined, bottom: rowNumber === bottom ? { style: "mediumDashed", color: { argb: color } } : undefined, left: columnNumber === left ? { style: "mediumDashed", color: { argb: color } } : undefined, right: columnNumber === right ? { style: "mediumDashed", color: { argb: color } } : undefined };
        }
      }
    });
    for (let rowNumber = 3; rowNumber <= rows.length + 2; rowNumber += 1) for (let columnNumber = 4; columnNumber <= dates.length + 3; columnNumber += 1) {
      const cell = ganttSheet.getCell(rowNumber, columnNumber);
      const item = rows[rowNumber - 3]; const plannedEnd = item?.baselineDueDate || item?.dueDate || item?.startDate;
      const delayEnd = typeof item?.dueDate === "string" && item.dueDate > String(plannedEnd)
        ? item.dueDate
        : !item?.dueDate && String(plannedEnd) < today ? today : undefined;
      const renderedEnd = delayEnd || plannedEnd;
      const isTaskBar = item?.kind === "task" && inRange(dates[columnNumber - 4]!, item.startDate || renderedEnd, renderedEnd);
      if (!isTaskBar && !cell.border?.left) cell.border = { ...cell.border, left: { style: "thin", color: { argb: "FF6B7280" } } };
    }
    rows.forEach((item, index) => {
      if (item.kind !== "task") return;
      const plannedEnd = item.baselineDueDate || item.dueDate || item.startDate;
      const delayEnd = typeof item.dueDate === "string" && item.dueDate > String(plannedEnd)
        ? item.dueDate
        : !item.dueDate && String(plannedEnd) < today ? today : undefined;
      const renderedEnd = delayEnd || plannedEnd;
      const startIndex = dates.findIndex(date => date >= String(item.startDate || plannedEnd));
      let plannedEndIndex = -1;
      for (let dateIndex = dates.length - 1; dateIndex >= 0; dateIndex -= 1) if (dates[dateIndex]! <= String(plannedEnd)) { plannedEndIndex = dateIndex; break; }
      let endIndex = -1;
      for (let dateIndex = dates.length - 1; dateIndex >= 0; dateIndex -= 1) if (dates[dateIndex]! <= String(renderedEnd)) { endIndex = dateIndex; break; }
      if (startIndex < 0 || endIndex < startIndex) return;
      const border = item.status === "blocked" ? "FFFDA4AF" : item.status === "todo" ? "FFCBD5E1" : "FF6EE7B7";
      for (let dateIndex = startIndex; dateIndex <= endIndex; dateIndex += 1) {
        const isDelay = Boolean(delayEnd && dateIndex > plannedEndIndex);
        const edgeColor = isDelay ? "FFE11D48" : border;
        ganttSheet.getCell(index + 3, dateIndex + 4).border = { top: { style: "medium", color: { argb: edgeColor } }, bottom: { style: "medium", color: { argb: edgeColor } }, left: dateIndex === startIndex ? { style: "medium", color: { argb: border } } : undefined, right: dateIndex === plannedEndIndex ? { style: "medium", color: { argb: border } } : dateIndex === endIndex ? { style: "medium", color: { argb: edgeColor } } : undefined };
      }
    });
    const todayColumn = dates.indexOf(gantt.today) + 4;
    if (todayColumn >= 4) for (let rowNumber = 1; rowNumber <= rows.length + 2; rowNumber += 1) {
      const cell = ganttSheet.getCell(rowNumber, todayColumn);
      cell.border = { ...cell.border, left: { style: "medium", color: { argb: "FFFB7185" } } };
    }
    ganttSheet.views = [{ state: "frozen", xSplit: 3, ySplit: 2, showGridLines: false }];
    const tableSheet = workbook.addWorksheet("Excel 列表");
    for (const row of value.tableRows) if (Array.isArray(row)) tableSheet.addRow(row.map(cell => typeof cell === "string" || typeof cell === "number" ? cell : ""));
    tableSheet.views = [{ state: "frozen", ySplit: 1 }];
    tableSheet.columns = [34, 24, 12, 12, 12, 14, 14, 14, 14, 14, 12, 32, 14].map(width => ({ width }));
    tableSheet.autoFilter = { from: "A1", to: `M${Math.max(1, tableSheet.rowCount)}` };
    tableSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.height = rowNumber === 1 ? 28 : 22;
      row.eachCell(cell => {
        cell.alignment = { vertical: "middle", wrapText: true };
        cell.border = { top: { style: "thin", color: { argb: "FFD8E1EC" } }, left: { style: "thin", color: { argb: "FFD8E1EC" } }, bottom: { style: "thin", color: { argb: "FFD8E1EC" } }, right: { style: "thin", color: { argb: "FFD8E1EC" } } };
        cell.font = { name: "PingFang SC", size: 10, color: { argb: "FF243B53" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowNumber % 2 === 0 ? "FFF7FAFC" : "FFFFFFFF" } };
      });
      if (rowNumber === 1) {
        row.eachCell(cell => { cell.font = { name: "PingFang SC", size: 11, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { horizontal: "center", vertical: "middle" }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17365D" } }; });
        return;
      }
      const type = String(row.getCell(2).value || "");
      const title = row.getCell(1);
      const depth = Math.min(4, (String(title.value || "").match(/\./g) || []).length);
      title.alignment = { vertical: "middle", wrapText: true, indent: depth };
      if (type.startsWith("阶段")) row.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCEBFF" } }; cell.font = { name: "PingFang SC", size: 10, bold: true, color: { argb: "FF174EA6" } }; });
      else if (type.startsWith("分组")) row.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6FFFA" } }; cell.font = { name: "PingFang SC", size: 10, bold: true, color: { argb: "FF0F766E" } }; });
      else if (type.startsWith("里程碑")) row.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7D6" } }; });
      else if (type.startsWith("风险点")) row.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF0F1" } }; cell.font = { name: "PingFang SC", size: 10, color: { argb: "FFB42318" } }; });
      const status = row.getCell(3);
      const statusColor = status.value === "已完成" ? "FFDCFCE7" : status.value === "进行中" ? "FFDBEAFE" : status.value === "已阻塞" ? "FFFEE2E2" : "FFFEF3C7";
      status.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusColor } };
      status.font = { name: "PingFang SC", size: 10, bold: true, color: { argb: "FF243B53" } };
      status.alignment = { horizontal: "center", vertical: "middle" };
    });
    await workbook.xlsx.writeFile(result.filePath);
    return true;
  };
  ipcMain.handle("rich-delivery-plan:export", exportDeliveryPlan);
  win.on("closed", () => {
    ipcMain.removeListener("rich-window:toggle-maximize", onToggleMaximize);
    ipcMain.removeListener("rich-window:set-layout-mode", onSetLayoutMode);
    ipcMain.removeHandler("rich-delivery-plan:export");
    if (mainWindow === win) mainWindow = null;
  });
  // While maximized, make the strip a regular transparent element so its
  // double-click event explicitly restores the window. In normal size it is
  // a native drag region again, preserving the usual macOS window movement.
  win.on("maximize", () => setTopDragRegionMode(win, "no-drag"));
  win.on("unmaximize", () => setTopDragRegionMode(win, "drag"));
  mainWindow = win;
  if (savedState?.dockedSide && !savedState.maximized) {
    edgeDockState = { side: savedState.dockedSide, bounds: savedState.bounds };
    edgeDockIsCollapsed = savedState.dockedCollapsed === true;
  }
  setupMainWindowStatePersistence(win);
  setupEdgeDock(win);

  // Open external links in the default browser, not new Electron windows.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (handleRichWindowCommand(url, win)) return { action: "deny" };
    if (url.startsWith("rich://navigate")) {
      void navigateMainWindowFromUrl(url);
      return { action: "deny" };
    }
    if (openRichExternalUrl(url)) return { action: "deny" };
    if (url.startsWith("http://127.0.0.1:") || url.startsWith("http://localhost:")) return { action: "allow" };
    openExternalTarget(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(`http://127.0.0.1:${port}/`) || url.startsWith(`http://localhost:${port}/`)) return;
    event.preventDefault();
    if (handleRichWindowCommand(url, win)) return;
    if (url.startsWith("rich://navigate")) {
      void navigateMainWindowFromUrl(url);
      return;
    }
    if (openRichExternalUrl(url)) return;
    openExternalTarget(url);
  });

  // Default the UI to 80% zoom — the source design was tuned for a denser
  // layout. Re-apply on every navigation so SPA route changes don't reset
  // zoom (Chromium binds zoom per-origin; setting on did-finish-load is the
  // most reliable hook). Users can override via Cmd +/− at runtime.
  const DEFAULT_ZOOM = 0.8;
  win.webContents.on("did-finish-load", () => {
    win.webContents.setZoomFactor(DEFAULT_ZOOM);
    // Every full-screen view gets a real top drag strip. Several screens
    // intentionally reserve blank top padding for the macOS traffic lights;
    // styling only their visible header left that padding non-draggable.
    // Start after the traffic lights so their native controls stay usable.
    win.webContents.executeJavaScript(`(() => {
      let region = document.getElementById("rich-window-drag-region");
      if (!region) {
        region = document.createElement("div");
        region.id = "rich-window-drag-region";
        region.setAttribute("aria-hidden", "true");
        document.body.prepend(region);
      }
      Object.assign(region.style, {
        position: "fixed",
        top: "0",
        left: "88px",
        right: "0",
        height: "56px",
        zIndex: "2147483646",
        WebkitAppRegion: "drag",
        pointerEvents: "none",
        userSelect: "none",
      });
      if (!region.dataset.richWindowRestoreHandler) {
        region.dataset.richWindowRestoreHandler = "true";
        region.addEventListener("dblclick", () => {
          window.richWindow?.toggleMaximize?.();
        });
      }
    })()`).catch(() => { /* renderer can be gone while reloading */ });
    // Chromeless top: reserve space for the macOS traffic lights at the
    // top-left of the TopBar, and make the bar itself act as a drag
    // handle (-webkit-app-region: drag). Buttons / links / inputs inside
    // get app-region: no-drag so they stay clickable.
    // The existing left rail (.learning-sidebar) now spans the full window
    // height and absorbs the macOS traffic-light area at its top (theme
    // CSS reserves 36px of top padding). Both the rail AND the TopBar
    // become drag regions for the window; interactive elements opt out.
    win.webContents.insertCSS(`
      .tv-topbar,
      .learning-sidebar,
      .prj-ws__head,
      .prj-ws__nav,
      .prj__head,
      .apps-launcher__head,
      .app-launcher__head,
      .app-launcher__header,
      .mini-apps__head,
      .mini-apps-header,
      .riking-projects__head,
      .rkp-header,
      .health-view__head,
      .health-header,
      .gm-shell__head,
      .mindmap-view__head,
      .practice-view__head,
      .practice-workspace__head,
      .toolbox-view__head,
      .toolbox-head,
      .admin-view__head,
      .news-page-head,
      [data-window-drag-region="true"] {
        -webkit-app-region: drag;
        user-select: none;
      }
      /* The deep workbench has a full-width interactive header at the top of
         the window. Its own header is the drag handle so the global overlay
         never covers the outline/mindmap mode switch. */
      body:has(.deep-canvas) #rich-window-drag-region {
        display: none;
      }
      body:has(.pfc--standalone .pfc-task.is-expanded) #rich-window-drag-region {
        display: none;
      }
      .deep-canvas__header {
        -webkit-app-region: drag;
        user-select: none;
      }
      .tv-topbar button,
      .tv-topbar a,
      .tv-topbar input,
      .tv-topbar select,
      .tv-topbar [role="button"],
      .tv-topbar [contenteditable="true"],
      .learning-sidebar button,
      .learning-sidebar a,
      .learning-sidebar input,
      .learning-sidebar select,
      .learning-sidebar [role="button"],
      .learning-sidebar [contenteditable="true"],
      .learning-sidebar [draggable="true"],
      .learning-sidebar [data-draggable],
      .prj-ws__head button,
      .prj-ws__head a,
      .prj-ws__head input,
      .prj-ws__head textarea,
      .prj-ws__head select,
      .prj-ws__head [role="button"],
      .prj-ws__head [role="tab"],
      .prj-ws__head [contenteditable="true"],
      .prj__head button,
      .prj__head a,
      .prj__head input,
      .prj__head textarea,
      .prj__head select,
      .apps-launcher__head button,
      .apps-launcher__head a,
      .apps-launcher__head input,
      .app-launcher__head button,
      .app-launcher__head a,
      .app-launcher__head input,
      .app-launcher__header button,
      .app-launcher__header a,
      .app-launcher__header input,
      .mini-apps__head button,
      .mini-apps__head a,
      .mini-apps__head input,
      .mini-apps-header button,
      .mini-apps-header a,
      .mini-apps-header input,
      .riking-projects__head button,
      .riking-projects__head a,
      .riking-projects__head input,
      .rkp-header button,
      .rkp-header a,
      .rkp-header input,
      .health-view__head button,
      .health-view__head a,
      .health-view__head input,
      .health-header button,
      .health-header a,
      .health-header input,
      .gm-shell__head button,
      .gm-shell__head a,
      .gm-shell__head input,
      .mindmap-view__head button,
      .mindmap-view__head a,
      .mindmap-view__head input,
      .practice-view__head button,
      .practice-view__head a,
      .practice-view__head input,
      .practice-workspace__head button,
      .practice-workspace__head a,
      .practice-workspace__head input,
      .toolbox-view__head button,
      .toolbox-view__head a,
      .toolbox-view__head input,
      .toolbox-head button,
      .toolbox-head a,
      .toolbox-head input,
      .admin-view__head button,
      .admin-view__head a,
      .admin-view__head input,
      .news-page-head button,
      .news-page-head a,
      .news-page-head input,
      .deep-canvas__header button,
      .deep-canvas__header a,
      .deep-canvas__header input,
      .deep-canvas__header textarea,
      .deep-canvas__header select,
      [data-window-drag-region="true"] button,
      [data-window-drag-region="true"] a,
      [data-window-drag-region="true"] input,
      [data-window-drag-region="true"] textarea,
      [data-window-drag-region="true"] select,
      [data-window-drag-region="true"] [role="button"],
      [data-window-drag-region="true"] [role="tab"],
      [data-window-drag-region="true"] [contenteditable="true"] {
        -webkit-app-region: no-drag;
      }
    `).catch(() => { /* SPA route changes may race; ignore */ });
    // A native drag region normally handles a double-click itself. This
    // renderer fallback covers view headers that do not expose such a region
    // (including future pages) without stealing double-clicks from controls.
    // It stays installed for the lifetime of the SPA, so view switches do not
    // need page-specific maximize handlers.
    win.webContents.executeJavaScript(`(() => {
      if (window.__richWindowHeaderDblClickInstalled) return;
      window.__richWindowHeaderDblClickInstalled = true;
      document.addEventListener("dblclick", (event) => {
        if (event.clientY > 120) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target || target.closest("button, a, input, textarea, select, [role='button'], [role='tab'], [contenteditable='true']")) return;
        if (target.closest(".deliverable-codex-workbench")) return;
        if (!target.closest("header, [data-window-drag-region='true']")) return;
        event.preventDefault();
        event.stopPropagation();
        window.richWindow?.toggleMaximize?.();
      }, true);
    })()`).catch(() => { /* renderer can be gone while reloading */ });
  });

  // Wire Cmd +/= , Cmd - , Cmd 0 zoom shortcuts so the user can still adjust.
  win.webContents.on("before-input-event", (event, input) => {
    // Some custom drag regions do not forward the native double-click to the
    // renderer. Handle the universal top strip in the main process as well.
    const mouseInput = input as typeof input & { clickCount?: number; x?: number; y?: number };
    if (input.type === "mouseDown" && mouseInput.clickCount === 2 && mouseInput.y !== undefined && mouseInput.y <= 56 && mouseInput.x !== undefined && mouseInput.x >= 88) {
      toggleWindowMaximize(win);
      event.preventDefault();
      return;
    }
    if (input.type !== "keyDown") return;
    // When Rich is already the foreground app, keep these shortcuts local to
    // this window. The global Shift+Cmd+Space registration would otherwise
    // consume Cmd+Space before Electron can deliver it here.
    if (input.shift && (input.meta || input.control) && (input.code === "Space" || input.key === " ")) {
      toggleRichMainWindow(win);
      event.preventDefault();
      return;
    }
    if (input.shift && (input.meta || input.control) && (input.code === "KeyP" || input.key.toLowerCase() === "p")) {
      win.webContents.executeJavaScript("window.dispatchEvent(new Event('rich:toggle-control-center'))")
        .catch(() => { /* renderer can be navigating */ });
      event.preventDefault();
      return;
    }
    if (!input.shift && (input.meta || input.control) && (input.code === "Space" || input.key === " ")) {
      openDeliverableCodex(win);
      event.preventDefault();
      return;
    }
    if (
      input.shift &&
      (input.meta || input.control) &&
      (input.key === "0" || input.key === ")" || input.code === "Digit0")
    ) {
      toggleOverlay();
      event.preventDefault();
      return;
    }
    // Cmd+Esc → return to home. Caught here in the main process so it
    // can't be eaten by focused inputs / textareas / nested keydown
    // handlers in the renderer. We re-fire it on the renderer's
    // `window` with a synthetic event the App-level handler still
    // recognises (key=Escape + metaKey=true).
    if (input.key === "Escape" && (input.meta || input.control)) {
      win.webContents.executeJavaScript(
        `(() => {
          // Mirrors the App.tsx Cmd+Esc handler: snap to tree view and
          // clear rootId via the Zustand store. The store is exposed
          // on window in dev (Zustand devtools); fall back to dispatching
          // a synthetic keydown so the App handler picks it up.
          try {
            const evt = new KeyboardEvent("keydown", {
              key: "Escape", code: "Escape", metaKey: true, bubbles: true,
            });
            window.dispatchEvent(evt);
          } catch (e) { /* ignore */ }
        })();`,
      ).catch(() => { /* SPA loads may race; ignore */ });
      event.preventDefault();
      return;
    }
    if (!input.meta) return;
    const cur = win.webContents.getZoomFactor();
    if (input.key === "=" || input.key === "+") {
      win.webContents.setZoomFactor(Math.min(cur + 0.1, 2));
      event.preventDefault();
    } else if (input.key === "-") {
      win.webContents.setZoomFactor(Math.max(cur - 0.1, 0.3));
      event.preventDefault();
    } else if (input.key === "0") {
      win.webContents.setZoomFactor(DEFAULT_ZOOM);
      event.preventDefault();
    }
  });

  // Wait for the server to be reachable (it's racing with us during cold start).
  for (let i = 0; i < 50; i++) {
    if (await ping(port)) break;
    await sleep(100);
  }
  await win.webContents.session.clearCache();
  await win.loadURL(`http://127.0.0.1:${port}/`);
  return win;
}

// ----- Step 4.5: Global transparent overlay ------------------------------
// A separate always-on-top, mouse-transparent task monitor. It loads the same
// web origin in a dedicated #overlay route so it can read the persisted task
// list without stealing focus or intercepting clicks from other apps.
/** Module-level reference to the single main window. Hoisted out of the
 *  whenReady closure so the dock-activate handler can re-show it instead
 *  of creating a new window (and a new server) every time. */
let mainWindow: BrowserWindow | null = null;
/** Cached server port for the lifetime of this process — re-used when the
 *  dock activate handler has to recreate the window after window-all-closed. */
let serverPort: number | null = null;

// ----- Edge dock ---------------------------------------------------------
// A docked Rich window is still a regular window while it has focus. When the
// user moves to another app, we hide it and leave a small, non-focusable glow
// at the screen edge. Polling the cursor here is deliberate: the glow must not
// intercept a click from the app beneath it.
type EdgeDockSide = "left" | "right";
type EdgeDockState = { side: EdgeDockSide; bounds: Electron.Rectangle };
const EDGE_DOCK_SNAP_DISTANCE = 24;
const EDGE_DOCK_GLOW_WIDTH = 6;
const EDGE_DOCK_CURSOR_INTERVAL = 90;
const EDGE_DOCK_ANIMATION_DURATION = 180;
let edgeDockState: EdgeDockState | null = null;
let edgeDockGlowWindow: BrowserWindow | null = null;
let edgeDockCursorPoller: NodeJS.Timeout | null = null;
let edgeDockIsCollapsed = false;
let edgeDockIsAnimating = false;
let edgeDockAnimationTimer: NodeJS.Timeout | null = null;
let richWindowLayoutMode: WindowLayoutMode = "desktop";
let richLastWindowedLayoutMode: RememberedWindowLayoutMode = "desktop";
let richDesktopBounds: Electron.Rectangle | null = null;
let richPadBounds: Electron.Rectangle | null = null;

function setRichWindowLayoutMode(win: BrowserWindow, mode: WindowLayoutMode): void {
  if (win.isDestroyed() || richWindowLayoutMode === mode) return;

  if (richWindowLayoutMode === "pad") richPadBounds = win.getNormalBounds();
  if (richWindowLayoutMode === "desktop") richDesktopBounds = win.getNormalBounds();
  if (win.isFullScreen()) win.setFullScreen(false);
  edgeDockState = null;
  edgeDockIsCollapsed = false;
  hideEdgeDockGlow();

  if (mode === "fullscreen") {
    richWindowLayoutMode = mode;
    win.setMinimumSize(MAIN_WINDOW_MIN_WIDTH, MAIN_WINDOW_MIN_HEIGHT);
    win.setFullScreen(true);
    saveMainWindowState(win);
    return;
  }

  richLastWindowedLayoutMode = mode;
  if (mode === "pad") {
    richWindowLayoutMode = mode;
    win.setMinimumSize(PAD_WINDOW_MIN_WIDTH, PAD_WINDOW_MIN_HEIGHT);
    const current = richPadBounds ?? win.getBounds();
    const workArea = screen.getDisplayNearestPoint({ x: current.x, y: current.y }).workArea;
    const width = Math.min(Math.max(PAD_WINDOW_MIN_WIDTH, richPadBounds?.width ?? PAD_WINDOW_WIDTH), workArea.width);
    const height = Math.min(Math.max(PAD_WINDOW_MIN_HEIGHT, richPadBounds?.height ?? PAD_WINDOW_HEIGHT), workArea.height);
    win.setBounds({
      x: richPadBounds ? Math.min(Math.max(richPadBounds.x, workArea.x), workArea.x + workArea.width - width) : Math.round(workArea.x + (workArea.width - width) / 2),
      y: richPadBounds ? Math.min(Math.max(richPadBounds.y, workArea.y), workArea.y + workArea.height - height) : Math.round(workArea.y + (workArea.height - height) / 2),
      width,
      height,
    });
  } else {
    richWindowLayoutMode = mode;
    win.setMinimumSize(MAIN_WINDOW_MIN_WIDTH, MAIN_WINDOW_MIN_HEIGHT);
    if (richDesktopBounds) win.setBounds(richDesktopBounds);
  }
  saveMainWindowState(win);
}

function pointIsInsideBounds(point: Electron.Point, bounds: Electron.Rectangle): boolean {
  return point.x >= bounds.x && point.x < bounds.x + bounds.width
    && point.y >= bounds.y && point.y < bounds.y + bounds.height;
}

function edgeDockGlowBounds(state: EdgeDockState): Electron.Rectangle {
  const display = screen.getDisplayNearestPoint({ x: state.bounds.x, y: state.bounds.y });
  const workArea = display.workArea;
  return {
    x: state.side === "left" ? workArea.x : workArea.x + workArea.width - EDGE_DOCK_GLOW_WIDTH,
    y: state.bounds.y,
    width: EDGE_DOCK_GLOW_WIDTH,
    height: state.bounds.height,
  };
}

function createEdgeDockGlowWindow(): BrowserWindow {
  const glow = new BrowserWindow({
    width: EDGE_DOCK_GLOW_WIDTH,
    height: 320,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  glow.setIgnoreMouseEvents(true);
  glow.setAlwaysOnTop(true, "floating");
  glow.loadURL(`data:text/html,${encodeURIComponent(`<!doctype html><style>html,body{margin:0;width:100%;height:100%;background:transparent;overflow:hidden}body{background:linear-gradient(90deg,transparent 0%,rgba(215,224,238,.35) 36%,rgba(245,248,255,.96) 50%,rgba(215,224,238,.35) 64%,transparent 100%);box-shadow:0 0 7px rgba(214,225,255,.95),0 0 20px rgba(171,193,255,.55)}</style>`)}`).catch(() => {});
  return glow;
}

function hideEdgeDockGlow() {
  if (edgeDockGlowWindow && !edgeDockGlowWindow.isDestroyed()) edgeDockGlowWindow.hide();
}

function showEdgeDockGlow() {
  if (!edgeDockState) return;
  if (!edgeDockGlowWindow || edgeDockGlowWindow.isDestroyed()) edgeDockGlowWindow = createEdgeDockGlowWindow();
  edgeDockGlowWindow.setBounds(edgeDockGlowBounds(edgeDockState));
  edgeDockGlowWindow.showInactive();
}

function edgeDockHiddenBounds(state: EdgeDockState): Electron.Rectangle {
  const display = screen.getDisplayNearestPoint({ x: state.bounds.x, y: state.bounds.y });
  const workArea = display.workArea;
  return {
    ...state.bounds,
    x: state.side === "left"
      ? workArea.x - state.bounds.width + EDGE_DOCK_GLOW_WIDTH
      : workArea.x + workArea.width - EDGE_DOCK_GLOW_WIDTH,
  };
}

function animateEdgeDockBounds(
  win: BrowserWindow,
  from: Electron.Rectangle,
  to: Electron.Rectangle,
  onComplete: () => void,
) {
  if (edgeDockAnimationTimer) clearTimeout(edgeDockAnimationTimer);
  edgeDockIsAnimating = true;
  const startedAt = Date.now();
  const tick = () => {
    if (win.isDestroyed()) {
      edgeDockIsAnimating = false;
      return;
    }
    const progress = Math.min(1, (Date.now() - startedAt) / EDGE_DOCK_ANIMATION_DURATION);
    const eased = 1 - (1 - progress) ** 3;
    win.setBounds({
      ...from,
      x: Math.round(from.x + (to.x - from.x) * eased),
      y: Math.round(from.y + (to.y - from.y) * eased),
    });
    if (progress < 1) {
      edgeDockAnimationTimer = setTimeout(tick, 16);
      return;
    }
    edgeDockAnimationTimer = null;
    edgeDockIsAnimating = false;
    onComplete();
  };
  tick();
}

function collapseEdgeDockWindow(win: BrowserWindow) {
  if (!edgeDockState || edgeDockIsAnimating || win.isDestroyed() || !win.isVisible() || win.isFocused()) return;
  edgeDockState.bounds = win.getBounds();
  const state = edgeDockState;
  animateEdgeDockBounds(win, state.bounds, edgeDockHiddenBounds(state), () => {
    if (win.isFocused()) {
      win.setBounds(state.bounds);
      return;
    }
    edgeDockIsCollapsed = true;
    win.hide();
    showEdgeDockGlow();
  });
}

function expandEdgeDockWindow(win: BrowserWindow) {
  if (!edgeDockState || edgeDockIsAnimating || win.isDestroyed() || win.isVisible()) return;
  const state = edgeDockState;
  edgeDockIsCollapsed = false;
  hideEdgeDockGlow();
  const hiddenBounds = edgeDockHiddenBounds(state);
  win.setBounds(hiddenBounds);
  // Do not take focus from the app the user is using. A click inside Rich is
  // the explicit signal that it should stay expanded.
  win.showInactive();
  animateEdgeDockBounds(win, hiddenBounds, state.bounds, () => {});
}

function snapMainWindowToEdge(win: BrowserWindow) {
  if (edgeDockIsAnimating || win.isDestroyed() || win.isMaximized() || !win.isVisible()) return;
  const bounds = win.getBounds();
  const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
  const workArea = display.workArea;
  const leftDistance = Math.abs(bounds.x - workArea.x);
  const rightDistance = Math.abs(bounds.x + bounds.width - (workArea.x + workArea.width));
  const side: EdgeDockSide | null = leftDistance <= EDGE_DOCK_SNAP_DISTANCE
    ? "left"
    : rightDistance <= EDGE_DOCK_SNAP_DISTANCE ? "right" : null;

  if (!side) {
    edgeDockState = null;
    edgeDockIsCollapsed = false;
    hideEdgeDockGlow();
    return;
  }

  const snapped = {
    ...bounds,
    x: side === "left" ? workArea.x : workArea.x + workArea.width - bounds.width,
    y: Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - bounds.height),
  };
  edgeDockState = { side, bounds: snapped };
  if (bounds.x !== snapped.x || bounds.y !== snapped.y) win.setBounds(snapped);
}

function setupEdgeDock(mainWin: BrowserWindow) {
  mainWin.on("move", () => snapMainWindowToEdge(mainWin));
  mainWin.on("resize", () => snapMainWindowToEdge(mainWin));
  mainWin.on("focus", () => {
    edgeDockIsCollapsed = false;
    hideEdgeDockGlow();
  });
  mainWin.on("blur", () => setTimeout(() => collapseEdgeDockWindow(mainWin), 80));
  mainWin.on("hide", () => {
    if (!edgeDockIsCollapsed) hideEdgeDockGlow();
  });
  edgeDockCursorPoller ??= setInterval(() => {
    if (!edgeDockState || edgeDockIsAnimating || mainWin.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();
    if (!mainWin.isVisible()) {
      if (pointIsInsideBounds(cursor, edgeDockGlowBounds(edgeDockState))) expandEdgeDockWindow(mainWin);
      return;
    }
    if (!mainWin.isFocused() && !pointIsInsideBounds(cursor, mainWin.getBounds())) collapseEdgeDockWindow(mainWin);
  }, EDGE_DOCK_CURSOR_INTERVAL);
  app.on("will-quit", () => {
    if (edgeDockCursorPoller) clearInterval(edgeDockCursorPoller);
    edgeDockCursorPoller = null;
    if (edgeDockAnimationTimer) clearTimeout(edgeDockAnimationTimer);
    edgeDockAnimationTimer = null;
    if (edgeDockGlowWindow && !edgeDockGlowWindow.isDestroyed()) edgeDockGlowWindow.destroy();
  });
}

let overlayWindows: BrowserWindow[] = [];
let breakReminderWindows: BrowserWindow[] = [];
let breakReminderUntil = 0;
let breakReminderPoller: NodeJS.Timeout | null = null;

/** Spotlight-style chat overlay window. Created lazily on first invocation
 *  of the Cmd+~ shortcut, then kept alive (hidden on Esc/blur)
 *  so the conversation state in the renderer survives across opens. */
let chatWindow: BrowserWindow | null = null;
let overlayVisible = false;
let overlayPort: number | null = null;
const OVERLAY_WINDOW_WIDTH = 440;
const OVERLAY_WINDOW_HEIGHT = 520;
const OVERLAY_WINDOW_MARGIN = 18;
const OVERLAY_TRANSPARENT_CSS = `
  html,
  body,
  #root {
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    overflow: hidden !important;
    background: transparent !important;
  }
  body::before,
  body::after,
  #root::before,
  #root::after {
    display: none !important;
    content: none !important;
    background: transparent !important;
  }
`;

function createOverlayWindow(bounds: Electron.Rectangle, port: number): BrowserWindow {
  const width = Math.min(OVERLAY_WINDOW_WIDTH, Math.max(300, bounds.width - OVERLAY_WINDOW_MARGIN * 2));
  const height = Math.min(OVERLAY_WINDOW_HEIGHT, Math.max(260, bounds.height - OVERLAY_WINDOW_MARGIN * 2));
  const x = bounds.x + bounds.width - width - OVERLAY_WINDOW_MARGIN;
  const y = bounds.y + bounds.height - height - OVERLAY_WINDOW_MARGIN;

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setIgnoreMouseEvents(true);
  win.on("show", () => win.setIgnoreMouseEvents(true));
  win.setAlwaysOnTop(true, "screen-saver", 1);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.webContents.on("did-finish-load", () => {
    win.webContents.insertCSS(OVERLAY_TRANSPARENT_CSS).catch(() => {});
  });
  win.loadURL(`http://127.0.0.1:${port}/#overlay`).catch(() => {});
  return win;
}

function rebuildOverlayWindows() {
  if (overlayPort === null) return;
  for (const win of overlayWindows) {
    if (!win.isDestroyed()) win.destroy();
  }
  overlayWindows = screen.getAllDisplays().map(display => createOverlayWindow(display.bounds, overlayPort!));
  if (overlayVisible) {
    for (const win of overlayWindows) win.showInactive();
  }
}

function setOverlayVisible(visible: boolean) {
  overlayVisible = visible;
  if (overlayWindows.length === 0) rebuildOverlayWindows();
  for (const win of overlayWindows) {
    if (win.isDestroyed()) continue;
    if (visible) {
      win.setAlwaysOnTop(true, "screen-saver", 1);
      win.showInactive();
    } else {
      win.hide();
    }
  }
  console.log(`[ke-desktop] overlay ${visible ? "shown" : "hidden"}`);
}

function toggleOverlay() {
  setOverlayVisible(!overlayVisible);
}

function showRichMainWindow(mainWin: BrowserWindow) {
  if (mainWin.isDestroyed()) return;
  ensureDockApplication("show main window");
  edgeDockIsCollapsed = false;
  hideEdgeDockGlow();
  if (process.platform === "darwin") app.show();
  if (mainWin.isMinimized()) mainWin.restore();
  if (!mainWin.isVisible() && edgeDockState) mainWin.setBounds(edgeDockState.bounds);
  if (!mainWin.isVisible()) mainWin.show();
  mainWin.moveTop();
  mainWin.focus();
  app.focus({ steal: true });
}

function openDeliverableCodex(mainWin: BrowserWindow) {
  if (mainWin.isDestroyed()) return;
  mainWin.webContents.executeJavaScript(`window.dispatchEvent(new Event("rich:toggle-deliverable-codex"));`)
    .catch(() => { /* renderer may be navigating */ });
}

function toggleRichMainWindow(mainWin: BrowserWindow) {
  if (mainWin.isDestroyed()) return;
  if (mainWin.isVisible() && mainWin.isFocused() && !mainWin.isMinimized()) {
    mainWin.hide();
    return;
  }
  showRichMainWindow(mainWin);
}

function setupRichSummonShortcut(mainWin: BrowserWindow) {
  const shortcuts = ["CommandOrControl+Shift+Space"];
  const accelerator = shortcuts[0]!;
  const registerShortcut = () => {
    if (mainWin.isDestroyed() || mainWin.isFocused() || globalShortcut.isRegistered(accelerator)) return;
    const ok = globalShortcut.register(accelerator, () => toggleRichMainWindow(mainWin));
    console.log(`[ke-desktop] summon shortcut ${accelerator}: ${ok ? "registered" : "failed"}`);
    if (!ok) {
      console.warn(`[ke-desktop] summon shortcut ${accelerator} failed; another app may already own it.`);
    }
  };
  const unregisterShortcut = () => globalShortcut.unregister(accelerator);
  mainWin.on("focus", unregisterShortcut);
  mainWin.on("blur", registerShortcut);
  registerShortcut();
  app.on("will-quit", () => {
    globalShortcut.unregister(accelerator);
  });
}

function setupEdgeDockNavigationShortcuts(mainWin: BrowserWindow) {
  const shortcuts = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  let registered = false;
  const dispatchViewShortcut = (key: string) => {
    const code = key === "0" ? "Digit0" : `Digit${key}`;
    const modifier = process.platform === "darwin" ? "metaKey" : "ctrlKey";
    mainWin.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(key)}, code: ${JSON.stringify(code)}, ${modifier}: true, bubbles: true }))`)
      .catch(() => { /* renderer may be navigating */ });
  };
  const refresh = () => {
    const shouldRegister = Boolean(edgeDockState && mainWin.isVisible() && !mainWin.isFocused());
    if (shouldRegister && !registered) {
      registered = true;
      for (const key of shortcuts) {
        const accelerator = `CommandOrControl+${key}`;
        const ok = globalShortcut.register(accelerator, () => dispatchViewShortcut(key));
        if (!ok) console.warn(`[ke-desktop] edge dock shortcut ${accelerator} is unavailable`);
      }
    } else if (!shouldRegister && registered) {
      for (const key of shortcuts) globalShortcut.unregister(`CommandOrControl+${key}`);
      registered = false;
    }
  };
  mainWin.on("show", refresh);
  mainWin.on("focus", refresh);
  mainWin.on("blur", () => setTimeout(refresh, 0));
  mainWin.on("hide", refresh);
  app.on("will-quit", () => {
    for (const key of shortcuts) globalShortcut.unregister(`CommandOrControl+${key}`);
  });
}

function setupOverlayControls(port: number) {
  overlayPort = port;
  rebuildOverlayWindows();
  screen.on("display-added", rebuildOverlayWindows);
  screen.on("display-removed", rebuildOverlayWindows);
  screen.on("display-metrics-changed", rebuildOverlayWindows);

  const shortcuts = ["CommandOrControl+Shift+0"];
  for (const accelerator of shortcuts) {
    const ok = globalShortcut.register(accelerator, toggleOverlay);
    console.log(`[ke-desktop] overlay shortcut ${accelerator}: ${ok ? "registered" : "failed"}`);
  }
  app.on("will-quit", () => {
    for (const accelerator of shortcuts) globalShortcut.unregister(accelerator);
  });
}

// ----- Mandatory break reminder -----------------------------------------
// The server owns the work/rest schedule. Polling its tiny local status
// endpoint from Electron lets the reminder outlive the main window being
// minimized or hidden, without giving the renderer Node / IPC privileges.
function createBreakReminderWindow(bounds: Electron.Rectangle, port: number, until: number): BrowserWindow {
  const win = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    frame: false, fullscreenable: false, resizable: false, movable: false,
    minimizable: false, maximizable: false, skipTaskbar: true, focusable: false,
    backgroundColor: "#07121a", show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setIgnoreMouseEvents(true);
  win.setAlwaysOnTop(true, "screen-saver", 1);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadURL(`http://127.0.0.1:${port}/#break-reminder?until=${until}`).catch(() => {});
  return win;
}

function hideBreakReminder() {
  breakReminderUntil = 0;
  for (const win of breakReminderWindows) if (!win.isDestroyed()) win.hide();
}

function showBreakReminder(port: number, until: number) {
  if (breakReminderUntil === until && breakReminderWindows.length > 0) return;
  for (const win of breakReminderWindows) if (!win.isDestroyed()) win.destroy();
  breakReminderUntil = until;
  breakReminderWindows = screen.getAllDisplays().map(display => createBreakReminderWindow(display.bounds, port, until));
  for (const win of breakReminderWindows) {
    win.once("ready-to-show", () => {
      if (breakReminderUntil === until) win.showInactive();
    });
  }
}

function readBreakReminderStatus(port: number): Promise<{ activeUntil: string | null }> {
  return new Promise(resolve => {
    const request = http.get(`http://127.0.0.1:${port}/api/toolbox/break-reminder`, response => {
      let raw = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { raw += chunk; });
      response.on("end", () => {
        try { resolve(JSON.parse(raw) as { activeUntil: string | null }); }
        catch { resolve({ activeUntil: null }); }
      });
    });
    request.setTimeout(800, () => { request.destroy(); resolve({ activeUntil: null }); });
    request.on("error", () => resolve({ activeUntil: null }));
  });
}

function setupBreakReminder(port: number) {
  const refresh = async () => {
    const { activeUntil } = await readBreakReminderStatus(port);
    const until = activeUntil ? new Date(activeUntil).getTime() : 0;
    if (until > Date.now()) showBreakReminder(port, until);
    else hideBreakReminder();
  };
  void refresh();
  breakReminderPoller = setInterval(() => { void refresh(); }, 1_000);
  screen.on("display-added", () => { if (breakReminderUntil > Date.now()) showBreakReminder(port, breakReminderUntil); });
  screen.on("display-removed", () => { if (breakReminderUntil > Date.now()) showBreakReminder(port, breakReminderUntil); });
  app.on("will-quit", () => { if (breakReminderPoller) clearInterval(breakReminderPoller); });
}

// ----- Chat overlay (Spotlight-style global chat) ------------------------

const CHAT_WINDOW_WIDTH = 760;
const CHAT_WINDOW_HEIGHT = 600;

ipcMain.handle("rich-chat:capture-current-view", async (event) => {
  if ((event.sender !== chatWindow?.webContents && event.sender !== mainWindow?.webContents) || !mainWindow || mainWindow.isDestroyed()) return null;
  const image = await mainWindow.webContents.capturePage();
  return image.toDataURL();
});

function createChatWindow(port: number): BrowserWindow {
  const display = screen.getPrimaryDisplay();
  const x = Math.round(display.bounds.x + (display.bounds.width - CHAT_WINDOW_WIDTH) / 2);
  const y = Math.round(display.bounds.y + display.bounds.height * 0.18);

  const win = new BrowserWindow({
    x, y,
    width: CHAT_WINDOW_WIDTH,
    height: CHAT_WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    movable: true,           // allow drag via the header bar (draggable region in CSS)
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, "preload.cjs"),
    },
  });

  win.setAlwaysOnTop(true, "floating", 1);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("rich://navigate")) {
      void navigateMainWindowFromUrl(url);
    } else if (!openRichExternalUrl(url)) {
      openExternalTarget(url);
    }
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    event.preventDefault();
    if (url.startsWith("rich://navigate")) {
      void navigateMainWindowFromUrl(url);
      return;
    }
    if (openRichExternalUrl(url)) return;
    openExternalTarget(url);
  });

  // Belt-and-suspenders: inject a !important transparent body rule after
  // the renderer loads. Same trick OverlayTaskView uses — defends against
  // theme stylesheets that load late and re-apply a solid body background.
  win.webContents.on("did-finish-load", () => {
    win.webContents.insertCSS(`
      html, html[data-theme], html body, html[data-theme] body, #root {
        background: transparent !important;
      }
      html body::before, html body::after,
      html[data-theme] body::before, html[data-theme] body::after,
      #root::before, #root::after {
        display: none !important;
        content: none !important;
        background: transparent !important;
      }
    `).catch(() => {});
  });

  // Hide (don't destroy) on blur so the conversation state in the renderer
  // survives across opens. The blur path only hides the chat — for the
  // full Spotlight-style "go away entirely" behavior, the Cmd+~
  // re-press and the Esc key both go through hideChatAndApp() (which
  // additionally sends the Rich app to background).
  win.on("blur", () => {
    if (!win.isDestroyed() && win.isVisible()) win.hide();
  });
  // Intercept Esc inside the renderer before it propagates — same effect
  // as toggling the shortcut off.
  win.webContents.on("before-input-event", (_e, input) => {
    if (input.type === "keyDown" && input.key === "Escape") {
      hideChatAndApp();
    }
  });
  win.on("closed", () => { if (chatWindow === win) chatWindow = null; });

  win.loadURL(`http://127.0.0.1:${port}/#chat`).catch(() => {});
  return win;
}

function hideChatAndApp() {
  ensureDockApplication("hide chat");
  if (chatWindow && !chatWindow.isDestroyed() && chatWindow.isVisible()) {
    chatWindow.hide();
  }
}

async function navigateMainWindowFromUrl(url: string) {
  let payload: unknown;
  try {
    const parsed = new URL(url);
    const raw = parsed.searchParams.get("payload");
    if (!raw) return;
    payload = JSON.parse(raw);
  } catch {
    return;
  }
  await navigateMainWindow(payload);
}

async function navigateMainWindow(payload: unknown) {
  if (serverPort == null) return;
  const win = mainWindow && !mainWindow.isDestroyed()
    ? mainWindow
    : await openMainWindow(serverPort);

  if (process.platform === "darwin") app.show();
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();

  const jsPayload = JSON.stringify(payload);
  const script = `window.dispatchEvent(new CustomEvent("rich.navigate", { detail: ${jsPayload} }));`;
  const run = () => win.webContents.executeJavaScript(script).catch(() => undefined);
  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", run);
  } else {
    await run();
  }

  if (chatWindow && !chatWindow.isDestroyed() && chatWindow.isVisible()) {
    chatWindow.hide();
  }
}

function toggleChatWindow() {
  if (serverPort == null) return;
  if (!chatWindow || chatWindow.isDestroyed()) {
    chatWindow = createChatWindow(serverPort);
    chatWindow.once("ready-to-show", () => {
      if (process.platform === "darwin") app.show();
      chatWindow?.show();
      chatWindow?.focus();
    });
    return;
  }
  if (chatWindow.isVisible()) {
    hideChatAndApp();
  } else {
    // Recenter on the active display in case the user moved between screens.
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const bounds = chatWindow.getBounds();
    chatWindow.setBounds({
      width: bounds.width,
      height: bounds.height,
      x: Math.round(display.bounds.x + (display.bounds.width - bounds.width) / 2),
      y: Math.round(display.bounds.y + display.bounds.height * 0.18),
    });
    if (process.platform === "darwin") app.show();
    chatWindow.show();
    chatWindow.focus();
  }
}

function setupChatOverlay(port: number, mainWin: BrowserWindow) {
  const accelerator = "CommandOrControl+`";
  const ok = globalShortcut.register(accelerator, () => {
    const quickChatVisible = Boolean(chatWindow && !chatWindow.isDestroyed() && chatWindow.isVisible());
    if (!quickChatVisible && mainWin.isVisible()) mainWin.hide();
    toggleChatWindow();
  });
  console.log(`[ke-desktop] Command+~ shortcut ${accelerator}: ${ok ? "registered" : "failed"}`);
  if (!ok) console.warn(`[ke-desktop] chat shortcut ${accelerator} failed; another app may already own it.`);
  app.on("will-quit", () => globalShortcut.unregister(accelerator));

  // Pre-warm the window so the first invocation is instant. Keeps the
  // renderer + zustand state alive ready for repeated open/close cycles.
  serverPort = port;
  chatWindow = createChatWindow(port);
}

function ping(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.request({ host: "127.0.0.1", port, path: "/api/health", timeout: 500 }, res => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.end();
  });
}
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ----- Step 5: Tray (animated menu-bar Transformer mascot) ---------------
// We hold strong refs at module scope so V8 doesn't collect them after
// openMainWindow returns.
let tray: Tray | null = null;
const trayFrames: Electron.NativeImage[] = [];
// Per-frame durations loaded from timing.json next to the PNGs. Walk frames
// are snappy (~150ms), transformation frames linger (~300ms) so the
// "ka-chunk ka-chunk" mechanical segmentation reads.
let trayFrameDurations: number[] = [];

/** Locate the tray-frame directory in both dev (apps/desktop/assets/tray)
 *  and packaged (Contents/Resources/tray-frames) layouts. */
function trayAssetsDir(): string {
  if (process.resourcesPath && existsSync(join(process.resourcesPath, "tray-frames"))) {
    return join(process.resourcesPath, "tray-frames");
  }
  return resolve(__dirname, "..", "assets", "tray");
}

function setupTray(mainWin: BrowserWindow) {
  const dir = trayAssetsDir();

  // Load timing manifest first — it tells us how many frames exist.
  let frameCount = 16;
  try {
    const timing = JSON.parse(
      require("node:fs").readFileSync(join(dir, "timing.json"), "utf-8"),
    );
    frameCount = timing.frames;
    trayFrameDurations = timing.durationsMs;
  } catch {
    // Fallback: uniform 220ms if timing.json missing.
    trayFrameDurations = new Array(frameCount).fill(220);
  }

  for (let i = 0; i < frameCount; i++) {
    const img = nativeImage.createFromPath(join(dir, `frame-${i}.png`));
    img.setTemplateImage(true);
    trayFrames.push(img);
  }
  if (trayFrames.length === 0 || trayFrames[0].isEmpty()) {
    flog(`tray assets missing at ${dir} — skipping tray setup`);
    return;
  }

  tray = new Tray(trayFrames[0]);
  tray.setToolTip("Rich · 私人 AI 助理");

  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: "显示 Rich",
      click: () => showRichMainWindow(mainWin),
    },
    {
      label: "显示/隐藏透明悬浮层",
      accelerator: "CommandOrControl+Shift+0",
      click: toggleOverlay,
    },
    {
      label: "打开数据目录",
      click: () => { shell.openPath(userDataDir()); },
    },
    { type: "separator" },
    { label: "退出 Rich", role: "quit" },
  ]));

  tray.on("click", () => {
    if (mainWin.isVisible() && mainWin.isFocused()) mainWin.hide();
    else showRichMainWindow(mainWin);
  });

  // Variable-interval animation. We chain setTimeout instead of using
  // setInterval so each frame can have its own dwell time. The chain is
  // re-entered until before-quit cancels it.
  let stopped = false;
  let i = 0;
  const tick = () => {
    if (stopped || !tray || tray.isDestroyed()) return;
    tray.setImage(trayFrames[i]);
    const dwell = trayFrameDurations[i] ?? 220;
    i = (i + 1) % trayFrames.length;
    setTimeout(tick, dwell);
  };
  tick();
  app.on("before-quit", () => {
    stopped = true;
    if (tray && !tray.isDestroyed()) tray.destroy();
  });
}

// ----- App lifecycle -----------------------------------------------------
app.setName("Rich");

app.whenReady().then(async () => {
  try {
    ensureUserShellPath();
    loadRichCloudEnv();
    setDockIconIfAvailable();
    migrateInRepoDataIfNeeded(userDataDir());
    const port = await findFreePort();
    serverPort = port;
    await bootServer(port);
    const mainWin = await openMainWindow(port);
    setupOverlayControls(port);
        setupBreakReminder(port);
        setupRichSummonShortcut(mainWin);
        setupEdgeDockNavigationShortcuts(mainWin);
        setupChatOverlay(port, mainWin);
    setupTray(mainWin);
    setTimeout(() => ensureDockApplication("startup settled"), 1000);
    flog(`startup ok, port=${port}, tray=${tray ? "yes" : "no"}`);

    // Minimal menu so Cmd+Q etc. work; let the renderer handle most actions.
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: "Rich",
        submenu: [
          { role: "about" },
          { type: "separator" },
          {
            label: "打开数据目录",
            click: () => { shell.openPath(userDataDir()); },
          },
          {
            label: "显示/隐藏透明悬浮层",
            accelerator: "CommandOrControl+Shift+0",
            click: toggleOverlay,
          },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" }, { role: "hideOthers" }, { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      { role: "editMenu" },
      { role: "viewMenu" },
      { role: "windowMenu" },
    ]));
  } catch (e) {
    const msg = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
    dialog.showErrorBox("Rich 启动失败", msg);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Set by Cmd+Q / app.quit() so the main window's `close` handler knows it
// should actually close (instead of just hiding for the dock-icon flow).
app.on("before-quit", () => {
  (app as unknown as { isQuitting?: boolean }).isQuitting = true;
});

app.on("activate", async () => {
  // Dock icon clicked on macOS. Three cases:
  //   1. Main window is just hidden (most common — user pressed red close)
  //      → unhide + focus, NO new window, NO new server.
  //   2. Main window is minimized → restore.
  //   3. Main window truly gone (rare; cold start path) → recreate using
  //      the EXISTING server port; don't allocate a new one.
  if (process.platform === "darwin") app.show();
  if (mainWindow && !mainWindow.isDestroyed()) {
    showRichMainWindow(mainWindow);
    return;
  }
  if (serverPort != null) {
    const win = await openMainWindow(serverPort);
    showRichMainWindow(win);
  }
});
