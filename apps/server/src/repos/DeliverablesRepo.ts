export type Deliverable = {
  id: string;
  title: string;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export interface DeliverablesRepo {
  list(): Promise<Deliverable[]>;
  get(id: string): Promise<Deliverable | null>;
  create(input: Pick<Deliverable, "title" | "content">): Promise<Deliverable>;
  update(id: string, patch: Partial<Pick<Deliverable, "title" | "content">>): Promise<Deliverable | null>;
  remove(id: string): Promise<boolean>;
}
