import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("richWindow", {
  toggleMaximize: () => ipcRenderer.send("rich-window:toggle-maximize"),
  setLayoutMode: (mode: "desktop" | "pad" | "fullscreen") => ipcRenderer.send("rich-window:set-layout-mode", mode),
  exportDeliveryPlan: (payload: unknown) => ipcRenderer.invoke("rich-delivery-plan:export", payload),
  captureCurrentView: () => ipcRenderer.invoke("rich-chat:capture-current-view"),
  restartLatestApp: () => ipcRenderer.invoke("rich-app:restart-latest"),
});
