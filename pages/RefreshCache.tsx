import React, { useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';

type EnvType = 'sit' | 'uat' | 'pp';

interface AppInfo {
  name: string;
  label: string;
}

interface CacheItem {
  id: number;
  cacheName: string;
  cacheEnglishName: string;
}

const ENV_OPTIONS: { value: EnvType; label: string }[] = [
  { value: 'sit', label: '测试环境 (sit)' },
  { value: 'uat', label: '业务验收环境（uat）' },
  { value: 'pp', label: '生产环境 (pp)' },
];

const APP_OPTIONS: AppInfo[] = [
  { name: 'param', label: '参数中心' },
  { name: 'channel', label: '渠道中心' },
  { name: 'customer', label: '用户中心' },
  { name: 'router', label: '内联中心' },
  { name: 'forex', label: '外汇中心' },
];

export const RefreshCache: React.FC = () => {
  const [env, setEnv] = useState<EnvType>('sit');
  const [appName, setAppName] = useState<string>(APP_OPTIONS[0].name);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [cacheList, setCacheList] = useState<CacheItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // ✅ 获取 token（正确写法）
  const getToken = () => localStorage.getItem('accessToken') || '';

  // ✅ 带认证的请求（放在组件内，能拿到最新 token）
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = getToken();
    const headers = new Headers(options.headers || {});

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  };

  // 查询列表
  const handleSearch = async () => {
    setLoading(true);
    setResult(null);
    setHasSearched(true);
    setCacheList([]);

    try {
      const res = await fetchWithAuth('/api/apps/qryList', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ env, appName }),
      });

      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const data = await res.json();

      if (data.code === 0 || data.success) {
        setCacheList(data.data || []);
      } else {
        throw new Error(data.message || '查询失败');
      }
    } catch (err: any) {
      setResult({ type: 'error', msg: err.message || '查询异常' });
    } finally {
      setLoading(false);
    }
  };

  // 刷新单个缓存
  const handleRefreshItem = async (item: CacheItem) => {
    setListLoading(true);
    setResult(null);

    try {
      const res = await fetchWithAuth('/api/apps/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          env,
          appName,
          cacheName: item.cacheEnglishName,
        }),
      });

      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const data = await res.json();

      if (data.code === 0 || data.success) {
        setResult({
          type: 'success',
          msg: `【${item.cacheName}】刷新成功`,
        });
      } else {
        throw new Error(data.message || '刷新失败');
      }
    } catch (err: any) {
      setResult({ type: 'error', msg: err.message || '刷新异常' });
    } finally {
      setListLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .app-refresh-container {
          max-width: 900px;
          margin: 40px auto;
          padding: 24px;
        }
        .app-refresh-box {
          padding: 24px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          margin-bottom: 24px;
        }
        .app-refresh-box h2 {
          margin-bottom: 20px;
          font-size: 20px;
          color: #1e293b;
        }
        .search-row {
          display: flex;
          align-items: flex-end;
          gap: 16px;
          flex-wrap: wrap;
        }
        .search-form-item {
          display: flex;
          flex-direction: column;
          min-width: 200px;
          flex: 1;
        }
        .search-form-item label {
          margin-bottom: 6px;
          font-size: 14px;
          color: #475569;
          font-weight: 500;
        }
        .search-form-item select {
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 14px;
          background: #fff;
          cursor: pointer;
          height: 38px;
        }
        .search-form-item select:focus {
          outline: none;
          border-color: #2563eb;
        }
        .search-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 20px;
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 15px;
          cursor: pointer;
          transition: background 0.2s;
          height: 38px;
        }
        .search-btn:hover:not(:disabled) {
          background: #1d4ed8;
        }
        .search-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }
        .refresh-result {
          margin-top: 16px;
          padding: 12px;
          border-radius: 6px;
          font-size: 14px;
        }
        .refresh-result.success {
          background: #dcfce7;
          color: #166534;
          border: 1px solid #86efac;
        }
        .refresh-result.error {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fca5a5;
        }
        .cache-table-box {
          padding: 24px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .cache-table-box h3 {
          margin-bottom: 16px;
          font-size: 16px;
          color: #1e293b;
        }
        .cache-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .cache-table th {
          background: #f8fafc;
          color: #475569;
          font-weight: 600;
          text-align: left;
          padding: 12px 16px;
          border-bottom: 1px solid #e2e8f0;
        }
        .cache-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
        }
        .cache-table tr:hover td {
          background: #f8fafc;
        }
        .cache-table .col-index {
          width: 60px;
          text-align: center;
        }
        .cache-table .col-name {
          width: 200px;
        }
        .cache-table .col-ename {
          width: 250px;
        }
        .cache-table .col-action {
          width: 100px;
          text-align: center;
        }
        .refresh-item-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 12px;
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .refresh-item-btn:hover:not(:disabled) {
          background: #1d4ed8;
        }
        .refresh-item-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }
        .empty-state {
          text-align: center;
          padding: 40px;
          color: #94a3b8;
          font-size: 14px;
        }
      `}</style>

      <div className="app-refresh-container">
        <div className="app-refresh-box">
          <h2>应用缓存刷新</h2>

          <div className="search-row">
            <div className="search-form-item">
              <label>选择环境</label>
              <select value={env} onChange={e => setEnv(e.target.value as EnvType)}>
                {ENV_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="search-form-item">
              <label>选择应用</label>
              <select value={appName} onChange={e => setAppName(e.target.value)}>
                {APP_OPTIONS.map(app => (
                  <option key={app.name} value={app.name}>{app.label}</option>
                ))}
              </select>
            </div>

            <button
              className="search-btn"
              onClick={handleSearch}
              disabled={loading}
            >
              <Search size={16} />
              {loading ? '查询中...' : '查询'}
            </button>
          </div>

          {result && (
            <div className={`refresh-result ${result.type}`}>
              {result.msg}
            </div>
          )}
        </div>

        {hasSearched && (
          <div className="cache-table-box">
            <h3>缓存列表</h3>
            {cacheList.length > 0 ? (
              <table className="cache-table">
                <thead>
                  <tr>
                    <th className="col-index">序号</th>
                    <th className="col-name">缓存名称</th>
                    <th className="col-ename">缓存英文名</th>
                    <th className="col-action">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {cacheList.map((item, index) => (
                    <tr key={item.id}>
                      <td className="col-index">{index + 1}</td>
                      <td className="col-name">{item.cacheName}</td>
                      <td className="col-ename">{item.cacheEnglishName}</td>
                      <td className="col-action">
                        <button
                          className="refresh-item-btn"
                          onClick={() => handleRefreshItem(item)}
                          disabled={listLoading}
                        >
                          <RefreshCw size={13} />
                          刷新
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                {loading ? '加载中...' : '暂无数据'}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};