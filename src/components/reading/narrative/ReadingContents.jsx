import { useCallback, useEffect, useRef, useState } from 'react';
import { List, SpeakerHigh, CaretDown } from '@phosphor-icons/react';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

export function ReadingContents({ sections, readingRef, controlsModel, onNarrate, onStopNarration, compactTabs = false }) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const reducedMotion = useReducedMotion();
  const toggleRef = useRef(null);
  const toolbarRef = useRef(null);
  const sectionIds = sections.map(section => section.id).join(',');
  const current = Math.max(0, sections.findIndex(section => section.id === activeId));

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return undefined;
    const measure = () => {
      const sticky = toolbar.offsetHeight <= innerHeight * .35;
      toolbar.style.position = sticky ? 'sticky' : 'static';
      readingRef.current?.style.setProperty('--reading-wayfinding-height', `${sticky ? toolbar.offsetHeight : 0}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(toolbar);
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [readingRef]);

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
      const toolbar = toolbarRef.current;
      const sticky = toolbar && toolbar.offsetHeight <= innerHeight * .35;
      readingRef.current?.style.setProperty('--reading-wayfinding-height', `${sticky ? toolbar.offsetHeight : 0}px`);
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'instant' : 'smooth' });
    });
  }, [reducedMotion, readingRef]);

  return <div className="reading-wayfinding" ref={toolbarRef}>
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
    {sections.length > 3 && current < sections.length - 1 && <a className="reading-continue" href={`#${sections[current + 1].id}`}
      onClick={event => visit(event, sections[current + 1].id)}><CaretDown aria-hidden="true" size={18} /> Continue reading</a>}
  </div>;
}
