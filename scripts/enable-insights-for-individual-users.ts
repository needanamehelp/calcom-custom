// Script to enable insights for individual users
import { PrismaClient } from "@prisma/client";

async function enableInsightsForIndividualUsers() {
  console.log("Starting script to enable Insights for individual users...");

  // Create Prisma client
  const prisma = new PrismaClient();

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
      console.log("Insights feature flag is already enabled");
    }

    console.log("Script completed successfully!");
  } catch (error) {
    console.error("Error enabling insights for individual users:", error);
  } finally {
    // Clean up Prisma client
    await prisma.$disconnect();
  }
}

// Run the function
enableInsightsForIndividualUsers();
