import React, { useEffect, useRef, useState } from 'react';
import {
  BadgePercent,
  BookOpenText,
  Boxes,
  ChevronDown,
  LayoutDashboard,
  Megaphone,
  Menu,
  Package,
  ReceiptText,
  Rss,
  Settings2,
  ShoppingBasket,
  Sparkles,
  Truck,
  UsersRound,
  Image as ImageIcon,
} from 'lucide-react';

const dashboardItem = {
  id: 'dashboard',
  labelKey: 'nav.dashboard',
  icon: LayoutDashboard,
};

const navGroups = [
  {
    id: 'catalog',
    labelKey: 'navGroups.catalog',
    icon: Package,
    items: [
      { id: 'products', labelKey: 'nav.products', icon: Package },
      { id: 'categories', labelKey: 'nav.categories', icon: Boxes },
      { id: 'suppliers', labelKey: 'nav.suppliers', icon: ShoppingBasket },
    ],
  },
  {
    id: 'operations',
    labelKey: 'navGroups.operations',
    icon: Truck,
    items: [
      { id: 'orders', labelKey: 'nav.orders', icon: ShoppingBasket },
      { id: 'invoices', labelKey: 'nav.invoices', icon: ReceiptText },
    ],
  },
  {
    id: 'growth',
    labelKey: 'navGroups.growth',
    icon: Megaphone,
    items: [
      { id: 'marketing', labelKey: 'nav.marketing', icon: Megaphone },
      { id: 'ai-recommendations', labelKey: 'nav.aiRecommendations', icon: Sparkles },
      { id: 'vouchers', labelKey: 'nav.vouchers', icon: BadgePercent },
      { id: 'blog', labelKey: 'nav.blog', icon: BookOpenText },
      { id: 'homepage-hero', labelKey: 'homepageHero.navLabel', icon: ImageIcon },
      { id: 'google-feed', labelKey: 'nav.googleFeed', icon: Rss },
    ],
  },
  {
    id: 'administration',
    labelKey: 'navGroups.administration',
    icon: Settings2,
    items: [
      { id: 'users', labelKey: 'nav.users', icon: UsersRound },
      { id: 'company-settings', labelKey: 'nav.companySettings', icon: Settings2 },
      { id: 'wms', labelKey: 'nav.wms', icon: Truck },
    ],
  },
];

function getGroupForView(view) {
  return navGroups.find((group) => group.items.some((item) => item.id === view))?.id || '';
}

export default function AdminNavigation({ activeView, onSelect, t }) {
  const activeGroupId = getGroupForView(activeView);
  const [openGroup, setOpenGroup] = useState(activeGroupId);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileToggleRef = useRef(null);

  useEffect(() => {
    setOpenGroup(activeGroupId);
    setMobileOpen(false);
  }, [activeGroupId]);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        mobileToggleRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  const selectView = (view, groupId) => {
    setOpenGroup(groupId);
    setMobileOpen(false);
    onSelect(view);

    if (window.matchMedia?.('(max-width: 800px)').matches) {
      window.requestAnimationFrame(() => mobileToggleRef.current?.focus());
    }
  };

  const renderLink = (item, groupId) => {
    const Icon = item.icon;
    const isActive = activeView === item.id;

    return (
      <button
        key={item.id}
        type="button"
        className={`admin-nav-link${isActive ? ' is-active' : ''}`}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => selectView(item.id, groupId)}
      >
        <span className="admin-nav-link-icon" aria-hidden="true">
          <Icon size={16} strokeWidth={1.9} />
        </span>
        <span>{t(item.labelKey)}</span>
      </button>
    );
  };

  return (
    <div className={`admin-nav-column${mobileOpen ? ' menu-open' : ''}`}>
      <button
        ref={mobileToggleRef}
        className="mobile-nav-toggle"
        type="button"
        aria-expanded={mobileOpen}
        aria-controls="admin-primary-navigation"
        onClick={() => setMobileOpen((open) => !open)}
      >
        <Menu size={16} aria-hidden="true" />
        {mobileOpen ? t('nav.closeMenu') : t('nav.openMenu')}
      </button>

      <aside
        className="admin-sidebar"
        id="admin-primary-navigation"
        aria-label={t('nav.navigation')}
      >
        <div className="admin-sidebar-kicker">{t('nav.workspace')}</div>
        {renderLink(dashboardItem, '')}
        <div className="admin-nav-divider" />

        {navGroups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = openGroup === group.id;
          const isCurrent = activeGroupId === group.id;
          const childrenId = `admin-nav-${group.id}-items`;

          return (
            <div className="admin-nav-group" key={group.id}>
              <button
                className={`admin-nav-group-button${isCurrent ? ' is-current' : ''}`}
                type="button"
                aria-expanded={isOpen}
                aria-controls={childrenId}
                onClick={() => setOpenGroup((current) => current === group.id ? '' : group.id)}
              >
                <span className="admin-nav-link-icon" aria-hidden="true">
                  <GroupIcon size={16} strokeWidth={1.9} />
                </span>
                <span>{t(group.labelKey)}</span>
                <ChevronDown
                  className={`admin-nav-chevron${isOpen ? ' is-open' : ''}`}
                  size={14}
                  aria-hidden="true"
                />
              </button>
              {isOpen && (
                <div className="admin-nav-children" id={childrenId}>
                  {group.items.map((item) => renderLink(item, group.id))}
                </div>
              )}
            </div>
          );
        })}
      </aside>
    </div>
  );
}