import type { readonlyPrisma } from "@calcom/prisma";

/**
 * Find a user's personal team
 * This is used when a user doesn't specify a team but still needs access to insights
 */
export async function findPersonalTeam(userId: number, prisma: typeof readonlyPrisma) {
  try {
    const personalTeam = await prisma.team.findFirst({
      where: {
        members: {
          some: {
            userId,
            role: "OWNER",
            accepted: true
          }
        },
        // Look for personal team metadata flag - this was set when creating the team
        metadata: {
          path: ["isPersonalTeam"],
          equals: true
        }
      },
      select: {
        id: true
      }
    });
    
    return personalTeam;
  } catch (error) {
    console.error(`Error finding personal team for user ${userId}:`, error);
    return null;
  }
}
