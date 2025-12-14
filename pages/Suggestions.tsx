import React, { useState, useEffect, useMemo } from 'react';
import { Lightbulb, Plus, X, User, Monitor, Clock } from 'lucide-react';
import { apiService } from '../services/apiService';
import { SuggestionItem } from '../types';
import { getIpMappings, IpMapping } from '../services/auditService';

const INPUT_STYLE = "w-full pl-3 pr-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400";
const LABEL_STYLE = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1";

export const Suggestions: React.FC = () => {
  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [mappings, setMappings] = useState<IpMapping[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '' });
  const [loading, setLoading] = useState(false);

  // Load Data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const suggestions = await apiService.suggestionApi.getAll();
        setItems(suggestions.map((s: any) => ({
          id: s.id.toString(),
          title: s.title,
          description: s.content,
          category: s.category,
          priority: s.priority,
          status: s.status,
          timestamp: new Date(s.createdAt).toLocaleString()
        })));
        const fetchedMappings = await getIpMappings();
        setMappings(fetchedMappings);
      } catch (error) {
        console.error('Failed to load suggestions:', error);
        alert('加载建议失败，请重试');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleAdd = async () => {
    if (!formData.title.trim()) {
        alert('请输入建议标题');
        return;
    }

    try {
      setLoading(true);
      const newSuggestion = {
        title: formData.title,
        content: formData.content,
        category: 'GENERAL',
        priority: 1,
        status: 'NEW'
      };
      
      const created = await apiService.suggestionApi.create(newSuggestion);
      
      // Reload suggestions after adding
      const suggestions = await apiService.suggestionApi.getAll();
      setItems(suggestions.map((s: any) => ({
        id: s.id.toString(),
        title: s.title,
        description: s.content,
        category: s.category,
        priority: s.priority,
        status: s.status,
        timestamp: new Date(s.createdAt).toLocaleString()
      })));
      
      setFormData({ title: '', content: '' });
      setIsModalOpen(false);
      alert('建议已成功提交！');
    } catch (error) {
      console.error('Failed to submit suggestion:', error);
      alert('提交建议失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // Resolve Names Dynamically
  const displayItems = useMemo(() => {
      return items.map(item => {
          const mapping = mappings.find(m => m && m.ip); // Safe mapping access
          return {
              ...item,
              displayName: mapping ? mapping.name : 'System'
          };
      });
  }, [items, mappings]);

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

        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-slate-700 w-48">提交时间</th>
                            <th className="px-6 py-4 font-semibold text-slate-700 w-40">提交人 (IP解析)</th>
                            <th className="px-6 py-4 font-semibold text-slate-700 w-32">IP 地址</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">标题</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">说明</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {displayItems.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-3 text-slate-500 font-mono text-xs flex items-center gap-2">
                                    <Clock size={12}/> {item.timestamp}
                                </td>
                                <td className="px-6 py-3 font-medium text-slate-800">
                                    <div className="flex items-center gap-2">
                                        <User size={14} className="text-blue-400"/>
                                        {item.displayName}
                                    </div>
                                </td>
                                <td className="px-6 py-3 text-slate-500 font-mono text-xs">
                                    <div className="flex items-center gap-2">
                                        <Monitor size={14} className="text-slate-300"/>
                                        {item.ip}
                                    </div>
                                </td>
                                <td className="px-6 py-3 font-bold text-slate-800">{item.title}</td>
                                <td className="px-6 py-3 text-slate-600">{item.description || '-'}</td>
                            </tr>
                        ))}
                        {displayItems.length === 0 && (
                            <tr><td colSpan={5} className="text-center py-10 text-slate-400 italic">暂无建议，欢迎提交！</td></tr>
                        )}
                    </tbody>
                </table>
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