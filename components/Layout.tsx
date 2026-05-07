import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MenuItem } from '../types';
import { menuApi } from '../services/authService';

export const Layout: React.FC = () => {
  const user = localStorage.getItem('user');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const location = useLocation();

  // Load dynamic menus from backend API
    useEffect(() => {
      const loadMenusFromAPI = async () => {
        try {
          // Load from API - backend already returns tree structure
          const data = await menuApi.getTree();
          
          // Convert API response to MenuItem format while preserving tree structure
          const convertMenu = (item: any): MenuItem => ({
            id: String(item.id),
            name: item.name,
            path: item.path,
            icon: item.icon,
            visible: item.status === 1,
            sortOrder: item.sortOrder || 0,
            children: item.children ? item.children.map((child: any) => convertMenu(child)).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)) : undefined
          });
          
          // Filter and sort root menus (parentId is 0 or null)
          const menus = data
            .filter((item: any) => !item.parentId || item.parentId === 0)
            .map((item: any) => convertMenu(item))
            .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
          
          setMenuItems(menus);
        } catch (error) {
          console.error('Failed to load menus from API:', error);
          // Set empty menu if API fails
          setMenuItems([]);
        }
      };

    loadMenusFromAPI();
    
    // Refresh menus every 5 seconds to detect changes in real-time
    const interval = setInterval(loadMenusFromAPI, 5000);
    
    // Listen for immediate menu updates from MenuManagement page
    const handleMenuUpdate = (event: Event) => {
      console.log('Menu update event received:', event);
      loadMenusFromAPI();
    };
    
    // Listen for both 'menuUpdated' and 'menuNameChanged' events for immediate updates
    window.addEventListener('menuUpdated', handleMenuUpdate);
    window.addEventListener('menuNameChanged', handleMenuUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('menuUpdated', handleMenuUpdate);
      window.removeEventListener('menuNameChanged', handleMenuUpdate);
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
