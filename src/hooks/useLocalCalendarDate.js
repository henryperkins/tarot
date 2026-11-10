import { useEffect, useState } from 'react';

function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Keep calendar scopes and daily streaks current while the journal stays open,
// including when a sleeping/backgrounded tab resumes after midnight.
export function useLocalCalendarDate() {
  const [date, setDate] = useState(today);
  useEffect(() => {
    let timer;
    function schedule() {
      clearTimeout(timer);
      const now = new Date();
      const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, nextDay.getTime() - now.getTime());
    }
    function refresh() {
      const next = today();
      setDate(previous => previous.getTime() === next.getTime() ? previous : next);
      schedule();
    }
    schedule();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return date;
}
