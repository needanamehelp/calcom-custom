import type { AppMeta } from "@calcom/types/App";

import _package from "./package.json";

export const metadata = {
  name: "QR Code Payment",
  description: _package.description,
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
} as AppMeta;

export default metadata;
