import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import prisma from "@calcom/prisma";
import logger from "@calcom/lib/logger";

const log = logger.getSubLogger({ prefix: ["razorpay", "createOrder"] });

// Define schema for order creation request
const orderSchema = z.object({
  amount: z.number(),
  currency: z.string(),
  bookingId: z.number(),
  receipt: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Verify user session
  const session = await getServerSession({ req });
  if (!session || !session.user || !session.user.id) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const data = orderSchema.parse(req.body);
    
    // Get user's Razorpay credentials
    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id;
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }
    
    const credential = await prisma.credential.findFirst({
      where: {
        userId: userId,
        type: "razorpay_payment",
      },
      select: {
        key: true,
      }
    });

    if (!credential) {
      return res.status(400).json({ message: "Razorpay credentials not found" });
    }
    
    // Safely parse the key object
    const keyData = credential.key as Record<string, unknown>;
    const key_id = keyData.key_id as string;
    const key_secret = keyData.key_secret as string;
    
    if (!key_id || !key_secret) {
      return res.status(400).json({ message: "Invalid Razorpay credentials" });
    }
    
    // Use Node.js require - more reliable for CommonJS modules like Razorpay
    // @ts-ignore - Bypassing TypeScript's checking to avoid persistent constructor issues
    const Razorpay = require('razorpay');
    
    // Initialize the Razorpay instance using the required module directly
    // This approach works with Node.js/CommonJS modules regardless of TypeScript's type checking
    const razorpay = new Razorpay({
      key_id,
      key_secret,
    });
    
    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: data.amount, // Amount in smallest currency unit (e.g., paise for INR)
      currency: data.currency,
      receipt: data.receipt || `booking-${data.bookingId}`,
    });
    
    return res.status(200).json({ 
      orderId: order.id,
      key_id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    log.error("Error creating Razorpay order", error);
    return res.status(500).json({ message: "Error creating order", error });
  }
}
