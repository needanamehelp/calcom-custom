import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@calcom/prisma";

/**
 * API endpoint to register the QRCodePay app in the database
 * Can be called by navigating to /api/app-store/qrcodepay/register
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Check if app exists
    const existingApp = await prisma.app.findFirst({
      where: {
        slug: "qrcodepay",
      },
    });

    if (existingApp) {
      // Update app
      await prisma.app.update({
        where: {
          slug: "qrcodepay",
        },
        data: {
          enabled: true,
          categories: ["payment"],
        },
      });

      return res.status(200).json({
        message: "QRCodePay app updated successfully",
        appId: existingApp.slug,
      });
    } else {
      // Create app
      const newApp = await prisma.app.create({
        data: {
          slug: "qrcodepay",
          dirName: "qrcodepay",
          enabled: true,
          categories: ["payment"],
        },
      });

      return res.status(200).json({
        message: "QRCodePay app registered successfully",
        appId: newApp.slug,
      });
    }
  } catch (error) {
    console.error("Error registering QRCodePay app:", error);
    return res.status(500).json({ message: "Failed to register app", error: String(error) });
  }
}
