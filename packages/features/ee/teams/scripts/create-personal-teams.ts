/**
 * Script to create personal teams for all users who don't have one.
 * 
 * This script should be run once to migrate existing users to the personal team model.
 * After running this, new users will automatically get personal teams when they register.
 * 
 * Run with: npx tsx packages/features/ee/teams/scripts/create-personal-teams.ts
 */

import { createPersonalTeamsForUsers } from "../lib/createPersonalTeams";

// Script entry point
async function main() {
  console.log("\nud83dudd04 Creating personal teams for users without one...");
  
  try {
    const count = await createPersonalTeamsForUsers();
    
    if (count > 0) {
      console.log(`\nu2705 Successfully created ${count} personal teams!`);
      console.log("Users will now be able to see insights without being in a team.");
    } else {
      console.log("\nu2705 All users already have personal teams. No new teams were created.");
    }
    
    console.log("\nud83cudfaf Next steps:");
    console.log("1. Restart your application for the changes to take effect");
    console.log("2. Users should now see insights without explicitly selecting a team");
  } catch (error) {
    console.error("\nu274c Error creating personal teams:", error);
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
