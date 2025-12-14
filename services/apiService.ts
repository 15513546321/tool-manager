/**
 * API Service for Backend Communication
 * Handles all HTTP requests to the Spring Boot backend
 */

// Get API base URL from environment or default to localhost:8080
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Announcement APIs
export const announcementApi = {
  getLatest: async () => {
    const res = await fetch(`${API_BASE_URL}/announcement/latest`);
    if (!res.ok) throw new Error('Failed to fetch latest announcement');
    return res.json();
  },

  getByVersion: async (version: string) => {
    const res = await fetch(`${API_BASE_URL}/announcement/${version}`);
    if (!res.ok) throw new Error('Failed to fetch announcement');
    return res.json();
  },

  getAll: async () => {
    const res = await fetch(`${API_BASE_URL}/announcement/list/all`);
    if (!res.ok) throw new Error('Failed to fetch announcements');
    return res.json();
  },

  create: async (data: any) => {
    const res = await fetch(`${API_BASE_URL}/announcement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create announcement');
    return res.json();
  },

  update: async (id: number, data: any) => {
    const res = await fetch(`${API_BASE_URL}/announcement/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update announcement');
    return res.json();
  },

  delete: async (id: number) => {
    const res = await fetch(`${API_BASE_URL}/announcement/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete announcement');
  },

  checkStatus: async () => {
    const res = await fetch(`${API_BASE_URL}/announcement/status/check`);
    if (!res.ok) throw new Error('Failed to check announcement status');
    return res.json();
  },

  recordView: async () => {
    const res = await fetch(`${API_BASE_URL}/announcement/record-view`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to record announcement view');
    return res.json();
  },
};

// Menu APIs
export const menuApi = {
  getAll: async () => {
    const res = await fetch(`${API_BASE_URL}/menu/all`);
    if (!res.ok) throw new Error('Failed to fetch menus');
    return res.json();
  },

  getById: async (menuId: string) => {
    const res = await fetch(`${API_BASE_URL}/menu/${menuId}`);
    if (!res.ok) throw new Error('Failed to fetch menu');
    return res.json();
  },

  getChildren: async (parentId: string) => {
    const res = await fetch(`${API_BASE_URL}/menu/children/${parentId}`);
    if (!res.ok) throw new Error('Failed to fetch menu children');
    return res.json();
  },

  create: async (data: any) => {
    const res = await fetch(`${API_BASE_URL}/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create menu');
    return res.json();
  },

  update: async (menuId: string, data: any) => {
    const res = await fetch(`${API_BASE_URL}/menu/${menuId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update menu');
    return res.json();
  },

  delete: async (menuId: string) => {
    const res = await fetch(`${API_BASE_URL}/menu/${menuId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete menu');
  },
};

// System Parameter APIs
export const systemParameterApi = {
  getByKey: async (paramKey: string) => {
    const res = await fetch(`${API_BASE_URL}/system-param/${paramKey}`);
    if (!res.ok) throw new Error('Failed to fetch parameter');
    return res.json();
  },

  getByCategory: async (category: string) => {
    const res = await fetch(`${API_BASE_URL}/system-param/category/${category}`);
    if (!res.ok) throw new Error('Failed to fetch parameters');
    return res.json();
  },

  getAll: async () => {
    const res = await fetch(`${API_BASE_URL}/system-param/all`);
    if (!res.ok) throw new Error('Failed to fetch all parameters');
    return res.json();
  },

  save: async (data: any) => {
    const res = await fetch(`${API_BASE_URL}/system-param`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save parameter');
    return res.json();
  },

  delete: async (paramKey: string) => {
    const res = await fetch(`${API_BASE_URL}/system-param/${paramKey}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete parameter');
  },
};

// Suggestion APIs
export const suggestionApi = {
  getAll: async () => {
    const res = await fetch(`${API_BASE_URL}/suggestion/all`);
    if (!res.ok) throw new Error('Failed to fetch suggestions');
    return res.json();
  },

  getByStatus: async (status: string) => {
    const res = await fetch(`${API_BASE_URL}/suggestion/status/${status}`);
    if (!res.ok) throw new Error('Failed to fetch suggestions');
    return res.json();
  },

  getByCategory: async (category: string) => {
    const res = await fetch(`${API_BASE_URL}/suggestion/category/${category}`);
    if (!res.ok) throw new Error('Failed to fetch suggestions');
    return res.json();
  },

  create: async (data: any) => {
    const res = await fetch(`${API_BASE_URL}/suggestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create suggestion');
    return res.json();
  },

  update: async (id: number, data: any) => {
    const res = await fetch(`${API_BASE_URL}/suggestion/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update suggestion');
    return res.json();
  },

  delete: async (id: number) => {
    const res = await fetch(`${API_BASE_URL}/suggestion/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete suggestion');
  },
};

// Config Setting APIs (for GitLab, Gitee, Nacos, Oracle, etc.)
export const configApi = {
  getByKey: async (configKey: string) => {
    const res = await fetch(`${API_BASE_URL}/config/${configKey}`);
    if (!res.ok) throw new Error('Failed to fetch config');
    return res.json();
  },

  getByType: async (configType: string) => {
    const res = await fetch(`${API_BASE_URL}/config/type/${configType}`);
    if (!res.ok) throw new Error('Failed to fetch configs');
    return res.json();
  },

  getAll: async () => {
    const res = await fetch(`${API_BASE_URL}/config/all`);
    if (!res.ok) throw new Error('Failed to fetch all configs');
    return res.json();
  },

  save: async (data: any) => {
    const res = await fetch(`${API_BASE_URL}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save config');
    return res.json();
  },

  delete: async (configKey: string) => {
    const res = await fetch(`${API_BASE_URL}/config/${configKey}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete config');
  },
};

// Database Connection API
export const dbConnectionApi = {
  getAll: async () => {
    const res = await fetch(`${API_BASE_URL}/db-connection/all`);
    if (!res.ok) throw new Error('Failed to fetch database connections');
    return res.json();
  },

  getByType: async (type: string) => {
    const res = await fetch(`${API_BASE_URL}/db-connection/type/${type}`);
    if (!res.ok) throw new Error('Failed to fetch connections by type');
    return res.json();
  },

  getById: async (id: number) => {
    const res = await fetch(`${API_BASE_URL}/db-connection/${id}`);
    if (!res.ok) throw new Error('Failed to fetch database connection');
    return res.json();
  },

  create: async (data: any) => {
    const res = await fetch(`${API_BASE_URL}/db-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create database connection');
    return res.json();
  },

  update: async (id: number, data: any) => {
    const res = await fetch(`${API_BASE_URL}/db-connection/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update database connection');
    return res.json();
  },

  delete: async (id: number) => {
    const res = await fetch(`${API_BASE_URL}/db-connection/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete database connection');
  },
};

// Code Template API
export const codeTemplateApi = {
  getAll: async () => {
    const res = await fetch(`${API_BASE_URL}/code-template/all`);
    if (!res.ok) throw new Error('Failed to fetch code templates');
    return res.json();
  },

  getByType: async (type: string) => {
    const res = await fetch(`${API_BASE_URL}/code-template/type/${type}`);
    if (!res.ok) throw new Error('Failed to fetch templates by type');
    return res.json();
  },

  getById: async (id: number) => {
    const res = await fetch(`${API_BASE_URL}/code-template/${id}`);
    if (!res.ok) throw new Error('Failed to fetch code template');
    return res.json();
  },

  getByName: async (name: string) => {
    const res = await fetch(`${API_BASE_URL}/code-template/name/${name}`);
    if (!res.ok) throw new Error('Failed to fetch code template by name');
    return res.json();
  },

  create: async (data: any) => {
    const res = await fetch(`${API_BASE_URL}/code-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create code template');
    return res.json();
  },

  update: async (id: number, data: any) => {
    const res = await fetch(`${API_BASE_URL}/code-template/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update code template');
    return res.json();
  },

  delete: async (id: number) => {
    const res = await fetch(`${API_BASE_URL}/code-template/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete code template');
  },
};

// Document API
export const documentApi = {
  getAll: async () => {
    const res = await fetch(`${API_BASE_URL}/document/all`);
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  getByCategory: async (category: string) => {
    const res = await fetch(`${API_BASE_URL}/document/category/${category}`);
    if (!res.ok) throw new Error('Failed to fetch documents by category');
    return res.json();
  },

  getByType: async (type: string) => {
    const res = await fetch(`${API_BASE_URL}/document/type/${type}`);
    if (!res.ok) throw new Error('Failed to fetch documents by type');
    return res.json();
  },

  getById: async (id: number) => {
    const res = await fetch(`${API_BASE_URL}/document/${id}`);
    if (!res.ok) throw new Error('Failed to fetch document');
    return res.json();
  },

  create: async (data: any) => {
    const res = await fetch(`${API_BASE_URL}/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create document');
    return res.json();
  },

  update: async (id: number, data: any) => {
    const res = await fetch(`${API_BASE_URL}/document/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update document');
    return res.json();
  },

  delete: async (id: number) => {
    const res = await fetch(`${API_BASE_URL}/document/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete document');
  },
};

export const apiService = {
  announcementApi,
  menuApi,
  systemParameterApi,
  suggestionApi,
  configApi,
  dbConnectionApi,
  codeTemplateApi,
  documentApi,
};
