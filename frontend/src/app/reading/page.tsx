import type { Metadata } from "next";
import ReadingLibrary from "@/components/reading/ReadingLibrary";

export const metadata: Metadata = {
  title: "Reading Library",
};

export default function Page() {
  return <ReadingLibrary />;
}
