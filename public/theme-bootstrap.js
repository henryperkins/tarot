// Keep the stored palette in place before styles and the React entry load.
(function () {
  let theme = 'dark';
  try {
    if (localStorage.getItem('tarot-theme') === 'light') theme = 'light';
  } catch {
    // Storage may be unavailable; the default palette still works.
  }
  document.documentElement.classList.remove('light-mode');
  document.documentElement.classList.toggle('light', theme === 'light');
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
    meta.setAttribute('content', theme === 'light' ? '#FAFAFA' : '#0F0E13');
  });
}());
