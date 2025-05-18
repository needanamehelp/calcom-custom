"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Alert } from "@calcom/ui/components/alert";
import { Button } from "@calcom/ui/components/button";
import { Icon } from "@calcom/ui/components/icon";

export function InvalidSetup() {
  const router = useRouter();
  const { t } = useLocale();
  
  return (
    <Alert
      severity="warning"
      title={t("qrcode_setup_required") || "QR Code payment setup required"}
      message={t("qrcode_payment_missing") || "You need to upload your payment QR code before you can accept payments."}
      className="my-4"
      actions={
        <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-3 sm:space-y-0">
          <Button
            color="secondary"
            StartIcon="settings"
            className="w-full sm:w-auto"
            onClick={() => {
              router.push("/apps/qrcodepay");
            }}>
            {t("setup_qrcode_payment") || "Setup QR Code Payment"}
          </Button>
        </div>
      }
    />
  );
}

export default InvalidSetup;
