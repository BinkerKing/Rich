export type Flowchart = {
  id: string;
  title: string;
  graph: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export interface FlowchartsRepo {
  list(): Promise<Flowchart[]>;
  get(id: string): Promise<Flowchart | null>;
  create(input: Pick<Flowchart, "title" | "graph">): Promise<Flowchart>;
  update(id: string, patch: Partial<Pick<Flowchart, "title" | "graph">>): Promise<Flowchart | null>;
  remove(id: string): Promise<boolean>;
}
