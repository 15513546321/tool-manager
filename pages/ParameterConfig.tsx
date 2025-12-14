import React, { useState, useMemo, useEffect } from 'react';
import { ParameterConfig } from '../types';
import { Plus, Trash2, Filter, Search, X } from 'lucide-react';
import { Database, TABLE } from '../services/database';
import { ConfirmModal } from '../components/ConfirmModal';
import { systemParameterApi } from '../services/apiService';

const mockParams: ParameterConfig[] = [
  { id: '1', category: 'System', subCategory: 'Timeout', key: 'SESSION_TIMEOUT', value: '3000', description: 'Session timeout in seconds' },
  { id: '2', category: 'System', subCategory: 'Security', key: 'MAX_RETRY', value: '3', description: 'Max login retries' },
  { id: '3', category: 'Business', subCategory: 'Fees', key: 'TRANSFER_FEE', value: '1.50', description: 'Default fee' },
];

const INPUT_STYLE = "w-full p-2 border border-slate-200 rounded mt-1 bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400";

export const ParameterConfigPage: React.FC = () => {
  const [params, setParams] = useState<ParameterConfig[]>(mockParams);
  
  // Filter States
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subCategoryFilter, setSubCategoryFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  
  // New Param State
  const [isAdding, setIsAdding] = useState(false);
  const [newParam, setNewParam] = useState<Partial<ParameterConfig>>({ category: 'System', subCategory: 'General' });

  // Confirmation State
  const [confirmState, setConfirmState] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Init Data from API
  useEffect(() => {
    const loadParams = async () => {
      try {
        const data = await systemParameterApi.getAll();
        // Convert API response to ParameterConfig format
        const converted = data.map((param: any) => ({
          id: param.id.toString(),
          category: param.category || 'System',
          subCategory: param.paramType || 'General',
          key: param.paramKey,
          value: param.paramValue,
          description: param.description || ''
        }));
        setParams(converted);
      } catch (error) {
        console.error('Failed to load parameters:', error);
        setParams(mockParams);
      }
    };
    loadParams();
  }, []);

  const saveParams = async (newParams: ParameterConfig[]) => {
    setParams(newParams);
    try {
      for (const param of newParams) {
        await systemParameterApi.save({
          paramKey: param.key,
          paramValue: param.value,
          paramType: param.subCategory,
          description: param.description,
          category: param.category,
          updatedBy: 'admin'
        });
      }
    } catch (error) {
      console.error('Failed to save parameters:', error);
    }
  };

  // Compute unique categories
  const categories = useMemo(() => {
    return Array.from(new Set(params.map(p => p.category))).sort();
  }, [params]);

  // Compute unique sub-categories based on selected category
  const subCategories = useMemo(() => {
    let source = params;
    if (categoryFilter) {
      source = source.filter(p => p.category === categoryFilter);
    }
    return Array.from(new Set(source.map(p => p.subCategory))).sort();
  }, [params, categoryFilter]);

  const filteredParams = params.filter(p => {
    const matchesCategory = categoryFilter ? p.category === categoryFilter : true;
    const matchesSubCategory = subCategoryFilter ? p.subCategory === subCategoryFilter : true;
    const matchesSearch = searchFilter ? (
      p.key.toLowerCase().includes(searchFilter.toLowerCase()) || 
      p.value.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.description.toLowerCase().includes(searchFilter.toLowerCase())
    ) : true;

    return matchesCategory && matchesSubCategory && matchesSearch;
  });

  const handleAdd = () => {
    if (newParam.key && newParam.value && newParam.category) {
      saveParams([...params, { ...newParam, id: Date.now().toString() } as ParameterConfig]);
      setIsAdding(false);
      setNewParam({ category: 'System', subCategory: 'General' });
    }
  };

  const handleDelete = (id: string) => {
    const paramToDelete = params.find(p => p.id === id);
    setConfirmState({
        isOpen: true,
        title: '删除参数',
        message: '确定要删除此参数吗？',
        onConfirm: async () => {
            try {
              if (paramToDelete) {
                await systemParameterApi.delete(paramToDelete.key);
              }
              saveParams(params.filter(p => p.id !== id));
            } catch (error) {
              console.error('Failed to delete parameter:', error);
            }
        }
    });
  };

  return (
    <div className="p-6">
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({...prev, isOpen: false}))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type="danger"
        confirmText="删除"
      />

      <div className="flex justify-between items-end mb-6">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">参数配置</h2>
           <p className="text-slate-500 text-sm mt-1">管理系统业务参数键值对</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          新增参数
        </button>
      </div>

      {isAdding && (
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6 grid grid-cols-1 md:grid-cols-5 gap-4 items-end animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="text-xs font-bold text-blue-800 uppercase">大类 (Category)</label>
            <input className={INPUT_STYLE} placeholder="Category" value={newParam.category} onChange={e => setNewParam({...newParam, category: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-bold text-blue-800 uppercase">小类 (Sub-Cat)</label>
            <input className={INPUT_STYLE} placeholder="Sub-Cat" value={newParam.subCategory} onChange={e => setNewParam({...newParam, subCategory: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-bold text-blue-800 uppercase">键 (Key)</label>
            <input className={INPUT_STYLE} placeholder="KEY_NAME" value={newParam.key} onChange={e => setNewParam({...newParam, key: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-bold text-blue-800 uppercase">值 (Value)</label>
            <input className={INPUT_STYLE} placeholder="Value" value={newParam.value} onChange={e => setNewParam({...newParam, value: e.target.value})} />
          </div>
          <button onClick={handleAdd} className="bg-blue-600 text-white h-[38px] rounded px-4 font-medium hover:bg-blue-700 mb-[2px] shadow-sm">保存</button>
        </div>
      )}

      {/* Filter Section */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
           <Filter size={14} />
           筛选查询
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
           {/* Category Select */}
           <div className="md:col-span-3">
             <select 
               value={categoryFilter}
               onChange={(e) => {
                 setCategoryFilter(e.target.value);
                 setSubCategoryFilter('');
               }}
               className={INPUT_STYLE}
             >
               <option value="">所有大类</option>
               {categories.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
           </div>
           
           {/* SubCategory Select */}
           <div className="md:col-span-3">
             <select 
               value={subCategoryFilter}
               onChange={(e) => setSubCategoryFilter(e.target.value)}
               className={INPUT_STYLE}
             >
               <option value="">所有小类</option>
               {subCategories.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
           </div>

           {/* Search Input */}
           <div className="md:col-span-6 relative">
             <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
             <input 
               className={`${INPUT_STYLE} pl-10`}
               placeholder="搜索键、值或描述..."
               value={searchFilter}
               onChange={e => setSearchFilter(e.target.value)}
             />
             {searchFilter && (
                <button 
                  onClick={() => setSearchFilter('')}
                  className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
             )}
           </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
             <tr>
               <th className="px-6 py-4 font-semibold text-slate-700">大类</th>
               <th className="px-6 py-4 font-semibold text-slate-700">小类</th>
               <th className="px-6 py-4 font-semibold text-slate-700">键</th>
               <th className="px-6 py-4 font-semibold text-slate-700">值</th>
               <th className="px-6 py-4 font-semibold text-slate-700">操作</th>
             </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredParams.length > 0 ? filteredParams.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 font-medium text-slate-800">{p.category}</td>
                <td className="px-6 py-3 text-slate-600">{p.subCategory}</td>
                <td className="px-6 py-3 font-mono text-blue-600">{p.key}</td>
                <td className="px-6 py-3 text-slate-700">{p.value}</td>
                <td className="px-6 py-3">
                  <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-600" title="删除">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                  没有找到匹配的参数
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};