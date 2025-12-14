/**
 * 远程代码配置服务
 * 管理在线仓库配置，支持文档管理和代码生成两个模块共用
 */

export interface RemoteCodeConfig {
  repoUrl: string;
  authType: 'none' | 'http-basic' | 'http-token' | 'ssh-key';
  authUsername?: string;
  authPassword?: string;
  authToken?: string;
  sshKeyContent?: string;
  sshPassphrase?: string;
  branch: string;
  branches: string[];
  isConnected: boolean;
  connectionError?: string;
  lastUpdated?: number;
  cacheKey?: string; // 用于标识缓存的数据
}

export interface RemoteInterface {
  id: string;
  name: string;
  module: string;
  description?: string;
  inputs: any[];
  outputs: any[];
  downstreamCalls: string[];
  filePath?: string;
}

const STORAGE_KEY = 'remoteCodeConfig';
const CACHE_KEY_PREFIX = 'remoteInterfaceCache_';
const CACHE_TTL = 3600000; // 1小时缓存

class RemoteCodeService {
  /**
   * 保存远程代码配置
   */
  saveConfig(config: RemoteCodeConfig): void {
    const configToSave = {
      repoUrl: config.repoUrl,
      authType: config.authType,
      authUsername: config.authUsername,
      branch: config.branch,
      branches: config.branches,
      isConnected: config.isConnected,
      lastUpdated: Date.now(),
      cacheKey: this.generateCacheKey(config.repoUrl, config.branch)
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configToSave));
  }

  /**
   * 加载保存的远程代码配置
   */
  loadConfig(): RemoteCodeConfig | null {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    try {
      return JSON.parse(saved);
    } catch (err) {
      console.error('Failed to parse saved config:', err);
      return null;
    }
  }

  /**
   * 清空配置
   */
  clearConfig(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * 生成缓存key（基于仓库URL和分支）
   */
  private generateCacheKey(repoUrl: string, branch: string): string {
    const hash = btoa(`${repoUrl}:${branch}`).replace(/[^a-zA-Z0-9]/g, '');
    return CACHE_KEY_PREFIX + hash;
  }

  /**
   * 保存接口清单到缓存
   */
  cacheInterfaces(config: RemoteCodeConfig, interfaces: RemoteInterface[]): void {
    const cacheKey = config.cacheKey || this.generateCacheKey(config.repoUrl, config.branch);
    const cacheData = {
      interfaces,
      timestamp: Date.now(),
      repoUrl: config.repoUrl,
      branch: config.branch
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  }

  /**
   * 从缓存获取接口清单
   */
  getCachedInterfaces(config: RemoteCodeConfig): RemoteInterface[] | null {
    const cacheKey = config.cacheKey || this.generateCacheKey(config.repoUrl, config.branch);
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) return null;

    try {
      const data = JSON.parse(cached);
      const age = Date.now() - data.timestamp;
      
      // 检查缓存是否过期
      if (age > CACHE_TTL) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return data.interfaces;
    } catch (err) {
      console.error('Failed to parse cached interfaces:', err);
      return null;
    }
  }

  /**
   * 构建认证请求头
   */
  buildAuthHeaders(config: RemoteCodeConfig): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (config.authType) {
      case 'http-basic':
        if (config.authUsername && config.authPassword) {
          const encoded = btoa(`${config.authUsername}:${config.authPassword}`);
          headers['Authorization'] = `Basic ${encoded}`;
        }
        break;
      case 'http-token':
        if (config.authToken) {
          headers['Authorization'] = `Bearer ${config.authToken}`;
        }
        break;
      case 'ssh-key':
        headers['X-SSH-Key'] = 'configured';
        break;
    }

    return headers;
  }

  /**
   * 验证配置是否有效
   */
  isConfigValid(config: RemoteCodeConfig | null): boolean {
    if (!config) return false;
    if (!config.repoUrl || !config.repoUrl.trim()) return false;
    if (!config.isConnected) return false;
    return true;
  }

  /**
   * 格式化配置为显示文本
   */
  formatConfigDisplay(config: RemoteCodeConfig | null): string {
    if (!config || !config.repoUrl) {
      return '未配置';
    }
    
    const parts = [
      `${config.repoUrl.split('/').pop()}`,
      `(${config.branch})`,
      config.authType !== 'none' ? `[${config.authType}]` : null
    ].filter(Boolean);

    return parts.join(' ');
  }
}

export const remoteCodeService = new RemoteCodeService();
