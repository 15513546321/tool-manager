import React, { useState, useEffect, useMemo } from 'react';
import { Search, Activity } from 'lucide-react';
import { getLogs, getIpMappings, LogEntry, IpMapping } from '../services/auditService';

const INPUT_STYLE = "w-full pl-3 pr-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400";

export const AuditLog: React.FC = () => {
  // Log State
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logSearch, setLogSearch] = useState('');
  const [mappings, setMappings] = useState<IpMapping[]>([]);

  useEffect(() => {
    // Fetch logs and mappings from backend
    const fetchData = async () => {
      const fetchedLogs = await getLogs();
      const fetchedMappings = await getIpMappings();
      setLogs(fetchedLogs);
      setMappings(fetchedMappings);
    };
    
    fetchData();
    
    // Refresh logs every few seconds to show live activity
    const interval = setInterval(() => {
      fetchData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Derive logs with dynamic username resolution based on current mappings
  const displayLogs = useMemo(() => {
    return logs.map(log => {
        // Real-time lookup: If mapping exists for this IP, use it. 
        // Otherwise fall back to the username stored at log time (or 'Unknown')
        const mapping = mappings.find(m => m.ip === log.ip);
        return {
            ...log,
            // Priority: Real-time Config > Stored Name > 'Unknown'
            displayName: mapping ? mapping.name : (log.username || 'Unknown User')
        };
    });
  }, [logs, mappings]);

  const filteredLogs = useMemo(() => {
    if (!logSearch) return displayLogs;
    const lower = logSearch.toLowerCase();
    return displayLogs.filter(l => 
      l.displayName.toLowerCase().includes(lower) || 
      l.action.toLowerCase().includes(lower) ||
      l.details.toLowerCase().includes(lower) ||
      l.ip.includes(lower)
    );
  }, [displayLogs, logSearch]);

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">审计日志 & 安全</h2>
           <p className="text-slate-500 text-sm mt-1">监控用户操作轨迹与身份管理</p>
        </div>
      </div>

        <div className="flex-1 flex flex-col space-y-4">
           {/* Search */}
           <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="relative">
                 <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                 <input 
                   className={`${INPUT_STYLE} pl-10`}
                   placeholder="搜索姓名、IP、操作内容..."
                   value={logSearch}
                   onChange={e => setLogSearch(e.target.value)}
                 />
              </div>
           </div>

           {/* Table */}
           <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="overflow-auto flex-1">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 font-semibold text-slate-700">时间</th>
                      <th className="px-6 py-4 font-semibold text-slate-700">操作人 (动态解析)</th>
                      <th className="px-6 py-4 font-semibold text-slate-700">IP地址</th>
                      <th className="px-6 py-4 font-semibold text-slate-700">事项 (菜单 - 按钮)</th>
                      <th className="px-6 py-4 font-semibold text-slate-700">详情</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 text-slate-500 font-mono text-xs">{log.timestamp}</td>
                        <td className="px-6 py-3 font-medium text-slate-800 flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-green-500"></span>
                           {log.displayName}
                        </td>
                        <td className="px-6 py-3 text-slate-500 font-mono">{log.ip}</td>
                        <td className="px-6 py-3">
                           <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold border border-blue-100">
                             {log.action}
                           </span>
                        </td>
                        <td className="px-6 py-3 text-slate-600 truncate max-w-xs" title={log.details}>
                            {log.details}
                        </td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-8 text-slate-400 italic">暂无日志记录</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
    </div>
  );
};