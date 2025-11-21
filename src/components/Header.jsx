import React from 'react';
import { Moon, Sun } from '@phosphor-icons/react';

export function Header() {
  return (
    <div className="text-center mb-12 animate-fade-in">
      <div className="flex flex-col items-center justify-center gap-3 mb-4">
        <img src="/images/logo.png" alt="Tableu Logo" className="w-32 h-32 sm:w-40 sm:h-40 object-contain" />
        <h1 className="sr-only">Tableu</h1>
      </div>
      <p className="text-muted text-lg">A picturesque grouping, analyzing many cards at once to reveal an artistic composition.</p>
    </div>
  );
}
