/**
 * 认证服务
 * 作者：张擎
 * 时间：2026-05-06
 */

import { apiService } from './apiService';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  userId: number;
  username: string;
  realName: string;
  roles: string[];
  permissions: string[];
}

export interface UserInfo {
  id: number;
  username: string;
  realName: string;
  email: string;
  phone: string;
  status: number;
  roleIds: number[];
  createdAt: string;
  updatedAt: string;
  password?: string;
}

export interface CurrentUser {
  userId: number;
  username: string;
  realName: string;
  roles: string[];
  permissions: string[];
}

export interface RoleInfo {
  id: number;
  roleCode: string;
  roleName: string;
  description: string;
  level: number;
  status: number;
  menuIds: number[];
}

export interface MenuInfo {
  id: number;
  name: string;
  path: string;
  icon: string;
  permission: string;
  parentId: number;
  sortOrder: number;
  isButton: number;
  status: number;
  children?: MenuInfo[];
}

export const authApi = {
  /**
   * 用户登录
   */
  login: async (request: LoginRequest): Promise<LoginResponse> => {
    const response = await apiService.post('/auth/login', request);
    // 保存Token到localStorage
    if (response.accessToken) {
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('user', JSON.stringify({
        userId: response.userId,
        username: response.username,
        realName: response.realName,
        roles: response.roles,
        permissions: response.permissions
      }));
      localStorage.setItem('userInfo', JSON.stringify({
        userId: response.userId,
        username: response.username,
        realName: response.realName,
        roles: response.roles,
        permissions: response.permissions
      }));
    }
    return response;
  },

  /**
   * 刷新Token
   */
  refreshToken: async (refreshToken: string): Promise<LoginResponse> => {
    const response = await apiService.post('/auth/refresh-token', { refreshToken });
    if (response.accessToken) {
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
    }
    return response;
  },

  /**
   * 退出登录
   */
  logout: async (): Promise<void> => {
    await apiService.post('/auth/logout');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userInfo');
  },

  /**
   * 获取当前用户信息
   */
  getUserInfo: (): CurrentUser | null => {
    const userInfo = localStorage.getItem('userInfo');
    return userInfo ? JSON.parse(userInfo) : null;
  },

  /**
   * 获取Token
   */
  getToken: (): string | null => {
    return localStorage.getItem('accessToken');
  },

  /**
   * 检查是否已登录
   */
  isLoggedIn: (): boolean => {
    return !!localStorage.getItem('accessToken');
  },

  /**
   * 检查权限
   */
  hasPermission: (permission: string): boolean => {
    const userInfo = authApi.getUserInfo();
    if (!userInfo) return false;
    // 超级管理员拥有所有权限
    if (userInfo.roles.includes('ADMIN')) return true;
    return userInfo.permissions.includes(permission);
  },

  /**
   * 检查角色
   */
  hasRole: (role: string): boolean => {
    const userInfo = authApi.getUserInfo();
    if (!userInfo) return false;
    return userInfo.roles.includes(role);
  }
};

export const userApi = {
  /**
   * 获取用户列表
   */
  list: async (page = 0, size = 10): Promise<any> => {
    return apiService.get(`/users?page=${page}&size=${size}`);
  },

  /**
   * 获取用户详情
   */
  getById: async (id: number): Promise<UserInfo> => {
    return apiService.get(`/users/${id}`);
  },

  /**
   * 创建用户
   */
  create: async (user: Omit<UserInfo, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserInfo> => {
    return apiService.post('/users', user);
  },

  /**
   * 更新用户
   */
  update: async (id: number, user: Partial<UserInfo>): Promise<UserInfo> => {
    return apiService.put(`/users/${id}`, user);
  },

  /**
   * 更新用户状态
   */
  updateStatus: async (id: number, status: number): Promise<UserInfo> => {
    return apiService.post(`/users/${id}/status`, { status });
  },

  /**
   * 删除用户
   */
  delete: async (id: number): Promise<void> => {
    return apiService.delete(`/users/${id}`);
  },

  /**
   * 修改密码
   */
  changePassword: async (userId: number, oldPassword: string, newPassword: string): Promise<void> => {
    return apiService.post('/users/change-password', { userId, oldPassword, newPassword });
  },

  /**
   * 重置密码
   */
  resetPassword: async (id: number): Promise<{ message: string; newPassword: string }> => {
    return apiService.post(`/users/${id}/reset-password`);
  }
};

export const roleApi = {
  /**
   * 获取角色列表
   */
  list: async (page = 0, size = 10): Promise<any> => {
    return apiService.get(`/roles?page=${page}&size=${size}`);
  },

  /**
   * 获取所有角色
   */
  getAll: async (): Promise<RoleInfo[]> => {
    return apiService.get('/roles/all');
  },

  /**
   * 获取角色详情
   */
  getById: async (id: number): Promise<RoleInfo> => {
    return apiService.get(`/roles/${id}`);
  },

  /**
   * 创建角色
   */
  create: async (role: Omit<RoleInfo, 'id' | 'createdAt' | 'updatedAt'>): Promise<RoleInfo> => {
    return apiService.post('/roles', role);
  },

  /**
   * 更新角色
   */
  update: async (id: number, role: Partial<RoleInfo>): Promise<RoleInfo> => {
    return apiService.put(`/roles/${id}`, role);
  },

  /**
   * 更新角色状态
   */
  updateStatus: async (id: number, status: number): Promise<RoleInfo> => {
    return apiService.post(`/roles/${id}/status`, { status });
  },

  /**
   * 删除角色
   */
  delete: async (id: number): Promise<void> => {
    return apiService.delete(`/roles/${id}`);
  },

  /**
   * 获取所有启用的角色
   */
  getActiveRoles: async (): Promise<RoleInfo[]> => {
    return apiService.get('/roles/active');
  },

  /**
   * 获取角色的菜单
   */
  getMenus: async (roleId: number): Promise<MenuInfo[]> => {
    return apiService.get(`/roles/${roleId}/menus`);
  },

  /**
   * 为角色分配菜单
   */
  assignMenus: async (roleId: number, menuIds: number[]): Promise<void> => {
    return apiService.post(`/roles/${roleId}/menus`, { menuIds });
  }
};

export const menuApi = {
  /**
   * 获取当前用户有权限的菜单树（用于前端导航）
   */
  getTree: async (): Promise<MenuInfo[]> => {
    return apiService.get('/menus/tree');
  },

  /**
   * 获取所有菜单树（不进行权限过滤，用于管理页面）
   */
  getAllTree: async (): Promise<MenuInfo[]> => {
    return apiService.get('/menus/all-tree');
  },

  /**
   * 获取菜单详情
   */
  getById: async (id: number): Promise<MenuInfo> => {
    return apiService.get(`/menus/${id}`);
  },

  /**
   * 创建菜单
   */
  create: async (menu: Omit<MenuInfo, 'id' | 'createdAt' | 'updatedAt' | 'children'>): Promise<MenuInfo> => {
    return apiService.post('/menus', menu);
  },

  /**
   * 更新菜单
   */
  update: async (id: number, menu: Partial<MenuInfo>): Promise<MenuInfo> => {
    return apiService.put(`/menus/${id}`, menu);
  },

  /**
   * 删除菜单
   */
  delete: async (id: number): Promise<void> => {
    return apiService.delete(`/menus/${id}`);
  },

  /**
   * 获取所有启用的菜单
   */
  getActiveMenus: async (): Promise<MenuInfo[]> => {
    return apiService.get('/menus/active');
  },

  /**
   * 调整菜单排序（上移/下移）
   */
  reorder: async (id: number, direction: 'up' | 'down'): Promise<void> => {
    return apiService.post(`/menus/${id}/reorder?direction=${direction}`);
  },

  /**
   * 切换菜单状态（启用/禁用）
   */
  toggleStatus: async (id: number, status: number): Promise<MenuInfo> => {
    return apiService.put(`/menus/${id}/status`, { status });
  }
};
