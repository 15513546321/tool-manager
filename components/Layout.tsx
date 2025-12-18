import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MenuItem } from '../types';
import { initialMenuItems } from '../pages/MenuManagement';
import { menuApi } from '../services/apiService';

export const Layout: React.FC = () => {
  const user = localStorage.getItem('user');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const location = useLocation();

  // Load dynamic menus from backend API
  useEffect(() => {
    const loadMenusFromAPI = async () => {
      try {
        // Load from API instead of localStorage
        const data = await menuApi.getAll();
        
        // Convert API response to MenuItem format
        const converted = data
          .map((item: any) => ({
            id: item.menuId,
            name: item.name,
            path: item.path,
            icon: item.icon,
            visible: item.visible !== false,
            parentId: item.parentId,
            sortOrder: item.sortOrder || 0
          }))
          .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
        
        // Build hierarchy
        const rootItems = converted.filter((m: any) => !m.parentId);
        const buildTree = (parent: any) => {
          const children = converted
            .filter((m: any) => m.parentId === parent.id)
            .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
          if (children.length > 0) {
            parent.children = children.map((c: any) => buildTree(c));
          }
          return parent;
        };
        
        const menus = rootItems.map((item: any) => buildTree(item));
        setMenuItems(menus);
      } catch (error) {
        console.error('Failed to load menus from API:', error);
        // Fallback to initial menus if API fails
        setMenuItems(initialMenuItems);
      }
    };

    loadMenusFromAPI();
    
    // Refresh menus every 5 seconds to detect changes in real-time
    const interval = setInterval(loadMenusFromAPI, 5000);
    
    // Listen for menu updates from MenuManagement page
    const handleMenuUpdate = () => loadMenusFromAPI();
    window.addEventListener('menuUpdated', handleMenuUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('menuUpdated', handleMenuUpdate);
    };
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