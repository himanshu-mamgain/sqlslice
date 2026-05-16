import { Slice } from '../../../src';

export interface AnalyticsSliceParams {
  orgId: string;
  gstStatePattern: string; // e.g. '%karnataka%' for intra-state CGST/SGST
}

export const flightSlice = new Slice<AnalyticsSliceParams>({
  name: 'flight_bookings_analytics',
  type: 'fragment',
  description: 'Flight bookings branch of the unified analytics view',
  sql: ({ orgId, gstStatePattern }) => `
        SELECT
          fb.id,
          'FLIGHT'::text AS entity_type,
          t."organizationId" AS organization_id,
          fb."tripId" AS trip_id,
          t."requesterId" AS member_id,
          m."userId" AS user_id,
          fb."createdAt" AS created_at,
          fb."updatedAt" AS updated_at,
          fb.total_price AS cost,

          -- Dynamic GST: 18% on extracted markup
          CASE
            WHEN (COALESCE(fb.cgst,0)+COALESCE(fb.sgst,0)+COALESCE(fb.igst,0)) > 0
              THEN fb.cgst
            WHEN LOWER(op."gstAddress") LIKE '${gstStatePattern}'
              THEN ROUND((fgst.markup * 0.18 / 2)::numeric, 2)::double precision
            ELSE 0::double precision
          END AS cgst,
          CASE
            WHEN (COALESCE(fb.cgst,0)+COALESCE(fb.sgst,0)+COALESCE(fb.igst,0)) > 0
              THEN fb.sgst
            WHEN LOWER(op."gstAddress") LIKE '${gstStatePattern}'
              THEN ROUND((fgst.markup*0.18)::numeric,2)::double precision
                 - ROUND((fgst.markup*0.18/2)::numeric,2)::double precision
            ELSE 0::double precision
          END AS sgst,
          CASE
            WHEN (COALESCE(fb.cgst,0)+COALESCE(fb.sgst,0)+COALESCE(fb.igst,0)) > 0
              THEN fb.igst
            WHEN op."gstAddress" IS NOT NULL
             AND NOT (LOWER(op."gstAddress") LIKE '${gstStatePattern}')
              THEN ROUND((fgst.markup*0.18)::numeric,2)::double precision
            ELSE 0::double precision
          END AS igst,

          CASE
            WHEN (COALESCE(fb.cgst,0)+COALESCE(fb.sgst,0)+COALESCE(fb.igst,0)) > 0
              THEN fb."totalFareWithoutMarkup"
            ELSE GREATEST(0::double precision, fb.total_price - fgst.markup)
          END AS "totalFareWithoutMarkup",
          CASE
            WHEN (COALESCE(fb.cgst,0)+COALESCE(fb.sgst,0)+COALESCE(fb.igst,0)) > 0
              THEN fb."totalFareWithGst"
            WHEN op."gstAddress" IS NULL OR TRIM(op."gstAddress") = ''
              THEN fb.total_price
            ELSE fb.total_price + ROUND((fgst.markup*0.18)::numeric,2)::double precision
          END AS "totalFareWithGst",

          NULL::text AS payment_method,
          'INR'::text AS currency,
          fb."bookingStatus"::text AS status,
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
          COALESCE(seg.start_dept, fb."originCode") AS origin_code,
          CASE
            WHEN COALESCE(seg.start_dept,'XX') = COALESCE(seg.end_arr,'YY')
              THEN COALESCE(seg.longest_non_origin_arr, seg.end_arr)
            ELSE COALESCE(seg.end_arr, fb."destinationCode")
          END AS destination_code,
          fb."flightType"::text AS flight_type,
          COALESCE(seg.start_flight, fb."flightNumber") AS flight_number,
          (SELECT pnr FROM flight_segments fs
           WHERE fs."flightBookingId" = fb.id
           ORDER BY "segmentIndex" ASC LIMIT 1) AS pnr,
          COALESCE((SELECT bool_or("isInternational") FROM flight_segments fs
                    WHERE fs."flightBookingId" = fb.id), FALSE) AS is_international,
          NULL::text AS city_name,
          NULL::text AS hotel_name,
          NULL::timestamp AS check_in,
          NULL::timestamp AS check_out,
          NULL::text AS supplier_code,
          fb."policyCompliance" AS policy_compliance,
          (fb."policyCompliance"->>'tag')::text AS policy_tag,
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', fs.id,
              'origin', fs."departureAirport",
              'destination', fs."arrivalAirport",
              'departureTime', fs."departureTime",
              'arrivalTime', fs."arrivalTime",
              'flightNumber', fs."flightNumber",
              'airline', fs.airline,
              'pnr', fs.pnr
            )) FROM flight_segments fs WHERE fs."flightBookingId" = fb.id
          ), '[]'::jsonb) AS flight_segments,
          NULL::jsonb AS hotel_booking_details,
          NULL::numeric AS potential_savings,
          NULL::numeric AS savings_percentage,
          NULL::jsonb AS frugality_details,
          NULL::text AS amendment_type,
          NULL::text AS amendment_status,
          NULL::numeric AS refundable_amount,
          NULL::text AS orig_booking_id,
          NULL::text AS reason,
          (CASE WHEN (SELECT bool_or("isRefundable") FROM flight_segments fs
                      WHERE fs."flightBookingId" = fb.id) IS TRUE
            THEN 'Yes' ELSE 'No' END)::text AS refund_eligible,
          NULL::text AS charges_category,
          0::numeric AS fee,
          fb."fareIdentifier" AS fare_identifier,
          fb."corporateCode" AS corporate_code,
          -- Delegation
          t."delegatedByMemberId" AS delegation_member_id,
          du.name AS delegated_by_name,
          -- Multi-approval
          t."approvalMode"::text AS approval_mode,
          t."currentApprovalLevel" AS current_approval_level,
          t."totalApprovalLevels" AS total_approval_levels,
          -- Hotel convenience fee (NULL for flights)
          NULL::numeric AS convenience_fee,
          NULL::numeric AS cgst_on_convenience_fee,
          NULL::numeric AS sgst_on_convenience_fee,
          NULL::numeric AS igst_on_convenience_fee

        FROM flight_bookings fb
        LEFT JOIN LATERAL (
          SELECT
            (SELECT "departureAirport" FROM flight_segments fs
             WHERE fs."flightBookingId" = fb.id ORDER BY "segmentIndex" ASC LIMIT 1) AS start_dept,
            (SELECT "arrivalAirport" FROM flight_segments fs
             WHERE fs."flightBookingId" = fb.id ORDER BY "segmentIndex" DESC LIMIT 1) AS end_arr,
            (SELECT "flightNumber" FROM flight_segments fs
             WHERE fs."flightBookingId" = fb.id ORDER BY "segmentIndex" ASC LIMIT 1) AS start_flight,
            (SELECT "arrivalAirport" FROM flight_segments fs
             WHERE fs."flightBookingId" = fb.id
               AND "arrivalAirport" <> (
                 SELECT "departureAirport" FROM flight_segments fs3
                 WHERE fs3."flightBookingId" = fb.id ORDER BY "segmentIndex" ASC LIMIT 1
               )
             ORDER BY duration DESC NULLS LAST LIMIT 1) AS longest_non_origin_arr
        ) seg ON TRUE
        LEFT JOIN trips t ON fb."tripId" = t.id
        LEFT JOIN organization_guests og ON og.id = t."organizationGuestId"
        LEFT JOIN members m ON t."requesterId" = m.id
        LEFT JOIN users u ON m."userId" = u.id
        LEFT JOIN designations d ON m."designationId" = d.id
        LEFT JOIN travel_policy_tiers tpt ON d."travelPolicyTierId" = tpt.id
        LEFT JOIN members am ON t."approverId" = am.id
        LEFT JOIN users au ON am."userId" = au.id
        LEFT JOIN members dm ON t."delegatedByMemberId" = dm.id
        LEFT JOIN users du ON dm."userId" = du.id
        LEFT JOIN LATERAL (
          SELECT * FROM flight_frugality_data WHERE "flightBookingId" = fb.id LIMIT 1
        ) ffd ON TRUE
        LEFT JOIN flight_booking_details fbd ON fb."flightBookingDetailsId" = fbd.id
        LEFT JOIN LATERAL (
          SELECT GREATEST(0::double precision,
            CASE
              WHEN COALESCE(fb."totalMarkupAmount", 0) > 0
                THEN fb."totalMarkupAmount"::double precision
              WHEN COALESCE((SELECT SUM(COALESCE(fs.markup,0))
                             FROM flight_segments fs WHERE fs."flightBookingId" = fb.id), 0) > 0
                THEN (SELECT SUM(COALESCE(fs.markup,0))
                      FROM flight_segments fs WHERE fs."flightBookingId" = fb.id)
              WHEN COALESCE(fbd.markup, 0) > 0
                THEN fbd.markup::double precision
              ELSE 0::double precision
            END
          ) AS markup
        ) fgst ON TRUE
        LEFT JOIN organization_preferences op ON t."organizationId" = op."organizationId"
        LEFT JOIN payment_preferences pp ON t."organizationId" = pp."organizationId"
        WHERE t."organizationId" = '${orgId}'`,
});
