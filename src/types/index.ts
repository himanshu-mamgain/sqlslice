export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  fields?: FieldInfo[];
}

export interface FieldInfo {
  name: string;
  dataType?: string;
}

export interface BaseConnectionConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  password: string;
}

export interface PostgresConfig extends BaseConnectionConfig {
  port?: number;
  ssl?: boolean | object;
  poolSize?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export type SliceType = 'query' | 'procedure' | 'view' | 'fragment';

export interface SliceDefinition<
  TParams = Record<string, unknown>,
  TResult = Record<string, unknown>,
> {
  name: string;
  type: SliceType;
  sql: string | ((params: TParams) => string);
  dependencies?: string[];
  description?: string;
}
