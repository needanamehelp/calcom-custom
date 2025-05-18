import { prisma } from "@calcom/prisma";

/**
 * Creates a personal team for a single user
 * This should be called when a new user is created
 */
export async function createPersonalTeam(userId: number) {
  try {
    if (!userId) {
      console.error("No user ID provided to createPersonalTeam");
      return null;
    }
    
    // Check if user already has a personal team
    const existingPersonalTeam = await prisma.team.findFirst({
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
      }
    });
    
    if (existingPersonalTeam) {
      console.log(`User ${userId} already has a personal team (${existingPersonalTeam.id})`);
      return existingPersonalTeam;
    }
    
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
    const personalTeam = await prisma.team.create({
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
      }
    });
    
    console.log(`Created personal team ${personalTeam.id} for user ${userId}`);
    return personalTeam;
  } catch (error) {
    console.error(`Error creating personal team for user ${userId}:`, error);
    return null;
  }
}
