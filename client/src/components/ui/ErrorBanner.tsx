import type { ReactNode } from 'react';

interface ErrorBannerProps {
  children: ReactNode;
  /** Extra classes appended to the banner (e.g. "mb-6" or "text-sm"). */
  className?: string;
}

/**
 * The app's standard red error/alert box.
 */
export default function ErrorBanner({ children, className = '' }: ErrorBannerProps) {
  return (
    <div
      className={`bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg${
        className ? ` ${className}` : ''
      }`}
    >
      {children}
    </div>
  );
}
