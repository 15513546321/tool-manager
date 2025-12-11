import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2 } from 'lucide-react';
import { getIpMappings, saveIpMappings, IpMapping } from '../../services/auditService';
import { ConfirmModal } from '../../components/ConfirmModal';

const INPUT_STYLE = "w-full pl-3 pr-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400";

export const IpConfig: React.FC = () => {
  const [mappings, setMappings] = useState<IpMapping[]>([]);
  const [newIp, setNewIp] = useState('');
  const [newName, setNewName] = useState('');
  
  // Confirmation State
  const [confirmState, setConfirmState] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    const fetchMappings = async () => {
      const data = await getIpMappings();
      setMappings(data);
    };
    fetchMappings();
  }, []);

  const handleAddMapping = async () => {
    if (newIp && newName) {
      // Basic validation: Check if IP already exists
      if (mappings.some(m => m.ip === newIp)) {
          alert('该 IP 地址已存在配置。');
          return;
      }
      try {
        await saveIpMappings([{ ip: newIp, name: newName }]);
        const updated = [...mappings, { ip: newIp, name: newName }];
        setMappings(updated);
        setNewIp('');
        setNewName('');
      } catch (err) {
        alert('添加失败');
      }
    }
  };

  const handleDeleteMapping = (ip: string) => {
    setConfirmState({
        isOpen: true,
        title: '删除 IP 映射',
        message: `确定要删除 IP [${ip}] 的映射配置吗？`,
        onConfirm: async () => {
            try {
              const updated = mappings.filter(m => m.ip !== ip);
              setMappings(updated);
              // Call backend to delete
              const resp = await fetch(`/api/ip-mappings/${encodeURIComponent(ip)}`, {
                method: 'DELETE',
                credentials: 'include'
              });
              if (!resp.ok) {
                alert('删除失败');
                setMappings(mappings); // Restore
              }
            } catch (err) {
              alert('删除失败');
              setMappings(mappings); // Restore
            }
        }
    });
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50">
        <ConfirmModal 
            isOpen={confirmState.isOpen}
            onClose={() => setConfirmState(prev => ({...prev, isOpen: false}))}
            onConfirm={confirmState.onConfirm}
            title={confirmState.title}
            message={confirmState.message}
            type="danger"
            confirmText="删除"
        />

        <div className="flex justify-between items-center mb-6">
            <div>
            <h2 className="text-2xl font-bold text-slate-800">IP 映射配置</h2>
            <p className="text-slate-500 text-sm mt-1">管理系统 IP 地址与真实姓名的映射关系</p>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-4xl mx-auto w-full">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Shield size={20} className="text-purple-600"/>
                配置管理
            </h3>
            <p className="text-slate-500 text-sm mb-6">配置生效后，审计日志和优化建议中的操作人姓名将根据此表实时更新。</p>

            {/* Add Form */}
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 mb-6 flex gap-4 items-end">
                <div className="flex-1">
                    <label className="text-xs font-bold text-purple-800 uppercase mb-1 block">IP 地址</label>
                    <input 
                        className={INPUT_STYLE} 
                        placeholder="e.g. 192.168.1.50" 
                        value={newIp} 
                        onChange={e => setNewIp(e.target.value)}
                    />
                </div>
                <div className="flex-1">
                    <label className="text-xs font-bold text-purple-800 uppercase mb-1 block">姓名 / 描述</label>
                    <input 
                        className={INPUT_STYLE} 
                        placeholder="e.g. 张三" 
                        value={newName} 
                        onChange={e => setNewName(e.target.value)}
                    />
                </div>
                <button 
                    onClick={handleAddMapping}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors mb-[1px]"
                >
                    <Plus size={18} /> 添加映射
                </button>
            </div>

            {/* List */}
            <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 font-semibold text-slate-700">IP 地址</th>
                            <th className="px-6 py-3 font-semibold text-slate-700">对应姓名</th>
                            <th className="px-6 py-3 font-semibold text-slate-700 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {mappings.map(m => (
                            <tr key={m.ip} className="hover:bg-slate-50">
                                <td className="px-6 py-3 font-mono text-slate-600">{m.ip}</td>
                                <td className="px-6 py-3 font-bold text-slate-800">{m.name}</td>
                                <td className="px-6 py-3 text-right">
                                    <button 
                                        onClick={() => handleDeleteMapping(m.ip)}
                                        className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                         {mappings.length === 0 && (
                            <tr><td colSpan={3} className="text-center py-6 text-slate-400">暂无配置</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-6 p-4 bg-slate-50 rounded-lg text-xs text-slate-500 border border-slate-200">
                <p className="font-bold mb-1">当前会话信息 (调试用):</p>
                <p>Mock IP: {localStorage.getItem('mock_client_device_ip') || 'Not Set'}</p>
            </div>
        </div>
    </div>
  );
};