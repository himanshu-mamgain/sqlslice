import { Slice } from '../../../src';
import { AnalyticsSliceParams } from './flight.slice';

export const hotelSlice = new Slice<AnalyticsSliceParams>({
  name: 'hotel_bookings_analytics',
  type: 'fragment',
  description: 'Hotel bookings branch — includes convenience fee GST fields',
  sql: ({ orgId, gstStatePattern }) => `
        SELECT
          hb.id,
          'HOTEL'::text AS entity_type,
          t."organizationId" AS organization_id,
          hb."tripId" AS trip_id,
          t."requesterId" AS member_id,
          m."userId" AS user_id,
          hb."createdAt" AS created_at,
          hb."updatedAt" AS updated_at,
          hb."totalCost" AS cost,

          CASE
            WHEN (COALESCE(hb.cgst,0)+COALESCE(hb.sgst,0)+COALESCE(hb.igst,0)) > 0
              THEN hb.cgst
            WHEN LOWER(op."gstAddress") LIKE '${gstStatePattern}'
              THEN ROUND((hgst.markup*0.18/2)::numeric,2)::double precision
            ELSE 0::double precision
          END AS cgst,
          CASE
            WHEN (COALESCE(hb.cgst,0)+COALESCE(hb.sgst,0)+COALESCE(hb.igst,0)) > 0
              THEN hb.sgst
            WHEN LOWER(op."gstAddress") LIKE '${gstStatePattern}'
              THEN ROUND((hgst.markup*0.18)::numeric,2)::double precision
                 - ROUND((hgst.markup*0.18/2)::numeric,2)::double precision
            ELSE 0::double precision
          END AS sgst,
          CASE
            WHEN (COALESCE(hb.cgst,0)+COALESCE(hb.sgst,0)+COALESCE(hb.igst,0)) > 0
              THEN hb.igst
            WHEN op."gstAddress" IS NOT NULL
             AND NOT (LOWER(op."gstAddress") LIKE '${gstStatePattern}')
              THEN ROUND((hgst.markup*0.18)::numeric,2)::double precision
            ELSE 0::double precision
          END AS igst,

          CASE
            WHEN (COALESCE(hb.cgst,0)+COALESCE(hb.sgst,0)+COALESCE(hb.igst,0)) > 0
              THEN hb."totalFareWithoutMarkup"
            ELSE GREATEST(0::double precision, hb."totalCost" - hgst.markup)
          END AS "totalFareWithoutMarkup",
          CASE
            WHEN (COALESCE(hb.cgst,0)+COALESCE(hb.sgst,0)+COALESCE(hb.igst,0)) > 0
              THEN hb."totalFareWithGst"
            WHEN op."gstAddress" IS NULL OR TRIM(op."gstAddress") = ''
              THEN hb."totalCost"
            ELSE hb."totalCost" + ROUND((hgst.markup*0.18)::numeric,2)::double precision
          END AS "totalFareWithGst",

          NULL::text AS payment_method,
          'INR'::text AS currency,
          hb."bookingStatus"::text AS status,
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
          hm."cityName" AS origin_code,
          hm.name AS destination_code,
          NULL::text AS flight_type,
          NULL::text AS flight_number,
          NULL::text AS pnr,
          NULL::boolean AS is_international,
          hm."cityName" AS city_name,
          hm.name AS hotel_name,
          hb."checkIn" AS check_in,
          hb."checkOut" AS check_out,
          hb."supplierCode" AS supplier_code,
          hb."policyCompliance" AS policy_compliance,
          (hb."policyCompliance"->>'tag')::text AS policy_tag,
          '[]'::jsonb AS flight_segments,
          jsonb_build_object(
            'supplierBookingId', hbd."supplierBookingId",
            'finalAmount', hbd."finalAmount",
            'status', hbd."supplierStatus",
            'checkIn', hbd."checkInTime",
            'checkOut', hbd."checkOutTime",
            'address', hm.address,
            'countryName', hm."countryName",
            'starRating', hm."starRating",
            'propertyType', hm."propertyType"
          ) AS hotel_booking_details,
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
          -- Hotel-specific convenience fee fields (populated only here)
          hb."convenienceFee"::numeric AS convenience_fee,
          hb."cgstOnConvenienceFee"::numeric AS cgst_on_convenience_fee,
          hb."sgstOnConvenienceFee"::numeric AS sgst_on_convenience_fee,
          hb."igstOnConvenienceFee"::numeric AS igst_on_convenience_fee

        FROM hotel_bookings hb
        LEFT JOIN trips t ON hb."tripId" = t.id
        LEFT JOIN organization_guests og ON og.id = t."organizationGuestId"
        LEFT JOIN members m ON t."requesterId" = m.id
        LEFT JOIN users u ON m."userId" = u.id
        LEFT JOIN designations d ON m."designationId" = d.id
        LEFT JOIN travel_policy_tiers tpt ON d."travelPolicyTierId" = tpt.id
        LEFT JOIN members am ON t."approverId" = am.id
        LEFT JOIN users au ON am."userId" = au.id
        LEFT JOIN members dm ON t."delegatedByMemberId" = dm.id
        LEFT JOIN users du ON dm."userId" = du.id
        LEFT JOIN "HotelMaster" hm ON hb."tripareHotelSlug" = hm."tripareHotelSlug"
        LEFT JOIN LATERAL (
          SELECT * FROM hotel_booking_details
          WHERE "hotelBookingId" = hb.id ORDER BY "createdAt" DESC LIMIT 1
        ) hbd ON TRUE
        LEFT JOIN LATERAL (
          SELECT GREATEST(0::double precision,
            CASE
              WHEN COALESCE(hb."totalMarkupAmount", 0) > 0
                THEN hb."totalMarkupAmount"::double precision
              WHEN COALESCE(hbd.markup, 0) > 0
                THEN hbd.markup::double precision
              WHEN hb."selectedRoom" IS NOT NULL
               AND jsonb_typeof(hb."selectedRoom"->'pricingComponents'->'priceInfoStructure') = 'array'
                THEN COALESCE((
                  SELECT SUM(COALESCE((elem->'additionalFeeComponents'->'TAF'->>'MU')::double precision, 0))
                  FROM jsonb_array_elements(hb."selectedRoom"->'pricingComponents'->'priceInfoStructure') elem
                ), 0)
              ELSE 0::double precision
            END
          ) AS markup
        ) hgst ON TRUE
        LEFT JOIN organization_preferences op ON t."organizationId" = op."organizationId"
        LEFT JOIN payment_preferences pp ON t."organizationId" = pp."organizationId"
        WHERE t."organizationId" = '${orgId}'`,
});
