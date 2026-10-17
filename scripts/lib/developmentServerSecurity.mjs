// Shared by ordinary Vite development, controlled browser tests and the local beta.
// An explicit fs.deny replaces Vite's defaults, so retain secret-file protections.
export const PRIVATE_FILE_DENIES = Object.freeze([
  '**/.git/**', '**/.wrangler/**', '**/.superpowers/**', '**/.config/**',
  '**/.env', '**/.env.*', '**/.dev.vars', '**/.dev.vars.*',
  '**/playwright/.auth/**', '**/*.{crt,pem}'
]);

export function secureDevelopmentServer(server = {}) {
  return {
    ...server,
    host: '127.0.0.1',
    allowedHosts: ['localhost'],
    fs: { ...server.fs, strict: true,
      deny: [...new Set([...(server.fs?.deny || []), ...PRIVATE_FILE_DENIES])] }
  };
}
