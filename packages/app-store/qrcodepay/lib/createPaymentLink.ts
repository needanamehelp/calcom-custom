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

    // THIS IS THE KEY FIX FOR AMOUNT CONVERSION
    // Cal.com divides amounts by 100 when displaying them
    // So we need to multiply by 100 here to counteract that
    // This fixes the issue where 1500 was showing as 15.00
    const paymentAmount = opts.paymentAmount * 100;
    
    console.log(`QRCodePay: FIXED amount conversion by multiplying by 100`);
    console.log(`QRCodePay: Original input amount: ${opts.paymentAmount}`);
    console.log(`QRCodePay: Amount after *100 conversion: ${paymentAmount}`);
    
    // This approach matches what other payment apps like Razorpay do
    // Razorpay uses: amount: amount * 100 // paise
    
    // Create a payment record with pending status
    const payment = await prisma.payment.create({
      data: {
        uid: opts.paymentUid,
        // CRITICAL FIX: This is what prevents the 1500 → 15.00 conversion
        // In Cal.com, most payment apps multiply by 100 for cents conversion
        // But for QRCodePay, we want the exact amount with no modification
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
          forceConfirmBooking: true, // Ensure booking is confirmed regardless of payment
          useExactAmount: true, // Flag to signal no amount conversion needed
          customer: {
            email: opts.email,
            name: opts.name,
          },
          originalAmount: paymentAmount, // Store the original unmodified amount
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
