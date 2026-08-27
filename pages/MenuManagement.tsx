import React, { useState, useEffect } from 'react';
import { MenuItem } from '../types';
import { Save, Edit2, Eye, EyeOff, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { recordAction } from '../services/auditService';
import { menuApi, type MenuInfo } from '../services/authService';

export const MenuManagement: React.FC = () => {
  const [menus, setMenus] = useState<MenuInfo[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuInfo | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<number[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    path: '',
    icon: '',
    permission: '',
    parentId: 0,
    sortOrder: 0,
    isButton: 0,
    status: 1
  });

  useEffect(() => {
    loadMenus();
  }, []);

  const loadMenus = async () => {
    try {
      const response = await menuApi.getAllTree();
      setMenus(response);
    } catch (error) {
      console.error('Failed to load menus:', error);
    }
  };

  const handleEdit = (menu: MenuInfo) => {
    setEditingId(menu.id);
    setEditName(menu.name);
  };

  const handleSave = async (id: number) => {
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
        name: editName.trim(),
        path: target.path || '',
        icon: target.icon,
        permission: target.permission,
        parentId: target.parentId,
        sortOrder: target.sortOrder,
        isButton: target.isButton,
        status: target.status
      };
      
      await menuApi.update(id, updatePayload);
      
      await loadMenus();
      recordAction('系统设置 - 菜单管理', `修改菜单 [${id}] 名称为 "${editName.trim()}"`);
      
      alert('菜单名称已更新');
      setEditingId(null);
      setEditName('');
      
      window.dispatchEvent(new Event('menuNameChanged'));
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Failed to save menu:', error);
      alert(`菜单名称修改失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoadingId(null);
    }
  };

  const findMenuById = (items: MenuInfo[], id: number): MenuInfo | null => {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findMenuById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const handleToggleStatus = async (id: number) => {
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

      const newStatus = target.status === 1 ? 0 : 1;
      await menuApi.toggleStatus(id, newStatus);
      
      await loadMenus();
      window.dispatchEvent(new Event('menuUpdated'));
      recordAction('系统设置 - 菜单管理', `菜单 [${id}] 状态变更为 ${newStatus === 1 ? '启用' : '禁用'}`);
      alert(`菜单已${newStatus === 1 ? '启用' : '禁用'}`);
    } catch (error) {
      console.error('Failed to toggle menu status:', error);
      alert(`菜单状态切换失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个菜单吗？')) return;
    
    setLoadingId(id);
    try {
      await menuApi.delete(id);
      await loadMenus();
      recordAction('系统设置 - 菜单管理', `删除菜单 [${id}]`);
      alert('删除成功');
    } catch (error) {
      console.error('Failed to delete menu:', error);
      alert(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoadingId(null);
    }
  };

  const handleReorder = async (id: number, direction: 'up' | 'down') => {
    if (loadingId !== null || isLoading) {
      console.warn('Operation already in progress');
      return;
    }

    setLoadingId(id);
    try {
      await menuApi.reorder(id, direction);
      await loadMenus();
      recordAction('系统设置 - 菜单管理', `菜单 [${id}] ${direction === 'up' ? '上移' : '下移'}`);
    } catch (error) {
      console.error('Failed to reorder menu:', error);
      alert(`排序调整失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoadingId(null);
    }
  };

  const getSiblingCount = (parentId: number): number => {
    const countSiblings = (items: MenuInfo[], targetParentId: number): number => {
      let count = 0;
      for (const item of items) {
        if (item.parentId === targetParentId) {
          count++;
        }
        if (item.children) {
          count += countSiblings(item.children, targetParentId);
        }
      }
      return count;
    };
    return countSiblings(menus, parentId);
  };

  const handleOpenModal = (menu?: MenuInfo) => {
    if (menu) {
      setEditingMenu(menu);
      setFormData({
        name: menu.name,
        path: menu.path || '',
        icon: menu.icon || '',
        permission: menu.permission || '',
        parentId: menu.parentId,
        sortOrder: menu.sortOrder,
        isButton: menu.isButton,
        status: menu.status
      });
    } else {
      setEditingMenu(null);
      setFormData({
        name: '',
        path: '',
        icon: '',
        permission: '',
        parentId: 0,
        sortOrder: 0,
        isButton: 0,
        status: 1
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert('菜单名称不能为空');
      return;
    }

    try {
      if (editingMenu) {
        await menuApi.update(editingMenu.id, formData);
      } else {
        await menuApi.create(formData);
      }
      setShowModal(false);
      await loadMenus();
      alert(editingMenu ? '菜单更新成功' : '菜单创建成功');
    } catch (error: any) {
      alert(error.response?.data?.message || '操作失败');
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedMenus(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getParentMenuOptions = () => {
    const options: { value: number; label: string; level: number }[] = [
      { value: 0, label: '根菜单', level: 0 }
    ];
    
    const traverse = (menuList: MenuInfo[], level = 0) => {
      menuList.forEach(menu => {
        if (menu.isButton === 0) {
          options.push({
            value: menu.id,
            label: `${'└──'.repeat(level)} ${menu.name}`,
            level
          });
          if (menu.children) {
            traverse(menu.children, level + 1);
          }
        }
      });
    };
    
    traverse(menus);
    return options;
  };

  const ICON_OPTIONS = [
    { value: '', label: '无图标' },
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'code', label: 'Code' },
    { value: 'interface', label: 'Interface' },
    { value: 'docs', label: 'Docs' },
    { value: 'payload', label: 'Payload' },
    { value: 'field', label: 'Field' },
    { value: 'format', label: 'Format' },
    { value: 'repo', label: 'Repo' },
    { value: 'release', label: 'Release' },
    { value: 'sync', label: 'Sync' },
    { value: 'nacos', label: 'Nacos' },
    { value: 'oracle', label: 'Oracle' },
    { value: 'params', label: 'Params' },
    { value: 'refresh', label: 'Refresh' },
    { value: 'audit', label: 'Audit' },
    { value: 'announcement', label: 'Announcement' },
    { value: 'suggestions', label: 'Suggestions' },
    { value: 'gitee', label: 'Gitee' },
    { value: 'gitlab', label: 'GitLab' },
    { value: 'users', label: 'Users' },
    { value: 'shield', label: 'Shield' },
    { value: 'settings', label: 'Settings' },
    { value: 'menu', label: 'Menu' },
    { value: 'file', label: 'File' },
    { value: 'folder', label: 'Folder' },
    { value: 'key', label: 'Key' },
    { value: 'lock', label: 'Lock' },
    { value: 'unlock', label: 'Unlock' },
    { value: 'add', label: 'Add' },
    { value: 'edit', label: 'Edit' },
    { value: 'delete', label: 'Delete' },
    { value: 'search', label: 'Search' }
  ];

  const renderList = (items: MenuInfo[], level = 0) => {
    return items.map(item => {
      const isDisabled = item.status === 0;
      const isGroup = item.isButton === 0 && item.children && item.children.length > 0;
      return (
      <div key={item.id} className="mb-2">
        <div 
          className={`flex items-center justify-between rounded-lg border p-3 transition-all ${
            isDisabled
              ? 'border-zinc-200 bg-zinc-50 opacity-60'
              : isGroup
                ? 'border-zinc-300 bg-white shadow-sm'
                : 'border-zinc-200 bg-white hover:border-blue-200 hover:shadow-sm'
          }`}
          style={{ marginLeft: `${level * 20}px` }}
        >
          <div className="flex items-center gap-3">
             {item.children && item.children.length > 0 && (
              <button
                onClick={() => toggleExpand(item.id)}
                className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
              >
                {expandedMenus.includes(item.id) ? (
                  <span>▼</span>
                ) : (
                  <span>▶</span>
                )}
              </button>
            )}
            {!item.children || item.children.length === 0 && (
              <span className="w-4" />
            )}
             
             <div className={`w-2 h-2 rounded-full ${isDisabled ? 'bg-zinc-300' : 'bg-blue-600'}`} title={isDisabled ? "已禁用" : "启用"}></div>
             
             <span className="text-zinc-400 text-xs font-mono w-10">{item.id}</span>
             
             {editingId === item.id ? (
               <input 
                 autoFocus
                 className="px-2 py-1 border border-zinc-200 rounded bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none text-sm text-zinc-700"
                 value={editName}
                 onChange={(e) => setEditName(e.target.value)}
               />
             ) : (
               <span className={`font-medium ${isDisabled ? 'text-zinc-500 line-through decoration-zinc-300' : 'text-zinc-800'}`}>{item.name}</span>
             )}
             
             {item.isButton === 1 && (
               <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-xs">按钮</span>
             )}
             {item.permission && (
               <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded text-xs font-mono">{item.permission}</span>
             )}
             {item.children && <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-1.5 rounded">{item.children.length} 子菜单</span>}
          </div>
          
          <div className="flex items-center gap-2">
            <button 
                onClick={() => handleToggleStatus(item.id)}
                disabled={loadingId === item.id || isLoading}
                className={`p-1.5 rounded flex items-center gap-1 text-xs font-medium transition-colors ${
                  loadingId === item.id || isLoading
                    ? 'opacity-50 cursor-not-allowed'
                    : isDisabled ? 'text-zinc-500 hover:bg-zinc-200' : 'text-blue-700 hover:bg-blue-50'
                }`}
                title={isDisabled ? "点击启用" : "点击禁用"}
            >
                {loadingId === item.id ? (
                  <div className="animate-spin">⟳</div>
                ) : isDisabled ? (
                  <EyeOff size={16}/>
                ) : (
                  <Eye size={16}/>
                )}
                <span className="hidden md:inline">{loadingId === item.id ? '处理中...' : isDisabled ? '已禁用' : '启用'}</span>
            </button>

            <div className="w-px h-4 bg-zinc-200 mx-1"></div>

            {/* 排序按钮 */}
            <button
              onClick={() => handleReorder(item.id, 'up')}
              disabled={loadingId === item.id || isLoading}
              className={`p-1.5 rounded ${loadingId === item.id || isLoading ? 'opacity-50 cursor-not-allowed' : 'text-zinc-500 hover:bg-amber-50 hover:text-amber-700'}`}
              title="上移"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={() => handleReorder(item.id, 'down')}
              disabled={loadingId === item.id || isLoading}
              className={`p-1.5 rounded ${loadingId === item.id || isLoading ? 'opacity-50 cursor-not-allowed' : 'text-zinc-500 hover:bg-amber-50 hover:text-amber-700'}`}
              title="下移"
            >
              <ChevronDown size={16} />
            </button>

            <div className="w-px h-4 bg-zinc-200 mx-1"></div>

            {editingId === item.id ? (
              <button 
                onClick={() => handleSave(item.id)} 
                disabled={loadingId === item.id || isLoading}
                className={`p-1.5 rounded ${loadingId === item.id || isLoading ? 'opacity-50 cursor-not-allowed text-zinc-400' : 'text-blue-700 hover:bg-blue-50'}`}
                title="Save"
              >
                <Save size={16} />
              </button>
            ) : (
              <button 
                onClick={() => handleEdit(item)} 
                disabled={loadingId !== null || isLoading}
                className={`p-1.5 rounded ${loadingId !== null || isLoading ? 'opacity-50 cursor-not-allowed' : 'text-zinc-500 hover:bg-blue-50 hover:text-blue-700'}`}
                title="Edit Name"
              >
                <Edit2 size={16} />
              </button>
            )}
            
            <button
              onClick={() => handleDelete(item.id)}
              disabled={loadingId === item.id || isLoading}
              className={`p-1.5 rounded ${loadingId === item.id || isLoading ? 'opacity-50 cursor-not-allowed' : 'text-zinc-500 hover:text-red-600 hover:bg-red-50'}`}
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        {item.children && item.children.length > 0 && expandedMenus.includes(item.id) && (
          <div className="bg-zinc-50/40 py-1">
            {renderList(item.children, level + 1)}
          </div>
        )}
      </div>
    )});
  };

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal text-blue-950">菜单管理</h2>
            <p className="mt-2 text-sm text-zinc-500">维护平台导航、权限入口与显示状态。</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500 shadow-sm md:flex">
               <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-600"></div> 启用</span>
               <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-zinc-300"></div> 禁用</span>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800"
            >
              <Plus size={18} />
              新增菜单
            </button>
          </div>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 shadow-sm">
        {renderList(menus)}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-blue-950/45 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-blue-950">
                  {editingMenu ? '编辑菜单' : '新增菜单'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">菜单名称 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">路由路径</label>
                  <input
                    type="text"
                    value={formData.path}
                    onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                    placeholder="/path/to/page"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">图标</label>
                  <select
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                  >
                    {ICON_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">权限标识</label>
                  <input
                    type="text"
                    value={formData.permission}
                    onChange={(e) => setFormData({ ...formData, permission: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none font-mono text-sm"
                    placeholder="如: user:add"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">父菜单</label>
                  <select
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                  >
                    {getParentMenuOptions().map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">排序</label>
                    <input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">类型</label>
                    <select
                      value={formData.isButton}
                      onChange={(e) => setFormData({ ...formData, isButton: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                    >
                      <option value={0}>菜单</option>
                      <option value={1}>按钮</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">状态</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                  >
                    <option value={1}>启用</option>
                    <option value={0}>禁用</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-600 rounded-md hover:bg-zinc-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800 font-medium"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
