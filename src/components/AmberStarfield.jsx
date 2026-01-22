/**
 * AmberStarfield - Decorative background overlay with gradient orbs
 */

export function AmberStarfield() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(circle at 12% 18%, var(--glow-gold), transparent 32%), radial-gradient(circle at 84% 22%, var(--glow-blue), transparent 30%), radial-gradient(circle at 58% 76%, var(--glow-pink), transparent 32%)'
        }}
      />
      <div
        className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full blur-[110px]"
        aria-hidden="true"
        style={{ backgroundColor: 'var(--glow-gold)' }}
      />
      <div
        className="pointer-events-none absolute right-[-120px] top-1/3 h-72 w-72 rounded-full blur-[110px]"
        aria-hidden="true"
        style={{ backgroundColor: 'var(--glow-blue)' }}
      />
    </>
  );
}

export default AmberStarfield;
