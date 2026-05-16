/**
 * Unified Analytics Materialized View — Migration Runner
 *
 * Mirrors the PostgreSQL function create_org_materialized_view() using sqlslice.
 * Each UNION ALL branch is an isolated Slice; MaterializedView composes them.
 *
 * Schema changes covered:
 *   20260412183010_multi_approval
 *   20260428103813_add_fee_component_kind_and_hotel_conv_fee
 *   20260511121429_replace_gst_on_conv_fee_with_cgst_sgst_igst
 */

import { PostgresConnector, SqlSliceEngine, MaterializedView } from '../../src';
import { flightSlice, AnalyticsSliceParams } from './slices/flight.slice';
import { hotelSlice } from './slices/hotel.slice';
import { paymentSlice } from './slices/payment.slice';
import { flightAmendmentSlice } from './slices/flight-amendment.slice';
import { hotelAmendmentSlice } from './slices/hotel-amendment.slice';

// ── Slug validation (mirrors the PL/pgSQL guard) ──────────────────────────────

function validateOrgSlug(slug: string): void {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`Invalid organization slug format: "${slug}"`);
  }
}

function viewNameFromSlug(slug: string): string {
  return `mv_unified_analytics_${slug.replace(/-/g, '_')}`;
}

// ── Core migration function ───────────────────────────────────────────────────

export async function createOrgMaterializedView(
  engine: SqlSliceEngine,
  orgSlug: string,
  orgId: string,
  /**
   * LIKE pattern to detect intra-state GST address.
   * e.g. '%karnataka%' means the org's GST address is Karnataka-registered
   * → CGST + SGST apply instead of IGST.
   */
  gstStatePattern = '%karnataka%',
): Promise<void> {
  validateOrgSlug(orgSlug);

  const params: AnalyticsSliceParams = { orgId, gstStatePattern };

  const mv = MaterializedView.fromUnion(
    viewNameFromSlug(orgSlug),
    [
      { slice: flightSlice,          params },
      { slice: hotelSlice,           params },
      { slice: paymentSlice,         params },
      { slice: flightAmendmentSlice, params },
      { slice: hotelAmendmentSlice,  params },
    ],
  );

  // DROP IF EXISTS then CREATE — same semantics as the original PL/pgSQL
  await engine.createMaterializedView(mv, { dropIfExists: true });

  console.log(`Created materialized view: ${mv.name}`);
}

// ── Refresh helper ────────────────────────────────────────────────────────────

export async function refreshOrgMaterializedView(
  engine: SqlSliceEngine,
  orgSlug: string,
): Promise<void> {
  validateOrgSlug(orgSlug);

  // MaterializedView.fromUnion is not needed for refresh — we only need the name.
  // Build a dummy view just to get the correct DDL.
  const mv = new MaterializedView(viewNameFromSlug(orgSlug), '');
  await engine.refreshMaterializedView(mv);

  console.log(`Refreshed materialized view: ${mv.name}`);
}

// ── CLI entry point (ts-node examples/unified-analytics/migration.ts) ─────────

async function main() {
  const connector = new PostgresConnector({
    host: process.env['DB_HOST'] ?? 'localhost',
    port: Number(process.env['DB_PORT'] ?? 5432),
    database: process.env['DB_NAME'] ?? 'tripare',
    user: process.env['DB_USER'] ?? 'postgres',
    password: process.env['DB_PASSWORD'] ?? '',
  });

  const engine = new SqlSliceEngine(connector);
  await engine.connect();

  try {
    // Run for every org that needs the view
    const orgs: Array<{ slug: string; id: string }> = [
      { slug: 'acme-corp', id: 'org_acme_001' },
      // add more orgs here
    ];

    for (const org of orgs) {
      await createOrgMaterializedView(engine, org.slug, org.id);
    }
  } finally {
    await engine.disconnect();
  }
}

main().catch(console.error);
