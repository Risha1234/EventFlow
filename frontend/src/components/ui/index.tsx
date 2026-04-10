import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/10 border border-violet-500/20',
      secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700/50',
      outline: 'bg-transparent border border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white',
      ghost: 'bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-5 py-2.5 text-sm font-medium',
      lg: 'px-8 py-4 text-lg font-semibold',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl transition-all duration-300 ease-out active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-2xl overflow-hidden', className)} {...props}>
      {children}
    </div>
  )
);

export const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800/50 text-zinc-400 border border-zinc-700/50', className)}>
    {children}
  </span>
);

export { default as ShaderBackground } from './shader-background';
