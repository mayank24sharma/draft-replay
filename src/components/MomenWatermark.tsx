import React from 'react';

interface MomenWatermarkProps {
  variant?: 'fixed' | 'inline';
  className?: string;
}

export const MomenWatermark: React.FC<MomenWatermarkProps> = ({
  variant = 'fixed',
  className = '',
}) => {
  if (variant === 'fixed') {
    return (
      <div className={`fixed bottom-3 right-4 z-40 select-none transition-transform duration-200 hover:scale-[1.03] ${className}`}>
        <a
          href="https://momen.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center px-3 py-1.5 rounded-xl border transition-colors duration-180 bg-[#FFFFFF] dark:bg-[#17191D] border-[#E2E8F0] dark:border-[#292D33] shadow-xs hover:shadow-md dark:shadow-black/40 group cursor-pointer"
          title="Made with Momen"
          aria-label="Made with Momen"
        >
          {/* Light Theme: Dark text on light pill */}
          <img
            src="/assets/momen_trans_dark.png"
            alt="Made with Momen"
            className="h-5 w-auto block dark:hidden transition-opacity"
            loading="eager"
          />
          {/* Dark Theme: White text on dark pill */}
          <img
            src="/assets/momen_trans_white.png"
            alt="Made with Momen"
            className="h-5 w-auto hidden dark:block transition-opacity"
            loading="eager"
          />
        </a>
      </div>
    );
  }

  return (
    <a
      href="https://momen.app"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center px-2.5 py-1 rounded-lg border transition-colors duration-180 bg-[#FFFFFF] dark:bg-[#17191D] border-[#E2E8F0] dark:border-[#292D33] shadow-xs hover:shadow-sm group cursor-pointer ${className}`}
      title="Made with Momen"
      aria-label="Made with Momen"
    >
      <img
        src="/assets/momen_trans_dark.png"
        alt="Made with Momen"
        className="h-4 w-auto block dark:hidden transition-opacity"
        loading="eager"
      />
      <img
        src="/assets/momen_trans_white.png"
        alt="Made with Momen"
        className="h-4 w-auto hidden dark:block transition-opacity"
        loading="eager"
      />
    </a>
  );
};
