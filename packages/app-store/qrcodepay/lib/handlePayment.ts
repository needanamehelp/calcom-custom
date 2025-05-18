import prisma from "@calcom/prisma";
import { BookingStatus } from "@calcom/prisma/enums";

export async function handlePayment(
  bookingId: number,
  paymentId: number
): Promise<{
  booking: {
    id: number;
    uid: string;
    userId: number | null; // Added | null to match potential database nullability
    startTime: Date;
    payment: {
      id: number;
      success: boolean;
    };
  };
  message: string;
  success: boolean;
  paymentId: number;
}> {
  // Helper function to safely get payment information regardless of type
  // Use explicit type to avoid array accessing issues
  const getPaymentInfo = (
    payment: unknown,
    defaultId: number,
    defaultSuccess: boolean
  ): { id: number; success: boolean } => {
    // Handle case where payment is undefined or null
    if (!payment) return { id: defaultId, success: defaultSuccess };
    
    // Handle case where payment is an array (from certain prisma queries)
    if (Array.isArray(payment) && payment.length > 0) {
      const firstPayment = payment[0];
      // Safely access properties on the first item
      const id = typeof firstPayment === 'object' && firstPayment !== null && 'id' in firstPayment ? 
        Number(firstPayment.id) : defaultId;
      const success = typeof firstPayment === 'object' && firstPayment !== null && 'success' in firstPayment ? 
        Boolean(firstPayment.success) : defaultSuccess;
      return { id, success };
    }
    
    // Handle case where payment is a single object
    if (typeof payment === 'object' && payment !== null) {
      const paymentObj = payment as Record<string, unknown>;
      const id = 'id' in paymentObj ? Number(paymentObj.id) : defaultId;
      const success = 'success' in paymentObj ? Boolean(paymentObj.success) : defaultSuccess;
      return { id, success };
    }
    
    // Default fallback
    return { id: defaultId, success: defaultSuccess };
  };
  try {
    // Get payment
    const payment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
      select: {
        id: true,
        success: true,
        data: true,
      },
    });

    if (!payment) {
      throw new Error(`Payment not found for payment id: ${paymentId}`);
    }

    // Check if client claimed payment was made
    // Need to safely access data which could be any type
    const paymentData = payment.data as Record<string, unknown> || {};
    const clientClaimedPaid = paymentData.clientClaimedPaid === true;

    // Get booking
    const booking = await prisma.booking.findUnique({
      where: {
        id: bookingId,
      },
      select: {
        id: true,
        uid: true,
        userId: true,
        startTime: true,
        status: true,
        payment: {
          select: {
            id: true,
            success: true,
          },
        },
      },
    });

    if (!booking) {
      throw new Error(`Booking not found for payment id: ${paymentId}`);
    }

    // Check for force confirm flag in payment data
    // The payment data can contain a forceConfirmBooking flag from the BookingPaymentComponent
    const shouldForceConfirm = typeof paymentData === 'object' && 
      paymentData !== null && 
      ('forceConfirmBooking' in paymentData ? !!paymentData.forceConfirmBooking : true);
    
    console.log(`QRCodePay handlePayment: Booking status=${booking.status}, shouldForceConfirm=${shouldForceConfirm}`);
    
    // Always update the booking status to ACCEPTED regardless of payment status
    // This ensures the booking is confirmed even with pending payments
    if (booking.status !== BookingStatus.ACCEPTED) {
      await prisma.booking.update({
        where: {
          id: bookingId,
        },
        data: {
          status: BookingStatus.ACCEPTED,
        },
      });
      console.log(`QRCodePay: Updated booking ${bookingId} status to ACCEPTED`);
    }
    
    // Update payment data if the client claimed they paid
    if (clientClaimedPaid) {
      // Update the payment to reflect client claimed payment
      await prisma.payment.update({
        where: {
          id: paymentId,
        },
        data: {
          data: {
            ...paymentData,
            lastClientClaimDate: new Date().toISOString(),
          },
        },
      });

      // Need to transform the result to match our expected return type
      const transformedBooking = {
        id: booking.id,
        uid: booking.uid,
        userId: booking.userId,
        startTime: booking.startTime,
        // Use the helper function to safely get payment info
        payment: getPaymentInfo(booking.payment, paymentId, true),
      };
      
      return {
        booking: transformedBooking,
        success: true,
        message: "Client claimed QR code payment was made and booking is confirmed",
        paymentId,
      };
    }

    // Transform the result to match our expected return type
    const transformedBooking = {
      id: booking.id,
      uid: booking.uid,
      userId: booking.userId,
      startTime: booking.startTime,
      // Use the helper function to safely get payment info
      payment: getPaymentInfo(booking.payment, paymentId, false),
    };
    
    return {
      booking: transformedBooking,
      success: false,
      message: "Client has not claimed to make a payment yet",
      paymentId,
    };
  } catch (error) {
    console.error(`Error handling QR code payment: ${error}`);
    throw error;
  }
}
