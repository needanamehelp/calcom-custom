import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import prisma from "@calcom/prisma";

// Schema validation for request body
const addQRCodePayAppBodySchema = z.object({
  accountName: z.string().min(1, "Account name is required"),
  qrCodeUrl: z.string().url("Must be a valid URL").min(1, "QR code URL is required"),
  instructions: z.string().optional(),
  currency: z.enum(["INR", "USD"]).default("INR"),
  userId: z.number().optional(), // User ID for credential association
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Validate request body
    const parsedBody = addQRCodePayAppBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ message: "Invalid request", errors: parsedBody.error.format() });
    }

    const { accountName, qrCodeUrl, instructions, currency, userId } = parsedBody.data;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Check if app exists
    const appExists = await prisma.app.findFirst({
      where: {
        dirName: "qrcodepay",
      },
      select: {
        slug: true,
      },
    });

    if (!appExists) {
      return res.status(404).json({ message: "QRCodePay app not found. Please ensure the app is registered in the database." });
    }

    // Find existing credential
    const existingCredential = await prisma.credential.findFirst({
      where: {
        userId,
        type: "qrcodepay_payment",
      },
      select: {
        id: true,
      },
    });

    let result;

    const credentialKey = {
      accountName,
      qrCodeUrl,
      instructions,
      currency,
    };

    if (existingCredential) {
      // Update existing credential
      result = await prisma.credential.update({
        where: {
          id: existingCredential.id,
        },
        data: {
          key: credentialKey,
        },
        select: {
          id: true,
        },
      });
    } else {
      // Create new credential
      result = await prisma.credential.create({
        data: {
          type: "qrcodepay_payment",
          key: credentialKey,
          userId,
        },
        select: {
          id: true,
        },
      });
    }

    return res.status(200).json({ success: true, credentialId: result.id });
  } catch (error) {
    console.error("Error configuring QRCodePay app:", error);
    return res.status(500).json({ message: "Internal server error", error: String(error) });
  }
}
