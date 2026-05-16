import { Slice } from '../../../src';
import { AnalyticsSliceParams } from './flight.slice';

export const flightAmendmentSlice = new Slice<AnalyticsSliceParams>({
  name: 'flight_amendments_analytics',
  type: 'fragment',
  description: 'Flight cancellations / date-change amendments',
  sql: ({ orgId }) => `
        SELECT
          fa.id,
          'AMENDMENT_FLIGHT'::text AS entity_type,
          fa."organizationId" AS organization_id,
          fa."tripId" AS trip_id,
          fa."createdBy" AS member_id,
          m."userId" AS user_id,
          fa."createdAt" AS created_at,
          fa."updatedAt" AS updated_at,
          fa."refundableAmount"::numeric AS cost,
          0::double precision AS cgst,
          0::double precision AS sgst,
          0::double precision AS igst,
          0::double precision AS "totalFareWithoutMarkup",
          0::double precision AS "totalFareWithGst",
          NULL::text AS payment_method,
          'INR'::text AS currency,
          fa."amendmentStatus"::text AS status,
          NULL::text AS approval_status,
          CASE WHEN t."organizationGuestId" IS NOT NULL
            THEN (og."travelerDetails"->>'fullName') ELSE u.name
          END AS requester_name,
          CASE WHEN t."organizationGuestId" IS NOT NULL
            THEN 'Guest' ELSE m.department
          END AS requester_department,
          COALESCE(d.name, m."designationId") AS requester_designation,
          m.role AS requester_role,
          NULL::text AS approver_name,
          t."tripNumber" AS trip_number,
          t."startDate" AS start_date,
          t."endDate" AS end_date,
          fb."originCode" AS origin_code,
          fb."destinationCode" AS destination_code,
          fb."flightType"::text AS flight_type,
          fb."flightNumber" AS flight_number,
          (SELECT pnr FROM flight_segments fs
           WHERE fs."flightBookingId" = fb.id ORDER BY "segmentIndex" ASC LIMIT 1) AS pnr,
          COALESCE((SELECT bool_or("isInternational") FROM flight_segments fs
                    WHERE fs."flightBookingId" = fb.id), FALSE) AS is_international,
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
          fa.type::text AS amendment_type,
          fa."amendmentStatus"::text AS amendment_status,
          fa."refundableAmount"::numeric AS refundable_amount,
          fa."bookingId"::text AS orig_booking_id,
          NULL::text AS reason,
          (CASE WHEN fa."refundableAmount" > 0 THEN 'Yes' ELSE 'No' END)::text AS refund_eligible,
          'Amendment Fee'::text AS charges_category,
          fa."amendmentCharges"::numeric AS fee,
          fb."fareIdentifier" AS fare_identifier,
          fb."corporateCode" AS corporate_code,
          -- Delegation
          t."delegatedByMemberId" AS delegation_member_id,
          du.name AS delegated_by_name,
          -- Multi-approval
          t."approvalMode"::text AS approval_mode,
          t."currentApprovalLevel" AS current_approval_level,
          t."totalApprovalLevels" AS total_approval_levels,
          -- Hotel convenience fee (NULL for flight amendments)
          NULL::numeric AS convenience_fee,
          NULL::numeric AS cgst_on_convenience_fee,
          NULL::numeric AS sgst_on_convenience_fee,
          NULL::numeric AS igst_on_convenience_fee

        FROM flight_amendments fa
        LEFT JOIN members m ON fa."createdBy" = m.id
        LEFT JOIN users u ON m."userId" = u.id
        LEFT JOIN designations d ON m."designationId" = d.id
        LEFT JOIN travel_policy_tiers tpt ON d."travelPolicyTierId" = tpt.id
        LEFT JOIN flight_bookings fb ON fa."bookingId" = fb.id
        LEFT JOIN trips t ON fa."tripId" = t.id
        LEFT JOIN organization_guests og ON og.id = t."organizationGuestId"
        LEFT JOIN members dm ON t."delegatedByMemberId" = dm.id
        LEFT JOIN users du ON dm."userId" = du.id
        LEFT JOIN organization_preferences op ON fa."organizationId" = op."organizationId"
        LEFT JOIN payment_preferences pp ON fa."organizationId" = pp."organizationId"
        WHERE fa."organizationId" = '${orgId}'`,
});
