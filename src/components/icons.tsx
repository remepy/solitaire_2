// Ionicons 5 / Feather glyphs used in the approved RoomyHeader design.
type IconProps = { size: number; color: string };

const MUSIC_NOTES =
  "M421.84 37.37a25.86 25.86 0 00-22.6-4.46L199.92 86.49A32.3 32.3 0 00176 118v226c0 6.74-4.36 12.56-11.11 14.83l-.12.05-52 18C92.88 383.53 80 402 80 423.91a55.54 55.54 0 0023.23 45.63A54.78 54.78 0 00135.34 480a55.82 55.82 0 0017.75-2.93l.38-.13 21.84-7.94A47.84 47.84 0 00208 423.91v-212c0-7.29 4.77-13.21 12.16-15.07l.21-.06L395 150.14a4 4 0 015 3.86v141.93c0 6.75-4.25 12.38-11.11 14.68l-.25.09-50.89 18.11A49.09 49.09 0 00304 375.92a55.67 55.67 0 0023.23 45.8 54.63 54.63 0 0049.88 7.35l.36-.12 21.84-7.95A47.83 47.83 0 00432 375.92V58a25.74 25.74 0 00-10.16-20.63z";

const BULB_FILLED =
  "M288 464h-64a16 16 0 000 32h64a16 16 0 000-32zM304 416h-96a16 16 0 000 32h96a16 16 0 000-32zM369.42 62.69C339.35 32.58 299.07 16 256 16A159.62 159.62 0 0096 176c0 46.62 17.87 90.23 49 119.64l4.36 4.09C167.37 316.57 192 339.64 192 360v24a16 16 0 0016 16h24a8 8 0 008-8V274.82a8 8 0 00-5.13-7.47A130.73 130.73 0 01208.71 253a16 16 0 1118.58-26c7.4 5.24 21.65 13 28.71 13s21.31-7.78 28.73-13a16 16 0 0118.56 26 130.73 130.73 0 01-26.16 14.32 8 8 0 00-5.13 7.47V392a8 8 0 008 8h24a16 16 0 0016-16v-24c0-19.88 24.36-42.93 42.15-59.77l4.91-4.66C399.08 265 416 223.61 416 176a159.16 159.16 0 00-46.58-113.31z";

/** Musical notes; slashed when the music is off. */
export function MusicIcon({ on, size, color }: IconProps & { on: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <path d={MUSIC_NOTES} fill={color} />
      {!on && <path d="M92 92l328 328" fill="none" stroke={color} strokeLinecap="round" strokeWidth={36} />}
    </svg>
  );
}

/** Outline question mark with a filled dot. */
export function HelpIcon({ size, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <path d="M256 80a176 176 0 10176 176A176 176 0 00256 80z" fill="none" stroke={color} strokeWidth={32} />
      <path
        d="M200 202.29s.84-17.5 19.57-32.57C230.68 160.77 244 158.18 256 158c10.93-.14 20.69 1.67 26.53 4.45 10 4.76 29.47 16.38 29.47 41.09 0 26-17 37.81-36.37 50.8S251 281.43 251 296"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={28}
      />
      <circle cx={250} cy={348} r={20} fill={color} />
    </svg>
  );
}

/** Light bulb: outline normally, filled while highlighted. */
export function BulbIcon({ filled, size, color }: IconProps & { filled: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      {filled ? (
        <path d={BULB_FILLED} fill={color} />
      ) : (
        <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={32}>
          <path d="M304 384v-24c0-29 31.54-56.43 52-76 28.84-27.57 44-64.61 44-108 0-80-63.73-144-144-144a143.6 143.6 0 00-144 144c0 41.84 15.81 81.39 44 108 20.35 19.21 52 46.7 52 76v24M224 480h64M208 432h96M256 384V256" />
          <path d="M294 240s-21.51 16-38 16-38-16-38-16" />
        </g>
      )}
    </svg>
  );
}

/** Feather "x". */
export function CloseIcon({ size, color }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
