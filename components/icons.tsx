/** Minimal line icons matching the brand — 1.5px strokes, currentColor. */

function Base({
  children,
  size = 18,
}: {
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconBell({ size }: { size?: number }) {
  return (
    <Base size={size}>
      <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9" />
      <path d="M10.2 19a2 2 0 0 0 3.6 0" />
    </Base>
  );
}

export function IconMegaphone({ size }: { size?: number }) {
  return (
    <Base size={size}>
      <path d="M4 10v4" />
      <path d="M7.5 9 18 5v14L7.5 15H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2.5" />
      <path d="M9 15.5V18a1.5 1.5 0 0 0 3 0v-2" />
    </Base>
  );
}

export function IconDoc({ size }: { size?: number }) {
  return (
    <Base size={size}>
      <path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z" />
      <path d="M14 3v4.5h4.5" />
      <path d="M9 12.5h6M9 16h6" />
    </Base>
  );
}

export function IconCheck({ size }: { size?: number }) {
  return (
    <Base size={size}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.3 2.4 2.4 4.6-5" />
    </Base>
  );
}

export function IconChat({ size }: { size?: number }) {
  return (
    <Base size={size}>
      <path d="M20 12a8 8 0 1 0-3.1 6.3L20 19.5l-.9-2.9A8 8 0 0 0 20 12" />
      <path d="M8.5 11h7M8.5 14h4.5" />
    </Base>
  );
}
