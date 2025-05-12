/**
 * Utility functions for insights feature
 */

import type { CreateInnerContextOptions } from "@calcom/trpc/server/createContext";

/**
 * Check if the insights feature is available for a user
 * This enables insights for both team members and individual users
 */
export function isInsightsEnabled(
  user: CreateInnerContextOptions["user"] | undefined,
  isInsightsFlagEnabled: boolean
): boolean {
  // Always enable insights if the feature flag is on
  if (isInsightsFlagEnabled) {
    return true;
  }
  
  // Enable insights for individual users by default
  return true;
}
