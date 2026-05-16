import { Slice } from '../../../src';
import { AnalyticsSliceParams } from './flight.slice';

export const paymentSlice = new Slice<AnalyticsSliceParams>({
  name: 'payment_transactions_analytics',
  type: 'fragment',
  description: 'Payment transactions branch of the unified analytics view',
  sql: ({ orgId }) => `
        SELECT
          pt.id,
          'PAYMENT'::text AS entity_type,
          pt."organizationId" AS organization_id,
          pt."tripId" AS trip_id,
          pt."memberId" AS member_id,
          m."userId" AS user_id,
          pt."createdAt" AS created_at,
          pt."updatedAt" AS updated_at,
          pt.amount AS cost,
          0::double precision AS cgst,
          0::double precision AS sgst,
          0::double precision AS igst,
          0::double precision AS "totalFareWithoutMarkup",
          0::double precision AS "totalFareWithGst",
          pt.payment_method,
          pt.currency,
          pt.status::text AS status,
          t."approvalStatus"::text AS approval_status,
          CASE WHEN t."organizationGuestId" IS NOT NULL
            THEN (og."travelerDetails"->>'fullName') ELSE u.name
          END AS requester_name,
          CASE WHEN t."organizationGuestId" IS NOT NULL
            THEN 'Guest' ELSE m.department
          END AS requester_department,
          COALESCE(d.name, m."designationId") AS requester_designation,
          m.role AS requester_role,
          au.name AS approver_name,
          t."tripNumber" AS trip_number,
          t."startDate" AS start_date,
          t."endDate" AS end_date,
          NULL::text AS origin_code,
          NULL::text AS destination_code,
          NULL::text AS flight_type,
          NULL::text AS flight_number,
          NULL::text AS pnr,
          NULL::boolean AS is_international,
          NULL::text AS city_name,
          NULL::text AS hotel_name,
          NULL::timestamp AS check_in,
          NULL::timestamp AS check_out,
          NULL::text AS supplier_code,
          NULL::jsonb AS policy_compliance,
          NULL::text AS policy_tag,
          '[]'::jsonb AS flight_segments,
          NULL::jsonb AS hotel_booking_details,
          NULL::numeric AS potential_savings,
          NULL::numeric AS savings_percentage,
          NULL::jsonb AS frugality_details,
          NULL::text AS amendment_type,
          NULL::text AS amendment_status,
          NULL::numeric AS refundable_amount,
          NULL::text AS orig_booking_id,
          NULL::text AS reason,
          NULL::text AS refund_eligible,
          NULL::text AS charges_category,
          0::numeric AS fee,
          NULL::text AS fare_identifier,
          NULL::text AS corporate_code,
          -- Delegation
          t."delegatedByMemberId" AS delegation_member_id,
          du.name AS delegated_by_name,
          -- Multi-approval
          t."approvalMode"::text AS approval_mode,
          t."currentApprovalLevel" AS current_approval_level,
          t."totalApprovalLevels" AS total_approval_levels,
          -- Hotel convenience fee (NULL for payments)
          NULL::numeric AS convenience_fee,
          NULL::numeric AS cgst_on_convenience_fee,
          NULL::numeric AS sgst_on_convenience_fee,
          NULL::numeric AS igst_on_convenience_fee

        FROM payment_transactions pt
        LEFT JOIN trips t ON pt."tripId" = t.id
        LEFT JOIN organization_guests og ON og.id = t."organizationGuestId"
        LEFT JOIN members m ON pt."memberId" = m.id
        LEFT JOIN users u ON m."userId" = u.id
        LEFT JOIN designations d ON m."designationId" = d.id
        LEFT JOIN travel_policy_tiers tpt ON d."travelPolicyTierId" = tpt.id
        LEFT JOIN members am ON t."approverId" = am.id
        LEFT JOIN users au ON am."userId" = au.id
        LEFT JOIN members dm ON t."delegatedByMemberId" = dm.id
        LEFT JOIN users du ON dm."userId" = du.id
        LEFT JOIN organization_preferences op ON pt."organizationId" = op."organizationId"
        LEFT JOIN payment_preferences pp ON pt."organizationId" = pp."organizationId"
        WHERE pt."organizationId" = '${orgId}'`,
});
