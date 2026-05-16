# sqlslice

Composable SQL architecture framework for breaking large relational queries, stored procedures, and materialized views into reusable, maintainable **slices**.

## Installation

```bash
npm install sqlslice
```

## Concepts

| Term | Description |
|---|---|
| **Slice** | A named, reusable SQL unit (query, CTE fragment, view reference, or procedure call). |
| **SliceRegistry** | An in-memory store of registered slices. |
| **SqlSliceEngine** | Ties a `DatabaseConnector` to a `SliceRegistry`; runs and composes slices. |
| **DatabaseConnector** | Abstract base class — extend it to add a new database driver. |

## Quick start

```typescript
import {
  PostgresConnector,
  SqlSliceEngine,
  Slice,
} from 'sqlslice';

const connector = new PostgresConnector({
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  user: 'admin',
  password: 'secret',
});

const engine = new SqlSliceEngine(connector);
await engine.connect();

// 1. Define slices
const activeUsers = new Slice({
  name: 'active_users',
  type: 'fragment',
  description: 'Users who logged in within the last 30 days',
  sql: `SELECT id, name, email FROM users WHERE last_login >= NOW() - INTERVAL '30 days'`,
});

const premiumUsers = new Slice({
  name: 'premium_users',
  type: 'fragment',
  sql: `SELECT user_id FROM subscriptions WHERE plan = 'premium' AND status = 'active'`,
});

// 2. Register
engine.register(activeUsers).register(premiumUsers);

// 3. Run a single slice
const { rows } = await engine.run('active_users');

// 4. Compose slices as CTEs + a final SELECT
const result = await engine.compose(
  ['active_users', 'premium_users'],
  `SELECT au.* FROM active_users au
   JOIN premium_users pu ON pu.user_id = au.id`,
);
// Emits:
//   WITH active_users AS (...),
//        premium_users AS (...)
//   SELECT au.* FROM active_users au JOIN premium_users pu ON ...

await engine.disconnect();
```

## Dynamic SQL with template params

Pass a function as `sql` to build the query at runtime:

```typescript
const recentOrders = new Slice<{ days: number }>({
  name: 'recent_orders',
  type: 'query',
  sql: ({ days }) =>
    `SELECT * FROM orders WHERE created_at >= NOW() - INTERVAL '${days} days'`,
});

engine.register(recentOrders);

const { rows } = await engine.run('recent_orders', { days: 7 });
```

## Positional bind parameters

Use `$1`, `$2`, … placeholders and pass `bindParams` for safe parameterized queries:

```typescript
const ordersByStatus = new Slice({
  name: 'orders_by_status',
  type: 'query',
  sql: `SELECT * FROM orders WHERE status = $1`,
});

engine.register(ordersByStatus);

const { rows } = await engine.run(
  'orders_by_status',
  undefined,
  ['shipped'],       // bindParams → $1 = 'shipped'
);
```

## OOP connector hierarchy

```
DatabaseConnector  (abstract)
└── PostgresConnector
```

To add a new database, extend `DatabaseConnector`:

```typescript
import { DatabaseConnector, QueryResult } from 'sqlslice';

export class MySQLConnector extends DatabaseConnector {
  get databaseType() { return 'mysql'; }
  get isConnected() { /* ... */ }

  async connect() { /* ... */ }
  async disconnect() { /* ... */ }
  async query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> { /* ... */ }
  async execute(sql: string, params?: unknown[]): Promise<void> { /* ... */ }
}
```

Then pass it straight into `SqlSliceEngine` — no other changes needed.

## Slice types

| `type` | Use for |
|---|---|
| `'query'` | Full SELECT statements |
| `'fragment'` | Sub-queries / CTE bodies |
| `'view'` | References to materialized / regular views |
| `'procedure'` | Stored procedure calls |

## API reference

### `new PostgresConnector(config: PostgresConfig)`

| Option | Type | Default |
|---|---|---|
| `host` | `string` | — |
| `port` | `number` | `5432` |
| `database` | `string` | — |
| `user` | `string` | — |
| `password` | `string` | — |
| `ssl` | `boolean \| object` | — |
| `poolSize` | `number` | `10` |
| `idleTimeoutMillis` | `number` | `30000` |
| `connectionTimeoutMillis` | `number` | `2000` |

### `SqlSliceEngine`

| Method | Description |
|---|---|
| `.connect()` | Open the underlying connection pool. Returns `this` (chainable). |
| `.disconnect()` | Close the pool. |
| `.register(slice)` | Add a slice to the registry. Returns `this` (chainable). |
| `.run(name, templateParams?, bindParams?)` | Execute a single slice. |
| `.compose(names, finalSelect, options?)` | Build a `WITH … AS (…)` query and execute it. |
| `.getRegistry()` | Access the `SliceRegistry` for introspection. |

## License

MIT
