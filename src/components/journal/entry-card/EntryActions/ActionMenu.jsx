/**
 * ActionMenu.jsx
 * Portal-based action menu for entry actions (export, copy, share, delete).
 */
import { memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { DownloadSimple, ClipboardText, FileText, CircleNotch } from '@phosphor-icons/react';
import { JournalTrashIcon } from '../../../JournalIcons';
import { ShareLinksPanel } from './ShareLinksPanel';
import { styles, cn } from '../EntryCard.primitives';

export const ActionMenu = memo(function ActionMenu({
  isOpen,
  menuRef,
  menuId,
  placement,
  canUseDom,
  pendingAction,
  onClose,
  actions,
  shareLinksProps
}) {
  const {
    handleExportCsv,
    handleExportMarkdown,
    handleCopyCsv,
    handleDelete,
    isAuthenticated,
    onDelete
  } = actions;

  const menuItems = useMemo(() => {
    const items = [
      { key: 'copy', label: 'Copy CSV', icon: ClipboardText, onSelect: handleCopyCsv },
      { key: 'export', label: 'Export CSV', icon: DownloadSimple, onSelect: handleExportCsv },
      { key: 'export-md', label: 'Export Markdown', icon: FileText, onSelect: handleExportMarkdown }
    ];

    if (isAuthenticated && onDelete) {
      items.push({
        key: 'delete',
        label: 'Delete entry',
        icon: JournalTrashIcon,
        onSelect: handleDelete,
        tone: 'danger'
      });
    }

    return items;
  }, [handleCopyCsv, handleExportCsv, handleExportMarkdown, handleDelete, isAuthenticated, onDelete]);

  const menuStyle = useMemo(() => {
    if (!placement) return null;
    return { left: placement.left, top: placement.top };
  }, [placement]);

  if (!isOpen) return null;

  const menu = (
    <div
      id={menuId}
      ref={menuRef}
      role="menu"
      aria-label="Entry actions"
      className={styles.menu}
      style={menuStyle || undefined}
    >
      <div className="space-y-1">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isPending = pendingAction === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                onClose();
                item.onSelect();
              }}
              disabled={isPending}
              className={cn(
                styles.menuItem,
                item.tone === 'danger' ? styles.menuItemDanger : styles.menuItemDefault
              )}
            >
              <span className="flex items-center gap-2">
                {isPending ? (
                  <CircleNotch
                    className="h-3.5 w-3.5 animate-spin text-[color:var(--text-muted)]"
                    aria-hidden="true"
                  />
                ) : (
                  <IconComponent
                    className={cn(
                      'h-4 w-4',
                      item.tone === 'danger'
                        ? 'text-[color:var(--status-error)]'
                        : 'text-[color:var(--brand-primary)]'
                    )}
                    aria-hidden="true"
                  />
                )}
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <ShareLinksPanel {...shareLinksProps} pendingAction={pendingAction} />
    </div>
  );

  // Portal to body for proper stacking
  if (canUseDom) {
    return createPortal(menu, document.body);
  }

  return menu;
});
