// Original, trademark-free World-Cup-style mark: a stylized trophy cradled by
// two arcs, with "26" set in the base. Uses currentColor so it inherits the
// surrounding text color (white on the teal nav, brand/coral on light surfaces).

export function WorldCupMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label="World Cup 2026"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Cup bowl */}
      <path
        d="M14 6h20v9a10 10 0 0 1-20 0V6Z"
        fill="currentColor"
      />
      {/* Side handles / arcs */}
      <path
        d="M14 8H9a4 4 0 0 0 0 8h2.2M34 8h5a4 4 0 0 1 0 8h-2.2"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Stem */}
      <path d="M22.4 24.5h3.2V31h-3.2z" fill="currentColor" />
      {/* Base plinth with the year cut out */}
      <path
        d="M13 31h22v3.2H13zM15 35.4h18V44H15z"
        fill="currentColor"
      />
      <text
        x="24"
        y="42.3"
        textAnchor="middle"
        fontFamily="var(--font-oswald), sans-serif"
        fontWeight="700"
        fontStyle="italic"
        fontSize="7.2"
        fill="var(--brand, #103D34)"
      >
        26
      </text>
    </svg>
  )
}
