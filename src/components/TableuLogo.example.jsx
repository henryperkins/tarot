import React from 'react';
import { TableuLogo } from './TableuLogo';

/**
 * TableuLogo Usage Examples
 *
 * This file demonstrates all available logo variants and usage patterns.
 * Not meant for production - just a reference guide.
 */
export function TableuLogoExamples() {
  return (
    <div className="p-8 space-y-12 bg-gray-50">
      <div>
        <h2 className="text-2xl font-bold mb-6">Tableu Logo Variants</h2>
      </div>

      {/* Primary (Full Detail) */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">1. Primary (Full Detail)</h3>
        <p className="text-gray-600 mb-4">
          Complete logo with all elements: card frame, moon, star, octopus, tentacles, eye, wand, sparkles
        </p>
        <div className="flex items-center gap-8 flex-wrap">
          <TableuLogo variant="primary" size={120} />
          <TableuLogo variant="primary" size={160} />
          <TableuLogo variant="primary" size={200} />
        </div>
        <pre className="mt-4 bg-gray-100 p-3 rounded text-sm">
{`<TableuLogo variant="primary" size={160} />`}
        </pre>
      </section>

      {/* Icon (Simplified) */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">2. Icon (Simplified)</h3>
        <p className="text-gray-600 mb-4">
          Simplified version without eye, wand, and bottom sparkle. Better for small sizes.
        </p>
        <div className="flex items-center gap-8 flex-wrap">
          <TableuLogo variant="icon" size={80} />
          <TableuLogo variant="icon" size={120} />
          <TableuLogo variant="icon" size={160} />
        </div>
        <pre className="mt-4 bg-gray-100 p-3 rounded text-sm">
{`<TableuLogo variant="icon" size={80} />`}
        </pre>
      </section>

      {/* Full (with Wordmark) */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">3. Full (with Wordmark)</h3>
        <p className="text-gray-600 mb-4">
          Complete logo with "TABLEU" wordmark below. Best for headers and branding.
        </p>
        <div className="flex items-center gap-8 flex-wrap">
          <TableuLogo variant="full" size={150} />
          <TableuLogo variant="full" size={200} />
        </div>
        <pre className="mt-4 bg-gray-100 p-3 rounded text-sm">
{`<TableuLogo variant="full" size={200} />`}
        </pre>
      </section>

      {/* Favicon */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">4. Favicon (Octopus Only)</h3>
        <p className="text-gray-600 mb-4">
          Minimal octopus-only mark for favicons and tiny contexts.
        </p>
        <div className="flex items-center gap-8 flex-wrap">
          <TableuLogo variant="favicon" size={32} />
          <TableuLogo variant="favicon" size={48} />
          <TableuLogo variant="favicon" size={64} />
        </div>
        <pre className="mt-4 bg-gray-100 p-3 rounded text-sm">
{`<TableuLogo variant="favicon" size={32} />`}
        </pre>
      </section>

      {/* Monochrome */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">5. Monochrome</h3>
        <p className="text-gray-600 mb-4">
          Black version for print or high-contrast contexts.
        </p>
        <div className="flex items-center gap-8 flex-wrap">
          <TableuLogo variant="mono" size={120} />
          <TableuLogo variant="mono" size={160} />
        </div>
        <pre className="mt-4 bg-gray-100 p-3 rounded text-sm">
{`<TableuLogo variant="mono" size={160} />`}
        </pre>
      </section>

      {/* Dark Mode */}
      <section className="bg-gray-900 p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4 text-white">6. Dark Mode</h3>
        <p className="text-gray-300 mb-4">
          White version with dark background for dark mode interfaces.
        </p>
        <div className="flex items-center gap-8 flex-wrap">
          <TableuLogo variant="dark" size={120} />
          <TableuLogo variant="dark" size={160} />
        </div>
        <pre className="mt-4 bg-gray-800 text-gray-100 p-3 rounded text-sm">
{`<TableuLogo variant="dark" size={160} />`}
        </pre>
      </section>

      {/* Custom Colors */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">7. Custom Colors</h3>
        <p className="text-gray-600 mb-4">
          Override the default color with any CSS color value.
        </p>
        <div className="flex items-center gap-8 flex-wrap">
          <TableuLogo variant="primary" size={120} color="#8B5CF6" />
          <TableuLogo variant="primary" size={120} color="#EC4899" />
          <TableuLogo variant="primary" size={120} color="#10B981" />
        </div>
        <pre className="mt-4 bg-gray-100 p-3 rounded text-sm">
{`<TableuLogo variant="primary" size={120} color="#8B5CF6" />`}
        </pre>
      </section>

      {/* Usage Guidelines */}
      <section className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
        <h3 className="text-xl font-semibold mb-4">Usage Guidelines</h3>
        <ul className="space-y-2 text-gray-700">
          <li><strong>Headers:</strong> Use <code>variant="full"</code> at size 180-240</li>
          <li><strong>Navigation:</strong> Use <code>variant="icon"</code> at size 40-60</li>
          <li><strong>Favicon:</strong> Use <code>variant="favicon"</code> at size 32 or 48</li>
          <li><strong>Social Cards:</strong> Use <code>variant="primary"</code> at size 400-600</li>
          <li><strong>Dark Backgrounds:</strong> Use <code>variant="dark"</code></li>
          <li><strong>Print:</strong> Use <code>variant="mono"</code></li>
        </ul>
      </section>
    </div>
  );
}
