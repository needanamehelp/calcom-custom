import { z } from "zod";
import { razorpayCredentialKeysSchema as schema } from "../config/link";

export { schema as razorpayCredentialKeysSchema };
export type RazorpayCredentialKeys = z.infer<typeof schema>; 