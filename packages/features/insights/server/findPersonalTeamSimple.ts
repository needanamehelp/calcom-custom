import { prisma } from "@calcom/prisma";

/**
 * A simplified version that uses direct Prisma queries to find a user's personal team
 * If a personal team doesn't exist, it will automatically create one
 */
export async function findPersonalTeamSimple(userId: number) {
  try {
    if (!userId) return null;
    
    // Look for a team where the user is an OWNER and has the isPersonalTeam metadata flag
    const personalTeam = await prisma.team.findFirst({
      where: {
        members: {
          some: {
            userId,
            role: "OWNER",
            accepted: true
          }
        },
        metadata: {
          path: ["isPersonalTeam"],
          equals: true
        }
      },
      select: {
        id: true
      }
    });
    
    // If a personal team already exists, return it
    if (personalTeam) {
      return personalTeam;
    }
    
    // Otherwise, create a new personal team for this user
    console.log(`No personal team found for user ${userId}. Creating one automatically.`);
    
    // Get user info to name the team
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true }
    });
    
    if (!user) {
      console.error(`Cannot create personal team: User ${userId} not found`);
      return null;
    }
    
    // Create the personal team
    const newPersonalTeam = await prisma.team.create({
      data: {
        name: `${user.name || user.email}'s Team`,
        slug: `personal-${userId}`,
        metadata: {
          isPersonalTeam: true
        },
        members: {
          create: {
            userId,
            role: "OWNER",
            accepted: true
          }
        }
      },
      select: {
        id: true
      }
    });
    
    console.log(`Created personal team ${newPersonalTeam.id} for user ${userId}`);
    return newPersonalTeam;
  } catch (error) {
    console.error(`Error finding/creating personal team for user ${userId}:`, error);
    return null;
  }
}
