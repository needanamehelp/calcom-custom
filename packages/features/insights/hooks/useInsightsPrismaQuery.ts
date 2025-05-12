import { useSession } from "next-auth/react";
import { useMemo } from "react";

import { WEBAPP_URL } from "@calcom/lib/constants";
import { trpc } from "@calcom/trpc/react";


type InsightQueryParams = {
  teamId?: number;
  userId?: number;
  memberUserIds?: number[];
  memberUserId?: number;
  eventTypeId?: number;
  startDate: string;
  endDate: string;
  [key: string]: unknown;
};

interface BaseInsightsProps {
  teamId?: number;
  userId?: number;
  isAll?: boolean;
  memberUserIds?: number[];
  memberUserId?: number;
  eventTypeId?: number;
  startDate: string;
  endDate: string;
  [key: string]: unknown;
}

// Common utility to prepare query parameters with user context
function useInsightsQueryParams(props: BaseInsightsProps): InsightQueryParams {
  const { teamId, userId, isAll, memberUserIds, memberUserId, eventTypeId, startDate, endDate, ...rest } = props;
  const session = useSession();

  return useMemo(() => {
    // Get current user ID for individual users
    const currentUserId = session.data?.user?.id;

    return {
      teamId,
      // Always include a userId, either from props or from session
      userId: userId || (isAll ? undefined : currentUserId),
      memberUserId,
      memberUserIds,
      eventTypeId,
      startDate,
      endDate,
      ...rest,
    };
  }, [teamId, userId, isAll, memberUserId, memberUserIds, eventTypeId, startDate, endDate, rest, session]);
}

// Hook for common insight response handling
function useInsightResponse() {
  const session = useSession();

  return useMemo(() => {
    return {
      isOwner: (teamId?: number) => {
        return !!(
          session.data?.user.id === teamId || 
          session.data?.user.org?.id === teamId
        );
      },
      link: WEBAPP_URL || "",
    };
  }, [session]);
}

/**
 * Hook to get most booked users insights data
 */
export function useGetMostBookedUsers(props: BaseInsightsProps) {
  const queryParams = useInsightsQueryParams(props);
  const response = useInsightResponse();
  
  const queryOptions = {
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 0,
    enabled: !!(queryParams.startDate && queryParams.endDate),
  };

  const { data, isLoading, error } = trpc.viewer.insights.membersWithMostBookings.useQuery(
    queryParams,
    queryOptions
  );

  return {
    data,
    isLoading,
    isOwner: response.isOwner(queryParams.teamId),
    link: response.link,
    error,
  } as const;
}

/**
 * Hook to get booking status count insights data
 */
export function useGetBookingStatusCount(props: BaseInsightsProps) {
  const queryParams = useInsightsQueryParams(props);
  const response = useInsightResponse();
  
  const queryOptions = {
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 0,
    enabled: !!(queryParams.startDate && queryParams.endDate),
  };

  const { data, isLoading, error } = trpc.viewer.insights.eventsByStatus.useQuery(
    queryParams,
    queryOptions
  );

  return {
    data,
    isLoading,
    isOwner: response.isOwner(queryParams.teamId),
    link: response.link,
    error,
  } as const;
}

/**
 * Hook to get booking trend insights data
 */
export function useGetBookingTrend(props: BaseInsightsProps & { timeView?: "day" | "week" | "month" | "year" }) {
  const baseParams = useInsightsQueryParams(props);
  const response = useInsightResponse();
  
  const queryOptions = {
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 0,
    enabled: !!(baseParams.startDate && baseParams.endDate),
  };

  // Add required timeView parameter to the query
  const queryParams = {
    ...baseParams,
    timeView: props.timeView || "month", // Default to month if not provided
  };

  const { data, isLoading, error } = trpc.viewer.insights.eventsTimeline.useQuery(
    queryParams,
    queryOptions
  );

  return {
    data,
    isLoading,
    isOwner: response.isOwner(queryParams.teamId),
    link: response.link,
    error,
  } as const;
}

/**
 * Hook to get event type bookings insights data
 */
export function useGetEventTypeBookings(props: BaseInsightsProps) {
  const queryParams = useInsightsQueryParams(props);
  const response = useInsightResponse();
  
  const queryOptions = {
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 0,
    enabled: !!(queryParams.startDate && queryParams.endDate),
  };

  const { data, isLoading, error } = trpc.viewer.insights.popularEventTypes.useQuery(
    queryParams,
    queryOptions
  );

  return {
    data,
    isLoading,
    isOwner: response.isOwner(queryParams.teamId),
    link: response.link,
    error,
  } as const;
}

// Legacy compatibility function for existing code
// Automatically selects the correct hook based on the query string
export function useInsightsPrismaQuery<T>(props: BaseInsightsProps & { query: string }) {
  const { query, ...baseProps } = props;
  const methodName = query.split('.').pop() || '';
  
  // For hooks that need additional parameters
  if (methodName === 'getBookingTrend' || methodName === 'eventsTimeline') {
    // Add timeView parameter for eventsTimeline query
    return useGetBookingTrend({ 
      ...baseProps, 
      timeView: (baseProps as any).timeView || 'month' 
    });
  }
  
  // Map method names to hook functions
  const methodMap: Record<string, Function> = {
    // Legacy method names
    'getMostBookedUsers': useGetMostBookedUsers,
    'getBookingStatusCount': useGetBookingStatusCount,
    'getEventTypeBookings': useGetEventTypeBookings,
    // Actual method names from codebase
    'membersWithMostBookings': useGetMostBookedUsers,
    'eventsByStatus': useGetBookingStatusCount,
    'popularEventTypes': useGetEventTypeBookings
  };
  
  // Get the appropriate hook function
  const hookFunction = methodMap[methodName];
  
  if (hookFunction) {
    return hookFunction(baseProps);
  }
  
  // Fallback for unsupported methods
  const response = useInsightResponse();
  return {
    data: undefined,
    isLoading: false,
    isOwner: response.isOwner(props.teamId),
    link: response.link,
    error: new Error(`Unsupported insights method: ${methodName}`),
  } as const;
}
