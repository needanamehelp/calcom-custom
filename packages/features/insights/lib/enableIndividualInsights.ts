// This file enables Insights for individual users, not just team members
import { prisma } from "@calcom/prisma";

/**
 * This ensures the insights feature flag is enabled for all users
 * regardless of their team membership status
 */
export async function enableInsightsForAllUsers() {
  try {
    // Check if the insights feature flag exists
    const insightsFeature = await prisma.feature.findFirst({
      where: { slug: "insights" },
    });

    if (!insightsFeature) {
      // If the feature doesn't exist yet, create it and enable it
      await prisma.feature.create({
        data: {
          slug: "insights",
          enabled: true,
          description: "Insights and analytics about bookings and usage.",
          type: "OPERATIONAL",
        },
      });
      console.log("Created insights feature flag and enabled it for all users");
    } else if (!insightsFeature.enabled) {
      // If the feature exists but is disabled, enable it
      await prisma.feature.update({
        where: { slug: "insights" },
        data: { enabled: true },
      });
      console.log("Enabled insights feature flag for all users");
    } else {
      console.log("Insights feature flag already enabled");
    }

    return true;
  } catch (error) {
    console.error("Failed to enable insights for all users:", error);
    return false;
  }
}
