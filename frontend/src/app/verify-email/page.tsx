import { VerifyEmailPage } from "@/components/auth/VerifyEmailPage";

export default async function VerifyEmailRoute({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ token?: string }>;
}>) {
  const { token = "" } = await searchParams;
  return <VerifyEmailPage token={token} />;
}
