import type { NextApiRequest, NextApiResponse } from "next";
import { readFile } from "fs/promises";
import path from "path";

/**
 * API endpoint to serve the icon.svg file for the QR code payment app
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const filePath = path.join(process.cwd(), "packages/app-store/qrcodepay/static/icon.svg");
  try {
    const iconFile = await readFile(filePath);
    res.setHeader("Content-Type", "image/svg+xml");
    return res.send(iconFile);
  } catch (error) {
    console.error(`Error reading icon file: ${error}`);
    return res.status(500).json({ message: "Error fetching icon" });
  }
}
