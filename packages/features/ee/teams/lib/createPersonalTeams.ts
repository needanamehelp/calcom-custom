import { Prisma } from "@prisma/client";
import { randomString } from "@calcom/lib/random";
import prisma from "@calcom/prisma";

/**
 * Creates personal teams for all users that don't have one yet.
 * This is used to ensure all users can access insights, even without being in a formal team.
 */
export async function createPersonalTeamsForUsers() {
  console.log("🔍 Looking for users without personal teams...");
  
  // Find all users without a personal team
  const usersWithoutPersonalTeam = await prisma.user.findMany({
    where: {
      NOT: {
        teams: {
          some: {
            role: "OWNER",
            team: {
              metadata: {
                path: ["isPersonalTeam"],
                equals: true
              }
            }
          }
        }
      }
      // Note: Removed 'active' filter as it's not in UserWhereInput type
    },
    select: { id: true, name: true, email: true, username: true }
  });

  console.log(`Found ${usersWithoutPersonalTeam.length} users without personal teams`);

  // Create personal teams for these users
  for (const user of usersWithoutPersonalTeam) {
    const name = user.name || user.username || user.email?.split("@")[0] || `User ${user.id}`;
    const slug = `personal-${name.toLowerCase().replace(/\s+/g, "-")}-${randomString(4)}`;
    
    try {
      const personalTeam = await prisma.team.create({
        data: {
          name: `${name}'s Personal Team`,
          slug: slug,
          // Removed 'logo' as it's not in TeamCreateInput type
          bio: "Automatically created personal team for insights access",
          hideBranding: false,
          hideBookATeamMember: false,
          metadata: {
            isPersonalTeam: true,
            createdAutomatically: true
          } as Prisma.JsonObject,
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
              accepted: true
            }
          }
        }
      });
      console.log(`✅ Created personal team ${personalTeam.id} for user ${user.id} (${name})`);
    } catch (error) {
      console.error(`❌ Failed to create personal team for user ${user.id} (${name}):`, error);
    }
  }

  console.log("✨ Personal team creation process completed");
  return usersWithoutPersonalTeam.length;
}

// Execute if running directly
if (require.main === module) {
  createPersonalTeamsForUsers()
    .then((count) => {
      console.log(`Created ${count} personal teams`);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error creating personal teams:", error);
      process.exit(1);
    });
}
