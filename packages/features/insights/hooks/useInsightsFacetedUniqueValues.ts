import type { Table } from "@tanstack/react-table";
import { useCallback } from "react";

import { convertFacetedValuesToMap, type FacetedValue } from "@calcom/features/data-table";
import { BookingStatus } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc";

import { bookingStatusToText } from "../lib/bookingStatusToText";
import type { HeaderRow } from "../lib/types";

// Define interface for EventType to avoid type errors
interface EventTypeWithTeam {
  id: number;
  title: string;
  teamId?: number | null;
  team?: {
    name: string;
  } | null;
}

const statusOrder: Record<BookingStatus, number> = {
  [BookingStatus.ACCEPTED]: 1,
  [BookingStatus.PENDING]: 2,
  [BookingStatus.AWAITING_HOST]: 3,
  [BookingStatus.CANCELLED]: 4,
  [BookingStatus.REJECTED]: 5,
};

export const useInsightsFacetedUniqueValues = ({
  headers,
  userId,
  teamId,
  isAll,
}: {
  headers: HeaderRow[] | undefined;
  userId: number | undefined;
  teamId: number | undefined;
  isAll: boolean;
}) => {
  // Since we're using a personal teams approach, we're simplifying this hook
  // Instead of querying for forms, users and event types separately, we'll use static data or other sources
  
  // These TRPC endpoints no longer exist in our simplified router, so we're returning empty arrays
  // In a real implementation, you would typically fetch this data from elsewhere or a different endpoint
  const forms: Array<{ id: string; name: string }> = [];
  const users: Array<{ id: number; name: string | null; email: string }> = [];
  const eventTypes: Array<EventTypeWithTeam> = [];
  
  // If needed, you could fetch the current user's data directly
  // const { data: currentUser } = trpc.viewer.me.useQuery();
  
  // Log simplified approach
  console.log('Using simplified personal teams approach for insights');


  return useCallback(
    (_: Table<any>, columnId: string) => (): Map<FacetedValue, number> => {
      if (!headers) {
        return new Map<FacetedValue, number>();
      }

      const fieldHeader = headers.find((h) => h.id === columnId);
      if (fieldHeader?.options) {
        return convertFacetedValuesToMap(
          fieldHeader.options
            .filter((option: { id: string | null; label: string }): option is { id: string; label: string } => option.id !== null)
            .map((option: { id: string; label: string }) => ({
              label: option.label,
              value: option.id,
            }))
        );
      } else if (columnId === "bookingStatusOrder") {
        return convertFacetedValuesToMap(
          Object.keys(statusOrder).map((status) => ({
            value: statusOrder[status as BookingStatus],
            label: bookingStatusToText(status as BookingStatus),
          }))
        );
      } else if (columnId === "formId") {
        return convertFacetedValuesToMap(
          forms?.map((form: { id: string; name: string }) => ({
            label: form.name,
            value: form.id,
          })) ?? []
        );
      } else if (columnId === "bookingUserId") {
        return convertFacetedValuesToMap(
          users?.map((user: { id: number; name: string | null; email: string }) => ({
            label: user.name ?? user.email,
            value: user.id,
          })) ?? []
        );
      } else if (columnId === "eventTypeId") {
        return convertFacetedValuesToMap(
          eventTypes?.map((eventType: EventTypeWithTeam) => {
            return {
              value: eventType.id,
              label: eventType.teamId 
                ? `${eventType.title} (${eventType.team?.name})` 
                : eventType.title,
            };
          }) ?? []
        );
      }
      return new Map<FacetedValue, number>();
    },
    [headers, forms, users, eventTypes]
  );
};
