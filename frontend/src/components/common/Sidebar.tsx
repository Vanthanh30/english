import Link from "next/link";

export function Sidebar() {
  return (
    <aside>
      <nav aria-label="Dashboard navigation">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/flashcards">Flashcards</Link>
        <Link href="/flashcards/practice">Writing Practice</Link>
        <Link href="/game">Vocabulary Game</Link>
      </nav>
    </aside>
  );
}
