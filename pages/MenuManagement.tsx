import React, { useState, useEffect } from 'react';
import { MenuItem } from '../types';
import { Save, Edit2, Eye, EyeOff, CheckCircle, XCircle, Plus, Trash2 } from 'lucide-react';
import { recordAction } from '../services/auditService';
import { Database, TABLE } from '../services/database';
import { menuApi } from '../services/apiService';

// Shared state for demo purposes (usually in Context or Redux)
export const initialMenuItems: MenuItem[] = [
  { id: '1', name: '首页', path: '/dashboard', icon: 'dashboard', visible: true },
  { id: '6', name: '公告通知', path: '/announcement', icon: 'docs', visible: true }, 
  { id: '10', name: '优化建议', path: '/suggestions', icon: 'suggestions', visible: true },
  { 
    id: '2', 
    name: '接口管理', 
    path: '/interface', 
    icon: 'interface',
    visible: true,
    children: [
      { id: '2-1', name: '文档管理', path: '/interface/docs', icon: 'docs', visible: true },
      { id: '2-2', name: '代码生成', path: '/interface/code', icon: 'code', visible: true },
    ] 
  },
  { 
    id: '11', 
    name: '数据同步', 
    path: '/sync', 
    icon: 'sync',
    visible: true,
    children: [
      { id: '11-1', name: 'Nacos配置同步', path: '/sync/nacos', icon: 'nacos', visible: true },
      { id: '11-2', name: 'Oracle DDL同步', path: '/sync/oracle', icon: 'oracle', visible: true },
    ] 
  },
  { id: '9', name: 'GitLab 报表', path: '/gitlab-reports', icon: 'gitlab', visible: true },
  { id: '12', name: 'Gitee管理', path: '/gitee', icon: 'gitee', visible: true },
  { id: '8', name: '格式化工具', path: '/format', icon: 'format', visible: true },
  { id: '3', name: '参数配置', path: '/params', icon: 'params', visible: true },
  { id: '4', name: '知识库', path: '/repo', icon: 'repo', visible: true },
  { id: '7', name: '审计日志', path: '/audit', icon: 'settings', visible: true }, 
  { id: '5', name: '系统设置', path: '/admin', icon: 'settings', visible: true, children: [
      { id: '5-1', name: '菜单管理', path: '/admin/menus', icon: 'settings', visible: true },
      { id: '5-2', name: 'IP映射配置', path: '/admin/ip-config', icon: 'ip', visible: true }
  ]}
];

export const MenuManagement: React.FC = () => {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 加载菜单的函数，可以在多个地方调用
  const loadMenus = async () => {
    try {
      const data = await menuApi.getAll();
      // Convert API response to MenuItem format
      // 注意：这里不过滤 visible=false，管理页面需要显示所有菜单（包括已下线的）
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
        .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)); // Sort by sortOrder
      
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
      setMenus(menus);
    } catch (error) {
      console.error('Failed to load menus:', error);
    }
  };

  useEffect(() => {
    loadMenus();
  }, []);

  const patchVisible = (item: MenuItem): MenuItem => {
    return {
        ...item,
        visible: item.visible !== false,
        children: item.children ? item.children.map(c => patchVisible(c)) : undefined
    };
  }

  const handleEdit = (menu: MenuItem) => {
    setEditingId(menu.id);
    setEditName(menu.name);
  };

  const handleSave = async (id: string) => {
    if (isLoading || loadingId) {
      console.warn('Operation already in progress');
      return;
    }

    if (!editName.trim()) {
      alert('菜单名称不能为空');
      return;
    }

    setLoadingId(id);
    try {
      const target = findMenuById(menus, id);
      if (!target) {
        alert('菜单项不存在');
        setEditingId(null);
        setEditName('');
        return;
      }

      const updatePayload = {
        menuId: id,
        name: editName.trim(),
        path: target.path,
        icon: target.icon,
        visible: target.visible,
        parentId: (target as any).parentId,
        sortOrder: (target as any).sortOrder || 0,
        updatedBy: 'admin'
      };
      
      console.log('Saving menu name for:', id, 'Payload:', updatePayload);
      const response = await menuApi.update(id, updatePayload);
      console.log('Menu update response:', response);
      
      // Check if response indicates success before updating local state
      // Accept various success indicators: success=true, code=200, no error field, or any non-empty response
      const isSuccess = !response?.error && (response?.success !== false) && (response?.code !== 500 && response?.code !== 404);
      
      if (isSuccess) {
        // 更新本地状态
        const updateRecursive = (items: MenuItem[]): MenuItem[] => {
          return items.map(item => {
            if (item.id === id) return { ...item, name: editName.trim() };
            if (item.children) return { ...item, children: updateRecursive(item.children) };
            return item;
          });
        };
        
        const newMenus = updateRecursive(menus);
        setMenus(newMenus);
        recordAction('系统设置 - 菜单管理', `修改菜单 [${id}] 名称为 "${editName.trim()}"`);
        alert('菜单名称已更新');
        setEditingId(null);
        setEditName('');
      } else {
        throw new Error(response?.message || '菜单名称修改失败');
      }
    } catch (error) {
      console.error('Failed to save menu:', error);
      alert(`菜单名称修改失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoadingId(null);
    }
  };

  const findMenuById = (items: MenuItem[], id: string): MenuItem | null => {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findMenuById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const handleToggleVisible = async (id: string) => {
    if (isLoading || loadingId) {
      console.warn('Operation already in progress');
      return;
    }

    setLoadingId(id);
    try {
      const target = findMenuById(menus, id);
      if (!target) {
        alert('菜单项不存在');
        return;
      }

      const newVisibleStatus = !target.visible;
      const updatePayload = {
        menuId: id,
        name: target.name,
        path: target.path,
        icon: target.icon,
        visible: newVisibleStatus,
        parentId: (target as any).parentId,
        sortOrder: (target as any).sortOrder || 0,
        updatedBy: 'admin'
      };
      
      console.log('Toggling visibility for menu:', id, 'New status:', newVisibleStatus);
      const response = await menuApi.update(id, updatePayload);
      console.log('Toggle visibility response:', response);
      
      // Check if response indicates success before updating local state
      // Accept various success indicators: success=true, code=200, no error field, or any non-empty response
      const isSuccess = !response?.error && (response?.success !== false) && (response?.code !== 500 && response?.code !== 404);
      
      if (isSuccess) {
        // 菜单下线/上线后，重新加载所有菜单以保证排序正确
        await loadMenus();
        
        // 触发全局菜单更新事件，让Layout中的Sidebar实时更新
        window.dispatchEvent(new Event('menuUpdated'));
        
        recordAction('系统设置 - 菜单管理', `菜单 [${id}] 状态变更为 ${newVisibleStatus ? '上线' : '下线'}`);
        alert(`菜单已${newVisibleStatus ? '上线' : '下线'}`);
      } else {
        throw new Error(response?.message || `菜单${newVisibleStatus ? '上线' : '下线'}失败`);
      }
    } catch (error) {
      console.error('Failed to toggle menu visibility:', error);
      alert(`菜单上下线操作失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoadingId(null);
    }
  };

  // Removed updateAndSave - now using API directly

  const renderList = (items: MenuItem[], depth = 0) => {
    return items.map(item => {
      const isOffline = item.visible === false;
      return (
      <div key={item.id} className="mb-2">
        <div 
          className={`flex items-center justify-between p-3 border rounded-lg transition-all ${isOffline ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 hover:shadow-sm'}`}
          style={{ marginLeft: `${depth * 20}px` }}
        >
          <div className="flex items-center gap-3">
             {/* Status Dot */}
             <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-slate-300' : 'bg-green-500'}`} title={isOffline ? "已下线" : "在线"}></div>
             
             <span className="text-slate-400 text-xs font-mono w-10">{item.id}</span>
             
             {editingId === item.id ? (
               <input 
                 autoFocus
                 className="px-2 py-1 border border-slate-200 rounded bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none text-sm text-slate-700"
                 value={editName}
                 onChange={(e) => setEditName(e.target.value)}
               />
             ) : (
               <span className={`font-medium ${isOffline ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-700'}`}>{item.name}</span>
             )}
             
             {item.children && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 rounded">{item.children.length} 子菜单</span>}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Online/Offline Toggle */}
            <button 
                onClick={() => handleToggleVisible(item.id)}
                disabled={loadingId === item.id || isLoading}
                className={`p-1.5 rounded flex items-center gap-1 text-xs font-medium transition-colors ${
                  loadingId === item.id || isLoading
                    ? 'opacity-50 cursor-not-allowed'
                    : isOffline ? 'text-slate-500 hover:bg-slate-200' : 'text-green-600 hover:bg-green-50'
                }`}
                title={isOffline ? "点击上线" : "点击下线"}
            >
                {loadingId === item.id ? (
                  <div className="animate-spin">⟳</div>
                ) : isOffline ? (
                  <EyeOff size={16}/>
                ) : (
                  <Eye size={16}/>
                )}
                <span className="hidden md:inline">{loadingId === item.id ? '处理中...' : isOffline ? '已下线' : '在线'}</span>
            </button>

            <div className="w-px h-4 bg-slate-200 mx-1"></div>

            {editingId === item.id ? (
              <button 
                onClick={() => handleSave(item.id)} 
                disabled={loadingId === item.id || isLoading}
                className={`p-1.5 rounded ${loadingId === item.id || isLoading ? 'opacity-50 cursor-not-allowed text-slate-400' : 'text-blue-600 hover:bg-blue-50'}`}
                title="Save"
              >
                <Save size={16} />
              </button>
            ) : (
              <button 
                onClick={() => handleEdit(item)} 
                disabled={loadingId !== null || isLoading}
                className={`p-1.5 rounded ${loadingId !== null || isLoading ? 'opacity-50 cursor-not-allowed' : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
                title="Edit Name"
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>
        </div>
        {item.children && renderList(item.children, depth + 1)}
      </div>
    )});
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">菜单管理</h2>
          <div className="text-sm text-slate-500 flex items-center gap-2">
             <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> 在线</span>
             <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300"></div> 下线 (隐藏)</span>
          </div>
      </div>
      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
        {renderList(menus)}
      </div>
    </div>
  );
};