import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("richWindow", {
  toggleMaximize: () => ipcRenderer.send("rich-window:toggle-maximize"),
  exportDeliveryPlan: (payload: unknown) => ipcRenderer.invoke("rich-delivery-plan:export", payload),
  captureCurrentView: () => ipcRenderer.invoke("rich-chat:capture-current-view"),
});
