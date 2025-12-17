import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Database, ArrowRight, Play, FileCode, CheckCircle, Settings, Plus, Trash2, X, ChevronDown, Link as LinkIcon, Download, AlertTriangle, Edit2, Zap } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { recordAction } from '../../services/auditService';
import { ConfirmModal } from '../../components/ConfirmModal';

const INPUT_STYLE = "w-full pl-3 pr-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400";

interface DbConnection {
  id?: string;
  name: string;
  type?: string;
  host?: string;
  port?: string;
  database?: string;
  username: string;
  password?: string;
  connectionString?: string;
  url?: string;
  notes?: string;
}

// --- Searchable Select Component ---
interface SearchableSelectProps {
  options: DbConnection[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync text when value changes externally
  useEffect(() => {
    const selected = options.find(o => o.id === value);
    if (selected) {
      setSearchText(selected.name);
    } else if (!value) {
      setSearchText('');
    }
  }, [value, options]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Revert text to selected value if no new selection was made
        const selected = options.find(o => o.id === value);
        if (selected) setSearchText(selected.name);
        else if (!value) setSearchText('');
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, options]);

  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes(searchText.toLowerCase()) || 
    opt.username.toLowerCase().includes(searchText.toLowerCase()) ||
    opt.url?.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          className={`${INPUT_STYLE} pr-8 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`}
          placeholder={placeholder || "Select or type to search..."}
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setIsOpen(true);
            if (e.target.value === '') onChange(''); // Clear selection on empty input
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
        />
        <ChevronDown className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-auto animate-in fade-in zoom-in-95 duration-100">
          {filteredOptions.length > 0 ? (
            filteredOptions.map(opt => (
              <div
                key={opt.id}
                className={`px-4 py-2 text-sm cursor-pointer transition-colors ${opt.id === value ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                onClick={() => {
                  onChange(opt.id || '');
                  setIsOpen(false);
                  setSearchText(opt.name);
                }}
              >
                <div className="font-bold">{opt.name}</div>
                <div className="text-xs text-slate-500 font-mono flex gap-2">
                  <span>{opt.username}</span>
                  <span className="truncate max-w-[150px] opacity-60">{opt.url}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">No matches found</div>
          )}
        </div>
      )}
    </div>
  );
};

export const OracleSync: React.FC = () => {
    // --- Connection State ---
    const [sourceConns, setSourceConns] = useState<DbConnection[]>([]);
    const [targetConns, setTargetConns] = useState<DbConnection[]>([]);
    
    // --- Management Modal State ---
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [configTab, setConfigTab] = useState<'source' | 'target'>('source');
    const [newConn, setNewConn] = useState<Partial<DbConnection>>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [testingConnId, setTestingConnId] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

    // --- Selection State ---
    const [sourceId, setSourceId] = useState<string>('');
    const [targetId, setTargetId] = useState<string>('');
    
    // --- Processing State ---
    const [ddlScript, setDdlScript] = useState('');
    const [loading, setLoading] = useState(false);

    // --- Modal State ---
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        confirmText?: string;
        cancelText?: string;
        type?: 'danger' | 'info' | 'warning';
    }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    // Load Data
    useEffect(() => {
        const loadConnections = async () => {
            try {
                const allConns = await apiService.dbConnectionApi.getAll();
                const sourceConns = allConns.filter((c: any) => c.type === 'ORACLE_SOURCE');
                const targetConns = allConns.filter((c: any) => c.type === 'ORACLE_TARGET');
                
                setSourceConns(sourceConns.length > 0 ? sourceConns : []);
                setTargetConns(targetConns.length > 0 ? targetConns : []);
            } catch (err) {
                console.error('Failed to load connections:', err);
            }
        };
        
        loadConnections();
    }, []);

    // --- Actions ---

    const saveSourceConns = async (list: DbConnection[]) => {
        setSourceConns(list);
        // Save to backend
        for (const conn of list) {
            if (conn.id?.startsWith('s')) {
                await apiService.dbConnectionApi.create({ ...conn, type: 'ORACLE_SOURCE' });
            }
        }
    };

    const saveTargetConns = async (list: DbConnection[]) => {
        setTargetConns(list);
        // Save to backend
        for (const conn of list) {
            if (conn.id?.startsWith('t')) {
                await apiService.dbConnectionApi.create({ ...conn, type: 'ORACLE_TARGET' });
            }
        }
    };

    const handleAddConnection = async () => {
        if (newConn.name && (newConn.connectionString || newConn.url) && newConn.username) {
            const entry = {
                ...newConn,
                id: editingId || Date.now().toString(),
                type: configTab === 'source' ? 'ORACLE_SOURCE' : 'ORACLE_TARGET',
                password: newConn.password || ''
            } as DbConnection;

            try {
                let saved: DbConnection;
                if (editingId && (editingId.startsWith('s') || editingId.startsWith('t'))) {
                    // Update existing connection
                    saved = await apiService.dbConnectionApi.update(Number(editingId), entry);
                    if (configTab === 'source') {
                        saveSourceConns(sourceConns.map(c => c.id === editingId ? saved : c));
                    } else {
                        saveTargetConns(targetConns.map(c => c.id === editingId ? saved : c));
                    }
                    recordAction('Oracle同步', `编辑${configTab === 'source' ? '源' : '目标'}连接: ${entry.name}`);
                } else {
                    // Create new connection
                    saved = await apiService.dbConnectionApi.create(entry);
                    if (configTab === 'source') {
                        saveSourceConns([...sourceConns, saved]);
                    } else {
                        saveTargetConns([...targetConns, saved]);
                    }
                    recordAction('Oracle同步', `添加${configTab === 'source' ? '源' : '目标'}连接: ${entry.name}`);
                }
                setNewConn({});
                setEditingId(null);
            } catch (err) {
                console.error('Failed to add connection:', err);
                alert('添加连接失败');
            }
        }
    };

    const handleEditConnection = (conn: DbConnection) => {
        setNewConn(conn);
        setEditingId(conn.id || null);
    };

    const handleCancelEdit = () => {
        setNewConn({});
        setEditingId(null);
        setTestResult(null);
    };

    const handleTestConnection = async (conn?: DbConnection) => {
        const testConn = conn || newConn;
        if (!testConn.connectionString && !testConn.url) {
            alert('请输入 Connection String');
            return;
        }

        setTestingConnId(testConn.id || 'new');
        try {
            const result = await apiService.dbConnectionApi.testConnection(
                testConn.connectionString || testConn.url || '',
                testConn.username || '',
                testConn.password || ''
            );
            setTestResult({
                id: testConn.id || 'new',
                success: result.success || result.data?.success,
                message: result.data?.message || result.error || '测试失败'
            });
            recordAction('Oracle同步', `测试连接: ${testConn.name || 'new'}`);
        } catch (err) {
            setTestResult({
                id: testConn.id || 'new',
                success: false,
                message: '网络错误：' + (err instanceof Error ? err.message : '未知错误')
            });
        } finally {
            setTestingConnId(null);
        }
    };

    const handleDeleteConnection = (e: React.MouseEvent, id: string | undefined, type: 'source' | 'target') => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!id) return;
        
        setConfirmState({
            isOpen: true,
            title: '删除连接',
            message: '确定要删除此数据库连接配置吗？此操作不可恢复。',
            confirmText: '确认删除',
            cancelText: '取消',
            type: 'danger',
            onConfirm: async () => {
                try {
                    if (typeof id === 'string' && !isNaN(Number(id))) {
                        await apiService.dbConnectionApi.delete(Number(id));
                    }
                    
                    if (type === 'source') {
                        const updated = sourceConns.filter(c => c.id !== id);
                        saveSourceConns(updated);
                        if (sourceId === id) setSourceId('');
                    } else {
                        const updated = targetConns.filter(c => c.id !== id);
                        saveTargetConns(updated);
                        if (targetId === id) setTargetId('');
                    }
                    recordAction('Oracle同步', `删除连接: ${id}`);
                } catch (err) {
                    console.error('Failed to delete connection:', err);
                }
            }
        });
    };

    // --- Auto-Linkage Logic ---
    
    // Derived Target Options based on Source Selection
    const activeTargetOptions = useMemo(() => {
        if (!sourceId) return targetConns;

        const sConn = sourceConns.find(c => c.id === sourceId);
        if (!sConn) return targetConns;

        // Filter targets that match source username
        const matchingTargets = targetConns.filter(t => t.username === sConn.username);
        
        // Return only matches if they exist
        if (matchingTargets.length > 0) {
            return matchingTargets;
        }
        
        // Fallback: If no matches, return all but user should be aware
        return targetConns;
    }, [sourceId, sourceConns, targetConns]);

    // Auto-select effect
    useEffect(() => {
        if (sourceId) {
            const sConn = sourceConns.find(c => c.id === sourceId);
            if (sConn) {
                const matches = targetConns.filter(t => t.username === sConn.username);
                if (matches.length === 1) {
                    setTargetId(matches[0]?.id || '');
                } else if (matches.length > 1) {
                     // Check if current targetId is still valid in the new filtered list
                     const currentValid = matches.some(m => m.id === targetId);
                     if (!currentValid) setTargetId(''); 
                } else {
                     setTargetId('');
                }
            }
        }
    }, [sourceId, sourceConns, targetConns]);


    const generateDDL = () => {
        if (!sourceId || !targetId) {
            alert("Please select both Source and Target databases.");
            return;
        }
        
        const sConn = sourceConns.find(c => c.id === sourceId);
        const tConn = targetConns.find(c => c.id === targetId);

        setLoading(true);
        // Simulate processing
        setTimeout(() => {
            let script = `-- Generated DDL Script ${new Date().toLocaleString()}\n`;
            script += `-- Source: ${sConn?.name} (${sConn?.url})\n`;
            script += `-- Target: ${tConn?.name} (${tConn?.url})\n`;
            script += `-- Schema User: ${sConn?.username}\n\n`;
            
            script += `/* ---------------------------------------------------------------------- */\n`;
            script += `/* Table Comparison Results                                               */\n`;
            script += `/* ---------------------------------------------------------------------- */\n\n`;

            script += `-- Table: T_USER_INFO (Differences found)\n`;
            script += `ALTER TABLE T_USER_INFO MODIFY (USER_NAME VARCHAR2(200));\n`;
            script += `ALTER TABLE T_USER_INFO ADD (LAST_LOGIN_TIME TIMESTAMP DEFAULT SYSDATE);\n`;
            
            setDdlScript(script);
            setLoading(false);
            recordAction('数据同步', `Oracle DDL生成: ${sConn?.name} -> ${tConn?.name}`);
        }, 1200);
    };

    const downloadDDL = () => {
        if (!ddlScript) {
            alert("请先生成DDL脚本");
            return;
        }
        
        const sConn = sourceConns.find(c => c.id === sourceId);
        const tConn = targetConns.find(c => c.id === targetId);
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `oracle_sync_${sConn?.name}_to_${tConn?.name}_${timestamp}.sql`;
        
        const blob = new Blob([ddlScript], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        recordAction('数据同步', `下载DDL脚本: ${filename}`);
    };

    const handleExecuteSQL = () => {
        if (!ddlScript) {
            alert("请先生成DDL脚本");
            return;
        }

        const tConn = targetConns.find(c => c.id === targetId);
        
        setConfirmState({
            isOpen: true,
            title: '✓ 确认执行SQL脚本',
            message: `即将在目标数据库 "${tConn?.name}" 上执行DDL修改操作。\n\n确认事项:\n✓ 已备份数据库\n✓ SQL脚本内容已确认正确\n✓ 目标数据库连接正确\n\n点击 "执行修改" 按钮确认执行此操作。`,
            confirmText: '执行修改',
            cancelText: '取消',
            type: 'warning',
            onConfirm: () => {
                setLoading(true);
                // Simulate API call to execute SQL
                setTimeout(() => {
                    setDdlScript(prev => prev + `\n\n/* ✓ 脚本已成功执行于 ${new Date().toLocaleString()} */`);
                    setLoading(false);
                    alert('✓ SQL脚本已成功执行在目标数据库上！');
                    recordAction('数据同步', `执行DDL脚本: ${tConn?.name}`);
                }, 1500);
            }
        });
    };

    const renderConnInfo = (id: string, list: DbConnection[]) => {
        const conn = list.find(c => c.id === id);
        if (!conn) return <div className="text-slate-400 text-sm mt-2 italic pl-1">未选择连接</div>;
        return (
            <div className="mt-4 space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Connection String</label>
                    <div className="text-xs font-mono text-slate-700 truncate" title={conn.connectionString || conn.url}>{conn.connectionString || conn.url}</div>
                </div>
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Username</label>
                        <div className="text-sm font-bold text-slate-800">{conn.username}</div>
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Host</label>
                        <div className="text-sm font-bold text-slate-800">{conn.host || '-'}</div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 h-full flex flex-col bg-slate-50">
            <ConfirmModal 
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                confirmText={confirmState.confirmText || '确认'}
                cancelText={confirmState.cancelText || '取消'}
                type={confirmState.type || 'info'}
            />

            <div className="flex justify-between items-center mb-6">
                <div>
                   <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                     <Database className="text-red-600"/> Oracle DDL 同步
                   </h2>
                   <p className="text-slate-500 text-sm mt-1">数据库结构比对与增量DDL脚本生成</p>
                </div>
                <button 
                    onClick={() => setIsConfigOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors text-sm font-medium shadow-sm"
                >
                    <Settings size={16}/> 管理连接列表
                </button>
            </div>

            {/* Selection Area */}
            <div className="grid grid-cols-1 md:grid-cols-10 gap-4 mb-6 items-start">
                {/* Source Card */}
                <div className="md:col-span-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"/> 源数据库 (Source)
                    </h3>
                    <SearchableSelect 
                        options={sourceConns}
                        value={sourceId}
                        onChange={setSourceId}
                        placeholder="搜索源数据库..."
                    />
                    {renderConnInfo(sourceId, sourceConns)}
                </div>

                {/* Source Test Button */}
                <div className="md:col-span-1 flex justify-center pt-12">
                    <button
                        onClick={() => {
                            const conn = sourceConns.find(c => c.id === sourceId);
                            if (conn) handleTestConnection(conn);
                            else alert('请先选择源数据库');
                        }}
                        className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xs transition-colors whitespace-nowrap"
                        title="测试源数据库连接"
                    >
                        <Play size={14}/> 测试
                    </button>
                </div>

                {/* Arrow */}
                <div className="md:col-span-1 flex justify-center pt-12 text-slate-300">
                    <ArrowRight size={32} />
                </div>

                {/* Target Card */}
                <div className="md:col-span-3 bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 flex-1">
                            <div className="w-2 h-2 rounded-full bg-purple-500"/> 目标数据库 (Target)
                        </h3>
                        {sourceId && targetId && sourceConns.find(c => c.id === sourceId)?.username === targetConns.find(c => c.id === targetId)?.username && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                                <LinkIcon size={10}/> Linked
                            </span>
                        )}
                    </div>
                    <SearchableSelect 
                        options={activeTargetOptions}
                        value={targetId}
                        onChange={setTargetId}
                        placeholder={activeTargetOptions.length < targetConns.length ? "已筛选匹配用户名的连接..." : "搜索目标数据库..."}
                        disabled={!sourceId}
                    />
                    {sourceId && activeTargetOptions.length === 0 && (
                        <div className="text-xs text-orange-500 mt-1 pl-1">Target list contains no databases with matching username.</div>
                    )}
                    {renderConnInfo(targetId, targetConns)}
                </div>

                {/* Target Test Button */}
                <div className="md:col-span-1 flex justify-center pt-12">
                    <button
                        onClick={() => {
                            const conn = targetConns.find(c => c.id === targetId);
                            if (conn) handleTestConnection(conn);
                            else alert('请先选择目标数据库');
                        }}
                        className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xs transition-colors whitespace-nowrap"
                        title="测试目标数据库连接"
                    >
                        <Play size={14}/> 测试
                    </button>
                </div>
            </div>

            {/* Action */}
            <div className="flex justify-center mb-6">
                <button 
                    onClick={generateDDL}
                    disabled={loading || !sourceId || !targetId}
                    className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-500/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Play size={20} className={loading ? 'animate-spin' : ''}/> 
                    {loading ? 'Analyzing Schema...' : '生成同步脚本 (Generate DDL)'}
                </button>
            </div>

            {/* Editor Area */}
            <div className="flex-1 bg-slate-900 rounded-xl shadow-2xl overflow-hidden flex flex-col border border-slate-700 min-h-[300px]">
                <div className="bg-slate-800 p-3 border-b border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
                        <FileCode size={14}/>
                        <span>Sync_Script.sql</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {ddlScript && (
                             <span className="flex items-center gap-1 text-green-400 text-xs font-bold"><CheckCircle size={12}/> Generated Successfully</span>
                        )}
                        {ddlScript && (
                            <div className="flex gap-2">
                                <button
                                    onClick={downloadDDL}
                                    className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition-colors"
                                    title="下载SQL脚本文件"
                                >
                                    <Download size={14}/> 下载
                                </button>
                                <button
                                    onClick={handleExecuteSQL}
                                    disabled={loading}
                                    className="flex items-center gap-1 px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="在目标数据库执行脚本"
                                >
                                    <AlertTriangle size={14}/> 执行
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <textarea 
                    className="flex-1 w-full bg-slate-900 text-blue-100 p-4 font-mono text-sm leading-relaxed resize-none outline-none"
                    value={ddlScript || '-- Select Source and Target databases to begin comparison...'}
                    readOnly
                />
            </div>

            {/* Management Modal */}
            {isConfigOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Settings size={20} className="text-slate-500"/> 连接配置管理
                            </h3>
                            <button onClick={() => setIsConfigOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                        </div>
                        
                        {/* Tabs */}
                        <div className="flex border-b border-slate-200 px-6 pt-2">
                             <button 
                                onClick={() => setConfigTab('source')}
                                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${configTab === 'source' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                             >
                                源数据库 (Source)
                             </button>
                             <button 
                                onClick={() => setConfigTab('target')}
                                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${configTab === 'target' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                             >
                                目标数据库 (Target)
                             </button>
                        </div>

                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="text-xs font-bold text-blue-900 mb-1">Connection String 格式说明:</div>
                                <div className="text-xs text-blue-800 font-mono space-y-1">
                                    <div>• SID 方式: <span className="bg-white px-1 py-0.5">jdbc:oracle:thin:@10.20.72.168:1521:ECSS</span></div>
                                    <div>• Service 方式: <span className="bg-white px-1 py-0.5">jdbc:oracle:thin:@10.20.72.168:1521/ECSS</span></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                <div className="md:col-span-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Alias Name</label>
                                    <input className={INPUT_STYLE} placeholder="e.g. DB Name" value={newConn.name || ''} onChange={e => setNewConn({...newConn, name: e.target.value})} />
                                </div>
                                <div className="md:col-span-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Connection String</label>
                                    <input className={INPUT_STYLE} placeholder="jdbc:oracle:thin:@host:port:SID" value={newConn.connectionString || newConn.url || ''} onChange={e => setNewConn({...newConn, connectionString: e.target.value, url: e.target.value})} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Username</label>
                                    <input className={INPUT_STYLE} placeholder="SCOTT" value={newConn.username || ''} onChange={e => setNewConn({...newConn, username: e.target.value})} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Password</label>
                                    <input className={INPUT_STYLE} type="password" placeholder="******" value={newConn.password || ''} onChange={e => setNewConn({...newConn, password: e.target.value})} />
                                </div>
                                <div className="md:col-span-1 flex gap-1">
                                    <button onClick={() => handleTestConnection()} disabled={testingConnId !== null} className={`flex-1 text-white h-[38px] rounded-lg flex items-center justify-center text-xs font-bold ${testingConnId !== null ? 'bg-slate-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`} title="测试数据库连接">
                                        {testingConnId !== null ? '测试中...' : '测试'}
                                    </button>
                                    {editingId ? (
                                        <button onClick={handleCancelEdit} className="flex-1 text-white h-[38px] rounded-lg flex items-center justify-center text-xs font-bold bg-slate-500 hover:bg-slate-600" title="取消编辑">
                                            ✕
                                        </button>
                                    ) : null}
                                    <button onClick={handleAddConnection} className={`flex-1 text-white h-[38px] rounded-lg flex items-center justify-center ${configTab === 'source' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`} title={editingId ? '保存修改' : '添加连接'}>
                                        {editingId ? '保存' : <Plus size={20} />}
                                    </button>
                                </div>
                            </div>
                            {testResult && testResult.id === (editingId || 'new') && (
                                <div className={`mt-3 p-3 rounded-lg text-sm font-bold ${testResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                                    {testResult.success ? '✓ 连接成功: ' : '✗ 连接失败: '} {testResult.message}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-white">
                            <div className="space-y-2">
                                {(configTab === 'source' ? sourceConns : targetConns).map(conn => (
                                    <div key={conn.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg hover:shadow-sm transition-shadow group">
                                        <div className="flex items-center gap-4 overflow-hidden">
                                            <div className={`w-8 h-8 rounded flex items-center justify-center font-bold shrink-0 text-white ${configTab === 'source' ? 'bg-blue-500' : 'bg-purple-500'}`}>
                                                Or
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-slate-800 text-sm truncate">{conn.name}</div>
                                                <div className="text-xs text-slate-500 font-mono truncate max-w-md">{conn.url}</div>
                                            </div>
                                            <div className="hidden md:block px-3 py-1 bg-white rounded text-xs font-bold text-slate-600 border border-slate-100">
                                                {conn.username}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={() => handleTestConnection(conn)}
                                                className="text-slate-400 hover:text-green-500 p-2 hover:bg-green-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                title="测试连接"
                                            >
                                                <Zap size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleEditConnection(conn)}
                                                className="text-slate-400 hover:text-blue-500 p-2 hover:bg-blue-50 rounded transition-colors"
                                                title="编辑连接"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button 
                                                onClick={(e) => handleDeleteConnection(e, conn.id, configTab)}
                                                className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {(configTab === 'source' ? sourceConns : targetConns).length === 0 && (
                                    <div className="text-center py-8 text-slate-400 italic">No connections configured in this list</div>
                                )}
                            </div>
                        </div>
                        
                        <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
                            <button onClick={() => setIsConfigOpen(false)} className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-sm font-bold">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};