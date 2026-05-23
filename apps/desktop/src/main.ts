import { app, BrowserWindow, shell, dialog, Menu, Tray, nativeImage, globalShortcut, screen } from "electron";
import { existsSync, mkdirSync, statSync, readdirSync, copyFileSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import http from "node:http";

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
async function openMainWindow(port: number): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    title: "Rich",
    backgroundColor: "#09090a",
    // Claude / VS Code-style chromeless top: macOS hides the title bar
    // strip entirely; the red/yellow/green traffic lights stay as floating
    // buttons over the content. The renderer reserves left padding for
    // them via the CSS injected on did-finish-load.
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 16 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });
  win.once("ready-to-show", () => win.show());

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
  win.on("closed", () => { if (mainWindow === win) mainWindow = null; });
  mainWindow = win;

  // Open external links in the default browser, not new Electron windows.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1:") || url.startsWith("http://localhost:")) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Default the UI to 80% zoom — the source design was tuned for a denser
  // layout. Re-apply on every navigation so SPA route changes don't reset
  // zoom (Chromium binds zoom per-origin; setting on did-finish-load is the
  // most reliable hook). Users can override via Cmd +/− at runtime.
  const DEFAULT_ZOOM = 0.8;
  win.webContents.on("did-finish-load", () => {
    win.webContents.setZoomFactor(DEFAULT_ZOOM);
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
      .learning-sidebar {
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
      .learning-sidebar [data-draggable] {
        -webkit-app-region: no-drag;
      }
    `).catch(() => { /* SPA route changes may race; ignore */ });
  });

  // Wire Cmd +/= , Cmd - , Cmd 0 zoom shortcuts so the user can still adjust.
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
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

let overlayWindows: BrowserWindow[] = [];

/** Spotlight-style chat overlay window. Created lazily on first invocation
 *  of the Cmd+Shift+Space shortcut, then kept alive (hidden on Esc/blur)
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

/** Toggle the main Rich window: if it's currently visible AND focused, send
 *  it (and the whole Rich app on macOS) to the background; otherwise bring
 *  it forward. Same idiom as the chat overlay's Cmd+Shift+Space — modifier
 *  key acts as a switch. */
function bringRichToFront(mainWin: BrowserWindow) {
  if (mainWin.isDestroyed()) return;
  const visibleAndFocused = mainWin.isVisible() && mainWin.isFocused() && !mainWin.isMinimized();
  if (visibleAndFocused) {
    mainWin.hide();
    if (process.platform === "darwin") app.hide();
    return;
  }
  if (mainWin.isMinimized()) mainWin.restore();
  if (!mainWin.isVisible()) mainWin.show();
  mainWin.moveTop();
  mainWin.focus();
  app.focus({ steal: true });
}

function setupRichSummonShortcut(mainWin: BrowserWindow) {
  // Cmd+Shift+Enter brings the main Rich window to front. We deliberately
  // moved off the original Cmd+Space binding because:
  //   1. Cmd+Space is macOS Spotlight — grabbing it broke Spotlight while
  //      Rich was running.
  //   2. The chat overlay now owns Cmd+Shift+Space, so Cmd+Shift+Enter is
  //      the natural "twin" — same modifier, different key, distinct intent.
  const shortcuts = ["CommandOrControl+Shift+Return"];
  for (const accelerator of shortcuts) {
    const ok = globalShortcut.register(accelerator, () => bringRichToFront(mainWin));
    console.log(`[ke-desktop] summon shortcut ${accelerator}: ${ok ? "registered" : "failed"}`);
    if (!ok) {
      console.warn(`[ke-desktop] summon shortcut ${accelerator} failed; another app may already own it.`);
    }
  }
  app.on("will-quit", () => {
    for (const accelerator of shortcuts) globalShortcut.unregister(accelerator);
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

// ----- Chat overlay (Spotlight-style global chat) ------------------------

const CHAT_WINDOW_WIDTH = 760;
const CHAT_WINDOW_HEIGHT = 600;

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
    },
  });

  win.setAlwaysOnTop(true, "floating", 1);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

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
  // full Spotlight-style "go away entirely" behavior, the Cmd+Shift+Space
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
  // Spotlight/Raycast-style dismissal: send the entire Rich app to the
  // background so the user's previous app pops back to the foreground.
  // CRITICAL ORDERING — on macOS, app.hide() hides ALL Rich windows in a
  // single compositor frame (atomic). If we call chatWindow.hide() first
  // and THEN app.hide(), there's a 1-2 frame gap where the chat overlay
  // is gone but the main window underneath has been revealed — which the
  // user sees as a brief flash of the main control panel. Calling
  // app.hide() alone handles both windows without that gap.
  if (process.platform === "darwin") {
    app.hide();
    return;
  }
  // Non-darwin platforms (Linux/Windows) don't have app.hide; explicitly
  // hide just the chat window. The main window's own visibility doesn't
  // change because there's no equivalent "app behind" concept.
  if (chatWindow && !chatWindow.isDestroyed() && chatWindow.isVisible()) {
    chatWindow.hide();
  }
}

function toggleChatWindow() {
  if (serverPort == null) return;
  if (!chatWindow || chatWindow.isDestroyed()) {
    chatWindow = createChatWindow(serverPort);
    chatWindow.once("ready-to-show", () => {
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
    chatWindow.show();
    chatWindow.focus();
  }
}

function setupChatOverlay(port: number) {
  // Register Cmd+Shift+Space globally (works even when Rich isn't focused).
  // Cmd+Space is taken by Spotlight (and Rich's own summon shortcut below),
  // so we pick the Shift variant — free on macOS by default.
  const accelerator = "CommandOrControl+Shift+Space";
  const ok = globalShortcut.register(accelerator, toggleChatWindow);
  console.log(`[ke-desktop] chat shortcut ${accelerator}: ${ok ? "registered" : "failed"}`);
  if (!ok) {
    console.warn(`[ke-desktop] chat shortcut ${accelerator} failed; another app may already own it.`);
  }
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
      click: () => { mainWin.show(); mainWin.focus(); },
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
    else { mainWin.show(); mainWin.focus(); }
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
    migrateInRepoDataIfNeeded(userDataDir());
    const port = await findFreePort();
    serverPort = port;
    await bootServer(port);
    const mainWin = await openMainWindow(port);
    setupOverlayControls(port);
    setupRichSummonShortcut(mainWin);
    setupChatOverlay(port);
    setupTray(mainWin);
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
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
    return;
  }
  if (serverPort != null) {
    await openMainWindow(serverPort);
  }
});
