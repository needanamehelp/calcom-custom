import React, { useState, useEffect } from "react";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { PasswordField, TextField } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";

// Define the expected shape of the data returned by appById
// Adjust based on the actual structure if different
interface AppData {
  // Assuming 'keys' holds the credential information
  keys: { 
    key_id?: string;
    key_secret?: string;
  } | null;
  // Add other properties returned by appById if needed
  [key: string]: any; // Allow other properties
}

// Define the shape of the form values
interface FormValues {
  key_id: string;
  key_secret: string;
}

// Define props if needed, e.g., for user details
// interface RazorpayAppProps {
//   user: { name?: string | null; email?: string | null };
// }

const RazorpayApp = (/* props: RazorpayAppProps */) => {
  const { t } = useLocale();
  const utils = trpc.useUtils();
  
  // State for payment amount example
  const [paymentAmount, setPaymentAmount] = useState(50000); // Example: 500 INR (in paise)

  // Fetch app data (including keys for the payment button)
  const { data: appData, isLoading: isLoadingAppData } = trpc.viewer.apps.appById.useQuery({ 
    appId: "razorpay"
  });
  
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

  // Create Order Mutation - Use the correct path
  const createOrderMutation = trpc.razorpay.createRazorpayOrder.useMutation({
    // Let tRPC infer error type or use TRPCClientError
    onError: (error) => {
      showToast(`Error creating order: ${error.message}`, "error");
    },
  });

  // Verify Payment Mutation - Use the correct path
  const verifyPaymentMutation = trpc.razorpay.verifyRazorpayPayment.useMutation({
    // Let tRPC infer data type
    onSuccess: (data) => {
      console.log("Payment Success Details:", data);
      showToast(`Payment successful! Order ID: ${data.orderId}`, "success");
      // TODO: Implement further post-payment logic:
      // - Update internal order status in DB if applicable
      // - Invalidate relevant queries (e.g., order list)
      // - Navigate user or update UI further
    },
    // Let tRPC infer error type or use TRPCClientError
    onError: (error) => {
      console.error("Payment Verification Error:", error);
      showToast(`Payment verification failed: ${error.message}`, "error");
      // Handle payment failure
    },
  });

  // Effect to ensure Razorpay script is loaded (if not using _document.tsx)
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  if (isLoadingAppData) {
    return <>Loading...</>;
  }

  if (isLoadingAppData) {
    return <>Loading...</>;
  }
  
  // ❌ delete old appKeysRaw/appKeys block here
  
  // ✅ grab stored credentials (null if none)
  const appKeys = (appData as { credentials?: { key_id?: string; key_secret?: string } })?.credentials;
  
  // ✅ if no creds, ask the user to enter them
  if (!appKeys) {
    return (
      <div className="space-y-6">
        <h2>Enter your Razorpay keys</h2>
        <form
          className="space-y-4"
          name="razorpayKeys"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target as any;
            saveKeysMutation.mutate({
              type: "razorpay_payment",
              slug: "razorpay",
              dirName: "razorpay",
              keys: {
                key_id: form.key_id.value,
                key_secret: form.key_secret.value,
              },
            });
          }}
        >
          <TextField name="key_id" label="Key ID" defaultValue="" />
          <PasswordField name="key_secret" label="Key Secret" defaultValue="" />
          <Button type="submit" loading={saveKeysMutation.isPending}>
            {t("save")}
          </Button>
        </form>
      </div>
    );
  }
  

  const handlePayment = async () => {
    if (!appKeys.key_id) {
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
        key: appKeys.key_id, // Your Razorpay Key ID
        amount: order.amount, // Amount from the order creation response
        currency: order.currency,
        name: "Your Company Name", // ToDo: Replace with actual name
        description: "Test Transaction",
        order_id: order.id, // Order ID from the backend
        handler: async (response: any) => {
          // This function is called after payment is successful
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
            color: "#3167FA" // Example Cal.com blue
        }
      };
      
      // Check if Razorpay is loaded
      const rzp = new (window as any).Razorpay(options);
       if (!rzp) {
         showToast("Razorpay SDK not loaded.", "error");
         return;
       }
      rzp.open();

    } catch (error: any) {
      // Error already handled by mutation's onError, but potentially catch other issues
      console.error("Payment initiation error:", error);
    }
  };

  return (
    <div className="space-y-6"> 
      <div>
        <h2>Save Razorpay Keys</h2>
        <form
          className="space-y-4" // Add spacing
          name="razorpayKeys"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target as typeof e.target & { key_id: { value: string }; key_secret: { value: string } };
            saveKeysMutation.mutate({
              type: "razorpay_payment",
              slug: "razorpay",
              dirName: "razorpay",
              keys: {
                key_id: form.key_id.value,
                key_secret: form.key_secret.value,
              },
            });
          }}>
          <TextField
            name="key_id"
            label="Key ID"
            defaultValue={appKeys.key_id ?? ""}
          />
          <PasswordField
            name="key_secret"
            label="Key Secret"
            defaultValue={appKeys.key_secret ?? ""}
          />
          <Button type="submit" loading={saveKeysMutation.isPending}>
            {t("save")}
          </Button>
        </form>
      </div>

      <hr /> 

      <div>
          <h2>Make a Test Payment</h2>
          <p>Amount: {(paymentAmount / 100).toFixed(2)} INR</p> 
          {/* ToDo: Add an input to change paymentAmount */} 
          <Button 
              onClick={handlePayment} 
              loading={createOrderMutation.isPending || verifyPaymentMutation.isPending}
              disabled={!appKeys.key_id || isLoadingAppData} // Disable if keys aren't loaded or set
          >
              Pay Now with Razorpay
          </Button>
      </div>
    </div>
  );
};

export default RazorpayApp;