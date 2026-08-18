import type { ElementType } from "@ke/domain";
import "./components.css";

export type IconName =
  | "brain"
  | "book"
  | "eye"
  | "target"
  | "chat"
  | "diamond"
  | "branch"
  | "spark"
  | "expand"
  | "link"
  | "rocket"
  | "center"
  | "card"
  | "search"
  | "grid"
  | "map"
  | "bell"
  | "upload"
  | "calendar"
  | "palette"
  | "gear"
  | "pencil"
  | "heart";

interface Props {
  name: IconName;
  className?: string;
}

const paths: Record<IconName, string[]> = {
  brain: [
    "M8.5 5.5c-2.2 0-4 1.7-4 3.9 0 .8.2 1.5.6 2.1A4.4 4.4 0 0 0 4 14.5c0 2.2 1.7 4 3.9 4 .6 1.3 1.9 2 3.3 2 1.8 0 3.3-1.5 3.3-3.3V6.9a3.4 3.4 0 0 0-6-1.4Z",
    "M15.5 6.9v10.3c0 1.8 1.5 3.3 3.3 3.3 1.4 0 2.7-.8 3.3-2 2.2 0 3.9-1.8 3.9-4 0-1.1-.4-2.1-1.1-2.9.4-.6.6-1.4.6-2.2 0-2.2-1.8-3.9-4-3.9a3.4 3.4 0 0 0-6 1.4Z",
    "M9 10h3M9 14h3M18 10h3M18 14h3",
  ],
  book: ["M5 6.5c0-1.1.9-2 2-2h5v15H7a2 2 0 0 1-2-2v-11Z", "M12 4.5h5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-5", "M7.5 8.5h2.5M14 8.5h2.5"],
  eye: ["M3 12s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6Z", "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"],
  target: ["M12 4v3M12 17v3M4 12h3M17 12h3", "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z", "M12 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"],
  chat: ["M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v4A3.5 3.5 0 0 1 15.5 14H11l-4.5 4v-4A3.5 3.5 0 0 1 5 10.5v-4Z", "M9 8.5h.1M12 8.5h.1M15 8.5h.1"],
  diamond: ["M12 3 21 12 12 21 3 12 12 3Z", "M9 12h6"],
  branch: ["M6 6a2 2 0 1 1 2 2 2 2 0 0 1-2-2ZM16 6a2 2 0 1 1 2 2 2 2 0 0 1-2-2ZM16 18a2 2 0 1 1 2 2 2 2 0 0 1-2-2Z", "M8 6h4c2.2 0 4 1.8 4 4v6M8 6c4 1 6 4 8 10"],
  spark: ["M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3Z", "M5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8L5 16Z"],
  expand: ["M8 4H4v4M16 4h4v4M4 16v4h4M20 16v4h-4", "M4 4l6 6M20 4l-6 6M4 20l6-6M20 20l-6-6"],
  link: ["M9.5 14.5 14.5 9.5", "M10 7.5l1-1a4 4 0 0 1 5.7 5.7l-1 1", "M14 16.5l-1 1a4 4 0 0 1-5.7-5.7l1-1"],
  rocket: ["M6 16c3.5-.6 7-3.8 9-7.5A12 12 0 0 1 21 3c-.3 2.2-1.7 4.4-3.6 6.4C14.9 12 11.4 14.2 8 15l-2 1Z", "M8 15l-2 5 5-2M14 7.5h.1"],
  center: ["M12 3v4M12 17v4M3 12h4M17 12h4", "M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z"],
  card: ["M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z", "M7 8h10M7 12h6M7 16h8"],
  search: ["M10.5 5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z", "M15 15l4 4"],
  grid: ["M4 4h6v6H4V4ZM14 4h6v6h-6V4ZM4 14h6v6H4v-6ZM14 14h6v6h-6v-6Z"],
  map: ["M5 5l5-2 5 2 4-2v16l-4 2-5-2-5 2V5Z", "M10 3v16M15 5v16"],
  bell: ["M18 10a6 6 0 0 0-12 0c0 7-2 7-2 7h16s-2 0-2-7Z", "M10 21h4"],
  upload: ["M12 16V4M7 9l5-5 5 5", "M5 18v2h14v-2"],
  calendar: ["M5 5h14v15H5V5Z", "M8 3v4M16 3v4M5 10h14"],
  palette: [
    "M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.9 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2H17a4 4 0 0 0 4-4c0-4.4-4-7.5-9-7.5Z",
    "M7.5 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM10.5 8.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM15 8.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM17.5 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z",
  ],
  gear: [
    "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
    "M19.4 12c0-.5-.05-1-.13-1.5l2-1.5-2-3.4-2.3.95a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.37 2.55a7.5 7.5 0 0 0-2.6 1.5L4.73 5.6 2.73 9l2 1.5c-.08.5-.13 1-.13 1.5s.05 1 .13 1.5l-2 1.5 2 3.4 2.3-.95a7.5 7.5 0 0 0 2.6 1.5L10 21.5h4l.37-2.55a7.5 7.5 0 0 0 2.6-1.5l2.3.95 2-3.4-2-1.5c.08-.5.13-1 .13-1.5Z",
  ],
  pencil: [
    "M14.5 4.5l5 5L8.5 20.5H3.5v-5L14.5 4.5Z",
    "M13 6l5 5",
  ],
  heart: [
    "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z",
  ],
};

export function Icon({ name, className = "" }: Props) {
  return (
    <svg className={`ke-icon ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      {paths[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function iconForElement(type: ElementType, title?: string): IconName {
  if (title?.includes("感知") || title?.includes("视觉")) return "eye";
  if (title?.includes("记忆")) return "book";
  if (title?.includes("注意")) return "target";
  if (title?.includes("语言")) return "chat";
  if (title?.includes("推理")) return "diamond";
  if (title?.includes("决策")) return "branch";
  if (type === "practice" || type === "project") return "rocket";
  if (type === "product-design") return "diamond";
  if (type === "summary") return "card";
  if (type === "topic") return "brain";
  return "spark";
}
