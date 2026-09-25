export type DeepMindMap = {
  id: string;
  title: string;
  map: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type DeepMindMapCreateInput = Pick<DeepMindMap, "title" | "map"> & { id?: string; importOnly?: boolean };
export type DeepMindMapUpdateInput = Pick<DeepMindMap, "title" | "map"> & { expectedUpdatedAt: string };

export interface DeepMindMapsRepo {
  list(): Promise<DeepMindMap[]>;
  get(id: string): Promise<DeepMindMap | null>;
  create(input: DeepMindMapCreateInput): Promise<DeepMindMap>;
  update(id: string, input: DeepMindMapUpdateInput): Promise<DeepMindMap | "conflict" | null>;
  remove(id: string): Promise<boolean>;
}
