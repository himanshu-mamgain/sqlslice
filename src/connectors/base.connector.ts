import { QueryResult } from '../types';

/**
 * Abstract base class for all database connectors.
 * Extend this class to add support for a new relational database.
 */
export abstract class DatabaseConnector {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  abstract query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;

  abstract execute(sql: string, params?: unknown[]): Promise<void>;

  abstract get isConnected(): boolean;
  abstract get databaseType(): string;
}
