import type { Metadata } from "next";
import { FlashcardPage } from "@/components/flashcard";

export const metadata: Metadata = {
  title: "Flashcards",
};

export default function Page() {
  return <FlashcardPage />;
}
