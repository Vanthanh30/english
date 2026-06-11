import Link from "next/link";

export function Header() {
  return (
    <header className="site-header">
      <div className="site-nav">
        <Link className="brand" href="/">
          <span className="brand-mark">EQ</span>
          <span>English Quest</span>
        </Link>
      </div>
    </header>
  );
}
