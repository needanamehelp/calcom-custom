/**
 * Script to test if a specific app can be loaded
 * Run with: node test-app-loading.js
 */

const appToTest = 'paypal';
console.log(`\n\n===== TESTING APP LOADING: ${appToTest} =====\n`);

try {
  console.log(`Attempting to require the app from: ./packages/app-store/${appToTest}`);
  // First try direct require
  try {
    const app = require(`./packages/app-store/${appToTest}`);
    console.log("✅ Successfully required app directly");
    console.log("Module content:", app);
  } catch (err) {
    console.error("❌ Failed to require app directly");
    console.error("Error:", err);
  }

  // Then try requiring index.ts specifically
  try {
    console.log(`\nAttempting to require the app index: ./packages/app-store/${appToTest}/index.ts`);
    const app = require(`./packages/app-store/${appToTest}/index.ts`);
    console.log("✅ Successfully required app index.ts");
    console.log("Module content:", app);
  } catch (err) {
    console.error("❌ Failed to require app index.ts");
    console.error("Error:", err);
  }

  // Check if file exists
  const fs = require('fs');
  const path = require('path');
  
  const indexPath = path.resolve(__dirname, `packages/app-store/${appToTest}/index.ts`);
  console.log(`\nChecking if file exists: ${indexPath}`);
  
  if (fs.existsSync(indexPath)) {
    console.log("✅ File exists");
    console.log("File content:", fs.readFileSync(indexPath, 'utf8'));
  } else {
    console.error("❌ File does not exist");
  }

  // List directory contents
  const dirPath = path.resolve(__dirname, `packages/app-store/${appToTest}`);
  console.log(`\nListing directory contents for: ${dirPath}`);
  
  if (fs.existsSync(dirPath)) {
    console.log("Directory contents:", fs.readdirSync(dirPath));
  } else {
    console.error("❌ Directory does not exist");
  }

  // Check for app in generated metadata
  const metadataPath = path.resolve(__dirname, 'packages/app-store/apps.metadata.generated.ts');
  console.log(`\nChecking if app is in metadata: ${metadataPath}`);
  
  if (fs.existsSync(metadataPath)) {
    const metadata = fs.readFileSync(metadataPath, 'utf8');
    if (metadata.includes(appToTest)) {
      console.log("✅ App found in metadata");
      
      // Extract the specific entries for this app
      const lines = metadata.split('\n');
      const appImportLine = lines.find(line => line.includes(`${appToTest}_config_json`));
      const appMetadataLine = lines.find(line => line.includes(`${appToTest}:`));
      
      console.log("Import line:", appImportLine);
      console.log("Metadata line:", appMetadataLine);
    } else {
      console.error("❌ App not found in metadata");
    }
  } else {
    console.error("❌ Metadata file does not exist");
  }

  // Check inclusion in app store index.ts
  const appStoreIndexPath = path.resolve(__dirname, 'packages/app-store/index.ts');
  console.log(`\nChecking if app is in app store index: ${appStoreIndexPath}`);
  
  if (fs.existsSync(appStoreIndexPath)) {
    const appStoreIndex = fs.readFileSync(appStoreIndexPath, 'utf8');
    if (appStoreIndex.includes(`import("./${appToTest}")`)) {
      console.log("✅ App found in app store index");
    } else {
      console.error("❌ App not found in app store index");
    }
  } else {
    console.error("❌ App store index file does not exist");
  }
  
} catch (error) {
  console.error("Main script error:", error);
}

console.log(`\n===== TEST COMPLETE =====\n`); 
