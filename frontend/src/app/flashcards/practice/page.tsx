import type { Metadata } from "next";
import { WritingPracticePage } from "@/components/flashcard";

export const metadata: Metadata = {
  title: "Vocabulary Writing Practice",
};

export default function Page() {
  return <WritingPracticePage />;
}
