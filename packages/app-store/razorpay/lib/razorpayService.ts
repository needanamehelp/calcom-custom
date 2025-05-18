import { z } from "zod";
// Using a type-only import for Razorpay
import type { Booking, Payment, Prisma } from "@prisma/client";

// Define Razorpay interface for typing
interface Razorpay {
  orders: {
    create: (options: any) => Promise<any>;
  };
  // Add other Razorpay methods as needed
}

import prisma from "@calcom/prisma";
import Logger from "@calcom/lib/logger";

const log = Logger.getSubLogger({ prefix: ["razorpay", "service"] });

type RazorpayCredentialType = {
  key_id: string;
  key_secret: string;
  webhook_secret?: string;
};

export const razorpayCredentialSchema = z.object({
  key_id: z.string(),
  key_secret: z.string(),
  webhook_secret: z.string().optional(),
});

export class RazorpayService {
  private razorpay: Razorpay | null = null;
  private credentials: RazorpayCredentialType | null = null;

  constructor(credentials?: RazorpayCredentialType) {
    if (credentials) {
      this.setCredentials(credentials);
    }
  }

  public setCredentials(credentials: RazorpayCredentialType) {
    this.credentials = credentials;
    
    // Use require() for CommonJS module - more reliable than ES imports
    // @ts-ignore - Bypass TypeScript checking for constructor signature
    const RazorpayConstructor = require('razorpay');
    
    this.razorpay = new RazorpayConstructor({
      key_id: credentials.key_id,
      key_secret: credentials.key_secret,
    });
  }

  public async getUserCredentials(userId: number): Promise<RazorpayCredentialType | null> {
    try {
      const credential = await prisma.credential.findFirst({
        where: {
          userId,
          type: "razorpay_payment",
        },
        select: {
          key: true,
        },
      });

      if (!credential) {
        return null;
      }

      const parsedKey = razorpayCredentialSchema.safeParse(credential.key);
      if (!parsedKey.success) {
        log.error("Invalid Razorpay credentials format");
        return null;
      }

      return parsedKey.data;
    } catch (error) {
      log.error("Error getting Razorpay credentials", error);
      return null;
    }
  }

  public async createOrder(
    amount: number,
    currency: string,
    receipt: string,
    notes: Record<string, string> = {}
  ) {
    if (!this.razorpay) {
      throw new Error("Razorpay client not initialized");
    }

    try {
      const order = await this.razorpay.orders.create({
        amount,
        currency,
        receipt,
        notes,
      });
      return order;
    } catch (error) {
      log.error("Error creating Razorpay order", error);
      throw error;
    }
  }

  public async createPaymentForBooking(
    booking: Booking,
    amount: number,
    currency: string
  ): Promise<Payment> {
    if (!this.razorpay || !this.credentials) {
      throw new Error("Razorpay client not initialized");
    }

    try {
      // Create a Razorpay order first
      const order = await this.createOrder(
        amount,
        currency,
        `booking-${booking.id}`,
        { bookingId: booking.id.toString() }
      );

      // Create a payment record in the database
      const paymentData: Prisma.PaymentCreateInput = {
        uid: `razorpay_${order.id}`, // Required unique identifier
        amount,
        currency,
        success: false,
        refunded: false, // Required field in Payment model
        externalId: order.id,
        booking: {
          connect: {
            id: booking.id,
          },
        },
        data: {
          order_id: order.id,
          key_id: this.credentials.key_id,
          provider: "razorpay", // Store payment provider type in the data field
        },
        fee: 0, // Fee will be calculated after payment
      };

      return await prisma.payment.create({
        data: paymentData,
      });
    } catch (error) {
      log.error("Error creating payment for booking", error);
      throw error;
    }
  }

  public verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!this.credentials) {
      throw new Error("Razorpay credentials not initialized");
    }

    try {
      const body = orderId + "|" + paymentId;
      const crypto = require("crypto");
      const expectedSignature = crypto
        .createHmac("sha256", this.credentials.key_secret)
        .update(body.toString())
        .digest("hex");

      return expectedSignature === signature;
    } catch (error) {
      log.error("Error verifying Razorpay payment signature", error);
      return false;
    }
  }
}

export default RazorpayService;
