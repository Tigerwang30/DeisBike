interface SpinnerProps {
  /** Extra classes appended to the spinner (e.g. spacing like "mb-3"). */
  className?: string;
}

/**
 * The app's standard loading spinner (brandeis-blue ring).
 * Render it inside whatever centering wrapper the caller needs.
 */
export default function Spinner({ className = '' }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full h-12 w-12 border-b-2 border-brandeis-blue${
        className ? ` ${className}` : ''
      }`}
    />
  );
}
