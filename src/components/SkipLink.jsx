export function SkipLink() {
  const handleSkip = (event) => {
    event.preventDefault();
    const target = document.getElementById('main-content');
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: 'instant', block: 'start' });
  };

  return (
    <div className="skip-links">
      <a
        href="#main-content"
        onClick={handleSkip}
        className="skip-link"
      >
        Skip to main content
      </a>
    </div>
  );
}
