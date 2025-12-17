import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { MenuItem } from '../types';
import { 
  LayoutDashboard, 
  Settings, 
  FileCode, 
  FileText, 
  Code, 
  Database,
  BookOpen,
  LogOut,
  ChevronRight,
  ChevronDown,
  FileJson,
  GitBranch,
  Split,
  RefreshCw,
  Server,
  ArrowLeftRight,
  Lightbulb,
  Network,
  GitPullRequest,
  Zap
} from 'lucide-react';

interface SidebarProps {
  menuItems: MenuItem[];
}

const IconMap: Record<string, React.ElementType> = {
  'dashboard': LayoutDashboard,
  'settings': Settings,
  'interface': FileCode,
  'api': Zap,
  'docs': FileText,
  'code': Code,
  'params': Database,
  'repo': BookOpen,
  'format': FileJson,
  'gitlab': GitBranch,
  'diff': Split,
  'sync': RefreshCw,
  'nacos': Server,
  'oracle': Database,
  'suggestions': Lightbulb,
  'ip': Network,
  'gitee': GitPullRequest
};

export const Sidebar: React.FC<SidebarProps> = ({ menuItems }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]); // Default all collapsed

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setExpandedMenus(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const renderMenu = (items: MenuItem[], depth = 0) => {
    return items.map((item) => {
      // 1. Filter out hidden (Offline) menus
      if (item.visible === false) return null;

      const Icon = item.icon ? IconMap[item.icon] : null;
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = expandedMenus.includes(item.id);
      
      // Check if any child is active to highlight parent
      const isActiveChild = hasChildren && item.children?.some(child => location.pathname.startsWith(child.path));

      return (
        <div key={item.id} className="mb-1">
          {hasChildren ? (
            // Render as Collapsible Parent
            <>
              <div 
                onClick={(e) => toggleExpand(item.id, e)}
                className={`flex items-center justify-between px-3 py-2 mx-2 rounded-md text-sm font-medium transition-colors cursor-pointer select-none ${
                  isActiveChild || isExpanded
                    ? 'text-white bg-slate-800' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                style={{ paddingLeft: `${12 + (depth * 12)}px` }}
              >
                <div className="flex items-center gap-3">
                  {Icon && <Icon size={18} className={isActiveChild ? "text-blue-400" : ""} />}
                  <span>{item.name}</span>
                </div>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
              
              {/* Children Container */}
              <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                 {renderMenu(item.children || [], depth + 1)}
              </div>
            </>
          ) : (
            // Render as Link
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 mx-2 rounded-md text-sm font-medium transition-all duration-200 relative group ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
              style={{ paddingLeft: `${12 + (depth * 12)}px` }}
            >
              {depth > 0 && (
                 <span className="absolute left-[18px] top-1/2 -translate-y-1/2 w-1 h-1 bg-slate-600 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></span>
              )}

              {Icon && <Icon size={18} className={depth > 0 ? "opacity-90" : "opacity-100"} />}
              <span>{item.name}</span>
            </NavLink>
          )}
        </div>
      );
    });
  };

  return (
    <aside className="w-64 bg-slate-900 h-screen flex flex-col fixed left-0 top-0 border-r border-slate-800 shadow-xl z-50">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Code className="text-white" size={20} />
        </div>
        <div>
           <h1 className="text-white font-bold text-lg tracking-tight">DevPlatform</h1>
           <p className="text-slate-500 text-[10px] font-mono leading-none">v1.2.0</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide space-y-0.5">
        {renderMenu(menuItems)}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-900">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20"
        >
          <LogOut size={18} />
          <span>退出登录</span>
        </button>
      </div>
    </aside>
  );
};