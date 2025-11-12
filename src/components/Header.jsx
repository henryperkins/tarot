import React from 'react';
import { Moon, Sun } from 'lucide-react';

export function Header() {
  return (
    <div className="text-center mb-12">
      <div className="flex items-center justify-center gap-3 mb-4">
        <Moon className="w-8 h-8 text-amber-300" />
        <h1 className="text-5xl font-serif text-amber-200">Mystic Tarot</h1>
        <Sun className="w-8 h-8 text-amber-300" />
      </div>
      <p className="text-amber-100/80 text-lg">Seek guidance from the ancient wisdom of the cards</p>
    </div>
  );
}