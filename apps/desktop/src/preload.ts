import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("richWindow", {
  toggleMaximize: () => ipcRenderer.send("rich-window:toggle-maximize"),
  setWindowControlsVisible: (visible: boolean) => ipcRenderer.send("rich-window:set-controls-visible", visible),
  exportDeliveryPlan: (payload: unknown) => ipcRenderer.invoke("rich-delivery-plan:export", payload),
  captureCurrentView: () => ipcRenderer.invoke("rich-chat:capture-current-view"),
});
