export function Loading({ label = "Loading..." }: Readonly<{ label?: string }>) {
  return <p role="status">{label}</p>;
}
