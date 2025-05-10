import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import prisma from "@calcom/prisma";
import { razorpayCredentialKeysSchema } from "../../lib/razorpayCredentialKeysSchema";
import type { IRazorpaySetupProps } from "./index";

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  const notFound = { notFound: true } as const;
  if (typeof ctx.params?.slug !== "string") return notFound;

  const session = await getServerSession({ req: ctx.req });
  if (!session?.user?.id) {
    return { redirect: { permanent: false, destination: "/auth/login" } };
  }

  const credentials = await prisma.credential.findFirst({
    where: {
      type: "razorpay_payment",
      userId: session.user.id,
    },
  });

  let props: IRazorpaySetupProps = {
    key_id: "",
    key_secret: "",
    webhook_secret: undefined,
  };

  if (credentials?.key) {
    const parse = razorpayCredentialKeysSchema.safeParse(credentials.key);
    if (parse.success) {
      props = parse.data;
    }
  }

  return { props };
}; 