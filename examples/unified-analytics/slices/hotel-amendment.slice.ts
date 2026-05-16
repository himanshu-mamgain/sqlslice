import { Slice } from '../../../src';
import { AnalyticsSliceParams } from './flight.slice';

export const hotelAmendmentSlice = new Slice<AnalyticsSliceParams>({
  name: 'hotel_amendments_analytics',
  type: 'fragment',
  description: 'Hotel cancellations / date-change amendments',
  sql: ({ orgId }) => `
        SELECT
          ha.id,
          'AMENDMENT_HOTEL'::text AS entity_type,
          ha."organizationId" AS organization_id,
          ha."tripId" AS trip_id,
          ha."createdBy" AS member_id,
          m."userId" AS user_id,
          ha."createdAt" AS created_at,
          ha."updatedAt" AS updated_at,
          ha."refundableAmount"::numeric AS cost,
          0::double precision AS cgst,
          0::double precision AS sgst,
          0::double precision AS igst,
          0::double precision AS "totalFareWithoutMarkup",
          0::double precision AS "totalFareWithGst",
          NULL::text AS payment_method,
          'INR'::text AS currency,
          ha."amendmentStatus"::text AS status,
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
          hm."cityName" AS origin_code,
          hm.name AS destination_code,
          NULL::text AS flight_type,
          NULL::text AS flight_number,
          NULL::text AS pnr,
          NULL::boolean AS is_international,
          hm."cityName" AS city_name,
          hm.name AS hotel_name,
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
          ha.type::text AS amendment_type,
          ha."amendmentStatus"::text AS amendment_status,
          ha."refundableAmount"::numeric AS refundable_amount,
          ha."bookingId"::text AS orig_booking_id,
          NULL::text AS reason,
          (CASE WHEN ha."refundableAmount" > 0 THEN 'Yes' ELSE 'No' END)::text AS refund_eligible,
          'Amendment Fee'::text AS charges_category,
          ha."amendmentCharges"::numeric AS fee,
          NULL::text AS fare_identifier,
          NULL::text AS corporate_code,
          -- Delegation
          t."delegatedByMemberId" AS delegation_member_id,
          du.name AS delegated_by_name,
          -- Multi-approval
          t."approvalMode"::text AS approval_mode,
          t."currentApprovalLevel" AS current_approval_level,
          t."totalApprovalLevels" AS total_approval_levels,
          -- Hotel convenience fee (NULL for hotel amendments)
          NULL::numeric AS convenience_fee,
          NULL::numeric AS cgst_on_convenience_fee,
          NULL::numeric AS sgst_on_convenience_fee,
          NULL::numeric AS igst_on_convenience_fee

        FROM hotel_amendments ha
        LEFT JOIN members m ON ha."createdBy" = m.id
        LEFT JOIN users u ON m."userId" = u.id
        LEFT JOIN designations d ON m."designationId" = d.id
        LEFT JOIN travel_policy_tiers tpt ON d."travelPolicyTierId" = tpt.id
        LEFT JOIN hotel_bookings hb ON ha."bookingId" = hb.id
        LEFT JOIN "HotelMaster" hm ON hb."tripareHotelSlug" = hm."tripareHotelSlug"
        LEFT JOIN trips t ON ha."tripId" = t.id
        LEFT JOIN organization_guests og ON og.id = t."organizationGuestId"
        LEFT JOIN members dm ON t."delegatedByMemberId" = dm.id
        LEFT JOIN users du ON dm."userId" = du.id
        LEFT JOIN organization_preferences op ON ha."organizationId" = op."organizationId"
        LEFT JOIN payment_preferences pp ON ha."organizationId" = pp."organizationId"
        WHERE ha."organizationId" = '${orgId}'`,
});
