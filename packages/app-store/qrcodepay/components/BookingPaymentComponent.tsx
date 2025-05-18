"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

import type { PaymentOption } from "@prisma/client";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button } from "@calcom/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogFooter } from "@calcom/ui/components/dialog";
import { showToast } from "@calcom/ui/components/toast";
import { Icon } from "@calcom/ui/components/icon";

// Import appRouter for type definition
// Import type { AppRouter } from "../trpc-router";

// This component is intended to be shown during the booking process as part of the checkout
interface BookingPaymentComponentProps {
  paymentData: {
    price: number;
    currency: string;
    qrCodeUrl: string;
    accountName: string;
    upiId?: string;
    instructions?: string;
  };
  bookingData: {
    eventTitle?: string;
    eventDescription?: string;
    paymentOption?: PaymentOption;
    customerEmail?: string;
    bookingId: number; // Required to connect payment to a booking
  };
  onSuccessBooking: (paymentId: string, isPaid: boolean) => void;
}

const BookingPaymentComponent = ({
  paymentData,
  bookingData,
  onSuccessBooking,
}: BookingPaymentComponentProps) => {
  const { t } = useLocale();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQRCodeDialog, setShowQRCodeDialog] = useState(false);

  // Use alternative mutation approach with fetch API
  // Instead of relying on TRPC which isn't properly connected yet
  // Define return type for createPayment
  interface PaymentResponse {
    id: string | number;
    [key: string]: any;
  }

  // Note: We're using fetch API directly since the TRPC endpoint for creating payments doesn't exist in this context
  // A custom endpoint integration is more appropriate for QR code payments

  const createPayment = async (params: {
    amount: number;
    currency: string;
    bookingId: number;
    eventName?: string;
    customerEmail?: string;
    paymentOption?: PaymentOption;
    markAsPaid?: boolean; // Whether to mark the payment as successful
    forceConfirmBooking?: boolean; // Whether to force confirm the booking regardless of payment status
  }): Promise<PaymentResponse | undefined> => {
    setIsProcessing(true);
    try {
      // Log the QR code URL to verify it exists
      console.log("QR Code URL being used:", paymentData.qrCodeUrl);
      
      // Use fetch API to create the payment directly
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: params.amount,
          currency: params.currency,
          bookingId: params.bookingId,
          eventName: params.eventName || "",
          appId: "qrcodepay",
          customerEmail: params.customerEmail || "",
          paymentOption: params.paymentOption || "ON_BOOKING",
          success: params.markAsPaid === true, // Only mark as successful if explicitly requested
          forceConfirmBooking: params.forceConfirmBooking === true, // Force booking confirmation if requested
          // Track payment status explicitly in metadata
          metadata: {
            qrCodeUrl: paymentData.qrCodeUrl,
            accountName: paymentData.accountName,
            upiId: paymentData.upiId,
            forceConfirmBooking: params.forceConfirmBooking === true,
            paymentStatus: params.markAsPaid === true ? "paid" : "pending",
            // Include the actual requested amount for better tracking
            requestedAmount: params.amount,
          }
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Payment creation failed");
      }
      
      const data = await response.json();
      if (data?.id) {
        showToast(t("payment_initiated") || "Payment initiated successfully", "success");
        return data as PaymentResponse;
      }
      
      return undefined;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t("payment_error") || "Error initiating payment";
      showToast(errorMessage, "error");
      setIsProcessing(false);
      return undefined;
    }
  };

  // Log the price received for debugging
  console.log("QRCodePay: Received payment data:", paymentData);
  
  // Format amount display with proper currency symbol
  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case "INR":
        return "₹";
      case "USD":
        return "$";
      default:
        return "₹";
    }
  };

  // IMPORTANT: Display the price as-is without any conversion
  // This ensures 1500 shows as 1500, not 15.00
  const formattedAmount = `${getCurrencySymbol(paymentData.currency)} ${paymentData.price} ${
    paymentData.currency
  }`;

  const handleConfirmPayment = async () => {
    setIsProcessing(true);
    try {
      console.log("QRCodePay: Confirming payment with data:", {
        price: paymentData.price,
        priceForApi: paymentData.price, // Don't multiply by 100, use as-is
        currency: paymentData.currency,
        bookingId: bookingData.bookingId
      });
      
      // When confirming payment, explicitly mark it as paid
      const result = await createPayment({
        amount: paymentData.price, // Don't multiply by 100, use as-is
        currency: paymentData.currency,
        bookingId: bookingData.bookingId, 
        eventName: bookingData.eventTitle || "",
        customerEmail: bookingData.customerEmail || "",
        paymentOption: bookingData.paymentOption || "ON_BOOKING",
        markAsPaid: true, // Important: This ensures the payment shows up as paid
      });
      
      if (result && result.id) {
        // User has confirmed they've completed the payment
        console.log("QRCodePay: Payment confirmed, calling onSuccessBooking");
        onSuccessBooking(result.id.toString(), true);
      }
    } catch (error) {
      console.error("Failed to create payment:", error);
      setIsProcessing(false);
    }
  };

  // For the initial button to start payment process
  // Add debug button for troubleshooting
  const debugInfo = () => {
    console.log("QRCodePay Debug Info:", {
      showQRCodeDialog: showQRCodeDialog,
      paymentData: paymentData,
      bookingData: bookingData,
    });
    alert("QR Code payment debug info logged to console");
  };

  // Auto-open dialog for testing - comment out in production
  useEffect(() => {
    console.log("QRCodePay: Component mounted, preparing to show QR code dialog");
    // Short delay to ensure the component is mounted
    const timer = setTimeout(() => {
      console.log("QRCodePay: Opening QR code dialog automatically");
      setShowQRCodeDialog(true);
    }, 1000);
    
    // Clean up the timer if the component unmounts
    return () => {
      console.log("QRCodePay: Cleaning up timer");
      clearTimeout(timer);
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <div className="my-6 flex flex-col items-center justify-center space-y-4">
      <h3 className="text-emphasis text-center text-xl font-semibold">
        {t("payment_required") || "Payment Required"}
      </h3>
      
      <div className="text-emphasis text-center">
        <p className="text-lg font-medium">{t("amount") || "Amount"}: {formattedAmount}</p>
        <p className="text-sm">{t("to") || "To"}: {paymentData.accountName}</p>
      </div>
      
      <div className="flex flex-col space-y-2">
        <Button
          className="w-full sm:w-auto"
          color="primary"
          onClick={() => setShowQRCodeDialog(true)}
          StartIcon="credit-card"
        >
          {t("pay_to_book") || "Pay to Book"}
        </Button>
        
        <Button
          className="w-full sm:w-auto"
          color="secondary"
          onClick={debugInfo}
          StartIcon="code"
        >
          Debug Payment Info
        </Button>
      </div>

      {/* QR Code Payment Dialog */}
      <Dialog open={showQRCodeDialog} onOpenChange={setShowQRCodeDialog}>
        <DialogContent size="lg">
          <DialogHeader 
            title={t("qr_code_payment_title") || "Complete Payment via QR Code"} 
            subtitle={`${t("amount") || "Amount"}: ${formattedAmount}`}
          />
          
          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="text-emphasis text-center">
              <p className="text-sm">{t("to") || "To"}: {paymentData.accountName}</p>
              {paymentData.upiId && (
                <p className="text-sm">
                  {t("upi_id") || "UPI ID"}: <span className="font-medium">{paymentData.upiId}</span>
                </p>
              )}
            </div>

            {/* QR Code Display */}
            <div className="mt-4">
              <div className="relative h-64 w-64 overflow-hidden rounded-lg border border-gray-300 bg-white p-2">
                {paymentData.qrCodeUrl ? (
                  <Image
                    src={paymentData.qrCodeUrl}
                    alt="Payment QR Code"
                    width={256}
                    height={256}
                    className="h-full w-full object-contain"
                    onError={() => {
                      console.error("QR Code image failed to load:", paymentData.qrCodeUrl);
                      showToast("QR Code image not loaded. Using placeholder instead.", "warning");
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-50">
                    <p className="text-subtle text-center text-sm">
                      {t("qr_code_not_available") || "QR code image not available"}
                    </p>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="mt-4 text-center">
                <h4 className="text-default font-medium">
                  {t("payment_instructions") || "Payment Instructions"}
                </h4>
                <p className="text-subtle text-sm">
                  {paymentData.instructions ||
                    t("default_payment_instructions") ||
                    "Scan the QR code with your UPI/Payment app to complete payment."}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
            <Button
              className="w-full sm:w-auto"
              color="secondary"
              onClick={async () => {
                // Mark as pay later - payment will be pending but booking will be confirmed
                try {
                  console.log("QRCodePay: Creating payment with Pay Later (pending but confirmed)");
                  setIsProcessing(true);
                  const result = await createPayment({
                    amount: paymentData.price,
                    currency: paymentData.currency,
                    bookingId: bookingData.bookingId,
                    eventName: bookingData.eventTitle || "",
                    customerEmail: bookingData.customerEmail || "",
                    paymentOption: bookingData.paymentOption || "ON_BOOKING",
                    markAsPaid: false, // Payment is pending
                    forceConfirmBooking: true, // But force booking to be confirmed anyway
                  });
                  
                  if (result && result.id) {
                    showToast("Booking confirmed with pending payment", "success");
                    setShowQRCodeDialog(false);
                    // Always pass true here to ensure booking is confirmed regardless of payment status
                    onSuccessBooking(result.id.toString(), true); 
                  }
                } catch (error) {
                  console.error("Error creating payment:", error);
                  setIsProcessing(false);
                }
              }}
              disabled={isProcessing}
            >
              {t("pay_later") || "Pay Later"}
            </Button>
            <Button
              className="w-full sm:w-auto"
              color="primary"
              loading={isProcessing}
              disabled={isProcessing || !paymentData.qrCodeUrl}
              onClick={async () => {
                await handleConfirmPayment();
                setShowQRCodeDialog(false);
              }}
              StartIcon="check"
            >
              {t("confirm_payment") || "I've Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingPaymentComponent;
