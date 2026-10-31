import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/theme';

interface Props {
  className?: string;
}

export const ThemeToggle: React.FC<Props> = ({ className = '' }) => {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center p-2 rounded-xl transition-all duration-180 ease-out cursor-pointer group focus-visible:outline-2 focus-visible:outline-emerald-500 focus-visible:outline-offset-2 ${
        isDark
          ? 'bg-[#17191D] hover:bg-[#22252B] text-[#9298A3] hover:text-[#ECEEF2] border border-[#292D33]'
          : 'bg-[#FFFFFF] hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#171923] border border-[#E2E8F0] shadow-xs'
      } ${className}`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {/* Sun Icon for Light Mode */}
        <Sun
          className={`w-4 h-4 text-amber-500 transition-all duration-200 transform ${
            isDark ? 'scale-0 rotate-90 opacity-0 absolute' : 'scale-100 rotate-0 opacity-100'
          }`}
        />
        {/* Moon Icon for Dark Mode */}
        <Moon
          className={`w-4 h-4 text-emerald-400 transition-all duration-200 transform ${
            isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-90 opacity-0 absolute'
          }`}
        />
      </div>
      <span className="sr-only">Toggle theme ({theme})</span>
    </button>
  );
};
