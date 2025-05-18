import prisma from "@calcom/prisma";
import { UserPermissionRole } from "@prisma/client";

/**
 * This script directly inserts QRCodePay app into the database
 * and creates a default credential for the system user.
 * 
 * You can run this script directly with:
 * npx tsx packages/app-store/qrcodepay/lib/forceRegisterApp.ts
 */
async function forceRegisterApp() {
  try {
    console.log("🚀 Force registering QRCodePay app...");
    
    // Get admin user to attach credentials to
    const adminUser = await prisma.user.findFirst({
      where: {
        role: UserPermissionRole.ADMIN
      },
      select: {
        id: true,
        email: true
      }
    });

    if (!adminUser) {
      console.error("❌ No admin user found. Cannot register app.");
      return;
    }

    console.log(`Found admin user: ${adminUser.email}`);

    // Check if app exists
    let app = await prisma.app.findFirst({
      where: {
        slug: "qrcodepay"
      },
      select: {
        slug: true,
        dirName: true,
        categories: true,
        enabled: true,
      }
    });

    // Create the app if it doesn't exist
    if (!app) {
      console.log("Creating new QRCodePay app entry...");
      app = await prisma.app.create({
        data: {
          slug: "qrcodepay",
          dirName: "qrcodepay",
          categories: ["payment"],
          enabled: true,
        }
      });
      console.log("✅ QRCodePay app created successfully");
    } else {
      console.log("Updating existing QRCodePay app...");
      await prisma.app.update({
        where: {
          slug: "qrcodepay"
        },
        data: {
          enabled: true,
          categories: ["payment"]
        }
      });
      console.log("✅ QRCodePay app updated successfully");
    }

    // Check if credential exists
    const existingCredential = await prisma.credential.findFirst({
      where: {
        type: "qrcodepay_payment",
        userId: adminUser.id
      }
    });

    if (!existingCredential) {
      console.log("Creating default QRCodePay credential...");
      // Create a default credential
      await prisma.credential.create({
        data: {
          type: "qrcodepay_payment",
          key: {
            accountName: "Default Account",
            qrCodeUrl: "https://example.com/qr.png",
            instructions: "Scan QR code to pay",
            currency: "INR"
          },
          userId: adminUser.id
        }
      });
      console.log("✅ Default credential created successfully");
    } else {
      console.log("✅ QRCodePay credential already exists");
    }

    console.log("\n🎉 QRCodePay app registration complete!");
    console.log("Restart your application and the app should now be visible in event types.");
  } catch (error) {
    console.error("❌ Error registering QRCodePay app:", error);
  }
}

// Execute if running directly
if (require.main === module) {
  forceRegisterApp()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}

export default forceRegisterApp;
