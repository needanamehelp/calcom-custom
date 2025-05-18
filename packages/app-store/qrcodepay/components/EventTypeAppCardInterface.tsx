"use client";

import { useMemo, useState } from "react";
import { z } from "zod";

import { useAppContextWithSchema } from "@calcom/app-store/EventTypeAppContext";
import useIsAppEnabled from "@calcom/app-store/_utils/useIsAppEnabled";
import checkForMultiplePaymentApps from "@calcom/app-store/_utils/payments/checkForMultiplePaymentApps";
import type { EventTypeAppCardComponent } from "@calcom/app-store/types";
import { WEBAPP_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Alert } from "@calcom/ui/components/alert";
import { Button } from "@calcom/ui/components/button";
import AppCard from "@calcom/app-store/_components/AppCard";

import { appDataSchema } from "../zod";

// This component is critical for showing up in the event type's apps tab
const EventTypeAppCardInterface: EventTypeAppCardComponent = function EventTypeAppCardInterface({
  app,
  eventType,
  eventTypeFormMetadata,
}) {
  const { t } = useLocale();
  const { getAppData, setAppData, disabled } = useAppContextWithSchema<typeof appDataSchema>();
  const { enabled, updateEnabled } = useIsAppEnabled(app);
  const [showInfoBanner, setShowInfoBanner] = useState(false);

  // Prevent enabling payment apps if there's already one enabled
  const otherPaymentAppEnabled = checkForMultiplePaymentApps(eventTypeFormMetadata);

  // Get the app's credentials to check if setup is complete
  const price = getAppData("price") || 0;
  const currency = getAppData("currency") || "INR";
  const enabled_app = getAppData("enabled") as boolean;
  // Explicitly use credentialIds (not credentials) to check if setup is complete
  const hasCredential = app.credentialIds && app.credentialIds.length > 0;

  return (
    <AppCard
      app={app}
      switchOnClick={otherPaymentAppEnabled ? undefined : updateEnabled}
      switchChecked={enabled}
      teamId={eventType.teamId || undefined}
      disableSwitch={otherPaymentAppEnabled && !enabled}
    >
      {otherPaymentAppEnabled && !enabled && (
        <Alert className="mt-2" severity="warning" title={t("event_setup_multiple_payment_apps_warning")} />
      )}
      
      {!hasCredential && enabled && (
        <Alert
          className="mt-2"
          severity="warning"
          title={t("missing_payment_configuration", "QR Code Payment setup incomplete")}
          message={
            <div className="mt-2">
              <p className="mb-2">
                {t("payment_app_needs_setup", "You need to configure your QR code payment settings before using this app.")}
              </p>
              <Button
                color="secondary"
                href={WEBAPP_URL + "/apps/qrcodepay/setup"}
                target="_blank"
                className="mb-1"
              >
                {t("setup_payment", "Setup Payment")}
              </Button>
            </div>
          }
        />
      )}

      {hasCredential && enabled && showInfoBanner && (
        <Alert
          className="mt-2"
          severity="neutral"
          title={t("qr_code_payment_info", "QR Code Payment Information")}
          message={
            <div className="mt-2 space-y-2 text-sm">
              <p>
                {t("qr_code_payment_description", 
                "The QR code payment gateway allows your clients to pay you using a QR code. They can scan this code using payment apps on their phone to complete the payment.")}
              </p>
              <p>
                {t("currency_selected", "Currency selected:")} <strong>{currency}</strong>
              </p>
              {!!price && (
                <p>
                  {t("price_set_to", "Price set to:")} <strong>{price} {currency}</strong>
                </p>
              )}
            </div>
          }
        />
      )}

      {hasCredential && enabled && !showInfoBanner && (
        <div className="mt-2">
          <Button color="secondary" onClick={() => setShowInfoBanner(true)} className="w-full">
            {t("view_payment_details", "View Payment Details")}
          </Button>
        </div>
      )}
    </AppCard>
  );
};

export default EventTypeAppCardInterface;
