import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { MenuItem } from '../types';
import {
  Code,
  LogOut,
  ChevronDown,
  User,
} from 'lucide-react';

interface SidebarProps {
  menuItems: MenuItem[];
}

interface MegaMenuSection {
  id: string;
  name: string;
  links: MenuItem[];
  isQuickSection?: boolean;
}

const hasActiveDescendant = (item: MenuItem, pathname: string): boolean => {
  if (item.path && pathname === item.path) return true;
  return item.children?.some(child => hasActiveDescendant(child, pathname)) || false;
};

const getFirstPath = (item: MenuItem): string | undefined => {
  if (item.path) return item.path;
  for (const child of item.children || []) {
    const path = getFirstPath(child);
    if (path) return path;
  }
  return undefined;
};

const buildMegaMenuSections = (items: MenuItem[]): MegaMenuSection[] => {
  const sections: MegaMenuSection[] = [];
  const quickLinks: MenuItem[] = [];

  items
    .filter(item => item.visible !== false)
    .forEach(item => {
      const children = item.children?.filter(child => child.visible !== false) || [];
      if (children.length > 0) {
        sections.push({
          id: item.id,
          name: item.name,
          links: children,
        });
        return;
      }

      quickLinks.push(item);
    });

  if (quickLinks.length > 0) {
    sections.push({
      id: 'quick-entry',
      name: '快捷入口',
      links: quickLinks,
      isQuickSection: true,
    });
  }

  return sections;
};

export const Sidebar: React.FC<SidebarProps> = ({ menuItems }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    setOpenMenuId(null);
  }, [location.pathname]);

  const userInfo = (() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userInfo');
    navigate('/login');
  };

  const renderMegaMenu = (items: MenuItem[]) => {
    const sections = buildMegaMenuSections(items);

    return sections.map(section => {
      const onlyQuickSection = sections.length === 1 && section.isQuickSection;

      return (
        <div key={section.id} className="min-w-0 space-y-1.5">
          {!onlyQuickSection && (
            <div className="flex h-7 items-center gap-2 border-b border-blue-100 px-2 text-xs font-semibold text-blue-800">
              <span>{section.name}</span>
            </div>
          )}
          <div className="space-y-0.5">
            {section.links.map(link => {
              const path = link.path || getFirstPath(link) || '/dashboard';
              return (
                <NavLink
                  key={link.id}
                  to={path}
                  className={({ isActive }) =>
                    `group flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-800'
                        : 'text-slate-600 hover:bg-blue-50/80 hover:text-blue-800'
                    }`
                  }
                >
                  <span className="truncate">{link.name}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      );
    });
  };

  const visibleRootMenus = menuItems.filter(item => item.visible !== false);

  return (
    <header className="sticky top-0 z-50 border-b border-blue-100 bg-white/95 shadow-[0_8px_30px_rgba(30,64,175,0.08)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-blue-700 text-white shadow-[0_12px_26px_rgba(29,78,216,0.2)]">
            <span className="absolute inset-x-0 bottom-0 h-1 bg-amber-400" />
            <Code size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-normal text-blue-950">公金开发辅助平台</h1>
            <p className="mt-0.5 hidden text-xs font-medium text-slate-500 sm:block">研发效能与交付治理</p>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <div className="hidden h-9 items-center gap-2 rounded-md border border-blue-100 bg-blue-50/70 px-3 text-sm text-slate-600 md:flex">
            <User size={16} className="text-blue-700" />
            <span className="max-w-[160px] truncate">{userInfo?.realName || userInfo?.username || '用户'}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex h-9 items-center gap-2 rounded-md border border-blue-100 px-3 text-sm font-medium text-slate-500 transition-colors hover:border-red-100 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">退出</span>
          </button>
        </div>
      </div>

      <nav
        className="relative border-t border-blue-50 bg-gradient-to-r from-blue-50 via-white to-amber-50"
        onMouseLeave={() => setOpenMenuId(null)}
      >
        <div className="scrollbar-hide mx-auto flex h-12 max-w-[1440px] items-center gap-1 overflow-x-auto px-4 sm:px-6 lg:overflow-visible lg:px-8">
          {visibleRootMenus.map((item, index) => {
            const isActive = hasActiveDescendant(item, location.pathname);
            const hasChildren = !!item.children?.length;
            const firstPath = getFirstPath(item);
            const sections = buildMegaMenuSections(item.children || []);
            const dropdownWidth = Math.min(Math.max(sections.length * 210 + 24, 250), 680);
            const alignRight = index >= visibleRootMenus.length - 2;

            return (
              <div
                key={item.id}
                className="relative h-full"
                onMouseEnter={() => setOpenMenuId(hasChildren ? item.id : null)}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (hasChildren) {
                      setOpenMenuId(item.id);
                      return;
                    }
                    if (firstPath) navigate(firstPath);
                  }}
                  className={`flex h-full items-center gap-1.5 border-b-2 px-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:bg-blue-50 lg:px-4 ${
                    isActive
                      ? 'border-blue-700 text-blue-800'
                      : 'border-transparent text-slate-600 hover:text-blue-800'
                  }`}
                >
                  <span className="whitespace-nowrap">{item.name}</span>
                  {hasChildren && <ChevronDown size={14} className={openMenuId === item.id ? 'rotate-180 transition-transform' : 'transition-transform'} />}
                </button>

                {hasChildren && openMenuId === item.id && (
                  <div
                    className={`fixed left-4 right-4 top-[112px] w-auto pt-2 lg:absolute lg:left-auto lg:right-auto lg:top-full lg:w-[var(--dropdown-width)] lg:max-w-[calc(100vw-64px)] ${alignRight ? 'lg:right-0' : 'lg:left-0'}`}
                    style={{ '--dropdown-width': `${dropdownWidth}px` } as React.CSSProperties}
                  >
                    <div
                      className="relative z-50 grid grid-cols-1 gap-3 rounded-lg border border-blue-100 bg-white p-2.5 shadow-[0_18px_36px_rgba(30,64,175,0.14)] lg:grid-cols-[var(--dropdown-columns)]"
                      style={{ '--dropdown-columns': `repeat(${Math.max(sections.length, 1)}, minmax(0, 1fr))` } as React.CSSProperties}
                    >
                      {renderMegaMenu(item.children || [])}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </header>
  );
};
