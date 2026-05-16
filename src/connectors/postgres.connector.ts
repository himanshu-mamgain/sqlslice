import { Pool, PoolClient, QueryResultRow } from 'pg';
import { DatabaseConnector } from './base.connector';
import { PostgresConfig, QueryResult } from '../types';

export class PostgresConnector extends DatabaseConnector {
  private pool: Pool | null = null;
  private _isConnected = false;

  constructor(private readonly config: PostgresConfig) {
    super();
  }

  get databaseType(): string {
    return 'postgres';
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(): Promise<void> {
    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port ?? 5432,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl as boolean | undefined,
      max: this.config.poolSize ?? 10,
      idleTimeoutMillis: this.config.idleTimeoutMillis ?? 30000,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis ?? 2000,
    });

    // Verify connectivity eagerly
    const client: PoolClient = await this.pool.connect();
    client.release();
    this._isConnected = true;
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this._isConnected = false;
    }
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    this.assertConnected();
    const result = await this.pool!.query<T & QueryResultRow>(sql, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
      fields: result.fields.map((f) => ({
        name: f.name,
        dataType: String(f.dataTypeID),
      })),
    };
  }

  async execute(sql: string, params?: unknown[]): Promise<void> {
    this.assertConnected();
    await this.pool!.query(sql, params);
  }

  private assertConnected(): void {
    if (!this.pool || !this._isConnected) {
      throw new Error(
        'PostgresConnector: not connected. Call connect() first.',
      );
    }
  }
}
