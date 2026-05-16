import { SliceDefinition, SliceType } from '../types';

export interface CteEntry<TParams = Record<string, unknown>> {
  slice: Slice<TParams, any>;
  params?: TParams;
}

export interface UnionEntry<TParams = Record<string, unknown>> {
  slice: Slice<TParams, any>;
  params?: TParams;
}

export class Slice<
  TParams = Record<string, unknown>,
  TResult = Record<string, unknown>,
> {
  readonly name: string;
  readonly type: SliceType;
  readonly dependencies: ReadonlyArray<string>;
  readonly description?: string;

  private readonly sqlBuilder:
    | string
    | ((params: TParams) => string);

  constructor(definition: SliceDefinition<TParams, TResult>) {
    this.name = definition.name;
    this.type = definition.type;
    this.sqlBuilder = definition.sql;
    this.dependencies = Object.freeze(definition.dependencies ?? []);
    this.description = definition.description;
  }

  buildSql(params?: TParams): string {
    return typeof this.sqlBuilder === 'function'
      ? this.sqlBuilder(params as TParams)
      : this.sqlBuilder;
  }

  toCte(params?: TParams): string {
    return `${this.name} AS (\n  ${this.buildSql(params)}\n)`;
  }

  /**
   * Compose multiple slices as CTEs followed by a final SELECT.
   *
   *   WITH slice_a AS (...), slice_b AS (...)
   *   SELECT * FROM slice_a JOIN slice_b USING (id)
   */
  static withCtes(entries: CteEntry[], finalSelect: string): string {
    if (entries.length === 0) {
      return finalSelect;
    }
    const ctes = entries
      .map(({ slice, params }) => slice.toCte(params))
      .join(',\n');
    return `WITH ${ctes}\n${finalSelect}`;
  }

  /**
   * Compose multiple slices with UNION ALL (or UNION).
   *
   *   SELECT ... FROM flight_bookings
   *   UNION ALL
   *   SELECT ... FROM hotel_bookings
   *   UNION ALL
   *   ...
   */
  static union(
    entries: UnionEntry[],
    options?: { all?: boolean },
  ): string {
    const separator =
      options?.all !== false ? '\n\nUNION ALL\n\n' : '\n\nUNION\n\n';
    return entries
      .map(({ slice, params }) => slice.buildSql(params))
      .join(separator);
  }
}
