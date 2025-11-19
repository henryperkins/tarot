import React from 'react';
import { Moon, Sun } from 'lucide-react';

export function Header() {
  return (
    <div className="text-center mb-12 animate-fade-in">
      <div className="flex flex-col items-center justify-center gap-3 mb-4">
        <img src="/images/logo.png" alt="Tableau Logo" className="w-24 h-24 object-contain" />
        <h1 className="text-5xl font-serif text-amber-200">Tableau</h1>
      </div>
      <p className="text-amber-100/80 text-lg">Seek guidance from the ancient wisdom of the cards</p>
    </div>
  );
}
