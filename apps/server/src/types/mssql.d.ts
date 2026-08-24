declare module "mssql" {
export interface QueryResult {
  rowsAffected: number[];
  recordset?: Array<Record<string, unknown>>;
}

  export interface Request {
    input(name: string, value: unknown): Request;
    query(sql: string): Promise<QueryResult>;
  }

  export interface ConnectionPool {
    request(): Request;
    close(): Promise<void>;
  }

  export interface ConnectionConfig {
    server: string;
    port?: number;
    database: string;
    user: string;
    password?: string;
    options?: {
      encrypt?: boolean;
      trustServerCertificate?: boolean;
    };
  }

  const mssql: {
    connect(config: ConnectionConfig): Promise<ConnectionPool>;
  };

  export default mssql;
}
