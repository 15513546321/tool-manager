// services/auditService.ts

export interface LogEntry {
  id: string;
  timestamp: string;
  ip: string;
  username: string;
  action: string;
  details: string;
}

export interface IpMapping {
  id?: number;
  ip: string;
  name: string;
}

const API_BASE = '/api';

// 记录操作日志（后端自动获取真实IP）
export const recordAction = async (action: string, details: string) => {
  try {
    await fetch(`${API_BASE}/audit/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, details }),
    });
  } catch (err) {
    console.error('Failed to record action:', err);
  }
};

// 获取全部日志
export const getLogs = async (): Promise<LogEntry[]> => {
  try {
    const resp = await fetch(`${API_BASE}/audit/logs`, { credentials: 'include' });
    if (resp.ok) {
      return await resp.json();
    }
  } catch (err) {
    console.error('Failed to fetch logs:', err);
  }
  return [];
};

// 获取全部IP映射
export const getIpMappings = async (): Promise<IpMapping[]> => {
  try {
    const resp = await fetch(`${API_BASE}/ip-mappings`, { credentials: 'include' });
    if (resp.ok) {
      return await resp.json();
    }
  } catch (err) {
    console.error('Failed to fetch IP mappings:', err);
  }
  return [];
};

// 新增IP映射
export const saveIpMappings = async (mappings: IpMapping[]) => {
  for (const mapping of mappings) {
    try {
      await fetch(`${API_BASE}/ip-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ip: mapping.ip, name: mapping.name }),
      });
    } catch (err) {
      console.error(`Failed to save mapping ${mapping.ip}:`, err);
    }
  }
};

// 删除IP映射
export const deleteIpMapping = async (ip: string) => {
  try {
    await fetch(`${API_BASE}/ip-mappings/${encodeURIComponent(ip)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch (err) {
    console.error('Failed to delete IP mapping:', err);
  }
};

// 获取当前客户端真实IP
export const getCurrentIp = async (): Promise<string> => {
  try {
    const resp = await fetch(`${API_BASE}/client-ip`, { credentials: 'include' });
    if (resp.ok) {
      const data = await resp.json();
      return data.ip;
    }
  } catch (err) {
    console.error('Failed to fetch client IP:', err);
  }
  return '';
};

// 同步函数（为兼容旧代码）
export const getNameByIp = (ip: string, mappings: IpMapping[]): string => {
  const found = mappings.find(m => m.ip === ip);
  return found ? found.name : 'Unknown Device';
};