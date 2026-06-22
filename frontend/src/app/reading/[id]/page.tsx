import ReadingWorkspace from "@/components/reading/ReadingWorkspace";

export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  return <ReadingWorkspace id={id} />;
}
