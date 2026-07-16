/**
 * Rally — the TFP assistant mascot. A lime pickleball that blinks
 * and does a happy little bounce now and then.
 */
export function RallyIcon({
  size = 40,
  animated = true,
}: {
  size?: number;
  animated?: boolean;
}) {
  const showHoles = size >= 32;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Rally"
      style={{ display: "block", overflow: "visible" }}
    >
      <g className={animated ? "rally-bob" : undefined}>
        <circle cx="50" cy="50" r="42" fill="#BEE515" />
        {showHoles && (
          <>
            <circle cx="24" cy="37" r="4.6" fill="#07243E" opacity=".26" />
            <circle cx="37" cy="20" r="4.6" fill="#07243E" opacity=".26" />
            <circle cx="63" cy="18" r="4.6" fill="#07243E" opacity=".26" />
            <circle cx="78" cy="35" r="4.6" fill="#07243E" opacity=".26" />
            <circle cx="74" cy="67" r="4.6" fill="#07243E" opacity=".26" />
            <circle cx="26" cy="67" r="4.6" fill="#07243E" opacity=".26" />
            <circle cx="51" cy="82" r="4.6" fill="#07243E" opacity=".26" />
          </>
        )}
        <g className={animated ? "rally-blink" : undefined}>
          <circle cx="39" cy="50" r="5.8" fill="#07243E" />
          <circle cx="61" cy="50" r="5.8" fill="#07243E" />
        </g>
        <path
          d="M41 63 Q50 70 59 63"
          stroke="#07243E"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
}
