/**
 * 客户端图片预处理 —— 上传前缩到合理大小 + 抹掉 EXIF + 重新编码。
 *
 *   - 长边 > 1600 → 缩到 1600（Claude / GPT-4o vision 输入上限附近）
 *   - JPEG 默认 q=82；PNG（有透明）保留 PNG
 *   - EXIF 自动消失（canvas 重绘后元数据丢失）
 *   - 输出 { blob, width, height, mime }
 *
 * 失败兜底：解码失败时原样返回，不阻塞用户上传（让服务端再校验）。
 */

const MAX_DIM = 1600;
const JPEG_QUALITY = 0.82;

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  mime: string;
  sha256: string;
}

export async function preprocessImage(file: File): Promise<ProcessedImage> {
  // 1) decode
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    // 不能解码：原样返回（让服务端兜底）
    const raw = await file.arrayBuffer();
    return {
      blob: file,
      width: 0,
      height: 0,
      mime: file.type || "application/octet-stream",
      sha256: await sha256Hex(raw),
    };
  }

  const { width: srcW, height: srcH } = bitmap;
  const scale = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
  const dstW = Math.round(srcW * scale);
  const dstH = Math.round(srcH * scale);

  // 2) 重绘到 OffscreenCanvas（如果不支持就用普通 canvas）
  // 透明 PNG 保留为 PNG；其它一律转 JPEG（更小、更快）
  const isTransparent = file.type === "image/png" || file.type === "image/gif";
  const outMime = isTransparent ? "image/png" : "image/jpeg";

  let canvas: OffscreenCanvas | HTMLCanvasElement;
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(dstW, dstH);
  } else {
    const c = document.createElement("canvas");
    c.width = dstW;
    c.height = dstH;
    canvas = c;
  }
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error("no 2d canvas context");
  if (!isTransparent) {
    // JPEG 没透明 —— 给个白底，避免 RGBA → RGB 时变黑
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, dstW, dstH);
  }
  ctx.drawImage(bitmap, 0, 0, dstW, dstH);
  bitmap.close?.();

  // 3) 编码到 blob
  let blob: Blob;
  if ("convertToBlob" in canvas) {
    blob = await canvas.convertToBlob({
      type: outMime,
      quality: outMime === "image/jpeg" ? JPEG_QUALITY : undefined,
    });
  } else {
    blob = await new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        b => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
        outMime,
        outMime === "image/jpeg" ? JPEG_QUALITY : undefined,
      );
    });
  }

  // 4) hash
  const bytes = await blob.arrayBuffer();
  const sha256 = await sha256Hex(bytes);

  return { blob, width: dstW, height: dstH, mime: outMime, sha256 };
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  if (!crypto?.subtle) {
    // 极个别老 Electron 环境没暴露 crypto.subtle —— 返回时间戳兜底，不影响主流程
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  }
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
