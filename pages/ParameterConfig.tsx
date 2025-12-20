import React, { useState, useMemo, useEffect } from 'react';
import { ParameterConfig } from '../types';
import { Plus, Trash2, Filter, Search, X, Edit2, Save, ExternalLink, Settings, Check, Edit } from 'lucide-react';
import { Database, TABLE } from '../services/database';
import { ConfirmModal } from '../components/ConfirmModal';
import { Pagination } from '../components/Pagination';
import { systemParameterApi } from '../services/apiService';
import { recordAction } from '../services/auditService';

const mockParams: ParameterConfig[] = [
  { id: '1', category: 'System', subCategory: 'Timeout', key: 'SESSION_TIMEOUT', value: '3000', description: 'Session timeout in seconds' },
  { id: '2', category: 'System', subCategory: 'Security', key: 'MAX_RETRY', value: '3', description: 'Max login retries' },
  { id: '3', category: 'Business', subCategory: 'Fees', key: 'TRANSFER_FEE', value: '1.50', description: 'Default fee' },
];

const INPUT_STYLE = "w-full p-2 border border-slate-200 rounded mt-1 bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400";

const INLINE_INPUT_STYLE = "w-full px-2 py-1 border border-slate-200 rounded bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none text-xs text-slate-700 transition-all";

export const ParameterConfigPage: React.FC = () => {
  const [params, setParams] = useState<ParameterConfig[]>(mockParams);
  
  // Filter States
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subCategoryFilter, setSubCategoryFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  
  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // New Param State
  const [isAdding, setIsAdding] = useState(false);
  const [newParam, setNewParam] = useState<Partial<ParameterConfig>>({ category: 'System', subCategory: 'General' });

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ParameterConfig>>({});

  // Category Management Modal State
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [categoryMap, setCategoryMap] = useState<Record<string, string[]>>({});
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [selectedCatForEdit, setSelectedCatForEdit] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newSubCatName, setNewSubCatName] = useState('');
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatValue, setEditCatValue] = useState('');
  const [editingSubCat, setEditingSubCat] = useState<string | null>(null);
  const [editSubCatValue, setEditSubCatValue] = useState('');

  // Confirmation State
  const [confirmState, setConfirmState] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      type?: 'danger' | 'warning' | 'info';
      onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Init Data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoadingCategories(true);
        
        // Load parameters
        const paramData = await systemParameterApi.getAll();
        const converted = paramData.map((param: any) => ({
          id: param.id.toString(),
          category: param.category || 'System',
          subCategory: param.paramType || 'General',
          key: param.paramKey,
          value: param.paramValue,
          description: param.description || ''
        }));
        setParams(converted);
        
        // Load categories from API
        try {
          const catData = await systemParameterApi.getCategories();
          setCategoryMap(catData || {});
        } catch (e) {
          // If API doesn't exist or fails, build from parameters
          const map: Record<string, string[]> = {};
          converted.forEach((p: ParameterConfig) => {
            if (!map[p.category]) map[p.category] = [];
            if (!map[p.category].includes(p.subCategory)) {
              map[p.category].push(p.subCategory);
            }
          });
          setCategoryMap(map);
        }
      } catch (error) {
        console.error('Failed to load parameters:', error);
        setParams(mockParams);
        // Initialize categoryMap from mock params
        const map: Record<string, string[]> = {};
        mockParams.forEach(p => {
          if (!map[p.category]) map[p.category] = [];
          if (!map[p.category].includes(p.subCategory)) {
            map[p.category].push(p.subCategory);
          }
        });
        setCategoryMap(map);
      } finally {
        setIsLoadingCategories(false);
      }
    };
    loadData();
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

  // Compute unique categories from categoryMap
  const categories = useMemo(() => {
    return Object.keys(categoryMap).sort();
  }, [categoryMap]);

  // Compute unique sub-categories based on selected category
  const subCategories = useMemo(() => {
    if (categoryFilter && categoryMap[categoryFilter]) {
      return categoryMap[categoryFilter];
    }
    // Show all subcategories if no filter
    const allSubs = new Set<string>();
    Object.values(categoryMap).forEach(subs => subs.forEach(s => allSubs.add(s)));
    return Array.from(allSubs).sort();
  }, [categoryMap, categoryFilter]);

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

  // Compute pagination
  const totalPages = Math.ceil(filteredParams.length / pageSize);
  const paginatedParams = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredParams.slice(start, start + pageSize);
  }, [filteredParams, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages || 1)));
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleAdd = () => {
    if (newParam.key && newParam.value && newParam.category) {
      saveParams([...params, { ...newParam, id: Date.now().toString() } as ParameterConfig]);
      recordAction('系统设置 - 参数配置', `添加参数: ${newParam.key}=${newParam.value}`);
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
                recordAction('系统设置 - 参数配置', `删除参数: ${paramToDelete.key}`);
              }
              saveParams(params.filter(p => p.id !== id));
            } catch (error) {
              console.error('Failed to delete parameter:', error);
            }
        }
    });
  };

  // Check if value is a URL
  const isUrl = (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  // Handle edit start
  const handleEditStart = (param: ParameterConfig) => {
    setEditingId(param.id);
    setEditForm({ ...param });
  };

  // Handle edit save
  const handleEditSave = async (paramId: string) => {
    const originalParam = params.find(p => p.id === paramId);
    if (!originalParam) return;

    try {
      // Update local state
      const updatedParams = params.map(p =>
        p.id === paramId ? { ...p, ...editForm } : p
      );
      
      // Save to database
      await systemParameterApi.save({
        paramKey: editForm.key || originalParam.key,
        paramValue: editForm.value || originalParam.value,
        paramType: editForm.subCategory || originalParam.subCategory,
        description: editForm.description || originalParam.description,
        category: editForm.category || originalParam.category,
        updatedBy: 'admin'
      });

      saveParams(updatedParams);
      recordAction('系统设置 - 参数配置', `修改参数: ${editForm.key || originalParam.key}`);
      setEditingId(null);
      setEditForm({});
    } catch (error) {
      console.error('Failed to save parameter:', error);
      alert('保存失败，请重试');
    }
  };

  // Handle edit cancel
  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  // Handle category rename
  // Handle category save
  const handleCategorySave = async (newMap: Record<string, string[]>) => {
    setCategoryMap(newMap);
    try {
      await systemParameterApi.saveCategories(newMap);
      recordAction('Save Parameter Categories', `Updated parameter categories`);
    } catch (error) {
      console.error('Failed to save categories:', error);
      alert('保存分类失败');
    }
  };

  // Handle add category
  const handleAddCategory = () => {
    if (newCatName && !categoryMap[newCatName]) {
      const newMap = { ...categoryMap, [newCatName]: [] };
      handleCategorySave(newMap);
      setNewCatName('');
    }
  };

  // Handle delete category
  const handleDeleteCategory = (cat: string) => {
    const hasLinkedParams = params.some(p => p.category === cat);
    if (hasLinkedParams) {
      const count = params.filter(p => p.category === cat).length;
      alert(`无法删除：该分类下有 ${count} 个参数。请先修改或删除这些参数。`);
      return;
    }

    setConfirmState({
      isOpen: true,
      title: '删除大类',
      message: `确定要删除大类 "${cat}" 吗?`,
      type: 'danger',
      onConfirm: () => {
        const { [cat]: removed, ...rest } = categoryMap;
        handleCategorySave(rest);
        if (selectedCatForEdit === cat) setSelectedCatForEdit(null);
      }
    });
  };

  // Handle rename category
  const handleRenameCategory = (oldName: string) => {
    if (!editCatValue || editCatValue === oldName) {
      setEditingCat(null);
      return;
    }
    if (categoryMap[editCatValue]) {
      alert('该分类名称已存在');
      return;
    }

    setConfirmState({
      isOpen: true,
      title: '重命名分类',
      message: `确定要将 "${oldName}" 重命名为 "${editCatValue}" 吗? 这将更新所有关联参数。`,
      onConfirm: () => {
        const { [oldName]: subs, ...rest } = categoryMap;
        const newMap = { ...rest, [editCatValue]: subs };
        handleCategorySave(newMap);

        const updatedParams = params.map(p => p.category === oldName ? { ...p, category: editCatValue } : p);
        saveParams(updatedParams);

        if (selectedCatForEdit === oldName) setSelectedCatForEdit(editCatValue);
        setEditingCat(null);
      }
    });
  };

  // Handle add sub-category
  const handleAddSubCategory = () => {
    if (selectedCatForEdit && newSubCatName && !categoryMap[selectedCatForEdit].includes(newSubCatName)) {
      const updatedList = [...categoryMap[selectedCatForEdit], newSubCatName];
      const newMap = { ...categoryMap, [selectedCatForEdit]: updatedList };
      handleCategorySave(newMap);
      setNewSubCatName('');
    }
  };

  // Handle delete sub-category
  const handleDeleteSubCategory = (cat: string, sub: string) => {
    const hasLinkedParams = params.some(p => p.category === cat && p.subCategory === sub);
    if (hasLinkedParams) {
      const count = params.filter(p => p.category === cat && p.subCategory === sub).length;
      alert(`无法删除：该分类下有 ${count} 个参数。请先修改或删除这些参数。`);
      return;
    }

    setConfirmState({
      isOpen: true,
      title: '删除小类',
      message: `确定要删除小类 "${sub}" 吗?`,
      type: 'danger',
      onConfirm: () => {
        const updatedList = categoryMap[cat].filter(s => s !== sub);
        const newMap = { ...categoryMap, [cat]: updatedList };
        handleCategorySave(newMap);
      }
    });
  };

  // Handle rename sub-category
  const handleRenameSubCategory = (cat: string, oldSub: string) => {
    if (!editSubCatValue || editSubCatValue === oldSub) {
      setEditingSubCat(null);
      return;
    }
    if (categoryMap[cat].includes(editSubCatValue)) {
      alert('该小类名称已存在');
      return;
    }

    setConfirmState({
      isOpen: true,
      title: '重命名小类',
      message: `确定要将 "${oldSub}" 重命名为 "${editSubCatValue}" 吗? 这将更新所有关联参数。`,
      onConfirm: () => {
        const updatedList = categoryMap[cat].map(s => s === oldSub ? editSubCatValue : s);
        const newMap = { ...categoryMap, [cat]: updatedList };
        handleCategorySave(newMap);

        const updatedParams = params.map(p => (p.category === cat && p.subCategory === oldSub) ? { ...p, subCategory: editSubCatValue } : p);
        saveParams(updatedParams);

        setEditingSubCat(null);
      }
    });
  };


  return (
    <div className="p-6">

      <div className="flex justify-between items-end mb-6">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">参数配置</h2>
           <p className="text-slate-500 text-sm mt-1">管理系统业务参数键值对</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsCatManagerOpen(true)}
            className="bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-700 transition-colors shadow-sm"
            title="管理大类和小类"
          >
            <Settings size={18} />
            分类管理
          </button>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            新增参数
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6 animate-in fade-in slide-in-from-top-2">
          <div className="text-xs font-bold text-blue-800 uppercase mb-4">新增参数</div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="text-xs font-bold text-blue-800 uppercase block mb-1">大类 *</label>
              <select
                value={newParam.category || ''}
                onChange={e => setNewParam({...newParam, category: e.target.value})}
                className={INPUT_STYLE}
              >
                <option value="">-- 选择大类 --</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-blue-800 uppercase block mb-1">小类 *</label>
              <select
                value={newParam.subCategory || ''}
                onChange={e => setNewParam({...newParam, subCategory: e.target.value})}
                className={INPUT_STYLE}
                disabled={!newParam.category}
              >
                <option value="">-- 选择小类 --</option>
                {newParam.category && categoryMap[newParam.category]?.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-blue-800 uppercase block mb-1">键 (Key) *</label>
              <input
                type="text"
                className={INPUT_STYLE}
                placeholder="KEY_NAME"
                value={newParam.key || ''}
                onChange={e => setNewParam({...newParam, key: e.target.value})}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-blue-800 uppercase block mb-1">值 (Value) *</label>
              <input
                type="text"
                className={INPUT_STYLE}
                placeholder="Value"
                value={newParam.value || ''}
                onChange={e => setNewParam({...newParam, value: e.target.value})}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!newParam.key || !newParam.value || !newParam.category || !newParam.subCategory}
                className="flex-1 bg-blue-600 text-white h-[38px] rounded px-4 font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                保存
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewParam({ category: 'System', subCategory: 'General' });
                }}
                className="bg-slate-300 text-slate-700 h-[38px] rounded px-4 font-medium hover:bg-slate-400"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Section */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6 shadow-sm">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">
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
                 setCurrentPage(1);
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
               onChange={(e) => {
                 setSubCategoryFilter(e.target.value);
                 setCurrentPage(1);
               }}
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
               onChange={e => {
                 setSearchFilter(e.target.value);
                 setCurrentPage(1);
               }}
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
            {paginatedParams.length > 0 ? paginatedParams.map(p => (
              <tr key={p.id} className={`${editingId === p.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                <td className="px-6 py-3">
                  <span className="font-medium text-slate-800">{p.category}</span>
                </td>
                <td className="px-6 py-3">
                  <span className="text-slate-600">{p.subCategory}</span>
                </td>
                <td className="px-6 py-3">
                  {editingId === p.id ? (
                    <input
                      type="text"
                      value={editForm.key || ''}
                      onChange={e => setEditForm({ ...editForm, key: e.target.value })}
                      className={INPUT_STYLE}
                      placeholder="键"
                    />
                  ) : (
                    <span className="font-mono text-blue-600">{p.key}</span>
                  )}
                </td>
                <td className="px-6 py-3">
                  {editingId === p.id ? (
                    <input
                      type="text"
                      value={editForm.value || ''}
                      onChange={e => setEditForm({ ...editForm, value: e.target.value })}
                      className={INPUT_STYLE}
                      placeholder="值"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700 break-all">{p.value}</span>
                      {isUrl(p.value) && (
                        <a
                          href={p.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="打开链接"
                          className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    {editingId === p.id ? (
                      <>
                        <button
                          onClick={() => handleEditSave(p.id)}
                          title="保存"
                          className="text-green-600 hover:text-green-800 hover:bg-green-50 p-1.5 rounded transition-colors"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={handleEditCancel}
                          title="取消"
                          className="text-slate-400 hover:text-slate-600 p-1.5 rounded transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEditStart(p)}
                          title="编辑"
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          title="删除"
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
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
        {filteredParams.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredParams.length}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>

      {/* Category Manager Modal */}
      {isCatManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden h-[600px] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Settings size={20} />
                分类管理
              </h3>
              <button onClick={() => setIsCatManagerOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="flex-1 flex overflow-hidden">
              {/* Big Classes */}
              <div className="w-1/2 border-r border-slate-200 flex flex-col">
                <div className="p-3 border-b border-slate-100 bg-slate-50/50 font-bold text-xs text-slate-500 uppercase tracking-wide">
                  大类 (Big Class)
                </div>
                <div className="p-2 border-b border-slate-100 flex gap-2">
                  <input
                    className={INLINE_INPUT_STYLE}
                    placeholder="New Category Name"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                  />
                  <button onClick={handleAddCategory} className="bg-blue-600 text-white px-3 rounded hover:bg-blue-700">
                    <Plus size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {Object.keys(categoryMap).map(cat => (
                    <div
                      key={cat}
                      onClick={() => setSelectedCatForEdit(cat)}
                      className={`flex justify-between items-center p-2 rounded cursor-pointer ${
                        selectedCatForEdit === cat ? 'bg-blue-50 border border-blue-200 text-blue-700' : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      {editingCat === cat ? (
                        <div className="flex items-center gap-1 w-full mr-2">
                          <input
                            className={INLINE_INPUT_STYLE}
                            value={editCatValue}
                            onChange={e => setEditCatValue(e.target.value)}
                            autoFocus
                            onClick={e => e.stopPropagation()}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleRenameCategory(cat); }}
                            className="text-green-600 hover:bg-green-100 rounded p-0.5"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditingCat(null); }}
                            className="text-slate-400 hover:bg-slate-200 rounded p-0.5"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium truncate flex-1">{cat}</span>
                          <div className="flex gap-1 opacity-60 hover:opacity-100">
                            <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditingCat(cat); setEditCatValue(cat); }} className="text-slate-400 hover:text-blue-500 p-1">
                              <Edit size={14} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteCategory(cat); }} className="text-slate-400 hover:text-red-500 p-1">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {/* Small Classes */}
              <div className="w-1/2 flex flex-col bg-slate-50/30">
                <div className="p-3 border-b border-slate-100 bg-slate-50/50 font-bold text-xs text-slate-500 uppercase tracking-wide">
                  小类 (Sub Class)
                </div>
                {selectedCatForEdit ? (
                  <>
                    <div className="p-2 border-b border-slate-100 flex gap-2">
                      <input
                        className={INLINE_INPUT_STYLE}
                        placeholder={`Add to ${selectedCatForEdit}`}
                        value={newSubCatName}
                        onChange={e => setNewSubCatName(e.target.value)}
                      />
                      <button onClick={handleAddSubCategory} className="bg-green-600 text-white px-3 rounded hover:bg-green-700">
                        <Plus size={18} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      {categoryMap[selectedCatForEdit]?.map(sub => (
                        <div key={sub} className="group flex justify-between items-center p-2 rounded bg-white border border-slate-100 shadow-sm hover:border-blue-200 hover:bg-blue-50 transition-colors">
                          {editingSubCat === sub ? (
                            <div className="flex items-center gap-1 w-full">
                              <input
                                className={INLINE_INPUT_STYLE}
                                value={editSubCatValue}
                                onChange={e => setEditSubCatValue(e.target.value)}
                                autoFocus
                              />
                              <button
                                onClick={() => handleRenameSubCategory(selectedCatForEdit, sub)}
                                className="text-green-600 hover:bg-green-100 rounded p-0.5"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setEditingSubCat(null)}
                                className="text-slate-400 hover:bg-slate-200 rounded p-0.5"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="truncate flex-1">{sub}</span>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingSubCat(sub); setEditSubCatValue(sub); }} className="text-slate-400 hover:text-blue-500 p-1 rounded hover:bg-blue-100">
                                  <Edit size={14} />
                                </button>
                                <button onClick={() => handleDeleteSubCategory(selectedCatForEdit, sub)} className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-100">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      {categoryMap[selectedCatForEdit]?.length === 0 && (
                        <div className="text-center text-slate-400 italic text-sm mt-4">No sub-categories</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-sm italic">
                    Select a category to manage sub-items
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type || 'danger'}
        confirmText="确认"
      />
    </div>
  );
};