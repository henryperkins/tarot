import React from 'react';
import { TableuLogo } from './TableuLogo';

export function Header() {
  return (
    <div className="text-center mb-12 animate-fade-in">
      <div className="flex flex-col items-center justify-center gap-3 mb-4">
        <TableuLogo
          variant="full"
          size={120}
          ariaLabel="Tableu - Tarot Reading Application"
        />
        <h1 className="sr-only">Tableu</h1>
      </div>
      <p className="text-muted text-lg">A picturesque grouping, analyzing many cards at once to reveal an artistic composition.</p>
    </div>
  );
}
