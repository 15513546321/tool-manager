import React, { useState, useEffect, useMemo } from 'react';
import { Lightbulb, Plus, X, Search } from 'lucide-react';
import { apiService } from '../services/apiService';
import { getIpMappings, IpMapping } from '../services/auditService';
import { Pagination } from '../components/Pagination';
import { SuggestionItem } from '../types';

const INPUT_STYLE = "w-full pl-3 pr-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400";
const LABEL_STYLE = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1";

export const Suggestions: React.FC = () => {
  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<IpMapping[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Load Data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [suggestions, ipMappings] = await Promise.all([
          apiService.suggestionApi.getAll(),
          getIpMappings()
        ]);
        setMappings(ipMappings);
        setItems(suggestions.map((s: any) => ({
          id: s.id.toString(),
          title: s.title,
          description: s.content,
          ip: s.ipAddress || 'Unknown IP',
          timestamp: new Date(s.createdAt).toLocaleString()
        })));
      } catch (error) {
        console.error('Failed to load suggestions:', error);
        setError('加载建议失败，请重试');
      } finally {
        setLoading(false);
      }
    };
    loadData();
    
    // Refresh data every 5 seconds to show live activity
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Derive display items with dynamic IP mapping resolution
  // Priority: Real-time Config > Stored Name > 'Unknown User'
  const displayItems = useMemo(() => {
    return items.map(item => {
      const mapping = mappings.find(m => m.ip === item.ip);
      return {
        ...item,
        displayName: mapping ? mapping.name : 'Unknown User'
      };
    });
  }, [items, mappings]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchFilter) return displayItems;
    const lower = searchFilter.toLowerCase();
    return displayItems.filter(item => 
      item.displayName.toLowerCase().includes(lower) || 
      item.title.toLowerCase().includes(lower) ||
      item.description.toLowerCase().includes(lower) ||
      item.ip.includes(lower)
    );
  }, [displayItems, searchFilter]);

  // Compute pagination
  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages || 1)));
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleAdd = async () => {
    if (!formData.title.trim()) {
        alert('请输入建议标题');
        return;
    }

    try {
      setLoading(true);
      setError(null);
      const newSuggestion = {
        title: formData.title,
        content: formData.content,
        category: 'GENERAL',
        priority: 1,
        status: 'NEW'
      };
      
      const created = await apiService.suggestionApi.create(newSuggestion);
      
      // Reload suggestions and mappings after adding
      const [suggestions, ipMappings] = await Promise.all([
        apiService.suggestionApi.getAll(),
        getIpMappings()
      ]);
      setMappings(ipMappings);
      setItems(suggestions.map((s: any) => ({
        id: s.id.toString(),
        title: s.title,
        description: s.content,
        ip: s.ipAddress || 'Unknown IP',
        timestamp: new Date(s.createdAt).toLocaleString()
      })));
      
      setFormData({ title: '', content: '' });
      setIsModalOpen(false);
      alert('建议已成功提交！');
    } catch (error) {
      console.error('Failed to submit suggestion:', error);
      setError('提交建议失败，请重试');
      alert('提交建议失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Lightbulb className="text-yellow-500" /> 优化建议
           </h2>
           <p className="text-slate-500 text-sm mt-1">收集用户对平台的改进建议与反馈</p>
        </div>
        <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors"
        >
            <Plus size={18} /> 提交建议
        </button>
      </div>

      <div className="flex-1 flex flex-col space-y-4">
         {/* Search */}
         <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="relative">
               <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
               <input 
                 className={`${INPUT_STYLE} pl-10`}
                 placeholder="搜索提交人、标题、内容或IP..."
                 value={searchFilter}
                 onChange={e => {
                   setSearchFilter(e.target.value);
                   setCurrentPage(1);
                 }}
               />
            </div>
         </div>

         {/* Table */}
         <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            {error && (
                <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-red-700 text-sm">
                    ⚠️ {error}
                </div>
            )}
            {loading && (
                <div className="px-6 py-3 bg-blue-50 border-b border-blue-200 text-blue-700 text-sm">
                    加载中...
                </div>
            )}
            <div className="overflow-auto flex-1">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-slate-700">提交时间</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">提交人 IP</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">提交人 (动态解析)</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">标题</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">说明</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginatedItems.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-3 text-slate-500 font-mono text-xs">{item.timestamp}</td>
                                <td className="px-6 py-3 text-slate-500 font-mono">{item.ip}</td>
                                <td className="px-6 py-3 font-medium text-slate-800 flex items-center gap-2">
                                   <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                   {item.displayName}
                                </td>
                                <td className="px-6 py-3 font-bold text-slate-800">{item.title}</td>
                                <td className="px-6 py-3 text-slate-600 truncate max-w-xs" title={item.description}>{item.description || '-'}</td>
                            </tr>
                        ))}
                        {paginatedItems.length === 0 && !loading && (
                            <tr><td colSpan={5} className="text-center py-8 text-slate-400 italic">暂无建议，欢迎提交！</td></tr>
                        )}
                    </tbody>
                </table>
              </div>
              {filteredItems.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={filteredItems.length}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              )}
           </div>
        </div>

        {/* Add Modal */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="text-lg font-bold text-slate-800">提交优化建议</h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className={LABEL_STYLE}>标题 (必填)</label>
                            <input 
                                className={INPUT_STYLE} 
                                placeholder="简要描述您的建议..." 
                                value={formData.title}
                                onChange={e => setFormData({...formData, title: e.target.value})}
                                disabled={loading}
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className={LABEL_STYLE}>详细说明 (可选)</label>
                            <textarea 
                                className={INPUT_STYLE} 
                                rows={4}
                                placeholder="请提供更多细节..." 
                                value={formData.content}
                                onChange={e => setFormData({...formData, content: e.target.value})}
                                disabled={loading}
                            />
                        </div>
                        <div className="text-xs text-slate-400 bg-slate-50 p-2 rounded border border-slate-100">
                            系统将自动记录建议，使用的是后端数据库存储。
                        </div>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            disabled={loading}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                        >
                            取消
                        </button>
                        <button 
                            onClick={handleAdd}
                            disabled={loading}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-colors disabled:opacity-50"
                        >
                            {loading ? '提交中...' : '提交'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};