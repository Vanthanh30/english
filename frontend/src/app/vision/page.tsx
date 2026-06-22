import type { Metadata } from "next";
import VisionWorkspace from "@/components/vision/VisionWorkspace";

export const metadata: Metadata = {
  title: "AI Image Recognition",
  description: "Learn English vocabulary from real-world images using Vision AI",
};

export default function Page() {
  return <VisionWorkspace />;
}
