"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Alert } from "@calcom/ui/components/alert";
import { Button } from "@calcom/ui/components/button";
import { Icon } from "@calcom/ui/components/icon";

export function RazorpaySetup() {
  const router = useRouter();
  const { t } = useLocale();
  
  return (
    <Alert
      severity="warning"
      title={t("razorpay_setup_required") || "Razorpay setup required"}
      message={t("razorpay_credentials_missing") || "You need to add your Razorpay API keys before you can accept payments."}
      className="my-4"
      actions={
        <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0">
          <Button
            color="secondary"
            StartIcon="settings"
            className="w-full sm:w-auto"
            onClick={() => {
              router.push("/apps/razorpay");
            }}>
            {t("setup_razorpay") || "Setup Razorpay"}
          </Button>
          <Button
            color="minimal"
            href="https://dashboard.razorpay.com/app/keys"
            target="_blank"
            StartIcon="external-link"
            className="w-full sm:w-auto">
            {t("visit_razorpay_dashboard") || "Visit Razorpay Dashboard"}
          </Button>
        </div>
      }
    />
  );
}

export default RazorpaySetup;