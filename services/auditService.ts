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

// 🔧 获取客户端真实IP地址（JAR直接部署场景）
// 前端调用此函数获取用户IP，然后在后续API调用时传递给后端
const getClientIp = async (): Promise<string> => {
  try {
    const resp = await fetch(`${API_BASE}/client-ip`, { credentials: 'include' });
    if (resp.ok) {
      const data = await resp.json();
      // 返回 remoteAddr（这就是客户端真实IP）
      return data.remoteAddr || data.ip || '0.0.0.0';
    }
  } catch (err) {
    console.error('Failed to get client IP:', err);
  }
  return '0.0.0.0';
};

// 记录操作日志（前端先获取真实IP，然后传递给后端）
export const recordAction = async (action: string, details: string) => {
  try {
    // 🔧 优化：前端先获取客户端真实IP，然后传递给后端
    const clientIp = await getClientIp();
    
    await fetch(`${API_BASE}/audit/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, details, ip: clientIp }),  // 添加 ip 参数
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