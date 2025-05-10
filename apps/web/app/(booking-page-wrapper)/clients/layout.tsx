import React from "react";
import Shell from "@calcom/features/shell/Shell";

export default function ClientsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      {children}
    </Shell>
  );
}
