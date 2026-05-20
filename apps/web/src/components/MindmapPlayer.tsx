import { useEffect, useRef } from "react";
import "./MindmapPlayer.css";

interface Props {
  /** Indented Markdown tree — see packages/domain/src/types/mindmap.ts. */
  source: string;
  /** Maps an `@image foo.png` reference to a real URL (e.g. /api/images/…). */
  resolveImage?: (relPath: string) => string;
}

interface Node {
  id: string;
  label: string;
  children: Node[];
  parent: Node | null;
  depth: number;
  image: string;
  preorderIndex: number;
}

interface NodeMetric { width: number; height: number; }
interface Position { x: number; y: number; }

interface VisibleNode {
  id: string; label: string; x: number; y: number;
  width: number; height: number; depth: number;
  preorderIndex: number;
  isPath: boolean; isActive: boolean; isComplete: boolean;
}
interface VisibleLink {
  id: string;
  from: Position; fromWidth: number;
  to: Position; toWidth: number;
  isPathLink: boolean;
}
interface ViewModel {
  nodes: VisibleNode[];
  links: VisibleLink[];
  baseline: number;
  isEnd?: boolean;
}

const SVG_NS = "http://www.w3.org/2000/svg";

const layout = {
  minNodeWidth: 146,
  minNodeHeight: 57,
  pathGap: 99,
  rowGap: 75,
  stagePaddingX: 114,
  stagePaddingY: 72,
  centerBaseline: 520,
  cameraTargetCenterBand: 0.4,
};
const wheelNavigation = { threshold: 72, idleResetMs: 180 };
const swipeNavigation = { intentDistance: 10, minDistance: 56, dominanceRatio: 1.25 };

/**
 * React port of agegr/mindmap-ppt's player. The algorithm is unchanged —
 * parse the Markdown tree, lay nodes out with parents centered on the
 * path-to-root and completed subtrees stacked above. All imperative DOM ops
 * happen inside a single useEffect so we don't fight React's render cycle.
 */
export function MindmapPlayer({ source, resolveImage }: Props) {
  const mindmapRef = useRef<HTMLDivElement | null>(null);
  const mapLayerRef = useRef<HTMLDivElement | null>(null);
  const linkLayerRef = useRef<SVGSVGElement | null>(null);
  const nodeLayerRef = useRef<HTMLDivElement | null>(null);
  const deckSubtitleRef = useRef<HTMLParagraphElement | null>(null);
  const deckTitleRef = useRef<HTMLHeadingElement | null>(null);
  const counterRef = useRef<HTMLSpanElement | null>(null);
  const nodeSliderRef = useRef<HTMLInputElement | null>(null);
  const zoomSliderRef = useRef<HTMLInputElement | null>(null);
  const zoomValueRef = useRef<HTMLElement | null>(null);
  const activeScaleSliderRef = useRef<HTMLInputElement | null>(null);
  const activeScaleValueRef = useRef<HTMLElement | null>(null);
  const nextSubtitleRef = useRef<HTMLSpanElement | null>(null);
  const nextTitleRef = useRef<HTMLSpanElement | null>(null);
  const nextPreviewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mindmap = mindmapRef.current!;
    const mapLayer = mapLayerRef.current!;
    const linkLayer = linkLayerRef.current!;
    const nodeLayer = nodeLayerRef.current!;
    const deckSubtitle = deckSubtitleRef.current!;
    const deckTitle = deckTitleRef.current!;
    const counter = counterRef.current!;
    const nodeSlider = nodeSliderRef.current!;
    const zoomSlider = zoomSliderRef.current!;
    const zoomValue = zoomValueRef.current!;
    const activeScaleSlider = activeScaleSliderRef.current!;
    const activeScaleValue = activeScaleValueRef.current!;
    const nextSubtitle = nextSubtitleRef.current!;
    const nextTitle = nextTitleRef.current!;
    const nextPreview = nextPreviewRef.current!;
    if (!mindmap || !mapLayer || !linkLayer || !nodeLayer) return;

    const root = parseMarkdownTree(source, resolveImage);
    if (!root) return;
    assignTreeMetadata(root);
    const preorder = collectPreorder(root);
    const idToNode = new Map(preorder.map(n => [n.id, n]));
    nodeSlider.max = String(preorder.length);
    updateDeckHeading(root.label);

    let activeIndex = 0;
    const renderedNodes = new Map<string, RenderedNode>();
    const renderedLinks = new Map<string, RenderedLink>();
    let cameraTargetIndex: number | null = null;
    let currentNodeMetrics = new Map<string, NodeMetric>();
    let cameraZoom = Number(zoomSlider.value) / 100;
    let activeScale = Number(activeScaleSlider.value) / 100;
    let wheelDeltaBuffer = 0;
    let wheelNavigationTimer: number | null = null;
    let swipeStart: { x: number; y: number; isVerticalSwipe: boolean } | null = null;

    const imageViewer = createImageViewer();

    function updateDeckHeading(label: string) {
      const { subtitle, title } = splitLabel(label);
      deckSubtitle.textContent = subtitle;
      deckTitle.textContent = title;
    }

    function setActiveIndex(index: number) {
      activeIndex = Math.max(0, Math.min(index, preorder.length));
      cameraTargetIndex = null;
      render();
    }

    function focusCameraOnNode(nodeId: string) {
      const node = idToNode.get(nodeId);
      if (!node) return;
      cameraTargetIndex = node.preorderIndex === activeIndex ? null : node.preorderIndex;
      render();
    }

    function render() {
      const activeNode = preorder[activeIndex] ?? null;
      currentNodeMetrics = measureAllNodes(preorder, activeNode);
      const model = activeNode ? buildVisibleModel(activeNode) : buildEndModel();
      const viewport = computeViewport(model, cameraTargetIndex);
      syncLinks(model.links);
      syncNodes(model.nodes, activeNode);
      positionMapLayer(viewport, model);
      updateControls();
    }

    function getNodeMetric(node: Node): NodeMetric {
      return currentNodeMetrics.get(node.id) ?? {
        width: layout.minNodeWidth, height: layout.minNodeHeight,
      };
    }

    function measureAllNodes(nodes: Node[], activeNode: Node | null): Map<string, NodeMetric> {
      const measurer = document.createElement("div");
      measurer.className = "mmp-node-measurer";
      // CRITICAL: append inside the player shell so the measurer inherits
      // the `--mmp-node-thumb-w` / `--mmp-node-thumb-h` CSS custom properties
      // defined on `.mmp-shell`. Appending to document.body left those vars
      // undefined → the image rule `width: var(--mmp-node-thumb-w)` resolved
      // to `auto`, causing <img> to take its natural file dimensions (often
      // 1000+px) and bloating the measured card width.
      const host = (mindmap.closest(".mmp-shell") as HTMLElement | null) ?? document.body;
      host.appendChild(measurer);
      const metrics = new Map<string, NodeMetric>();
      nodes.forEach(node => {
        const content = createNodeContent();
        updateNodeContent(content, node, node.id === activeNode?.id);
        measurer.appendChild(content.root);
        const rect = content.root.getBoundingClientRect();
        metrics.set(node.id, {
          width: Math.max(layout.minNodeWidth, Math.ceil(rect.width)),
          height: Math.max(layout.minNodeHeight, Math.ceil(rect.height)),
        });
        content.root.remove();
      });
      measurer.remove();
      return metrics;
    }

    function buildEndModel(): ViewModel {
      const visibleIds = new Set(preorder.map(n => n.id));
      const positions = new Map<string, Position>();
      const nodes: VisibleNode[] = [];
      const links: VisibleLink[] = [];
      const rootMetric = getNodeMetric(root!);
      placeSubtree(root!, visibleIds, positions, {
        x: layout.stagePaddingX + rootMetric.width / 2,
        y: layout.centerBaseline,
      });
      visibleIds.forEach(id => {
        const node = idToNode.get(id)!;
        const position = positions.get(id);
        if (!position) return;
        nodes.push({
          id, label: node.label, x: position.x, y: position.y,
          width: getNodeMetric(node).width, height: getNodeMetric(node).height,
          depth: node.depth, preorderIndex: node.preorderIndex,
          isPath: false, isActive: false, isComplete: false,
        });
        if (node.parent && positions.has(node.parent.id)) {
          links.push({
            id: `${node.parent.id}->${node.id}`,
            from: positions.get(node.parent.id)!,
            fromWidth: getNodeMetric(node.parent).width,
            to: position, toWidth: getNodeMetric(node).width,
            isPathLink: false,
          });
        }
      });
      return { nodes, links, baseline: layout.centerBaseline, isEnd: true };
    }

    function buildVisibleModel(activeNode: Node): ViewModel {
      const path = pathToRoot(activeNode);
      const pathIds = new Set(path.map(n => n.id));
      const visibleIds = new Set(preorder.slice(0, activeIndex + 1).map(n => n.id));
      const positions = new Map<string, Position>();
      const nodes: VisibleNode[] = [];
      const links: VisibleLink[] = [];
      const completedSubtrees: Array<{ child: Node; depthIndex: number; height: number }> = [];
      path.forEach((node, depthIndex) => {
        const completeChildren = node.children.filter(child => visibleIds.has(child.id) && !pathIds.has(child.id));
        completeChildren.forEach(child => completedSubtrees.push({
          child, depthIndex, height: measureSubtree(child, visibleIds).height,
        }));
      });
      const completedHeight = completedSubtrees.reduce((t, s) => t + s.height, 0) +
        Math.max(0, completedSubtrees.length - 1) * layout.rowGap;
      const baseline = layout.centerBaseline;
      let pathCursorX = layout.stagePaddingX;
      path.forEach(node => {
        const metric = getNodeMetric(node);
        positions.set(node.id, { x: pathCursorX + metric.width / 2, y: baseline });
        pathCursorX += metric.width + layout.pathGap;
      });
      let cursorY = baseline - layout.rowGap - completedHeight;
      completedSubtrees.forEach(subtree => {
        const parentPos = positions.get(path[subtree.depthIndex].id)!;
        const parentMetric = getNodeMetric(path[subtree.depthIndex]);
        const childMetric = getNodeMetric(subtree.child);
        placeSubtree(subtree.child, visibleIds, positions, {
          x: parentPos.x + parentMetric.width / 2 + layout.pathGap + childMetric.width / 2,
          y: cursorY + subtree.height / 2,
        });
        cursorY += subtree.height + layout.rowGap;
      });
      visibleIds.forEach(id => {
        const node = idToNode.get(id)!;
        const position = positions.get(id);
        if (!position) return;
        const isPath = pathIds.has(id);
        nodes.push({
          id, label: node.label, x: position.x, y: position.y,
          width: getNodeMetric(node).width, height: getNodeMetric(node).height,
          depth: node.depth, preorderIndex: node.preorderIndex,
          isPath, isActive: node.id === activeNode.id, isComplete: !isPath,
        });
        if (node.parent && positions.has(node.parent.id)) {
          links.push({
            id: `${node.parent.id}->${node.id}`,
            from: positions.get(node.parent.id)!,
            fromWidth: getNodeMetric(node.parent).width,
            to: position, toWidth: getNodeMetric(node).width,
            isPathLink: pathIds.has(node.parent.id) && pathIds.has(node.id),
          });
        }
      });
      return { nodes, links, baseline };
    }

    function measureSubtree(node: Node, visibleIds: Set<string>): { height: number } {
      const visibleChildren = node.children.filter(c => visibleIds.has(c.id));
      const metric = getNodeMetric(node);
      if (visibleChildren.length === 0) return { height: metric.height };
      const childHeights = visibleChildren.map(c => measureSubtree(c, visibleIds).height);
      return {
        height: Math.max(
          metric.height,
          childHeights.reduce((t, h) => t + h, 0) + (childHeights.length - 1) * layout.rowGap,
        ),
      };
    }

    function placeSubtree(node: Node, visibleIds: Set<string>, positions: Map<string, Position>, anchor: Position) {
      const visibleChildren = node.children.filter(c => visibleIds.has(c.id));
      positions.set(node.id, { x: anchor.x, y: anchor.y });
      if (visibleChildren.length === 0) return;
      const childMeasures = visibleChildren.map(child => ({
        child, height: measureSubtree(child, visibleIds).height,
      }));
      const totalHeight = childMeasures.reduce((t, m) => t + m.height, 0) +
        (childMeasures.length - 1) * layout.rowGap;
      let childCursor = anchor.y - totalHeight / 2;
      childMeasures.forEach(({ child, height }) => {
        const childY = childCursor + height / 2;
        const nodeMetric = getNodeMetric(node);
        const childMetric = getNodeMetric(child);
        placeSubtree(child, visibleIds, positions, {
          x: anchor.x + nodeMetric.width / 2 + layout.pathGap + childMetric.width / 2,
          y: childY,
        });
        childCursor += height + layout.rowGap;
      });
    }

    function computeViewport(model: ViewModel, targetIndex: number | null) {
      const viewportSize = getViewportSize();
      const logical = { width: viewportSize.width / cameraZoom, height: viewportSize.height / cameraZoom };
      if (model.nodes.length === 0) return { x: 0, y: 0, width: logical.width, height: logical.height };
      if (model.isEnd) return computeEndViewport(model, logical, targetIndex);
      const pathNodes = model.nodes.filter(n => n.isPath);
      const pathMinX = Math.min(...pathNodes.map(n => n.x - n.width / 2));
      const pathMaxX = Math.max(...pathNodes.map(n => n.x + n.width / 2));
      const pathCenterX = (pathMinX + pathMaxX) / 2;
      const activeNode = model.nodes.find(n => n.isActive);
      const targetNode = targetIndex === null ? activeNode : model.nodes.find(n => n.preorderIndex === targetIndex) ?? activeNode;
      let viewportX = pathCenterX - logical.width / 2;
      let viewportY = model.baseline - logical.height / 2;
      if (targetNode) {
        viewportX = keepNodeInCenterBand(viewportX, logical.width, targetNode.x, layout.cameraTargetCenterBand);
        viewportY = keepNodeInCenterBand(viewportY, logical.height, targetNode.y, layout.cameraTargetCenterBand);
      }
      return { x: viewportX, y: viewportY, width: logical.width, height: logical.height };
    }

    function computeEndViewport(model: ViewModel, logical: { width: number; height: number }, targetIndex: number | null) {
      const bounds = computeModelBounds(model.nodes);
      const graphCenterX = (bounds.minX + bounds.maxX) / 2;
      const graphCenterY = (bounds.minY + bounds.maxY) / 2;
      const targetNode = model.nodes.find(n => n.preorderIndex === targetIndex);
      let viewportX = graphCenterX - logical.width / 2;
      let viewportY = graphCenterY - logical.height / 2;
      if (targetNode) {
        viewportX = keepNodeInCenterBand(viewportX, logical.width, targetNode.x, layout.cameraTargetCenterBand);
        viewportY = keepNodeInCenterBand(viewportY, logical.height, targetNode.y, layout.cameraTargetCenterBand);
      }
      return { x: viewportX, y: viewportY, width: logical.width, height: logical.height };
    }

    function getViewportSize() {
      return { width: Math.max(1, mindmap.clientWidth), height: Math.max(1, mindmap.clientHeight) };
    }

    function positionMapLayer(viewport: { x: number; y: number; width: number; height: number }, model: ViewModel) {
      const canvas = computeCanvasSize(model, viewport);
      mapLayer.style.width = `${canvas.width}px`;
      mapLayer.style.height = `${canvas.height}px`;
      linkLayer.setAttribute("viewBox", `0 0 ${canvas.width} ${canvas.height}`);
      mapLayer.style.transform = `scale(${cameraZoom}) translate(${-viewport.x}px, ${-viewport.y}px)`;
    }

    function computeCanvasSize(model: ViewModel, viewport: { x: number; y: number; width: number; height: number }) {
      const maxRight = model.nodes.reduce((m, n) => Math.max(m, n.x + n.width / 2), 0);
      const maxBottom = model.nodes.reduce((m, n) => Math.max(m, n.y + n.height / 2), 0);
      return {
        width: Math.max(viewport.x + viewport.width, maxRight + layout.stagePaddingX),
        height: Math.max(viewport.y + viewport.height, maxBottom + layout.stagePaddingY),
      };
    }

    function syncNodes(nodes: VisibleNode[], activeNode: Node | null) {
      const liveIds = new Set(nodes.map(n => n.id));
      renderedNodes.forEach((entry, id) => {
        if (!liveIds.has(id)) {
          entry.group.classList.add("leaving");
          window.clearTimeout(entry.removalTimer ?? 0);
          entry.removalTimer = window.setTimeout(() => {
            entry.group.remove();
            renderedNodes.delete(id);
          }, 220);
          return;
        }
        if (entry.removalTimer) {
          window.clearTimeout(entry.removalTimer);
          entry.removalTimer = null;
          entry.group.classList.remove("leaving");
        }
      });
      nodes.sort((a, b) => a.preorderIndex - b.preorderIndex).forEach(node => {
        let entry = renderedNodes.get(node.id);
        if (!entry) {
          entry = createNodeElement(node);
          renderedNodes.set(node.id, entry);
          nodeLayer.appendChild(entry.group);
        }
        entry.group.classList.toggle("active", node.isActive);
        entry.group.classList.toggle("path-node", node.isPath);
        entry.group.classList.toggle("complete-node", node.isComplete);
        entry.group.classList.toggle("camera-target", node.preorderIndex === cameraTargetIndex);
        entry.group.dataset.nodeId = node.id;
        if (activeNode && node.id === activeNode.id) entry.group.setAttribute("aria-current", "true");
        else entry.group.removeAttribute("aria-current");
        entry.group.setAttribute("aria-label", `查看 ${formatInlineLabel(node.label)} 的视角`);
        entry.group.style.width = `${node.width}px`;
        entry.group.style.height = `${node.height}px`;
        entry.group.style.transform = `translate(${node.x - node.width / 2}px, ${node.y - node.height / 2}px)`;
        updateNodeContent(entry.content, idToNode.get(node.id)!, node.isActive);
      });
    }

    function createNodeElement(node: VisibleNode): RenderedNode {
      const group = document.createElement("div");
      group.classList.add("mmp-node", "entering");
      group.setAttribute("role", "button");
      group.setAttribute("tabindex", "0");
      group.addEventListener("click", () => focusCameraOnNode(node.id));
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          focusCameraOnNode(node.id);
        }
      });
      const content = createNodeContent();
      updateNodeContent(content, idToNode.get(node.id)!, node.preorderIndex === activeIndex);
      group.append(content.root);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => group.classList.remove("entering"));
      });
      return { group, content, removalTimer: null };
    }

    function createNodeContent(): NodeContent {
      const root = document.createElement("div");
      root.classList.add("mmp-node-content");
      const subtitle = document.createElement("span");
      subtitle.classList.add("mmp-node-subtitle");
      const title = document.createElement("span");
      title.classList.add("mmp-node-title");
      const imageWrap = document.createElement("button");
      imageWrap.type = "button";
      imageWrap.classList.add("mmp-node-image");
      imageWrap.addEventListener("click", (event) => {
        event.stopPropagation();
        const src = imageWrap.dataset.previewSrc;
        if (src) imageViewer.open(src, imageWrap.dataset.previewAlt || "节点插图");
      });
      imageWrap.addEventListener("keydown", (event) => event.stopPropagation());
      const image = document.createElement("img");
      imageWrap.appendChild(image);
      root.append(subtitle, title, imageWrap);
      return { root, subtitle, title, imageWrap, image };
    }

    function updateNodeContent(content: NodeContent, node: Node, isActive: boolean) {
      const [subtitle, ...titleLines] = node.label.split("\n");
      const title = titleLines.length > 0 ? titleLines.join(" / ") : subtitle;
      content.root.classList.toggle("has-subtitle", titleLines.length > 0);
      // has-node-image shows a thumbnail on path / completed nodes.
      // image-expanded is only set on the ACTIVE node and grows the image
      // to its big presentation size.
      content.root.classList.toggle("has-node-image", Boolean(node.image));
      content.root.classList.toggle("image-expanded", Boolean(node.image) && isActive);
      content.subtitle.textContent = subtitle;
      content.title.textContent = title;
      if (node.image) {
        if (content.image.getAttribute("src") !== node.image) content.image.src = node.image;
        content.image.alt = `${formatInlineLabel(node.label)} 插图`;
        content.imageWrap.disabled = false;
        content.imageWrap.dataset.previewSrc = node.image;
        content.imageWrap.dataset.previewAlt = content.image.alt;
        content.imageWrap.setAttribute("aria-label", `放大查看 ${content.image.alt}`);
      } else {
        content.image.removeAttribute("src");
        content.image.alt = "";
        content.imageWrap.disabled = true;
        delete content.imageWrap.dataset.previewSrc;
        delete content.imageWrap.dataset.previewAlt;
        content.imageWrap.removeAttribute("aria-label");
      }
    }

    function syncLinks(links: VisibleLink[]) {
      const liveIds = new Set(links.map(l => l.id));
      renderedLinks.forEach((entry, id) => {
        if (!liveIds.has(id)) {
          entry.path.classList.add("leaving");
          window.clearTimeout(entry.removalTimer ?? 0);
          entry.removalTimer = window.setTimeout(() => {
            entry.path.remove();
            renderedLinks.delete(id);
          }, 220);
          return;
        }
        if (entry.removalTimer) {
          window.clearTimeout(entry.removalTimer);
          entry.removalTimer = null;
          entry.path.classList.remove("leaving");
        }
      });
      links.forEach(link => {
        let entry = renderedLinks.get(link.id);
        if (!entry) {
          const path = document.createElementNS(SVG_NS, "path");
          path.classList.add("mmp-link", "entering");
          path.setAttribute("pathLength", "1");
          entry = { path, removalTimer: null };
          renderedLinks.set(link.id, entry);
          linkLayer.appendChild(path);
          window.setTimeout(() => path.classList.remove("entering"), 980);
        }
        entry.path.classList.toggle("path-link", link.isPathLink);
        entry.path.setAttribute("d", linkPath(link));
      });
    }

    function updateControls() {
      const nextNode = preorder[activeIndex + 1];
      const endIndex = preorder.length;
      const isEnd = activeIndex === endIndex;
      const sliderProgress = endIndex === 0 ? 0 : (activeIndex / endIndex) * 100;
      const label = getNextStepLabel(nextNode, isEnd);
      counter.textContent = `${activeIndex + 1} / ${endIndex + 1}`;
      nodeSlider.value = String(activeIndex);
      nodeSlider.style.setProperty("--slider-progress", `${sliderProgress}%`);
      zoomSlider.value = String(Math.round(cameraZoom * 100));
      zoomValue.textContent = `${Math.round(cameraZoom * 100)}%`;
      activeScaleSlider.value = String(Math.round(activeScale * 100));
      activeScaleValue.textContent = `${activeScale.toFixed(2)}x`;
      nodeLayer.style.setProperty("--active-node-scale", activeScale.toFixed(2));
      nextPreview.classList.toggle("has-subtitle", label.hasSubtitle);
      nextSubtitle.textContent = label.subtitle;
      nextTitle.textContent = label.title;
    }

    function handleKeydown(event: KeyboardEvent) {
      if (imageViewer.isOpen()) {
        if (event.key === "Escape") { event.preventDefault(); imageViewer.close(); }
        return;
      }
      const stepByKey: Record<string, number> = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 };
      const step = stepByKey[event.key];
      if (step) { event.preventDefault(); setActiveIndex(activeIndex + step); }
    }

    function handleWheel(event: WheelEvent) {
      if (imageViewer.isOpen() || event.ctrlKey || event.metaKey) return;
      const deltaY = normalizeWheelDeltaY(event);
      if (Math.abs(deltaY) < 1) return;
      event.preventDefault();
      if (wheelDeltaBuffer !== 0 && Math.sign(wheelDeltaBuffer) !== Math.sign(deltaY)) wheelDeltaBuffer = 0;
      wheelDeltaBuffer += deltaY;
      const step = Math.trunc(wheelDeltaBuffer / wheelNavigation.threshold);
      if (step === 0) { scheduleWheelBufferReset(); return; }
      setActiveIndex(activeIndex + step);
      wheelDeltaBuffer -= step * wheelNavigation.threshold;
      scheduleWheelBufferReset();
    }

    function scheduleWheelBufferReset() {
      if (wheelNavigationTimer !== null) window.clearTimeout(wheelNavigationTimer);
      wheelNavigationTimer = window.setTimeout(() => { wheelDeltaBuffer = 0; }, wheelNavigation.idleResetMs);
    }

    function normalizeWheelDeltaY(event: WheelEvent) {
      if (event.deltaMode === 1) return event.deltaY * 16;
      if (event.deltaMode === 2) return event.deltaY * getViewportSize().height;
      return event.deltaY;
    }

    function handleTouchStart(event: TouchEvent) {
      if (imageViewer.isOpen() || event.touches.length !== 1) { swipeStart = null; return; }
      const t = event.touches[0];
      swipeStart = { x: t.clientX, y: t.clientY, isVerticalSwipe: false };
    }

    function handleTouchMove(event: TouchEvent) {
      if (!swipeStart || event.touches.length !== 1) return;
      const t = event.touches[0];
      const dx = t.clientX - swipeStart.x;
      const dy = t.clientY - swipeStart.y;
      const isVerticalIntent = Math.abs(dy) >= swipeNavigation.intentDistance &&
        Math.abs(dy) > Math.abs(dx) * swipeNavigation.dominanceRatio;
      if (swipeStart.isVerticalSwipe || isVerticalIntent) {
        swipeStart.isVerticalSwipe = true;
        event.preventDefault();
      }
    }

    function handleTouchEnd(event: TouchEvent) {
      if (!swipeStart || event.changedTouches.length === 0) { swipeStart = null; return; }
      const t = event.changedTouches[0];
      const dx = t.clientX - swipeStart.x;
      const dy = t.clientY - swipeStart.y;
      const isVertical = swipeStart.isVerticalSwipe &&
        Math.abs(dy) >= swipeNavigation.minDistance &&
        Math.abs(dy) > Math.abs(dx) * swipeNavigation.dominanceRatio;
      if (isVertical) { event.preventDefault(); setActiveIndex(activeIndex + (dy < 0 ? 1 : -1)); }
      swipeStart = null;
    }

    const onSlider = (e: Event) => setActiveIndex(Number((e.target as HTMLInputElement).value));
    const onZoom = (e: Event) => { cameraZoom = Number((e.target as HTMLInputElement).value) / 100; render(); };
    const onActive = (e: Event) => { activeScale = Number((e.target as HTMLInputElement).value) / 100; render(); };
    const onResize = () => render();
    nodeSlider.addEventListener("input", onSlider);
    zoomSlider.addEventListener("input", onZoom);
    activeScaleSlider.addEventListener("input", onActive);
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("resize", onResize);
    mindmap.addEventListener("touchstart", handleTouchStart, { passive: true });
    mindmap.addEventListener("touchmove", handleTouchMove, { passive: false });
    mindmap.addEventListener("touchend", handleTouchEnd, { passive: false });
    mindmap.addEventListener("touchcancel", () => { swipeStart = null; });

    render();

    return () => {
      nodeSlider.removeEventListener("input", onSlider);
      zoomSlider.removeEventListener("input", onZoom);
      activeScaleSlider.removeEventListener("input", onActive);
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("resize", onResize);
      mindmap.removeEventListener("touchstart", handleTouchStart);
      mindmap.removeEventListener("touchmove", handleTouchMove);
      mindmap.removeEventListener("touchend", handleTouchEnd);
      renderedNodes.forEach(e => e.group.remove());
      renderedLinks.forEach(e => e.path.remove());
      renderedNodes.clear();
      renderedLinks.clear();
      imageViewer.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return (
    <div className="mmp-shell">
      <section className="mmp-frame">
        <div id="mindmap" ref={mindmapRef} role="img" aria-label="Mindmap presentation">
          <div className="mmp-map-layer" ref={mapLayerRef}>
            <svg className="mmp-link-layer" ref={linkLayerRef} aria-hidden="true" xmlns={SVG_NS} />
            <div className="mmp-node-layer" ref={nodeLayerRef} />
          </div>
        </div>
        <section className="mmp-floating-ui" aria-label="Presentation controls">
          <div className="mmp-title-panel mmp-glass">
            <p className="mmp-eyebrow" ref={deckSubtitleRef}>Mindmap</p>
            <h1 ref={deckTitleRef}>root</h1>
          </div>
          <div className="mmp-controls mmp-glass" aria-label="节点演示操作区">
            <div className="mmp-control-main">
              <label className="mmp-scrubber">
                <input ref={nodeSliderRef} type="range" min={0} max={0} defaultValue={0} aria-label="快速定位节点" />
                <span className="mmp-counter" ref={counterRef}>1 / 1</span>
              </label>
              <div className="mmp-readout" aria-live="polite">
                <div className="mmp-readout-card">
                  <div className="mmp-readout-icon" aria-hidden="true">NEXT</div>
                  <div className="mmp-node-content has-subtitle" ref={nextPreviewRef}>
                    <span className="mmp-node-subtitle" ref={nextSubtitleRef}>即将进入</span>
                    <span className="mmp-node-title" ref={nextTitleRef}>root</span>
                  </div>
                </div>
                <div className="mmp-zoom" aria-label="缩放设置">
                  <span className="mmp-zoom-icon" aria-hidden="true">ZOOM</span>
                  <div className="mmp-zoom-fields">
                    <label className="mmp-zoom-row">
                      <input ref={zoomSliderRef} type="range" min={70} max={140} defaultValue={100} aria-label="调整整体大小" />
                      <strong ref={zoomValueRef as React.RefObject<HTMLElement>}>100%</strong>
                    </label>
                    <label className="mmp-zoom-row">
                      <input ref={activeScaleSliderRef} type="range" min={100} max={200} step={5} defaultValue={150} aria-label="调整选中节点放大倍率" />
                      <strong ref={activeScaleValueRef as React.RefObject<HTMLElement>}>1.50x</strong>
                    </label>
                  </div>
                </div>
              </div>
              <p className="mmp-hint">翻页：↑ ↓、Page Up / Page Down、滚轮或上划/下划</p>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}

interface RenderedNode {
  group: HTMLDivElement;
  content: NodeContent;
  removalTimer: number | null;
}
interface RenderedLink {
  path: SVGPathElement;
  removalTimer: number | null;
}
interface NodeContent {
  root: HTMLDivElement;
  subtitle: HTMLSpanElement;
  title: HTMLSpanElement;
  imageWrap: HTMLButtonElement;
  image: HTMLImageElement;
}

function parseMarkdownTree(markdown: string, resolveImage?: (path: string) => string): Node | null {
  const stack: Array<{ node: Node; indent: number }> = [];
  let nextId = 0;
  let parsedRoot: Node | null = null;
  markdown.split("\n").filter(line => line.trim()).forEach(line => {
    const itemMatch = line.match(/^(\s*)-\s+(.+)$/);
    if (!itemMatch) {
      const continuationMatch = line.match(/^(\s+)(\S.*)$/);
      if (continuationMatch && stack.length > 0) {
        const indent = continuationMatch[1].replace(/\t/g, "    ").length;
        const continuationParent = findContinuationParent(stack, indent);
        const continuationText = continuationMatch[2].trim();
        if (continuationParent) {
          if (continuationText.startsWith("@image ")) {
            const ref = continuationText.slice("@image ".length).trim();
            continuationParent.image = resolveImage ? resolveImage(ref) : ref;
            return;
          }
          continuationParent.label = `${continuationParent.label}\n${continuationText}`;
        }
      }
      return;
    }
    const indent = itemMatch[1].replace(/\t/g, "    ").length;
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
    const depth = stack.length;
    const node: Node = {
      id: `node-${nextId++}`,
      label: itemMatch[2].trim(),
      children: [], parent: null, depth, image: "", preorderIndex: 0,
    };
    if (depth === 0) parsedRoot = node;
    else {
      const parent = stack[depth - 1].node;
      node.parent = parent;
      parent.children.push(node);
    }
    stack.push({ node, indent });
  });
  return parsedRoot;
}

function findContinuationParent(stack: Array<{ node: Node; indent: number }>, indent: number): Node | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].indent <= indent) return stack[i].node;
  }
  return stack[stack.length - 1]?.node ?? null;
}

function assignTreeMetadata(treeRoot: Node) {
  collectPreorder(treeRoot).forEach((node, index) => { node.preorderIndex = index; });
}

function collectPreorder(node: Node, list: Node[] = []): Node[] {
  list.push(node);
  node.children.forEach(c => collectPreorder(c, list));
  return list;
}

function pathToRoot(node: Node): Node[] {
  const path: Node[] = [];
  let current: Node | null = node;
  while (current) { path.unshift(current); current = current.parent; }
  return path;
}

function computeModelBounds(nodes: VisibleNode[]) {
  return nodes.reduce((b, n) => ({
    minX: Math.min(b.minX, n.x - n.width / 2),
    maxX: Math.max(b.maxX, n.x + n.width / 2),
    minY: Math.min(b.minY, n.y - n.height / 2),
    maxY: Math.max(b.maxY, n.y + n.height / 2),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}

function keepNodeInCenterBand(viewportStart: number, viewportSize: number, nodeCenter: number, centerBandRatio: number): number {
  const bandPadding = (viewportSize * (1 - centerBandRatio)) / 2;
  const bandStart = viewportStart + bandPadding;
  const bandEnd = viewportStart + viewportSize - bandPadding;
  if (nodeCenter < bandStart) return nodeCenter - bandPadding;
  if (nodeCenter > bandEnd) return nodeCenter - viewportSize + bandPadding;
  return viewportStart;
}

function linkPath(link: VisibleLink): string {
  const startX = link.from.x + link.fromWidth / 2;
  const startY = link.from.y;
  const endX = link.to.x - link.toWidth / 2;
  const endY = link.to.y;
  const midX = startX + Math.max(36, (endX - startX) * 0.5);
  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}

function formatInlineLabel(label: string): string {
  return label.replace(/\s*\n\s*/g, " / ");
}

function splitLabel(label: string): { hasSubtitle: boolean; subtitle: string; title: string } {
  const [subtitle, ...titleLines] = label.split("\n");
  const hasSubtitle = titleLines.length > 0;
  return { hasSubtitle, subtitle, title: hasSubtitle ? titleLines.join("\n") : subtitle };
}

function getNextStepLabel(nextNode: Node | undefined, isEnd: boolean) {
  if (isEnd) return { hasSubtitle: true, subtitle: "当前", title: "结束总览" };
  if (nextNode) return splitLabel(nextNode.label);
  return { hasSubtitle: true, subtitle: "下一步", title: "结束总览" };
}

function createImageViewer() {
  const overlay = document.createElement("div");
  overlay.classList.add("mmp-image-viewer");
  overlay.setAttribute("aria-hidden", "true");
  const frame = document.createElement("div");
  frame.classList.add("mmp-image-viewer-frame");
  frame.setAttribute("role", "dialog");
  frame.setAttribute("aria-modal", "true");
  const image = document.createElement("img");
  image.classList.add("mmp-image-viewer-img");
  let returnFocusTarget: HTMLElement | null = null;
  frame.append(image);
  overlay.append(frame);
  document.body.append(overlay);

  function open(src: string, alt: string) {
    returnFocusTarget = (document.activeElement as HTMLElement) ?? null;
    image.src = src;
    image.alt = alt;
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("mmp-image-viewer-open");
  }

  function close() {
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("mmp-image-viewer-open");
    if (returnFocusTarget && document.contains(returnFocusTarget)) returnFocusTarget.focus();
    returnFocusTarget = null;
  }

  overlay.addEventListener("click", close);

  return {
    open, close,
    isOpen: () => overlay.classList.contains("open"),
    destroy: () => { overlay.remove(); },
  };
}
