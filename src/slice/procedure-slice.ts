export interface ProcedureSliceDefinition<
  TParams = Record<string, unknown>,
  TResult = Record<string, unknown>,
> {
  name: string;
  description?: string;
  /** CREATE OR REPLACE FUNCTION / PROCEDURE DDL */
  createSql: string;
  /**
   * SQL to invoke the procedure.
   * Use a function to build it from template params (e.g. argument values).
   * Use positional bind params ($1, $2, …) for safe value passing.
   *
   * Examples:
   *   string:   "CALL refresh_all_views()"
   *   function: (p) => `SELECT create_org_materialized_view('${p.orgSlug}')`
   */
  invokeSql: string | ((params: TParams) => string);
}

export class ProcedureSlice<
  TParams = Record<string, unknown>,
  TResult = Record<string, unknown>,
> {
  readonly name: string;
  readonly type = 'procedure' as const;
  readonly description?: string;

  private readonly _createSql: string;
  private readonly _invokeSql: string | ((params: TParams) => string);

  // TResult is carried on the type so callers can annotate query results
  declare readonly _result: TResult;

  constructor(definition: ProcedureSliceDefinition<TParams, TResult>) {
    this.name = definition.name;
    this.description = definition.description;
    this._createSql = definition.createSql;
    this._invokeSql = definition.invokeSql;
  }

  get createSql(): string {
    return this._createSql;
  }

  buildInvokeSql(params?: TParams): string {
    return typeof this._invokeSql === 'function'
      ? this._invokeSql(params as TParams)
      : this._invokeSql;
  }

  dropSql(options?: { ifExists?: boolean }): string {
    const ifExists = options?.ifExists !== false ? 'IF EXISTS ' : '';
    return `DROP FUNCTION ${ifExists}${this.name}`;
  }
}
