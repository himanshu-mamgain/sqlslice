/**
 * The create_org_materialized_view stored procedure modelled as a ProcedureSlice.
 *
 * Two usage patterns:
 *
 *  A) Keep the PL/pgSQL function in the DB and call it from TypeScript.
 *     Useful when the function already exists and you just want typed invocation.
 *
 *  B) Use the TypeScript-first approach (migration.ts) which replaces the
 *     entire function body with composed Slice objects.
 *     Prefer this for new work — slices are testable and version-controlled.
 */

import { ProcedureSlice } from '../../src';

interface CreateOrgViewParams {
  orgSlug: string;
}

export const createOrgViewProcedure = new ProcedureSlice<CreateOrgViewParams>({
  name: 'create_org_materialized_view',
  description:
    'Creates or replaces the per-org unified analytics materialized view',

  // ── DDL ─────────────────────────────────────────────────────────────────
  // The full CREATE OR REPLACE FUNCTION body.
  // Deploy once with engine.createProcedure(); call it per-org afterwards.
  createSql: `
    CREATE OR REPLACE FUNCTION create_org_materialized_view(org_slug TEXT)
    RETURNS void
    LANGUAGE plpgsql
    AS $$
    DECLARE
        view_name  TEXT;
        org_id_val TEXT;
    BEGIN
        IF org_slug !~ '^[a-z0-9-]+$' THEN
            RAISE EXCEPTION 'Invalid organization slug format: %', org_slug;
        END IF;

        view_name := 'mv_unified_analytics_' || replace(org_slug, '-', '_');

        SELECT id INTO org_id_val FROM organizations WHERE slug = org_slug;

        IF org_id_val IS NULL THEN
            RAISE EXCEPTION 'Organization with slug % not found', org_slug;
        END IF;

        EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I', view_name);

        EXECUTE format($sql$
            CREATE MATERIALIZED VIEW %I AS
            -- (full UNION ALL query — kept in DB migration files)
            SELECT 1
        $sql$, view_name);
    END;
    $$`,

  // ── Invocation ───────────────────────────────────────────────────────────
  // PostgreSQL functions use SELECT, not CALL (CALL is for procedures without
  // a return value defined with LANGUAGE plpgsql RETURNS void in older versions;
  // for safety we use SELECT which works for both functions and procedures).
  invokeSql: ({ orgSlug }) =>
    `SELECT create_org_materialized_view('${orgSlug.replace(/'/g, "''")}')`,
});
