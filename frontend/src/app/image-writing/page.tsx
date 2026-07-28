import type { Metadata } from "next";
import ImageWritingWorkspace from "@/components/image-writing/ImageWritingWorkspace";

export const metadata: Metadata = {
  title: "AI Image Writing Practice",
  description: "Improve your English writing skills by describing images and receiving detailed AI evaluations",
};

export default function Page() {
  return <ImageWritingWorkspace />;
}
