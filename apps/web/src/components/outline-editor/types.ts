export type OutlineNode = {
  id: string;
  text: string;
  expanded?: boolean;
  children: OutlineNode[];
};

export type OutlineEditorProps = {
  root: OutlineNode;
  onChange: (root: OutlineNode) => void;
  createId: () => string;
  className?: string;
};
