import { useContext, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ChartBar, ClipboardText, Gear, List, SignOut } from '@phosphor-icons/react';
import '../../styles/admin-configuration.css';
import { LocalAdminAccessContext } from '../../lib/localAdminAccess.js';

const destinations = [
  { path: '/admin', label: 'Quality dashboard', Icon: ChartBar },
  { path: '/admin/ai-configuration', label: 'AI configuration', Icon: Gear },
  { path: '/admin#review-queue', label: 'Review queue', Icon: ClipboardText }
];

export default function AdminShell({ children, onLogout, onNavigate }) {
  const { pathname, hash } = useLocation();
  const [expanded, setExpanded] = useState(false);
  const openLocalAccess = useContext(LocalAdminAccessContext);

  function handleLink(event, path) {
    if (event.button !== 0 || event.metaKey || event.altKey || event.shiftKey || event.ctrlKey) return;
    onNavigate?.(event, path);
    if (!event.defaultPrevented) setExpanded(false);
  }

  return (
    <div className="admin-workspace">
      <aside className="admin-rail">
        <div className="admin-rail-heading">
          <div className="admin-wordmark">Tableu<span>Admin</span></div>
          <button type="button" className="admin-menu-toggle" aria-label="Admin navigation"
            aria-expanded={expanded} aria-controls="admin-menu" onClick={() => setExpanded(!expanded)}>
            <List size={22} aria-hidden="true" />
          </button>
        </div>
        <div id="admin-menu" className={expanded ? 'admin-rail-body is-open' : 'admin-rail-body'}>
          <nav aria-label="Admin">
            {destinations.map(({ path, label, Icon }) => (
              <Link key={path} to={path} aria-current={pathname + hash === path ? 'page' : undefined}
                onClick={event => handleLink(event, path)}>
                <Icon size={18} aria-hidden="true" />{label}
              </Link>
            ))}
          </nav>
          <div className="admin-rail-bottom">
            {openLocalAccess && <button type="button" className="text-left text-sm" onClick={openLocalAccess}>Local admin access</button>}
            <Link to="/" onClick={event => handleLink(event, '/')}><ArrowLeft size={17} aria-hidden="true" />Back to app</Link>
            <div className="admin-account">
              <span className="admin-avatar" aria-hidden="true">A</span>Admin
              <button type="button" onClick={onLogout} aria-label="Sign out" title="Sign out"><SignOut size={17} /></button>
            </div>
          </div>
        </div>
      </aside>
      <div className="admin-content">{children}</div>
    </div>
  );
}
