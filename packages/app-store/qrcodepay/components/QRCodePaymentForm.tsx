"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { showToast } from "@calcom/ui/components/toast";
import { Button } from "@calcom/ui/components/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@calcom/ui/components/dialog";
import { Icon } from "@calcom/ui/components/icon";

interface QRCodePaymentFormProps {
  payment: {
    id: number;
    uid: string;
    amount: number;
    currency: string;
    success: boolean;
    data: Record<string, any>;
    externalId: string;
  };
  booking: {
    id: number;
    uid: string;
    title: string;
  };
  onSuccessCallback: () => void;
}

export default function QRCodePaymentForm({
  payment,
  booking,
  onSuccessCallback,
}: QRCodePaymentFormProps) {
  const { t } = useLocale();
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { data: session } = useSession();
  
  const updatePaymentMutation = trpc.viewer.qrcodepay.markPaymentStatus.useMutation({
    onSuccess: () => {
      showToast(t("payment_successful") || "Payment status updated successfully", "success");
      setIsDialogOpen(false);
      onSuccessCallback();
    },
    onError: (error) => {
      showToast(error.message || t("payment_error") || "Error updating payment status", "error");
      setIsProcessing(false);
    },
  });

  const markAsPaid = async () => {
    setIsProcessing(true);
    try {
      await updatePaymentMutation.mutateAsync({
        paymentId: payment.id,
        status: "paid",
        verified: false, // Client claimed paid but not verified by host yet
      });
    } catch (error) {
      console.error("Failed to mark payment as paid:", error);
    }
  };

  const payLater = () => {
    setIsDialogOpen(false);
    showToast(t("payment_later") || "You can complete the payment later", "success");
    onSuccessCallback();
  };

  // Get the QR code URL and payment instructions from the payment data
  const qrCodeUrl = payment.data.qrCodeUrl;
  const instructions = payment.data.instructions || t("scan_to_pay") || "Scan the QR code to pay";
  const accountName = payment.data.accountName || "";

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

  const formattedAmount = `${getCurrencySymbol(payment.currency)} ${(payment.amount / 100).toFixed(2)} ${payment.currency}`;

  return (
    <>
      <Button
        color="primary"
        onClick={() => setIsDialogOpen(true)}
        data-testid="pay-button"
        className="w-full sm:w-auto"
      >
        {t("pay_now") || "Pay Now"}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader
            title={t("scan_qr_to_pay") || "Scan QR Code to Pay"}
            subtitle={
              <>
                {t("payment_amount") || "Amount"}: <strong>{formattedAmount}</strong>
                <p className="text-subtle mt-1 text-sm">
                  {t("payment_to") || "To"}: {accountName}
                </p>
              </>
            }
          />

          <div className="flex flex-col items-center justify-center space-y-4 py-5">
            {qrCodeUrl ? (
              <div className="relative h-64 w-64 overflow-hidden rounded-lg border border-gray-300 p-1">
                <Image
                  src={qrCodeUrl}
                  alt="Payment QR Code"
                  width={256}
                  height={256}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-lg border border-gray-300 bg-gray-50">
                <p className="text-subtle text-center text-sm">
                  {t("qr_code_not_available") || "QR code image not available"}
                </p>
              </div>
            )}

            <div className="text-subtle max-w-sm text-center text-sm">
              <p>{instructions}</p>
            </div>
          </div>

          <DialogFooter>
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                color="minimal"
                onClick={payLater}
                data-testid="pay-later-button"
              >
                {t("pay_later") || "Pay Later"}
              </Button>
              
              <div className="flex gap-2">
                <Button
                  color="secondary"
                  StartIcon="external-link"
                  onClick={() => {
                    if (qrCodeUrl) {
                      // Open QR code in new tab for better viewing/downloading
                      window.open(qrCodeUrl, "_blank");
                    }
                  }}
                  data-testid="view-qr-button"
                >
                  {t("view_qr_full") || "View Full Size"}
                </Button>
                
                <Button
                  color="primary"
                  loading={isProcessing}
                  disabled={isProcessing}
                  onClick={markAsPaid}
                  StartIcon="check"
                  data-testid="mark-paid-button"
                >
                  {t("i_have_paid") || "I Have Paid"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
