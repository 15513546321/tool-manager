
import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Eye, EyeOff, Lock, User } from 'lucide-react';
import { userApi, roleApi, type UserInfo, type RoleInfo } from '../../services/authService';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    realName: '',
    email: '',
    phone: '',
    status: 1,
    roleIds: [] as number[]
  });

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await userApi.list();
      setUsers(response.content || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await roleApi.getActiveRoles();
      setRoles(response);
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  };

  const handleOpenModal = (user?: UserInfo) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: '',
        realName: user.realName,
        email: user.email || '',
        phone: user.phone || '',
        status: user.status,
        roleIds: user.roleIds
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        realName: '',
        email: '',
        phone: '',
        status: 1,
        roleIds: []
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.username.trim()) {
      alert('用户名不能为空');
      return;
    }
    if (!editingUser && !formData.password.trim()) {
      alert('密码不能为空');
      return;
    }

    try {
      if (editingUser) {
        await userApi.update(editingUser.id, { ...formData, password: formData.password || undefined });
      } else {
        await userApi.create(formData);
      }
      setShowModal(false);
      loadUsers();
      alert(editingUser ? '用户更新成功' : '用户创建成功');
    } catch (error: any) {
      alert(error.response?.data?.message || '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个用户吗？')) return;
    try {
      await userApi.delete(id);
      loadUsers();
      alert('删除成功');
    } catch (error: any) {
      alert(error.response?.data?.message || '删除失败');
    }
  };

  const handleResetPassword = async (id: number, username: string) => {
    if (!confirm(`确定要重置用户 "${username}" 的密码吗？`)) return;
    try {
      const response = await userApi.resetPassword(id);
      alert(`密码重置成功！\n\n新密码：${response.newPassword}\n\n请及时告知用户并要求其登录后修改密码。`);
      loadUsers();
    } catch (error: any) {
      alert(error.response?.data?.message || '密码重置失败');
    }
  };

  const handleToggleStatus = async (user: UserInfo) => {
    try {
      await userApi.updateStatus(user.id, user.status === 1 ? 0 : 1);
      loadUsers();
    } catch (error: any) {
      alert(error.response?.data?.message || '操作失败');
    }
  };

  const getRoleNames = (roleIds: number[]) => {
    return roleIds.map(id => roles.find(r => r.id === id)?.roleName).filter(Boolean).join(', ');
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Users className="text-blue-600" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">用户管理</h2>
            <p className="text-slate-500 text-sm">管理系统用户和权限</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-colors shadow-sm"
        >
          <Plus size={18} />
          新增用户
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-700">用户名</th>
                <th className="px-6 py-4 font-semibold text-slate-700">真实姓名</th>
                <th className="px-6 py-4 font-semibold text-slate-700">邮箱</th>
                <th className="px-6 py-4 font-semibold text-slate-700">角色</th>
                <th className="px-6 py-4 font-semibold text-slate-700">状态</th>
                <th className="px-6 py-4 font-semibold text-slate-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">加载中...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">暂无数据</td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="text-blue-600" size={16} />
                        </div>
                        <span className="font-medium text-slate-700">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{user.realName}</td>
                    <td className="px-6 py-4 text-slate-600">{user.email || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-sm">
                        {getRoleNames(user.roleIds) || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(user)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          user.status === 1
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {user.status === 1 ? <Eye size={14} /> : <EyeOff size={14} />}
                        {user.status === 1 ? '启用' : '禁用'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResetPassword(user.id, user.username)}
                          className="p-2 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                          title="重置密码"
                        >
                          <Lock size={16} />
                        </button>
                        <button
                          onClick={() => handleOpenModal(user)}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="编辑"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-800">
                  {editingUser ? '编辑用户' : '新增用户'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">用户名 *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {editingUser ? '新密码' : '密码'} {!editingUser && '*'}
                    {editingUser && <span className="text-slate-400 font-normal ml-1">(留空表示不修改)</span>}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                    placeholder={editingUser ? '留空表示不修改密码' : '请输入密码'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">真实姓名</label>
                  <input
                    type="text"
                    value={formData.realName}
                    onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">手机号</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                  />
                </div>
                <div>
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
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">角色</label>
                  <select
                    multiple
                    value={formData.roleIds.map(id => String(id))}
                    onChange={(e) => setFormData({
                      ...formData,
                      roleIds: Array.from(e.target.selectedOptions).map(opt => parseInt(opt.value))
                    })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none h-24"
                  >
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.roleName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
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
