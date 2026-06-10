import Link from "next/link";

interface AuthCardProps {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footerText: string;
  footerLink: string;
  footerLabel: string;
}

export function AuthCard({
  eyebrow,
  title,
  description,
  children,
  footerText,
  footerLink,
  footerLabel,
}: Readonly<AuthCardProps>) {
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/">
        <span className="brand-mark">EQ</span>
        <span>English Quest</span>
      </Link>
      <section className="auth-card">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
        <p className="auth-footer">
          {footerText} <Link href={footerLink}>{footerLabel}</Link>
        </p>
      </section>
    </main>
  );
}
