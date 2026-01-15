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
            'radial-gradient(circle at 12% 18%, rgba(251,191,36,0.08), transparent 32%), radial-gradient(circle at 84% 22%, rgba(56,189,248,0.07), transparent 30%), radial-gradient(circle at 58% 76%, rgba(167,139,250,0.08), transparent 32%)'
        }}
      />
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-amber-500/12 blur-[110px]" aria-hidden="true" />
      <div className="pointer-events-none absolute right-[-120px] top-1/3 h-72 w-72 rounded-full bg-cyan-400/10 blur-[110px]" aria-hidden="true" />
    </>
  );
}

export default AmberStarfield;
