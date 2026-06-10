import type { Metadata } from "next";
import { NotesPage } from "@/components/note";

export const metadata: Metadata = {
  title: "Study Notes",
};

export default function Page() {
  return <NotesPage />;
}
