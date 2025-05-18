"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Toaster } from "sonner";
import { z } from "zod";

import AppNotInstalledMessage from "@calcom/app-store/_components/AppNotInstalledMessage";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { showToast } from "@calcom/ui/components/toast";

import KeyField from "../../components/KeyInput";
import KeyInputWithValidation from "../../components/KeyInputWithValidation";
import { razorpayAppKeysSchema as credentialSchema } from "../../zod";

export type IRazorpaySetupProps = z.infer<typeof credentialSchema>;

export default function RazorpaySetup(props: IRazorpaySetupProps) {
  const session = useSession();
  const router = useRouter();
  const { key_id, key_secret, webhook_secret } = props;
  const { t } = useLocale();

  // Check installation
  const integrations = trpc.viewer.apps.integrations.useQuery({ variant: "payment", appId: "razorpay" });
  const [integration] = integrations.data?.items || [];
  const [credentialId] = integration?.userCredentialIds || [];
  const isInstalled = integrations.isSuccess && credentialId > 0;

  if (session.status === "loading") return null;
  if (!isInstalled) {
    return <AppNotInstalledMessage appName="Razorpay" />;
  }

  const settingsSchema = credentialSchema;
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { key_id, key_secret, webhook_secret },
  });

  // Reset form when props change
  useEffect(() => {
    reset({ key_id, key_secret, webhook_secret });
  }, [key_id, key_secret, webhook_secret, reset]);

  // Track dirty state
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const sub = watch((val) => {
      const isDirty =
        val.key_id !== key_id ||
        val.key_secret !== key_secret ||
        val.webhook_secret !== webhook_secret;
      setDirty(isDirty);
    });
    return () => sub.unsubscribe();
  }, [watch, key_id, key_secret, webhook_secret]);

  // Use viewer.apps.saveKeys instead of non-existent viewer.razorpay.saveKeys
  const saveMutation = trpc.viewer.apps.saveKeys.useMutation({
    onSuccess: () => {
      showToast(t("razorpay_keys_saved", "Razorpay keys have been saved"), "success");
    },
    onError: (error) => {
      showToast(error.message, "error");
    },
  });
  const deleteMutation = trpc.viewer.credentials.delete.useMutation({
    onSuccess: () => {
      router.push("/apps/razorpay");
    },
    onError: (err) => {
      showToast(err.message, "error");
    },
  });

  const onSubmit = handleSubmit((data) => {
    // Format data for saveKeys mutation with required fields
    saveMutation.mutate({
      type: "razorpay_payment",
      slug: "razorpay",
      dirName: "razorpay",
      keys: credentialSchema.parse(data),
      ...(credentialId ? { credentialId } : {}),
    });
  });

  const onRemove = () => deleteMutation.mutate({ id: credentialId });

  return (
    <>
      <Toaster />
      <form onSubmit={onSubmit} className="space-y-4">
        <KeyInputWithValidation label={t("key_id")} defaultValue={key_id || ""} required {...register("key_id")} />
        <KeyInputWithValidation label={t("key_secret")} defaultValue={key_secret || ""} required {...register("key_secret")} />
        <KeyField label={t("webhook_secret")} {...register("webhook_secret")} defaultValue={webhook_secret || ""} />
        <div className="flex space-x-2">
          <Button type="submit" disabled={!dirty || saveMutation.isPending} loading={saveMutation.isPending}>
            {t("save")}
          </Button>
          <Button color="secondary" onClick={onRemove} disabled={deleteMutation.isPending} loading={deleteMutation.isPending}>
            {t("remove")}
          </Button>
        </div>
      </form>
    </>
  );
} 