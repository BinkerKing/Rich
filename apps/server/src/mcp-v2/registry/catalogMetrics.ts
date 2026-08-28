export interface CatalogMetricTool {
  name: string;
  description?: string;
  inputSchema: unknown;
}

export interface CatalogMetrics {
  toolCount: number;
  schemaBytes: number;
}

export function stableCatalogJson(tools: CatalogMetricTool[]): string {
  return JSON.stringify(
    [...tools].sort((left, right) => left.name.localeCompare(right.name)),
    (_key, value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right)),
      );
    },
  );
}

export function measureCatalog(tools: CatalogMetricTool[]): CatalogMetrics {
  return {
    toolCount: tools.length,
    schemaBytes: Buffer.byteLength(stableCatalogJson(tools), "utf8"),
  };
}
