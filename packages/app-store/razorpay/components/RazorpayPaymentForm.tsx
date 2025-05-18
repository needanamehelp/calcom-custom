"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";

import type { Props } from "@calcom/features/ee/payments/components/Payment";
import type { PaymentPageProps } from "@calcom/features/ee/payments/pages/payment";
import { WEBAPP_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { showToast } from "@calcom/ui/components/toast";
import { Button } from "@calcom/ui/components/button";

import getRazorpay from "../lib/client";

export const RazorpayPaymentForm = (
  props: Props & {
    uid: string;
    onPaymentSuccess?: (input: PaymentPageProps) => void;
    onPaymentCancellation?: (input: PaymentPageProps) => void;
  }
) => {
  const { t } = useLocale();
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const { payment, booking } = props;
  const attendeeEmail = booking.attendees[0]?.email || "";
  const attendeeName = booking.attendees[0]?.name || "";

  // Load Razorpay script when component mounts
  useEffect(() => {
    getRazorpay(
      () => setIsScriptLoaded(true),
      (error) => {
        console.error("Razorpay script loading error:", error);
        showToast(t("razorpay_load_error"), "error");
        setIsScriptLoaded(true); // Set to true to allow retry
      }
    );
  }, [t]);

  const handlePayment = () => {
    if (!isScriptLoaded) {
      showToast(t("razorpay_not_loaded"), "error");
      return;
    }

    if (!payment?.data?.key_id || !payment?.data?.order_id) {
      showToast(t("razorpay_missing_data"), "error");
      return;
    }
    
    setIsLoading(true);
    
    getRazorpay((Razorpay) => {
      try {
        const options = {
          key: payment.data.key_id as string,
          amount: payment.amount,
          currency: payment.currency,
          name: "Cal.com", // Use your application/company name
          description: `Payment for booking #${booking.uid}`,
          order_id: payment.data.order_id as string,
          handler: function (response: any) {
            // On successful payment, redirect to the success page
            window.location.href = `${WEBAPP_URL}/booking/${booking.uid}?payment_intent=${response.razorpay_payment_id}&payment_intent_client_secret=${response.razorpay_signature}&redirect_status=succeeded`;
          },
          prefill: {
            name: attendeeName,
            email: attendeeEmail,
          },
          theme: {
            color: "#3a86ff",
          },
          modal: {
            ondismiss: function () {
              setIsLoading(false);
            },
          },
        };

        const razorpayInstance = new Razorpay(options);
        razorpayInstance.open();
      } catch (error) {
        console.error("Error opening Razorpay:", error);
        showToast(t("razorpay_init_error"), "error");
        setIsLoading(false);
      }
    }, (error) => {
      console.error("Razorpay initialization error:", error);
      showToast(t("razorpay_init_error"), "error");
      setIsLoading(false);
    });
  };

  return (
    <div className="bg-subtle mt-4 rounded-md p-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-emphasis font-medium">{t("payment_via_razorpay")}</h2>
          <p className="text-default text-sm">
            {t("amount")}: {props.payment.amount / 100} {props.payment.currency.toUpperCase()}
          </p>
        </div>
        <div className="mt-2 flex justify-end space-x-2">
          <Button
            color="secondary"
            disabled={isLoading}
            id="razorpay-payment-button"
            type="button"
            loading={isLoading}
            onClick={handlePayment}>
            <span>{t("pay_now")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}; 