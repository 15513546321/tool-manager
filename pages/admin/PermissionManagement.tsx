import React, { useState, useEffect } from 'react';
import { Key, CheckCircle, XCircle, ChevronRight, ChevronDown, Save } from 'lucide-react';
import { menuApi, type MenuInfo, roleApi } from '../../services/authService';
import { recordAction } from '../../services/auditService';

interface Role {
  id: number;
  roleName: string;
  roleCode: string;
}

export const PermissionManagement: React.FC = () => {
  const [menus, setMenus] = useState<MenuInfo[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [assignedMenus, setAssignedMenus] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMenus();
    loadRoles();
  }, []);

  const loadMenus = async () => {
    setLoading(true);
    try {
      const response = await menuApi.getAllTree();
      setMenus(response);
    } catch (error) {
      console.error('Failed to load menus:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await roleApi.getAll();
      setRoles(response);
      if (response.length > 0) {
        setSelectedRoleId(response[0].id);
        loadRoleMenus(response[0].id);
      }
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  };

  const loadRoleMenus = async (roleId: number) => {
    try {
      const response = await roleApi.getMenus(roleId);
      const menuIds = new Set(response.map((m: any) => m.id));
      setAssignedMenus(menuIds);
    } catch (error) {
      console.error('Failed to load role menus:', error);
    }
  };

  const handleRoleChange = async (roleId: number) => {
    setSelectedRoleId(roleId);
    await loadRoleMenus(roleId);
  };

  const handleToggleMenu = (menuId: number) => {
    const newAssigned = new Set(assignedMenus);
    if (newAssigned.has(menuId)) {
      newAssigned.delete(menuId);
    } else {
      newAssigned.add(menuId);
    }
    setAssignedMenus(newAssigned);
  };

  const handleSave = async () => {
    if (!selectedRoleId) {
      alert('请先选择角色');
      return;
    }

    setSaving(true);
    try {
      await roleApi.assignMenus(selectedRoleId, Array.from(assignedMenus));
      recordAction('系统设置 - 权限管理', `为角色 [${selectedRoleId}] 分配菜单权限`);
      alert('权限分配成功');
    } catch (error) {
      console.error('Failed to save permissions:', error);
      alert('权限分配失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedMenus(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const renderMenuTree = (menuList: MenuInfo[], level = 0) => {
    return menuList.map(menu => {
      const isAssigned = assignedMenus.has(menu.id);
      const isDisabled = menu.status === 0;
      
      return (
        <div key={menu.id}>
          <div
            className={`flex items-center justify-between p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
              level > 0 ? 'ml-4' : ''
            } ${isDisabled ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-2">
              {menu.children && menu.children.length > 0 && (
                <button
                  onClick={() => toggleExpand(menu.id)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  {expandedMenus.includes(menu.id) ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </button>
              )}
              {!menu.children || menu.children.length === 0 && (
                <span className="w-4" />
              )}
              
              <button
                onClick={() => handleToggleMenu(menu.id)}
                className={`p-1.5 rounded transition-colors ${
                  isAssigned
                    ? 'text-green-600 hover:bg-green-50'
                    : isDisabled
                    ? 'text-orange-500 hover:bg-orange-50'
                    : 'text-slate-400 hover:bg-slate-200'
                }`}
                title={isAssigned ? '取消分配' : (isDisabled ? '分配（菜单已禁用）' : '分配')}
              >
                {isAssigned ? <CheckCircle size={16} /> : <XCircle size={16} />}
              </button>
              
              <span
                className={`font-medium ${
                  isDisabled ? 'text-slate-400' : 'text-slate-700'
                }`}
              >
                {menu.name}
              </span>
              
              {isDisabled && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs">
                  已禁用
                </span>
              )}
              {menu.isButton === 1 && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded text-xs">
                  按钮
                </span>
              )}
              {menu.permission && (
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-xs font-mono">
                  {menu.permission}
                </span>
              )}
            </div>
          </div>
          {menu.children && menu.children.length > 0 && expandedMenus.includes(menu.id) && (
            <div className="bg-slate-50/50">
              {renderMenuTree(menu.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Key className="text-purple-600" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">权限管理</h2>
            <p className="text-slate-500 text-sm">为角色分配菜单权限</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !selectedRoleId}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors shadow-sm ${
            saving || !selectedRoleId
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {saving ? (
            <>
              <div className="animate-spin">⟳</div>
              <span>保存中...</span>
            </>
          ) : (
            <>
              <Save size={18} />
              <span>保存权限</span>
            </>
          )}
        </button>
      </div>

      {/* Role Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">选择角色</label>
        <select
          value={selectedRoleId || ''}
          onChange={(e) => handleRoleChange(parseInt(e.target.value))}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
        >
          {roles.map(role => (
            <option key={role.id} value={role.id}>
              {role.roleName} ({role.roleCode})
            </option>
          ))}
        </select>
      </div>

      {/* Menu Tree */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <CheckCircle size={14} className="text-green-600" /> 已分配
            </span>
            <span className="flex items-center gap-1">
              <XCircle size={14} className="text-slate-400" /> 未分配
            </span>
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded text-xs">按钮</span> 表示操作权限
            </span>
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs">已禁用</span> 
            </span>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-8 text-slate-500">加载中...</div>
        ) : menus.length === 0 ? (
          <div className="text-center py-8 text-slate-500">暂无数据</div>
        ) : !selectedRoleId ? (
          <div className="text-center py-8 text-slate-500">请先选择角色</div>
        ) : (
          renderMenuTree(menus)
        )}
      </div>
    </div>
  );
};