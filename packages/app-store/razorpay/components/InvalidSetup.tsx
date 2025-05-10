"use client";

import { useRouter } from "next/navigation";
import z from "zod";

import { Alert } from "@calcom/ui/components/alert";
import { Button } from "@calcom/ui/components/button";

export function RazorpaySetup() {
  const router = useRouter();
  return (
    <Alert
      severity="warning"
      title="Additional step required"
      message="You need to set up your Razorpay credentials to start accepting payments."
      className="my-4"
      actions={
        <Button
          href="/apps/razorpay"
          color="secondary"
          className="mt-3"
          onClick={(e) => {
            e.preventDefault();
            router.push("/apps/razorpay");
          }}>
          Setup
        </Button>
      }
    />
  );
} 