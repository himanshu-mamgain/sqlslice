import { Slice, UnionEntry } from '../slice/slice';

function assertSafeIdentifier(name: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(
      `Unsafe SQL identifier "${name}". Use only letters, digits, and underscores.`,
    );
  }
}

export interface CreateMaterializedViewOptions {
  dropIfExists?: boolean;
}

export interface RefreshMaterializedViewOptions {
  concurrently?: boolean;
}

export interface DropMaterializedViewOptions {
  ifExists?: boolean;
}

export class MaterializedView {
  readonly name: string;
  private readonly querySql: string | (() => string);

  constructor(name: string, querySql: string | (() => string)) {
    assertSafeIdentifier(name);
    this.name = name;
    this.querySql = querySql;
  }

  /**
   * Build a MaterializedView whose body is a UNION ALL of the given slices.
   * Pass per-slice template params via the entries array.
   */
  static fromUnion(name: string, entries: UnionEntry[]): MaterializedView {
    return new MaterializedView(name, () => Slice.union(entries));
  }

  buildQuery(): string {
    return typeof this.querySql === 'function' ? this.querySql() : this.querySql;
  }

  createSql(options?: CreateMaterializedViewOptions): string {
    const parts: string[] = [];
    if (options?.dropIfExists) {
      parts.push(`DROP MATERIALIZED VIEW IF EXISTS "${this.name}";\n`);
    }
    parts.push(`CREATE MATERIALIZED VIEW "${this.name}" AS\n${this.buildQuery()}`);
    return parts.join('');
  }

  refreshSql(options?: RefreshMaterializedViewOptions): string {
    const concurrent = options?.concurrently ? 'CONCURRENTLY ' : '';
    return `REFRESH MATERIALIZED VIEW ${concurrent}"${this.name}"`;
  }

  dropSql(options?: DropMaterializedViewOptions): string {
    const ifExists = options?.ifExists !== false ? 'IF EXISTS ' : '';
    return `DROP MATERIALIZED VIEW ${ifExists}"${this.name}"`;
  }
}
