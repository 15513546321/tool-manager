
import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import { roleApi, menuApi, type RoleInfo, type MenuInfo } from '../../services/authService';

export const RoleManagement: React.FC = () => {
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [menus, setMenus] = useState<MenuInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleInfo | null>(null);
  const [formData, setFormData] = useState({
    roleCode: '',
    roleName: '',
    description: '',
    level: 1,
    status: 1,
    menuIds: [] as number[]
  });

  useEffect(() => {
    loadRoles();
    loadMenus();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const response = await roleApi.list();
      setRoles(response.content || []);
    } catch (error) {
      console.error('Failed to load roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMenus = async () => {
    try {
      const response = await menuApi.getAllTree();
      setMenus(response);
    } catch (error) {
      console.error('Failed to load menus:', error);
    }
  };

  const handleOpenModal = (role?: RoleInfo) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        roleCode: role.roleCode,
        roleName: role.roleName,
        description: role.description || '',
        level: role.level,
        status: role.status,
        menuIds: role.menuIds
      });
    } else {
      setEditingRole(null);
      setFormData({
        roleCode: '',
        roleName: '',
        description: '',
        level: 1,
        status: 1,
        menuIds: []
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.roleCode.trim()) {
      alert('角色编码不能为空');
      return;
    }
    if (!formData.roleName.trim()) {
      alert('角色名称不能为空');
      return;
    }

    try {
      if (editingRole) {
        await roleApi.update(editingRole.id, formData);
      } else {
        await roleApi.create(formData);
      }
      setShowModal(false);
      loadRoles();
      alert(editingRole ? '角色更新成功' : '角色创建成功');
    } catch (error: any) {
      alert(error.response?.data?.message || '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个角色吗？')) return;
    try {
      await roleApi.delete(id);
      loadRoles();
      alert('删除成功');
    } catch (error: any) {
      alert(error.response?.data?.message || '删除失败');
    }
  };

  const handleToggleStatus = async (role: RoleInfo) => {
    try {
      await roleApi.updateStatus(role.id, role.status === 1 ? 0 : 1);
      loadRoles();
    } catch (error: any) {
      alert(error.response?.data?.message || '操作失败');
    }
  };

  const renderMenuTree = (menuList: MenuInfo[], level = 0) => {
    return menuList.map(menu => {
      const isDisabled = menu.status === 0;
      const isAssigned = formData.menuIds.includes(menu.id);
      const shouldGrayOut = isDisabled || !isAssigned;
      return (
        <div key={menu.id} className="ml-4">
          <label className={`flex items-center gap-2 cursor-pointer ${shouldGrayOut ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input
              type="checkbox"
              checked={isAssigned}
              disabled={shouldGrayOut}
              onChange={(e) => {
                const newMenuIds = e.target.checked
                  ? [...formData.menuIds, menu.id]
                  : formData.menuIds.filter(id => id !== menu.id);
                setFormData({ ...formData, menuIds: newMenuIds });
              }}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-slate-600" style={{ paddingLeft: `${level * 12}px` }}>
              {menu.name} {menu.permission && `(${menu.permission})`}
              {isDisabled && <span className="ml-2 text-xs text-slate-400">(已禁用)</span>}
              {!isDisabled && !isAssigned && <span className="ml-2 text-xs text-slate-400">(未分配)</span>}
            </span>
          </label>
          {menu.children && renderMenuTree(menu.children, level + 1)}
        </div>
      );
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Shield className="text-orange-600" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">角色管理</h2>
            <p className="text-slate-500 text-sm">管理系统角色和权限</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold transition-colors shadow-sm"
        >
          <Plus size={18} />
          新增角色
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-700">角色编码</th>
                <th className="px-6 py-4 font-semibold text-slate-700">角色名称</th>
                <th className="px-6 py-4 font-semibold text-slate-700">描述</th>
                <th className="px-6 py-4 font-semibold text-slate-700">级别</th>
                <th className="px-6 py-4 font-semibold text-slate-700">状态</th>
                <th className="px-6 py-4 font-semibold text-slate-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">加载中...</td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">暂无数据</td>
                </tr>
              ) : (
                roles.map(role => (
                  <tr key={role.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono text-sm text-blue-600">{role.roleCode}</td>
                    <td className="px-6 py-4 font-medium text-slate-700">{role.roleName}</td>
                    <td className="px-6 py-4 text-slate-600">{role.description || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-sm">
                        L{role.level}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(role)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          role.status === 1
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {role.status === 1 ? <Eye size={14} /> : <EyeOff size={14} />}
                        {role.status === 1 ? '启用' : '禁用'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenModal(role)}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="编辑"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(role.id)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">
                  {editingRole ? '编辑角色' : '新增角色'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">角色编码 *</label>
                  <input
                    type="text"
                    value={formData.roleCode}
                    onChange={(e) => setFormData({ ...formData, roleCode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">角色名称 *</label>
                  <input
                    type="text"
                    value={formData.roleName}
                    onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">级别</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">状态</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                  >
                    <option value={1}>启用</option>
                    <option value={0}>禁用</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">权限菜单</label>
                <div className="border border-slate-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                  {renderMenuTree(menus)}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
