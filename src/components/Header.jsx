import React from 'react';
import { Moon, Sun } from 'lucide-react';

export function Header() {
  return (
    <div className="text-center mb-12 animate-fade-in">
      <div className="flex flex-col items-center justify-center gap-3 mb-4">
        <img src="/images/logo.png" alt="Tableu Logo" className="w-24 h-24 object-contain" />
        <h1 className="text-5xl font-serif text-amber-200">Tableu</h1>
      </div>
      <p className="text-amber-100/80 text-lg">A picturesque grouping, analyzing many cards at once to reveal an artistic composition.</p>
    </div>
  );
}
