"use client";

/**
 * GreeterButton.tsx
 * It creates a button that can be added anywhere. The button is visible only if the app is installed.
 */
import useApp from "@calcom/lib/hooks/useApp";
import { showToast } from "@calcom/ui/components/toast";
import { Button } from "@calcom/ui/components/button";

import useMeQuery from "@calcom/trpc/react/hooks/useMeQuery";

export default function GreeterButton() {
  const { data: user } = useMeQuery();
  const { data: greeterApp } = useApp("greeter");
  // Make sure that greeterApp is installed. We shouldn't show the button when app is not installed
  if (!user || !greeterApp) {
    return null;
  }
  return (
    <Button
      onClick={() => {
        showToast("Hello, " + user.name, "success");
      }}
    >
      Greet Me!
    </Button>
  );
} 