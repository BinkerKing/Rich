function copyStyles(source: Element, target: Element) {
  const style = window.getComputedStyle(source);
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index);
    (target as HTMLElement).style.setProperty(property, style.getPropertyValue(property), style.getPropertyPriority(property));
  }
  Array.from(source.children).forEach((child, index) => copyStyles(child, target.children[index]));
}

function pngBlob(element: HTMLElement): Promise<Blob> {
  const bounds = element.getBoundingClientRect();
  const clone = element.cloneNode(true) as HTMLElement;
  copyStyles(element, clone);
  clone.querySelectorAll(".react-flow__controls, .react-flow__attribution").forEach(node => node.remove());
  clone.style.width = `${bounds.width}px`;
  clone.style.height = `${bounds.height}px`;
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(clone)}</foreignObject></svg>`;
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("流程图渲染超时")), 10000);
    const image = new Image();
    image.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(bounds.width * scale);
      canvas.height = Math.ceil(bounds.height * scale);
      const context = canvas.getContext("2d");
      if (!context) { window.clearTimeout(timeout); reject(new Error("浏览器不支持图片导出")); return; }
      context.scale(scale, scale);
      context.drawImage(image, 0, 0, bounds.width, bounds.height);
      canvas.toBlob(blob => {
        window.clearTimeout(timeout);
        if (blob) resolve(blob);
        else reject(new Error("图片生成失败"));
      }, "image/png");
    };
    image.onerror = () => { window.clearTimeout(timeout); reject(new Error("流程图渲染失败")); };
    image.src = source;
  });
}

export async function exportFlowchartPng(element: HTMLElement, title: string) {
  const filename = `${(title || "流程图").replace(/[\\/:*?"<>|]/g, "_").trim() || "流程图"}.png`;
  const url = URL.createObjectURL(await pngBlob(element));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
