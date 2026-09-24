export type OutlineNode = {
  id: string;
  text: string;
  data?: Record<string, unknown>;
  expanded?: boolean;
  children: OutlineNode[];
};

export type OutlineEditorProps = {
  root: OutlineNode;
  onChange: (root: OutlineNode) => void;
  createId: () => string;
  className?: string;
  themeConfig?: Record<string, unknown>;
  onNodeSelect?: (nodeId: string) => void;
};
