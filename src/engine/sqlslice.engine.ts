import { DatabaseConnector } from '../connectors/base.connector';
import { ProcedureSlice } from '../slice/procedure-slice';
import {
  MaterializedView,
  CreateMaterializedViewOptions,
  RefreshMaterializedViewOptions,
  DropMaterializedViewOptions,
} from '../materialized-view/materialized-view';
import { Slice } from '../slice/slice';
import { SliceRegistry } from '../slice/slice-registry';
import { QueryResult } from '../types';

export interface ComposeOptions {
  /** Per-slice template params, keyed by slice name. */
  sliceParams?: Record<string, Record<string, unknown>>;
  /** Positional bind parameters for the final composed SQL ($1, $2, …). */
  bindParams?: unknown[];
}

export class SqlSliceEngine {
  private readonly _connector: DatabaseConnector;
  private readonly registry: SliceRegistry;

  constructor(connector: DatabaseConnector) {
    this._connector = connector;
    this.registry = new SliceRegistry();
  }

  get connector(): DatabaseConnector {
    return this._connector;
  }

  /** Register a slice so it can be referenced by name. Chainable. */
  register(slice: Slice<any, any>): this {
    this.registry.register(slice);
    return this;
  }

  async connect(): Promise<this> {
    await this._connector.connect();
    return this;
  }

  async disconnect(): Promise<void> {
    await this._connector.disconnect();
  }

  /** Execute a single registered slice by name. */
  async run<TResult = Record<string, unknown>>(
    sliceName: string,
    templateParams?: Record<string, unknown>,
    bindParams?: unknown[],
  ): Promise<QueryResult<TResult>> {
    const slice = this.registry.get(sliceName);
    const sql = slice.buildSql(templateParams);
    return this._connector.query<TResult>(sql, bindParams);
  }

  /**
   * Compose multiple registered slices as CTEs then run a final SELECT.
   *
   * @param sliceNames  Ordered list of CTE slice names.
   * @param finalSelect The SELECT that references those CTEs.
   * @param options     Optional per-slice template params and bind params.
   */
  async compose<TResult = Record<string, unknown>>(
    sliceNames: string[],
    finalSelect: string,
    options?: ComposeOptions,
  ): Promise<QueryResult<TResult>> {
    const entries = sliceNames.map((name) => ({
      slice: this.registry.get(name),
      params: options?.sliceParams?.[name],
    }));

    const sql = Slice.withCtes(entries, finalSelect);
    return this._connector.query<TResult>(sql, options?.bindParams);
  }

  /** Expose the registry for introspection (e.g. listing registered slices). */
  getRegistry(): SliceRegistry {
    return this.registry;
  }

  // ── Materialized view management ─────────────────────────────────────────

  async createMaterializedView(
    mv: MaterializedView,
    options?: CreateMaterializedViewOptions,
  ): Promise<void> {
    await this._connector.execute(mv.createSql(options));
  }

  async refreshMaterializedView(
    mv: MaterializedView,
    options?: RefreshMaterializedViewOptions,
  ): Promise<void> {
    await this._connector.execute(mv.refreshSql(options));
  }

  async dropMaterializedView(
    mv: MaterializedView,
    options?: DropMaterializedViewOptions,
  ): Promise<void> {
    await this._connector.execute(mv.dropSql(options));
  }

  // ── Stored procedure / function management ────────────────────────────────

  /** Run CREATE OR REPLACE FUNCTION / PROCEDURE DDL. */
  async createProcedure(proc: ProcedureSlice<any, any>): Promise<void> {
    await this._connector.execute(proc.createSql);
  }

  /** CALL or SELECT a procedure and return rows (e.g. SET-RETURNING functions). */
  async callProcedure<TResult = Record<string, unknown>>(
    proc: ProcedureSlice<any, TResult>,
    templateParams?: Record<string, unknown>,
    bindParams?: unknown[],
  ): Promise<QueryResult<TResult>> {
    return this._connector.query<TResult>(
      proc.buildInvokeSql(templateParams),
      bindParams,
    );
  }

  /** CALL a procedure that returns void (no result set). */
  async executeProcedure(
    proc: ProcedureSlice<any, any>,
    templateParams?: Record<string, unknown>,
    bindParams?: unknown[],
  ): Promise<void> {
    await this._connector.execute(
      proc.buildInvokeSql(templateParams),
      bindParams,
    );
  }

  /** DROP FUNCTION / PROCEDURE. */
  async dropProcedure(
    proc: ProcedureSlice<any, any>,
    options?: { ifExists?: boolean },
  ): Promise<void> {
    await this._connector.execute(proc.dropSql(options));
  }
}
