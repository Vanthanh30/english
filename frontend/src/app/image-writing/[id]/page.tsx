import ImageWritingWorkspace from "@/components/image-writing/ImageWritingWorkspace";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  return <ImageWritingWorkspace initialSessionId={resolvedParams.id} />;
}
