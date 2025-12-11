import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MenuItem } from '../types';
import { initialMenuItems } from '../pages/MenuManagement';

export const Layout: React.FC = () => {
  const user = localStorage.getItem('user');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const location = useLocation();

  // Load dynamic menus (simulating Admin allocation persistence)
  useEffect(() => {
    const loadMenus = () => {
      const saved = localStorage.getItem('appMenus');
      setMenuItems(saved ? JSON.parse(saved) : initialMenuItems);
    };

    loadMenus();
    
    // Listen for menu updates from MenuManagement page
    window.addEventListener('menuUpdated', loadMenus);
    return () => window.removeEventListener('menuUpdated', loadMenus);
  }, []);

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar menuItems={menuItems} />
      <main className="flex-1 ml-64 p-0">
        <div className="h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};