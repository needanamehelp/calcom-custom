import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import type { EventTypeAppSettingsComponent } from "@calcom/app-store/types";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Alert } from "@calcom/ui/components/alert";
import { Button } from "@calcom/ui/components/button";
import { Label, Input, Select, TextArea } from "@calcom/ui/components/form";
import { RadioGroup, RadioField } from "@calcom/ui/components/radio";
import { Icon } from "@calcom/ui/components/icon";
import { ImageUploader } from "@calcom/ui/components/image-uploader";

import { appDataSchema } from "../zod";

const paymentOptions = [
  {
    value: "ON_BOOKING",
    label: "On booking",
    description: "Guest will need to pay to complete the booking",
  },
];

const currencyOptions = [
  { value: "INR", label: "Indian Rupee (₹)" },
  { value: "USD", label: "US Dollar ($)" },
];

const EventTypeAppSettingsInterface: EventTypeAppSettingsComponent = ({
  eventType,
  disabled,
  getAppData,
  setAppData,
}) => {
  const { t } = useLocale();
  
  // Get all necessary values from app data
  const enabled = getAppData("enabled");
  const price = getAppData("price") || 0;
  const currency = getAppData("currency") || "INR";
  const paymentOption = getAppData("paymentOption") || "ON_BOOKING";
  const qrCodeUrl = getAppData("qrCodeUrl") || "";
  const upiId = getAppData("upiId") || "";
  const instructions = getAppData("instructions") || "";
  const accountName = getAppData("accountName") || "";

  const [selectedCurrency, setSelectedCurrency] = useState(
    currencyOptions.find((option) => option.value === currency) || currencyOptions[0]
  );

  // QR code preview state
  const [previewUrl, setPreviewUrl] = useState(qrCodeUrl);

  // Handle form changes
  const handleCurrencyChange = (option: any) => {
    if (!option) return;
    setSelectedCurrency(option);
    setAppData("currency", option.value);
  };

  // Define the type for credential response
  interface CredentialData {
    id: number;
    key: Record<string, string>;
    type: string;
  }

  interface AppResponse {
    credentials?: CredentialData[];
  }

  // Check if user has QR code payment credentials set up
  const { data: appData, isLoading } = trpc.viewer.apps.appById.useQuery({ 
    appId: "qrcodepay"
  }, {
    refetchOnWindowFocus: false,
  }) as { data: AppResponse | undefined; isLoading: boolean };
  
  // Determine if the user has set up QR code payments
  const [hasSetupApp, setHasSetupApp] = useState(false);
  const router = useRouter();

  // Detect if payment setup is not complete
  const setupIncomplete = !qrCodeUrl || !accountName;

  useEffect(() => {
    if (isLoading || !appData) return;
    
    // Find QRCodePay credentials
    const qrCodePayCred = appData.credentials?.find(
      (cred: CredentialData) => cred.type === "qrcodepay_payment"
    );
    
    // Set app as configured if credentials exist
    setHasSetupApp(!!qrCodePayCred);
    
    // If we have credentials but not local app data, load from credentials
    if (qrCodePayCred?.key) {
      const key = qrCodePayCred.key as Record<string, string>;
      
      // Only update app data if not already set in event type
      if (!qrCodeUrl && key.qrCodeUrl) setAppData("qrCodeUrl", key.qrCodeUrl);
      if (!accountName && key.accountName) setAppData("accountName", key.accountName);
      if (!upiId && key.upiId) setAppData("upiId", key.upiId);
      if (!instructions && key.instructions) setAppData("instructions", key.instructions);
      if (key.defaultCurrency) setAppData("currency", key.defaultCurrency);
    }
  }, [appData, isLoading, qrCodeUrl, accountName, upiId, instructions]);

  // Save credentials directly when enabled
  const saveKeysMutation = trpc.viewer.apps.saveKeys.useMutation({
    onSuccess: () => {
      // Refetch app data after saving
      const utils = trpc.useUtils();
      utils.viewer.apps.invalidate();
    },
    onError: (error) => {
      console.error("Error saving QR Code payment settings:", error);
    },
  });

  // Save credentials directly when enabled
  const saveCredentials = async () => {
    if (!qrCodeUrl || !accountName) {
      return; // Don't save if required fields are missing
    }

    try {
      await saveKeysMutation.mutateAsync({
        type: "qrcodepay_payment",
        slug: "qrcodepay",
        dirName: "qrcodepay",
        keys: {
          accountName,
          instructions,
          qrCodeUrl,
          upiId,
          defaultCurrency: currency,
        },
      });
    } catch (error) {
      console.error("Error saving QR Code payment settings:", error);
    }
  };

  // Auto-save credentials when setup changes
  useEffect(() => {
    if (enabled && !isLoading) {
      // Auto-save credentials when the app is enabled and we have at least account name (minimal requirement)
      if (accountName) {
        saveCredentials();
      }
    }
  }, [enabled, accountName, isLoading]);
  
  // This effect handles app setup state
  useEffect(() => {
    // Only run after we've fetched credentials
    if (isLoading) return;
    
    // IMPORTANT: Always mark app as setup if any credentials exist
    // This is the key fix for 'app_is_not_setup' error
    if (appData?.credentials && appData.credentials.some(
      (cred: CredentialData) => cred.type === "qrcodepay_payment"
    )) {
      // Find the first QRCodePay credential
      const qrCodePayCred = appData.credentials.find(
        (cred: CredentialData) => cred.type === "qrcodepay_payment"
      );
      
      // If credentials exist but local state is empty, populate from credentials
      if (qrCodePayCred?.key) {
        const key = qrCodePayCred.key as Record<string, string>;
        if (!accountName && key.accountName) setAppData("accountName", key.accountName);
        if (!qrCodeUrl && key.qrCodeUrl) setAppData("qrCodeUrl", key.qrCodeUrl);
        if (!upiId && key.upiId) setAppData("upiId", key.upiId);
        if (!instructions && key.instructions) setAppData("instructions", key.instructions);
        if (key.defaultCurrency) setAppData("currency", key.defaultCurrency);
      }
    }
  }, [isLoading, appData, accountName, qrCodeUrl, upiId, instructions]);

  return (
    <div className="space-y-6">
      {enabled && (!qrCodeUrl || !accountName) && (
        <Alert
          className="mb-4"
          severity="warning"
          title={t("setup_required", "Complete Setup Required")}
          message={t(
            "qr_code_setup_required",
            "Please upload a QR code image and provide your account details to enable payments."
          )}
        />
      )}

      <div className="space-y-4">
        {/* Price and Currency Section */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="price" className="mb-2 block text-sm font-medium">
              {t("price")}
            </Label>
            <div className="relative rounded-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-gray-500 sm:text-sm">
                  {selectedCurrency.value === "INR" ? "₹" : "$"}
                </span>
              </div>
              <Input
                id="price"
                type="number"
                step="1"
                min="0"
                required
                className="pl-7"
                placeholder="0"
                disabled={disabled}
                defaultValue={price || 0}
                onChange={(e) => {
                  // Store the exact value the user enters
                  // Don't convert to cents/paise here - let the payment process handle that
                  const value = Number(e.target.value);
                  console.log(`Setting QRCodePay price to: ${value} ${currency}`);
                  setAppData("price", value);
                }}
              />
              <div className="mt-1 text-xs text-gray-500">
                Enter the exact amount you want to charge. For example, enter 1500 to charge ₹1500.
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="currency" className="mb-2 block text-sm font-medium">
              {t("currency")}
            </Label>
            <Select
              id="currency"
              options={currencyOptions}
              defaultValue={selectedCurrency}
              onChange={handleCurrencyChange}
              className="mb-0 block w-full rounded-md"
              isDisabled={disabled}
            />
          </div>
        </div>

        {/* Payment Option - On Booking Only */}
        <div className="hidden">
          <input 
            type="hidden" 
            name="paymentOption" 
            value="ON_BOOKING" 
            onChange={() => setAppData("paymentOption", "ON_BOOKING")}
          />
        </div>

        {/* Account Details */}
        <div className="space-y-4 pt-4 border-t border-subtle">
          <h3 className="text-emphasis text-sm font-medium">{t("payment_details", "Payment Details")}</h3>
          
          <div>
            <Label htmlFor="accountName" className="mb-2 block text-sm font-medium">
              {t("account_name", "Account Name")}
            </Label>
            <Input
              id="accountName"
              defaultValue={accountName}
              placeholder="John Doe / Business Name"
              required
              disabled={disabled}
              onChange={(e) => setAppData("accountName", e.target.value)}
            />
          </div>

          {/* UPI ID */}
          <div>
            <Label htmlFor="upiId" className="mb-2 block text-sm font-medium">
              {t("upi_id", "UPI ID") + " " + t("optional")}
            </Label>
            <Input
              id="upiId"
              defaultValue={upiId}
              placeholder="username@upi"
              disabled={disabled}
              onChange={(e) => setAppData("upiId", e.target.value)}
            />
            <p className="text-subtle mt-1 text-sm">{t("upi_id_description", "Enter your UPI ID for direct payments")}</p>
          </div>

          {/* QR Code Upload */}
          <div>
            <Label htmlFor="qrCodeUrl" className="mb-2 block text-sm font-medium">
              {t("qr_code_image", "QR Code Image")} *
            </Label>
            <div className="mt-1">
              <ImageUploader
                id="qr-code-image"
                target="QR Code"
                handleAvatarChange={(value: string) => {
                  setPreviewUrl(value);
                  setAppData("qrCodeUrl", value);
                }}
                imageSrc={qrCodeUrl}
                buttonMsg={t("upload_qr_code", "Upload QR Code")}
                uploadInstruction={t("drag_qr_code", "Drag and drop your QR code image here, or click to select")}
                disabled={disabled}
              />
            </div>
          </div>

          {/* Payment Instructions */}
          <div>
            <Label htmlFor="instructions" className="mb-2 block text-sm font-medium">
              {t("payment_instructions", "Payment Instructions")}
            </Label>
            <TextArea
              id="instructions"
              defaultValue={instructions}
              placeholder="Scan the QR code to pay via UPI/PayTM"
              disabled={disabled}
              onChange={(e) => setAppData("instructions", e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventTypeAppSettingsInterface;
