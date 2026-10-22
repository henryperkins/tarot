import { useCallback, useEffect, useRef, useState } from 'react';
import { List, SpeakerHigh, CaretDown } from '@phosphor-icons/react';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

export function ReadingContents({ sections, readingRef, controlsModel, onNarrate, onStopNarration, compactTabs = false, showReadingActions = false }) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const reducedMotion = useReducedMotion();
  const toggleRef = useRef(null);
  const toolbarRef = useRef(null);
  const sectionIds = sections.map(section => section.id).join(',');
  const current = Math.max(0, sections.findIndex(section => section.id === activeId));

  // Pin the toolbar only while it and the pinned header together leave most of
  // the visible height for the reading (small phones, landscape, enlarged text
  // and an open keyboard all fail this). The pinned height is also published on
  // the document root for the reading page's root scroll-padding.
  const pinToolbar = useCallback(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar || toolbar.closest('[data-app-chrome]')) return;
    const visible = window.visualViewport?.height || innerHeight;
    const header = parseFloat(getComputedStyle(readingRef.current || toolbar).getPropertyValue('--sticky-header-height')) || 0;
    const sticky = toolbar.offsetHeight + header <= visible * .3;
    const height = `${sticky ? toolbar.offsetHeight : 0}px`;
    toolbar.style.position = sticky ? 'sticky' : 'static';
    readingRef.current?.style.setProperty('--reading-wayfinding-height', height);
    document.documentElement.style.setProperty('--pinned-wayfinding-height', height);
  }, [readingRef]);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar || toolbar.closest('[data-app-chrome]')) return undefined;
    // Measure after the header has re-measured for the same resize.
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(pinToolbar);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(toolbar);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    pinToolbar();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      document.documentElement.style.removeProperty('--pinned-wayfinding-height');
    };
  }, [pinToolbar]);

  useEffect(() => {
    const root = readingRef.current;
    if (!root) return undefined;
    let frame;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const headings = [...root.querySelectorAll('[data-reading-section]')];
        const inset = parseFloat(getComputedStyle(root).getPropertyValue('--sticky-header-height')) || 64;
        const toolbarHeight = parseFloat(getComputedStyle(root).getPropertyValue('--reading-wayfinding-height')) || 0;
        const passed = headings.filter(heading => heading.getBoundingClientRect().top <= inset + toolbarHeight + 32);
        const target = passed.at(-1) || headings[0];
        if (target) setActiveId(target.id);
      });
    };
    const observer = new MutationObserver(measure);
    observer.observe(root, { childList: true, subtree: true });
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [readingRef, sectionIds]);

  const visit = useCallback((event, id) => {
    const target = document.getElementById(id);
    if (!target) { event.preventDefault(); return; }
    event.preventDefault();
    setOpen(false);
    setActiveId(id);
    requestAnimationFrame(() => {
      pinToolbar();
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'instant' : 'smooth' });
    });
  }, [reducedMotion, pinToolbar]);

  return <div className="reading-wayfinding" ref={toolbarRef} data-app-secondary="1" data-chrome-height-var="--reading-wayfinding-height">
    <div className="reading-toolbar">
      {controlsModel?.show && <div className="reading-toolbar__audio">
        <button type="button" onClick={onNarrate} disabled={!controlsModel.canNarrate}>
          <SpeakerHigh aria-hidden="true" size={22} />
          <span>{controlsModel.narrationLabel}</span>
        </button>
        {controlsModel.showNarrationStop && <button type="button" onClick={onStopNarration}>Stop</button>}
      </div>}
      {sections.length > 0 && <button type="button" ref={toggleRef} onClick={() => setOpen(previous => !previous)}
        aria-expanded={open} aria-controls="reading-contents" className="reading-toolbar__contents">
        <span>Contents{sections.length > 3 ? ` · ${current + 1} of ${sections.length}` : ''}</span>
        <List aria-hidden="true" size={21} />
      </button>}
    </div>
    {open && <nav id="reading-contents" className="reading-contents" aria-label="Reading contents"
      onKeyDown={event => {
        if (event.key === 'Escape') { setOpen(false); toggleRef.current?.focus(); }
      }}>
      <ol>{sections.map((section, index) => <li key={section.id}>
        <a href={`#${section.id}`} onClick={event => visit(event, section.id)} aria-current={current === index ? 'location' : undefined}>
          <span className="reading-contents__marker" aria-hidden="true" />{section.title}
        </a>
      </li>)}</ol>
    </nav>}
    {compactTabs && sections.length > 1 && <nav className="reading-section-tabs" aria-label="Reading sections">
      {sections.map((section, index) => <a key={section.id} href={`#${section.id}`}
        aria-current={current === index ? 'location' : undefined} onClick={event => visit(event, section.id)}>{section.title}</a>)}
    </nav>}
    {/* Keep its natural height at the last section. Removing this row changes
        the sticky inset and can alternate the current section every frame. */}
    {sections.length > 3 && <a className={`reading-continue${current === sections.length - 1 ? ' invisible' : ''}`}
      aria-hidden={current === sections.length - 1 || undefined}
      inert={current === sections.length - 1 || undefined}
      tabIndex={current === sections.length - 1 ? -1 : undefined}
      href={`#${sections[Math.min(current + 1, sections.length - 1)].id}`}
      onClick={event => visit(event, sections[Math.min(current + 1, sections.length - 1)].id)}><CaretDown aria-hidden="true" size={18} /> Continue reading</a>}
    {showReadingActions && <button type="button" className="reading-actions-jump" onClick={() => {
      const actions = readingRef.current?.closest('[data-app-chrome]')
        ?.querySelector('[data-app-bottom-actions] [data-reading-completion]');
      const control = actions?.querySelector('button:not(:disabled)');
      if (!control) return;
      control.focus({ preventScroll: true });
      control.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'instant' : 'smooth' });
    }}>Save or ask about this reading</button>}
  </div>;
}
