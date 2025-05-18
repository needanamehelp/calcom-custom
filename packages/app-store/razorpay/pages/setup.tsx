import React, { useState, useEffect } from "react";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { PasswordField, TextField } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";

// Define the expected shape of the data returned by appById
interface AppData {
  credentials?: {
    key: { 
      key_id?: string;
      key_secret?: string;
    };
    id: number;
    credentialIds?: number[];
  };
  slug: string;
  [key: string]: any; // Allow other properties
}

const RazorpayApp = () => {
  const { t } = useLocale();
  const utils = trpc.useUtils();
  
  // State for payment amount example
  const [paymentAmount, setPaymentAmount] = useState(50000); // Example: 500 INR (in paise)

  // Fetch app data (including credentials for the payment button)
  const { data: appData, isLoading: isLoadingAppData } = trpc.viewer.apps.appById.useQuery({ 
    appId: "razorpay"
  }, {
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  }) as { data: AppData | undefined; isLoading: boolean };
  
  // Save Keys Mutation
  const saveKeysMutation = trpc.viewer.apps.saveKeys.useMutation({
    onSuccess: () => {
      utils.viewer.apps.appById.invalidate({ appId: "razorpay" });
      showToast(t("keys_saved_successfully"), "success");
    },
    onError: (error) => {
      showToast(error.message, "error");
    },
  });

  // Create Order Mutation
  const createOrderMutation = trpc.razorpay.createRazorpayOrder.useMutation({
    onError: (error) => {
      showToast(`Error creating order: ${error.message}`, "error");
    },
  });

  // Verify Payment Mutation
  const verifyPaymentMutation = trpc.razorpay.verifyRazorpayPayment.useMutation({
    onSuccess: (data) => {
      console.log("Payment Success Details:", data);
      showToast(`Payment successful! Order ID: ${data.orderId}`, "success");
    },
    onError: (error) => {
      console.error("Payment Verification Error:", error);
      showToast(`Payment verification failed: ${error.message}`, "error");
    },
  });

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Handle Razorpay payment
  const handlePayment = async () => {
    if (!appData?.credentials?.key?.key_id) {
      showToast("Razorpay Key ID is not configured.", "error");
      return;
    }

    try {
      const order = await createOrderMutation.mutateAsync({ amount: paymentAmount, currency: 'INR' });

      if (!order || !order.id) {
        showToast("Failed to get order details from backend.", "error");
        return;
      }

      const options = {
        key: appData?.credentials?.key?.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Your Company Name",
        description: "Test Transaction",
        order_id: order.id,
        handler: async (response: any) => {
          verifyPaymentMutation.mutate({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          });
        },
        prefill: {
            // name: props.user?.name || "", 
            // email: props.user?.email || "",
            // contact: ""
        },
        notes: {
            address: "Cal.com Corporate Office"
        },
        theme: {
            color: "#3167FA"
        }
      };
      
      const rzp = new (window as any).Razorpay(options);
      if (!rzp) {
        showToast("Razorpay SDK not loaded.", "error");
        return;
      }
      rzp.open();
    } catch (error: any) {
      console.error("Payment initiation error:", error);
    }
  };

  if (isLoadingAppData) {
    return <>Loading...</>;
  }
  
  // Extract credentials data for the form
  const appKeys = appData?.credentials?.key ?? {};
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-medium text-lg">{t("razorpay_setup")}</h2>
        <p className="text-sm text-gray-600 mt-1">
          {t("razorpay_setup_description")}
          <a 
            href="https://dashboard.razorpay.com/app/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            {t("razorpay_dashboard")}
          </a>
        </p>
      </div>
      <form
        className="space-y-4"
        name="razorpayKeys"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.target as HTMLFormElement;
          const key_id = (form.elements.namedItem('key_id') as HTMLInputElement).value;
          const key_secret = (form.elements.namedItem('key_secret') as HTMLInputElement).value;
          
          saveKeysMutation.mutate({
            type: "razorpay_payment",
            slug: "razorpay",
            dirName: "razorpay",
            keys: {
              key_id,
              key_secret,
            },
            ...(appData?.credentials?.id ? { credentialId: appData.credentials.id } : {}),
          });
        }}
      >
        <TextField 
          name="key_id" 
          label={t("razorpay_key_id")} 
          defaultValue={appKeys?.key_id ?? ""} 
          required
          placeholder="rzp_test_xxxxxxxxxxxxx"
        />
        <PasswordField 
          name="key_secret" 
          label={t("razorpay_key_secret")} 
          defaultValue={appKeys?.key_secret ?? ""} 
          required
          placeholder="xxxxxxxxxxxxxxxxxxxx"
        />
        <Button type="submit" loading={saveKeysMutation.isPending}>
          {t("save")}
        </Button>
      </form>
    </div>
  );
};

export default RazorpayApp;