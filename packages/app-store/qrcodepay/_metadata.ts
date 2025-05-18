import type { App_RoutingForms_Form } from "@prisma/client";
import type { AppMeta } from "@calcom/types/App";

import { createPaymentLink } from "./lib/createPaymentLink";
import { isSetupComplete } from "./lib/utils";

export const metadata = {
  name: "QR Code Payment",
  description: "Accept payments with QR codes for UPI, PayTM, and other local payment methods",
  installed: true,
  category: "payment",
  categories: ["payment"],
  logo: "/api/app-store/qrcodepay/icon.svg",
  publisher: "Cal.com",
  slug: "qrcodepay",
  title: "QR Code Payment",
  type: "qrcodepay_payment",
  url: "https://cal.com/",
  variant: "payment",
  email: "help@cal.com",
  dirName: "qrcodepay",
  appData: {
    location: {
      linkType: "static",
      type: "integrations:qrcodepay_payment",
      label: "QR Code Payment",
      urlRegExp: ".*",
      organizerInputType: "text",
    },
  },
  isTemplate: false,
} as AppMeta;
