import { _generateMetadata } from "app/_utils";
import { notFound } from "next/navigation";

// Import utilities to enable insights for individual users
import { isInsightsEnabled } from "@calcom/features/insights/utils";
import { getFeatureFlag } from "@calcom/features/flags/server/utils";

import InsightsPage from "~/insights/insights-view";

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("insights"),
    (t) => t("insights_subtitle")
  );

export default async function Page() {
  const prisma = await import("@calcom/prisma").then((mod) => mod.default);
  
  // Check if the insights feature flag is enabled
  const insightsFlagEnabled = await getFeatureFlag(prisma, "insights");
  
  // We're making insights available to all users (including individual users)
  // by using our utility function that bypasses the team requirement
  const insightsEnabled = isInsightsEnabled(undefined, insightsFlagEnabled);

  if (!insightsEnabled) {
    return notFound();
  }

  return <InsightsPage />;
}
