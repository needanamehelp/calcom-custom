"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { showToast } from "@calcom/ui/components/toast";
import { Button } from "@calcom/ui/components/button";
import { TextField, Label } from "@calcom/ui/components/form";
import { ImageUploader } from "@calcom/ui/components/image-uploader";
import { Select } from "@calcom/ui/components/form";
import { Icon } from "@calcom/ui/components/icon";

// Define the expected shape of the data returned by appById
interface AppData {
  credentials?: {
    key: { 
      accountName?: string;
      instructions?: string;
      qrCodeUrl?: string;
      defaultCurrency?: string;
      upiId?: string;
    };
    id: number;
  };
  slug: string;
  [key: string]: any; // Allow other properties
}

export default function QRCodePaymentSetup() {
  const { t } = useLocale();
  const router = useRouter();
  const utils = trpc.useUtils();
  
  // State to track form values
  const [accountName, setAccountName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [upiId, setUpiId] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("INR");
  
  // UI state
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch app data (including credentials)
  const { data: appData, isLoading } = trpc.viewer.apps.appById.useQuery({ 
    appId: "qrcodepay"
  }, {
    refetchOnWindowFocus: false,
  }) as { data: AppData | undefined; isLoading: boolean };

  // Save Keys Mutation
  const saveKeysMutation = trpc.viewer.apps.saveKeys.useMutation({
    onSuccess: () => {
      utils.viewer.apps.invalidate();
      showToast("QR Code Payment configured successfully!", "success");
      router.push("/apps/installed");
    },
    onError: (error) => {
      console.error("Error saving keys:", error);
      setError(error.message);
      showToast(error.message, "error");
      setIsUpdating(false);
    },
  });

  // Load existing credentials
  useEffect(() => {
    if (appData?.credentials?.key && !isLoading) {
      const key = appData.credentials.key;
      if (key.accountName) setAccountName(key.accountName);
      if (key.instructions) setInstructions(key.instructions);
      if (key.qrCodeUrl) setQrCodeUrl(key.qrCodeUrl);
      if (key.upiId) setUpiId(key.upiId);
      if (key.defaultCurrency) setDefaultCurrency(key.defaultCurrency);
    }
  }, [appData, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setError(null);
    
    // Validate required fields
    if (!accountName) {
      setError("Account name is required");
      setIsUpdating(false);
      return;
    }
    
    if (!qrCodeUrl) {
      setError("QR code image URL is required");
      setIsUpdating(false);
      return;
    }
    
    // Log for debugging
    console.log('Submitting QR Code Payment credentials:', {
      accountName,
      instructions,
      qrCodeUrl,
      upiId,
      defaultCurrency
    });

    // Submit credentials
    saveKeysMutation.mutate({
      type: "qrcodepay_payment",
      slug: "qrcodepay",
      dirName: "qrcodepay",
      keys: {
        accountName,
        instructions,
        qrCodeUrl,
        upiId,
        defaultCurrency,
      },
    });
  };

  if (isLoading) {
    return <div className="flex justify-center">Loading...</div>;
  }

  return (
    <div className="bg-default pb-10 pt-2">
      <div className="mb-8">
        <h1 className="font-cal text-emphasis mb-2 text-xl font-semibold">
          QR Code Payment Setup
        </h1>
        <p className="text-subtle text-sm">
          Configure your QR code payment settings for clients to pay directly.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center space-x-2 rounded-md border border-red-400 bg-red-50 p-3 text-sm text-red-700">
          <Icon name="triangle-alert" className="h-5 w-5 text-red-500" />
          <p>{error}</p>
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* QR Code Upload */}
        <div className="mb-6">
          <Label className="text-emphasis font-medium">
            Upload Payment QR Code
          </Label>
          <div className="mt-2">
            <ImageUploader
              id="qr-code-image"
              handleAvatarChange={(value: string) => setQrCodeUrl(value)}
              imageSrc={qrCodeUrl}
              target="QR Code"
              buttonMsg="Upload QR Code"
              uploadInstruction="Upload a square QR code image for payments"
            />
            {!qrCodeUrl && isUpdating && (
              <p className="text-sm text-red-500 mt-1">QR code image is reAquired</p>
            )}
          </div>
        </div>

        {/* Account Name */}
        <div className="mb-6">
          <TextField
            name="accountName"
            label="Account Name"
            placeholder="Enter account name"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            required
          />
        </div>

        {/* UPI ID */}
        <div className="mb-6">
          <TextField
            name="upiId"
            label="UPI ID"
            placeholder="yourname@bankname"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            hint="Enter your UPI ID (e.g., yourname@upi)"
          />
        </div>

        {/* Payment Instructions */}
        <div className="mb-6">
          <TextField
            name="instructions"
            label="Payment Instructions (optional)"
            placeholder="Scan the QR code and complete payment..."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

        {/* Default Currency */}
        <div className="mb-6">
          <Label htmlFor="currency" className="text-emphasis font-medium">
            Currency
          </Label>
          <Select
            id="currency"
            value={{ value: defaultCurrency, label: defaultCurrency === "INR" ? "₹ Indian Rupee (INR)" : "$ US Dollar (USD)" }}
            onChange={(option) => {
              if (option) setDefaultCurrency(option.value as string);
            }}
            className="mt-2"
            options={[
              { value: "INR", label: "₹ Indian Rupee (INR)" },
              { value: "USD", label: "$ US Dollar (USD)" }
            ]}
          />
        </div>

        <Button
          type="submit"
          loading={isUpdating}
          disabled={isUpdating}
          className="w-full"
          StartIcon="check"
        >
          {isUpdating ? "Updating..." : "Save Settings"}
        </Button>
      </form>
    </div>
  );
}
