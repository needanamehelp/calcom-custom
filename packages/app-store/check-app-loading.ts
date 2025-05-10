/**
 * Script to check if apps can be loaded correctly
 * Run with: yarn tsx packages/app-store/check-app-loading.ts
 */

import fs from 'fs';

async function checkAppLoading(appDir: string) {
  try {
    const appModule = await import(`./${appDir}/index.ts`);
    console.log("✅ LOADED APP:", appDir);
    return true;
  } catch (err) {
    console.error("❌ FAILED TO LOAD APP:", appDir, err);
    return false;
  }
}

async function main() {
  // Get all directories in the app store
  const dirs = fs.readdirSync(__dirname, { withFileTypes: true })
    .filter((dirent: fs.Dirent) => dirent.isDirectory())
    .map((dirent: fs.Dirent) => dirent.name)
    .filter((dir: string) => !dir.startsWith('.') && !dir.startsWith('_') && dir !== 'node_modules' && dir !== 'templates');
  
  console.log(`Checking ${dirs.length} apps`);
  
  // Check each app
  const results = await Promise.all(dirs.map((dir: string) => checkAppLoading(dir)));
  
  // Print summary
  const successCount = results.filter(result => result).length;
  console.log(`\nSummary: ${successCount}/${dirs.length} apps loaded successfully`);
  
  if (successCount < dirs.length) {
    console.log("Some apps failed to load. Check the errors above.");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Script error:", err);
  process.exit(1);
});
export {}; 