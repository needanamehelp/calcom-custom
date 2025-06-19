import type { Payment, Prisma, Booking, PaymentOption } from "@prisma/client";
import { z } from "zod";

import type { CalendarEvent } from "@calcom/types/Calendar";
import type { IAbstractPaymentService } from "@calcom/types/PaymentService";
import { prisma } from "@calcom/prisma";

export interface QRCodePaymentCredential {
  qrCodeUrl?: string;
  instructions?: string;
  accountName?: string;
  defaultCurrency?: string;
}

export class PaymentService implements IAbstractPaymentService {
  // Initialize with a default empty value to satisfy TypeScript
  private credentials: QRCodePaymentCredential = {
    qrCodeUrl: '',
    instructions: '',
    accountName: '',
    defaultCurrency: 'INR'
  };

  constructor(credentials: { key: Prisma.JsonValue }) {
    try {
      // Initialize with default values to prevent errors
      this.credentials = {
        qrCodeUrl: '',
        instructions: '',
        accountName: '',
        defaultCurrency: 'INR'
      };
      
      // Only try to parse if credentials exist
      if (credentials && credentials.key) {
        const parsed = z
          .object({
            qrCodeUrl: z.string().optional(),
            instructions: z.string().optional(),
            accountName: z.string().optional(),
            defaultCurrency: z.string().optional(),
          })
          .safeParse(credentials.key);

        if (parsed.success) {
          // Merge with defaults to ensure all fields exist
          this.credentials = {
            ...this.credentials,
            ...parsed.data
          };
        }
      }
    } catch (error) {
      console.error("Error initializing QRCodePay credentials:", error);
      // Continue with default values instead of throwing
    }
  }

  async create(
    payment: Pick<Prisma.PaymentUncheckedCreateInput, "amount" | "currency">,
    bookingId: Booking["id"],
    userId: Booking["userId"],
    username: string | null,
    bookerName: string | null,
    paymentOption: PaymentOption,
    bookerEmail: string,
    bookerPhoneNumber?: string | null,
    eventTitle?: string,
    bookingTitle?: string
  ): Promise<Payment> {
    // The qrCodeUrl should now contain the uploaded image URL
    // When using the ImageUploader component, this value is directly populated
    if (!this.credentials.qrCodeUrl) {
      console.warn("QR Code image not uploaded, using placeholder image");
      this.credentials.qrCodeUrl = "https://placehold.co/400x400/png?text=QR+Code+Missing";
    }
    
    // CRITICAL FIX: Check if we've received a data parameter with a success flag
    const paymentData = (payment as any).data || {};
    
    // Default success to false to create pending payments by default
    // This ensures payments show up in the clients tab with proper status
    const isPaid = paymentData.success === true; 
    
    // FIX: Need to show QR code during booking, so don't force confirmation
    const forceConfirmBooking = false;
    
    console.log(`QRCodePay PaymentService: Creating payment with amount=${payment.amount} currency=${payment.currency}`);
    
    // Create a payment record for QR code payment
    // FIX: Do NOT adjust the amount - keep it as-is to prevent decimal conversion issues
    return await prisma.payment.create({
      data: {
        // FIX: Do NOT modify the amount - keep it exactly as provided by the system
        amount: payment.amount,
        currency: payment.currency,
        bookingId,
        // These fields are required by Prisma schema
        fee: 0, // No fee for QR code payments
        refunded: false,
        success: isPaid,
        externalId: `qrcodepay_${Date.now()}_${bookingId}`,
        uid: `qrcodepay_${Date.now()}_${bookingId}`,
        data: {
          type: "qrcodepay_payment", // Store payment type in data object
          qrCodeUrl: this.credentials.qrCodeUrl,
          paymentInstructions: this.credentials.instructions,
          clientClaimedPaid: isPaid, // Track whether client has claimed payment
          verifiedByHost: isPaid, // Only auto-verify if marked as paid
          forceConfirmBooking: false, // EXPLICIT FALSE: Don't force confirm so QR code is displayed
          paymentStatus: isPaid ? "paid" : "pending",
          createdAt: new Date().toISOString(),
          originalAmount: payment.amount, // Store original amount for reference
          // Add additional fields to help with debugging
          isQRCodePayment: true,
        },
      },
    });
  }

  async update(
    paymentId: Payment["id"],
    data: Partial<Prisma.PaymentUncheckedCreateInput>
  ): Promise<Payment> {
    return await prisma.payment.update({
      where: {
        id: paymentId,
      },
      data,
    });
  }

  // Clients first collect card before charging
  async collectCard(
    payment: Pick<Prisma.PaymentUncheckedCreateInput, "amount" | "currency">,
    bookingId: Booking["id"],
    paymentOption: PaymentOption,
    bookerEmail: string
  ): Promise<Payment> {
    return this.create(
      payment,
      bookingId,
      null, // userId can be null for collect card
      null,
      null,
      paymentOption,
      bookerEmail
    );
  }

  // Method to charge a card after collection
  async chargeCard(
    payment: Pick<Prisma.PaymentUncheckedCreateInput, "amount" | "currency">,
    bookingId?: Booking["id"]
  ): Promise<Payment> {
    if (!bookingId) {
      throw new Error("No bookingId provided to charge card");
    }

    // Find existing payment for this booking by searching for QR code payments
    // We need to look at the data field since 'type' is stored inside the JSON data
    const existingPayment = await prisma.payment.findFirst({
      where: {
        bookingId,
        // Using externalId pattern to identify our payments
        externalId: { startsWith: 'qrcode_' },
      },
    });

    if (!existingPayment) {
      throw new Error(`No payment found for booking ${bookingId}`);
    }

    // Since QR code payments are manually verified, we don't actually charge here
    return existingPayment;
  }

  // Refund is not automated with QR codes - it must be done manually
  async refund(paymentId: Payment["id"]): Promise<Payment> {
    const payment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
    });

    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    // We need to safely handle the payment.data which might be any type
    const paymentData = payment.data as Record<string, unknown> || {};

    // Mark the payment as refunded in the database
    return await prisma.payment.update({
      where: {
        id: paymentId,
      },
      data: {
        refunded: true,
        data: {
          ...paymentData,
          refunded: true,
          refundDate: new Date().toISOString(),
        },
      },
    });
  }

  // These methods are required by the interface but not relevant for QR code payments
  async getPaymentPaidStatus(): Promise<string> {
    return "PENDING"; // QR code payments are always manual
  }

  async getPaymentDetails(): Promise<Payment> {
    throw new Error("Method not implemented for QR code payments");
  }

  async deletePayment(paymentId: number): Promise<boolean> {
    try {
      await prisma.payment.delete({
        where: {
          id: paymentId,
        },
      });
      return true;
    } catch (error) {
      console.error("Error deleting payment:", error);
      return false;
    }
  }

  async afterPayment(
    event: CalendarEvent,
    booking: {
      user: { email: string | null; name: string | null; timeZone: string } | null;
      id: number;
      startTime: { toISOString: () => string };
      uid: string;
    },
    paymentData?: Record<string, unknown>,
    eventTypeMetadata?: Record<string, unknown>
  ): Promise<void> {
    // No additional actions needed after payment for QR code payments
    return;
  }

  isSetupAlready(): boolean {
    // Check if QR code URL is properly configured
    return !!this.credentials && !!this.credentials.qrCodeUrl;
  }
}

export default PaymentService;
