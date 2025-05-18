import prisma from "@calcom/prisma";

/**
 * This script ensures the QRCodePay app is properly registered in the database.
 * Run this script with: npx tsx packages/app-store/qrcodepay/_registerApp.ts
 */
async function registerQRCodePayApp() {
  console.log("Checking QRCodePay app registration...");
  
  // Check if app exists
  const existingApp = await prisma.app.findFirst({
    where: {
      slug: "qrcodepay",
    },
    select: {
      slug: true,
    },
  });

  if (existingApp) {
    console.log("QRCodePay app already exists in the database with slug:", existingApp.slug);
    // Update fields to ensure they're correct
    await prisma.app.update({
      where: {
        slug: "qrcodepay",
      },
      data: {
        categories: ["payment"],
        enabled: true,
        dirName: "qrcodepay",
      },
    });
    console.log("Updated QRCodePay app details");
  } else {
    // Create app entry
    const newApp = await prisma.app.create({
      data: {
        categories: ["payment"],
        enabled: true,
        dirName: "qrcodepay",
        slug: "qrcodepay",
      },
      select: {
        slug: true,
      },
    });
    console.log("Created QRCodePay app with slug:", newApp.slug);
  }

  console.log("✅ QRCodePay app registration complete");
}

registerQRCodePayApp()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error running script:", error);
    process.exit(1);
  });
