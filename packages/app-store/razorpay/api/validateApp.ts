import type { NextApiRequest, NextApiResponse } from "next";
import { razorpayCredentialKeysSchema } from "../config/link";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { key_id, key_secret } = req.body;
  try {
    // Validate schema
    razorpayCredentialKeysSchema.pick({ key_id: true, key_secret: true }).parse({ key_id, key_secret });

    // Call Razorpay API to validate credentials
    const response = await fetch("https://api.razorpay.com/v1/accounts/me", {
      method: "GET",
      headers: {
        Authorization: "Basic " + Buffer.from(`${key_id}:${key_secret}`).toString("base64"),
      },
    });

    if (!response.ok) {
      return res.status(400).json({ message: "Invalid Razorpay credentials" });
    }

    const data = await response.json();
    return res.status(200).json({ valid: true, account: data });
  } catch (error: any) {
    return res.status(400).json({ message: error.message || "Validation failed" });
  }
}
