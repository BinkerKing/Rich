/// <reference types="vite/client" />

// PNG / image imports — Vite resolves these to URL strings at build time.
declare module "*.png" {
  const src: string;
  export default src;
}
declare module "*.svg" {
  const src: string;
  export default src;
}
