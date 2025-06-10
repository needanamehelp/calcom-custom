import type { AppMeta } from "@calcom/types/App";

import { createPaymentLink } from "./lib/createPaymentLink";
import { isSetupComplete } from "./lib/utils";

export const metadata = {
  name: "QR Code Payment",
  description: "Accept payments with QR codes for UPI, PayTM, and other local payment methods",
  installed: true,
  category: "payment",
  categories: ["payment"],
  logo: "/api/app-store/qrcodepay/static/icon.svg", // Fixed logo path
  publisher: "Cal.com",
  slug: "qrcodepay",
  title: "QR Code Payment",
  type: "qrcodepay_payment",
  url: "https://cal.com/",
  variant: "payment",
  email: "help@cal.com",
  dirName: "qrcodepay",
  // CRITICAL FIX: Force app to be recognized as set up
  isSetupAlready: true,
  appData: {
    location: {
      linkType: "static",
      type: "integrations:qrcodepay_payment",
      label: "QR Code Payment",
      urlRegExp: ".*",
      organizerInputType: "text",
    },
  },
  // Add credential requirement handling
  credentials: {
    accountName: {
      label: "Account Name",
      type: "text",
      placeholder: "Your Name or Business Name",
      required: true,
    },
    qrCodeUrl: {
      label: "QR Code URL",
      type: "text", 
      placeholder: "https://example.com/your-qr-code.png",
      required: false,
    },
    instructions: {
      label: "Payment Instructions",
      type: "text",
      placeholder: "Please make the payment and click Confirm",
      required: false,
    },
    defaultCurrency: {
      label: "Default Currency",
      type: "text",
      defaultValue: "INR",
      required: false,
    },
  },
  isTemplate: false,
} as AppMeta;
