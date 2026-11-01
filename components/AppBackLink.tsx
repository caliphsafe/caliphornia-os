import Link from "next/link";

type AppBackLinkProps = {
  href: string;
  label: string;
  ariaLabel?: string;
  className?: string;
};

export default function AppBackLink({
  href,
  label,
  ariaLabel,
  className = "",
}: AppBackLinkProps) {
  return (
    <Link
      href={href}
      className={[`cos-app-back-button`, className].filter(Boolean).join(" ")}
      aria-label={ariaLabel || `Back to ${label}`}
    >
      <span className="cos-app-back-chevron" aria-hidden="true">
        ‹
      </span>
      <span>{label}</span>
    </Link>
  );
}
