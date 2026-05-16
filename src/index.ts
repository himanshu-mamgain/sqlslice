// Connectors
export { DatabaseConnector } from './connectors/base.connector';
export { PostgresConnector } from './connectors/postgres.connector';

// Slice primitives
export { Slice, SliceRegistry, ProcedureSlice } from './slice';
export type { CteEntry, UnionEntry, ProcedureSliceDefinition } from './slice';

// Materialized views
export { MaterializedView } from './materialized-view';
export type {
  CreateMaterializedViewOptions,
  RefreshMaterializedViewOptions,
  DropMaterializedViewOptions,
} from './materialized-view';

// Engine
export { SqlSliceEngine } from './engine';
export type { ComposeOptions } from './engine';

// Types
export type {
  QueryResult,
  FieldInfo,
  BaseConnectionConfig,
  PostgresConfig,
  SliceType,
  SliceDefinition,
} from './types';
