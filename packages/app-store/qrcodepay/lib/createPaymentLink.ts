import { getUserCredentials } from "./utils";
import { randomString } from "@calcom/lib/random";
import { prisma } from "@calcom/prisma";
import type { Booking, Payment } from "@prisma/client";

interface CreatePaymentLinkOptions {
  paymentUid: string;
  bookingUid: string;
  redirectUrl: string;
  paymentAmount: number;
  currency: string;
  name?: string;
  email?: string;
  metadata?: Record<string, unknown>;
  username?: string;
  bookingId?: number;
  success?: boolean;
}

export const createPaymentLink = async (opts: CreatePaymentLinkOptions) => {
  try {
    // Get the booking
    const booking = await prisma.booking.findUnique({
      where: {
        uid: opts.bookingUid,
      },
      select: {
        id: true,
        userId: true,
        eventTypeId: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    // Get the credentials for the user
    // Ensure userId is not null before calling getUserCredentials
    if (!booking.userId) {
      throw new Error("User ID not found for booking");
    }
    
    const credentials = await getUserCredentials(booking.userId);
    if (!credentials) {
      throw new Error("QR Code payment credentials not found");
    }

    // Check if the payment amount needs to be converted
    // Cal.com typically expects amounts in the smallest currency unit (cents/paise)
    // But our app's UI may allow entering the actual amount (dollars/rupees)
    // Let's ensure the amount is in cents/paise without double-converting
    let paymentAmount = opts.paymentAmount;
    
    // If amount looks like it's already in dollars/rupees (e.g., 15.99), convert to cents
    // If amount is a whole number like 1500, assume it's already in cents/rupees and keep as is
    if (paymentAmount < 100 && paymentAmount % 1 !== 0) {
      // It has decimal places and is small - likely in dollars/rupees, convert to cents
      paymentAmount = Math.round(paymentAmount * 100);
    }
    
    console.log(`QRCodePay: Processing payment amount ${opts.paymentAmount} as ${paymentAmount} ${opts.currency.toLowerCase()} cents/paise`);
    
    // Create a payment record with pending status
    const payment = await prisma.payment.create({
      data: {
        uid: opts.paymentUid,
        amount: paymentAmount,
        currency: opts.currency,
        success: false, // Initially pending
        refunded: false,
        externalId: `qrcodepay_${randomString(10)}`,
        bookingId: booking.id,
        data: {
          paymentMethod: "qrcodepay",
          qrCodeUrl: credentials.qrCodeUrl,
          accountName: credentials.accountName,
          instructions: credentials.instructions || "",
          clientClaimedPaid: false,
          verifiedByHost: false,
          customer: {
            email: opts.email,
            name: opts.name,
          },
          originalAmount: opts.paymentAmount, // Store the original unmodified amount
        },
        fee: 0,
      },
    });

    // Return the necessary payment URL and metadata
    return {
      url: `${opts.redirectUrl}?qrcodepay=true&paymentId=${payment.id}`,
      paymentUid: payment.uid,
      paymentId: payment.id,
      externalId: payment.externalId,
    };
  } catch (error) {
    console.error("Error creating QR code payment link:", error);
    throw error;
  }
};
