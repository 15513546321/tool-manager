import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Database, ArrowRight, Play, FileCode, CheckCircle, Settings, Plus, Trash2, X, ChevronDown, Link as LinkIcon, Download, AlertTriangle, Edit2, Zap } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { recordAction } from '../../services/auditService';
import { ConfirmModal } from '../../components/ConfirmModal';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const INPUT_STYLE = "w-full pl-3 pr-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400";

// --- Utility Functions ---
/**
 * Parse Oracle connection string to extract host, port, and SID/SERVICE_NAME
 * Supports formats:
 *   - jdbc:oracle:thin:@host:port:SID
 *   - jdbc:oracle:thin:@host:port/SERVICE_NAME
 */
const parseOracleConnectionString = (connectionString: string): { host?: string; port?: string; sid?: string } => {
  if (!connectionString) return {};
  
  // Try to match Oracle connection string format
  const match = connectionString.match(/@([^:/@]+)(?::(\d+))?(?::([^/]+)|\/(.+))?/);
  
  if (match) {
    return {
      host: match[1],
      port: match[2],
      sid: match[3] || match[4] // Either :SID or /SERVICE_NAME
    };
  }
  
  return {};
};

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
                <div className="text-xs text-slate-500 font-mono flex gap-3 flex-wrap">
                  <span>👤 {opt.username}</span>
                  {(() => {
                    const parsed = parseOracleConnectionString(opt.connectionString || opt.url || '');
                    return (
                      <>
                        {parsed.host && <span>🖥️ {parsed.host}</span>}
                        {parsed.port && <span>:{parsed.port}</span>}
                        {parsed.sid && <span>🗄️ {parsed.sid}</span>}
                      </>
                    );
                  })()}
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
    
    // Separate testing state for form and list
    const [formTestingId, setFormTestingId] = useState<string | null>(null);
    
    // 测试连接结果弹框
    const [testModalState, setTestModalState] = useState<{
        isOpen: boolean;
        success: boolean;
        message: string;
    }>({ isOpen: false, success: false, message: '' });

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

    // Load Data - MUST be extracted to module level to be callable from event handlers
    const loadConnections = async () => {
        try {
            const allConns = await apiService.dbConnectionApi.getAll();
            const sourceConns = allConns.filter((c: any) => c.type === 'ORACLE_SOURCE');
            const targetConns = allConns.filter((c: any) => c.type === 'ORACLE_TARGET');
            
            // Force update by setting new array instances
            setSourceConns(sourceConns.length > 0 ? sourceConns : []);
            setTargetConns(targetConns.length > 0 ? targetConns : []);
            console.log('✓ Connections reloaded:', { sourceConns: sourceConns.length, targetConns: targetConns.length });
        } catch (err) {
            console.error('Failed to load connections:', err);
        }
    };

    useEffect(() => {
        loadConnections();
    }, []);

    // --- Actions ---

    const handleAddConnection = async () => {
        if (newConn.name && (newConn.connectionString || newConn.url) && newConn.username) {
            const entry = {
                ...newConn,
                type: configTab === 'source' ? 'ORACLE_SOURCE' : 'ORACLE_TARGET',
                password: newConn.password || ''
            } as DbConnection;

            try {
                let saved: DbConnection;
                if (editingId) {
                    // Update existing connection - editingId is numeric from backend
                    const numericId = typeof editingId === 'string' ? parseInt(editingId, 10) : editingId;
                    if (!isNaN(numericId)) {
                        saved = await apiService.dbConnectionApi.update(numericId, { ...entry, id: numericId });
                        if (configTab === 'source') {
                            setSourceConns(sourceConns.map(c => c.id === editingId ? saved : c));
                        } else {
                            setTargetConns(targetConns.map(c => c.id === editingId ? saved : c));
                        }
                        recordAction('Oracle同步', `编辑${configTab === 'source' ? '源' : '目标'}连接: ${entry.name}`);
                    } else {
                        alert('无效的连接ID');
                        return;
                    }
                } else {
                    // Create new connection
                    saved = await apiService.dbConnectionApi.create(entry);
                    if (configTab === 'source') {
                        setSourceConns([...sourceConns, saved]);
                    } else {
                        setTargetConns([...targetConns, saved]);
                    }
                    recordAction('Oracle同步', `添加${configTab === 'source' ? '源' : '目标'}连接: ${entry.name}`);
                }
                alert('✅ ' + (editingId ? '修改成功' : '添加成功'));
                setNewConn({});
                setEditingId(null);
            } catch (err) {
                console.error('Failed to add connection:', err);
                alert('❌ ' + (editingId ? '修改失败：' : '添加失败：') + (err instanceof Error ? err.message : '请稍后重试'));
            }
        } else {
            alert('请完整填写连接名称、连接字符串和用户名');
        }
    };

    const handleEditConnection = (conn: DbConnection) => {
        setNewConn(conn);
        setEditingId(conn.id || null);
    };

    const handleCancelEdit = () => {
        setNewConn({});
        setEditingId(null);
    };

    const handleTestConnection = async (conn: DbConnection) => {
        if (!conn.connectionString && !conn.url) {
            alert('请输入 Connection String');
            return;
        }

        setFormTestingId(String(conn.id || 'testing'));
        try {
            const result = await apiService.dbConnectionApi.testConnection(
                conn.connectionString || conn.url || '',
                conn.username || '',
                conn.password || ''
            );
            
            const isSuccess = result.success || result.data?.success;
            const message = result.data?.message || result.message || result.error || '测试失败';
            
            setTestModalState({
                isOpen: true,
                success: isSuccess,
                message: isSuccess ? message : ('错误: ' + message)
            });
            recordAction('Oracle同步', `测试连接: ${conn.name || ''}`);
        } catch (err) {
            console.error('Test connection error:', err);
            setTestModalState({
                isOpen: true,
                success: false,
                message: '网络错误：' + (err instanceof Error ? err.message : '连接超时或网络异常')
            });
        } finally {
            setFormTestingId(null);
        }
    };

    const handleDeleteConnection = (e: React.MouseEvent, id: string | undefined, type: 'source' | 'target') => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('🗑️ [DELETE] 删除按钮点击', { id, type, idType: typeof id });
        
        if (!id) {
            alert('❌ 连接ID无效，无法删除');
            return;
        }
        
        setConfirmState({
            isOpen: true,
            title: '删除连接',
            message: '确定要删除此数据库连接配置吗？此操作不可恢复。',
            confirmText: '确认删除',
            cancelText: '取消',
            type: 'danger',
            onConfirm: async () => {
                try {
                    let deleteSuccess = false;
                    let errorMsg = '';
                    
                    console.log('🗑️ [DELETE] 开始删除连接: ID=' + id + ', Type=' + type);
                    
                    // 更安全的 ID 转换
                    const numId = Number(id);
                    if (isNaN(numId)) {
                        errorMsg = '连接ID格式错误: ' + id;
                        console.error('❌ [DELETE] ' + errorMsg);
                        alert('❌ 删除失败: ' + errorMsg);
                        return;
                    }
                    
                    try {
                        console.log('📤 [DELETE] 向后端发送DELETE请求: /api/db-connection/' + numId);
                        const result = await apiService.dbConnectionApi.delete(numId);
                        console.log('📥 [DELETE] 后端响应:', JSON.stringify(result));
                        
                        // 检查响应
                        if (!result) {
                            errorMsg = '后端无响应';
                            console.error('❌ [DELETE] ' + errorMsg);
                        } else if (result.success === true) {
                            deleteSuccess = true;
                            console.log('✓ [DELETE] 后端删除成功，开始更新本地数据...');
                        } else if (result.success === false) {
                            errorMsg = result.error || '后端返回错误';
                            console.error('❌ [DELETE] ' + errorMsg);
                        } else {
                            errorMsg = '响应格式异常: ' + JSON.stringify(result);
                            console.error('⚠️ [DELETE] ' + errorMsg);
                        }
                    } catch (deleteErr) {
                        console.error('❌ [DELETE] API请求错误:', deleteErr);
                        errorMsg = deleteErr instanceof Error ? deleteErr.message : '网络错误';
                    }
                    
                    if (!deleteSuccess) {
                        alert('❌ 删除失败: ' + errorMsg);
                        return;
                    }
                    
                    // 立即从本地状态移除
                    console.log('🔄 [DELETE] 从本地状态移除连接 ID=' + numId + ', type=' + type);
                    
                    if (type === 'source') {
                        const updated = sourceConns.filter(c => {
                            const cId = typeof c.id === 'string' ? c.id : String(c.id);
                            return cId !== String(numId);
                        });
                        setSourceConns(updated);
                        if (sourceId === String(numId)) {
                            setSourceId('');
                        }
                        console.log('✓ [DELETE] 源数据库连接列表已更新, 剩余' + updated.length + '个');
                    } else if (type === 'target') {
                        const updated = targetConns.filter(c => {
                            const cId = typeof c.id === 'string' ? c.id : String(c.id);
                            return cId !== String(numId);
                        });
                        setTargetConns(updated);
                        if (targetId === String(numId)) {
                            setTargetId('');
                        }
                        console.log('✓ [DELETE] 目标数据库连接列表已更新, 剩余' + updated.length + '个');
                    } else {
                        console.error('❌ [DELETE] type 参数无效: ' + type);
                        alert('❌ 连接类型参数无效');
                        return;
                    }
                    
                    recordAction('Oracle同步', `删除连接: ${id}`);
                    alert('✓ 连接已删除成功');
                    
                    // 异步刷新后端数据以确保数据一致性
                    console.log('⏳ [DELETE] 等待500ms后从后端重新加载连接列表...');
                    setTimeout(() => {
                        console.log('🔄 [DELETE] 从后端重新加载连接列表...');
                        loadConnections();
                    }, 500);
                    
                } catch (err) {
                    console.error('❌ [DELETE] 删除连接异常:', err);
                    alert('❌ 删除失败: ' + (err instanceof Error ? err.message : '网络错误'));
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


    const generateDDL = async () => {
        if (!sourceId || !targetId) {
            alert("Please select both Source and Target databases.");
            return;
        }
        
        const sConn = sourceConns.find(c => c.id === sourceId);
        const tConn = targetConns.find(c => c.id === targetId);

        if (!sConn || !tConn) {
            alert("请选择有效的源和目标数据库");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/oracle-sync/generate-ddl`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceConnStr: sConn.connectionString || sConn.url,
                    sourceUser: sConn.username,
                    sourcePassword: sConn.password,
                    targetConnStr: tConn.connectionString || tConn.url,
                    targetUser: tConn.username,
                    targetPassword: tConn.password
                })
            });

            const result = await response.json();
            
            if (result.success && result.data?.ddlScript) {
                setDdlScript(result.data.ddlScript);
                recordAction('数据同步', `生成DDL脚本: ${sConn?.name} -> ${tConn?.name}`);
            } else {
                alert('生成DDL失败: ' + (result.error || '未知错误'));
                setDdlScript('-- 生成失败: ' + (result.error || '未知错误'));
            }
        } catch (err) {
            console.error('Failed to generate DDL:', err);
            alert('生成DDL失败: ' + (err instanceof Error ? err.message : '网络错误'));
            setDdlScript('-- 错误: ' + (err instanceof Error ? err.message : '网络连接失败'));
        } finally {
            setLoading(false);
        }
    };

    const downloadDDL = () => {
        if (!ddlScript) {
            alert("请先生成DDL脚本");
            return;
        }
        
        const sConn = sourceConns.find(c => c.id === sourceId);
        const tConn = targetConns.find(c => c.id === targetId);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        
        // Use username for source and target if available
        const sourceName = sConn?.username || sConn?.name || 'source';
        const targetName = tConn?.username || tConn?.name || 'target';
        const filename = `${sourceName}_to_${targetName}_${timestamp}.sql`;
        
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
            onConfirm: async () => {
                setLoading(true);
                try {
                    const response = await fetch(`${API_BASE_URL}/oracle-sync/execute-ddl`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            targetConnStr: tConn?.connectionString || tConn?.url,
                            targetUser: tConn?.username,
                            targetPassword: tConn?.password,
                            ddlScript: ddlScript
                        })
                    });

                    const result = await response.json();
                    
                    if (result.success) {
                        const data = result.data;
                        let successMsg = `✓ SQL脚本执行完成！\n`;
                        if (data?.successCount !== undefined) {
                            successMsg += `\n执行统计:\n`;
                            successMsg += `  成功: ${data.successCount}\n`;
                            successMsg += `  失败: ${data.failureCount}\n`;
                            successMsg += `  总计: ${data.executedStatements}`;
                        }
                        
                        alert(successMsg);
                        
                        // Show detailed results if there are failures
                        if (data?.failureCount > 0 && data?.details) {
                            console.group('DDL执行详情');
                            data.details.forEach((item: any) => {
                                if (!item.success) {
                                    console.error(`[${item.index}] 失败:`, item.statement, item.error);
                                }
                            });
                            console.groupEnd();
                        }
                        
                        recordAction('数据同步', `执行DDL脚本: ${tConn?.name} (成功:${data?.successCount}, 失败:${data?.failureCount})`);
                    } else {
                        alert('执行失败: ' + (result.error || '未知错误'));
                    }
                } catch (err) {
                    console.error('Failed to execute DDL:', err);
                    alert('执行失败: ' + (err instanceof Error ? err.message : '网络错误'));
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const renderConnInfo = (id: string, list: DbConnection[]) => {
        const conn = list.find(c => c.id === id);
        if (!conn) return <div className="text-slate-400 text-sm mt-2 italic pl-1">未选择连接</div>;
        
        // Try to get host from conn.host, or parse from connectionString
        const parsed = parseOracleConnectionString(conn.connectionString || conn.url || '');
        const displayHost = conn.host || parsed.host || '-';
        const displayPort = conn.port || parsed.port || '1521';
        const displaySid = parsed.sid || '-';
        
        return (
            <div className="mt-4 space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Connection String</label>
                    <div className="text-xs font-mono text-slate-700 truncate" title={conn.connectionString || conn.url}>{conn.connectionString || conn.url}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Username</label>
                        <div className="text-sm font-bold text-slate-800">{conn.username}</div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Host</label>
                        <div className="text-sm font-bold text-slate-800">{displayHost}</div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Port</label>
                        <div className="text-sm font-bold text-slate-800">{displayPort}</div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">SID/Service</label>
                        <div className="text-sm font-bold text-slate-800">{displaySid}</div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
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

            {/* Test Connection Modal */}
            {testModalState.isOpen && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className={`px-6 py-4 border-b-4 ${testModalState.success ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}>
                            <h3 className={`text-lg font-bold flex items-center gap-2 ${testModalState.success ? 'text-green-800' : 'text-red-800'}`}>
                                {testModalState.success ? '✅ 连接成功' : '❌ 连接失败'}
                            </h3>
                        </div>
                        <div className="p-6">
                            <p className={`text-sm ${testModalState.success ? 'text-green-700' : 'text-red-700'}`}>
                                {testModalState.message}
                            </p>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button 
                                onClick={() => setTestModalState({ ...testModalState, isOpen: false })}
                                className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-sm font-bold transition-colors"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="mb-8">
                <div className="flex justify-between items-start mb-4">
                   <div>
                       <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                           <div className="p-2 bg-red-100 rounded-lg"><Database className="text-red-600" size={28}/></div>
                           Oracle DDL 同步
                       </h1>
                       <p className="text-slate-500 text-sm mt-2">对比源库和目标库的表结构，自动生成增量DDL脚本</p>
                    </div>
                    <button 
                        onClick={() => setIsConfigOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg font-medium text-sm"
                    >
                        <Settings size={18}/> 连接管理
                    </button>
                </div>
            </div>

            {/* Main Content - Two-Column Layout */}
            <div className="flex-1 flex gap-6 min-h-0">
                {/* Left: Configuration Panel */}
                <div className="w-[35%] flex flex-col gap-6 min-w-0">
                    {/* Source Database Card */}
                    <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <h3 className="text-lg font-bold text-slate-800">源数据库</h3>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">选择源</label>
                            <SearchableSelect 
                                options={sourceConns}
                                value={sourceId}
                                onChange={setSourceId}
                                placeholder="搜索源数据库..."
                            />
                        </div>
                        {sourceId && (
                            <>
                                {renderConnInfo(sourceId, sourceConns)}
                                <button
                                    onClick={() => {
                                        const conn = sourceConns.find(c => c.id === sourceId);
                                        if (conn) handleTestConnection(conn);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg font-medium text-sm transition-colors"
                                    title="测试源数据库连接"
                                >
                                    <Zap size={14}/> 测试连接
                                </button>
                            </>
                        )}
                        {!sourceId && (
                            <div className="text-center py-8 text-slate-400">
                                <Database size={32} className="mx-auto mb-2 opacity-30"/>
                                <p className="text-sm">请选择源数据库</p>
                            </div>
                        )}
                    </div>

                    {/* Target Database Card */}
                    <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                                <h3 className="text-lg font-bold text-slate-800">目标数据库</h3>
                            </div>
                            {sourceId && targetId && sourceConns.find(c => c.id === sourceId)?.username === targetConns.find(c => c.id === targetId)?.username && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1 font-bold">
                                    <LinkIcon size={12}/> 关联
                                </span>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">选择目标</label>
                            <SearchableSelect 
                                options={activeTargetOptions}
                                value={targetId}
                                onChange={setTargetId}
                                placeholder={activeTargetOptions.length < targetConns.length ? "仅显示匹配用户名的连接" : "搜索目标数据库..."}
                                disabled={!sourceId}
                            />
                            {sourceId && activeTargetOptions.length === 0 && (
                                <div className="text-xs text-orange-500 mt-2">未找到匹配用户名的目标数据库</div>
                            )}
                        </div>
                        {targetId && (
                            <>
                                {renderConnInfo(targetId, targetConns)}
                                <button
                                    onClick={() => {
                                        const conn = targetConns.find(c => c.id === targetId);
                                        if (conn) handleTestConnection(conn);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg font-medium text-sm transition-colors"
                                    title="测试目标数据库连接"
                                >
                                    <Zap size={14}/> 测试连接
                                </button>
                            </>
                        )}
                        {!targetId && (
                            <div className="text-center py-8 text-slate-400">
                                <Database size={32} className="mx-auto mb-2 opacity-30"/>
                                <p className="text-sm">请选择目标数据库</p>
                            </div>
                        )}
                    </div>

                    {/* Action Button */}
                    <button 
                        onClick={generateDDL}
                        disabled={loading || !sourceId || !targetId}
                        className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-bold hover:from-red-700 hover:to-red-800 shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Play size={18} className={loading ? 'animate-spin' : ''}/> 
                        {loading ? '生成中...' : '生成同步脚本'}
                    </button>
                </div>

                {/* Right: DDL Script Panel */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    {/* Editor Header */}
                    <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <FileCode size={18} className="text-blue-600"/>
                            <div>
                                <div className="font-bold text-slate-800">同步脚本</div>
                                <div className="text-xs text-slate-500">Oracle DDL 脚本</div>
                            </div>
                        </div>
                        {ddlScript && (
                             <span className="flex items-center gap-1 text-green-600 text-sm font-bold"><CheckCircle size={14}/> 已生成</span>
                        )}
                    </div>

                    {/* Editor Area */}
                    <div className="flex-1 bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden flex flex-col">
                        <textarea 
                            className="flex-1 w-full p-4 bg-slate-900 text-blue-100 font-mono text-sm leading-relaxed resize-none outline-none"
                            value={ddlScript || '-- 选择源和目标数据库后，点击"生成同步脚本"开始对比表结构...'}
                            readOnly
                        />
                    </div>

                    {/* Action Buttons */}
                    {ddlScript && (
                        <div className="flex gap-3">
                            <button
                                onClick={downloadDDL}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-md"
                            >
                                <Download size={16}/> 下载脚本
                            </button>
                            <button
                                onClick={handleExecuteSQL}
                                disabled={loading}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <AlertTriangle size={16}/> 执行脚本
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Management Modal */}
            {isConfigOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
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

                        <div className="px-6 py-6 border-b border-slate-100 bg-white">
                            {/* 说明文本 - 增强版 */}
                            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg shadow-sm">
                                <div className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                                    <span className="text-lg">📝</span> Oracle Connection String 格式说明
                                </div>
                                <div className="space-y-3">
                                    <div className="bg-white p-3 rounded border border-blue-100">
                                        <div className="text-xs font-bold text-blue-700 mb-1">✅ SID 方式 (推荐用于传统实例)</div>
                                        <div className="text-xs font-mono text-slate-700 bg-slate-50 px-3 py-2 rounded border border-slate-200">
                                            jdbc:oracle:thin:@10.20.72.168:1521<span className="text-red-600 font-bold">:</span>ECSS
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-1">格式: @host:port<span className="text-red-600 font-bold">:SID</span></div>
                                    </div>
                                    <div className="bg-white p-3 rounded border border-blue-100">
                                        <div className="text-xs font-bold text-blue-700 mb-1">✅ Service Name 方式 (推荐用于 RAC / PDB)</div>
                                        <div className="text-xs font-mono text-slate-700 bg-slate-50 px-3 py-2 rounded border border-slate-200">
                                            jdbc:oracle:thin:@10.20.72.168:1521<span className="text-green-600 font-bold">/</span>ECSS
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-1">格式: @host:port<span className="text-green-600 font-bold">/SERVICE_NAME</span></div>
                                    </div>
                                </div>
                                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-[11px] text-yellow-800">
                                    <strong>⚠️ 重要提示：</strong> 请注意区分冒号(<span className="font-bold text-red-600">:</span>)和斜杠(<span className="font-bold text-green-600">/</span>)符号！
                                    如果连接失败，请尝试切换SID和Service方式。
                                </div>
                            </div>

                            {/* 表单字段 */}
                            <div className="space-y-4">
                                {/* 第一行：连接名称 和 连接字符串 */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 uppercase block mb-2">连接名称</label>
                                        <input 
                                            className={INPUT_STYLE} 
                                            placeholder="例：生产库" 
                                            value={newConn.name || ''} 
                                            onChange={e => setNewConn({...newConn, name: e.target.value})} 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 uppercase block mb-2">连接字符串</label>
                                        <input 
                                            className={INPUT_STYLE} 
                                            placeholder="jdbc:oracle:thin:@host:port:SID" 
                                            value={newConn.connectionString || newConn.url || ''} 
                                            onChange={e => setNewConn({...newConn, connectionString: e.target.value, url: e.target.value})} 
                                        />
                                    </div>
                                </div>

                                {/* 第二行：用户名 和 密码 */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 uppercase block mb-2">用户名</label>
                                        <input 
                                            className={INPUT_STYLE} 
                                            placeholder="如：SCOTT" 
                                            value={newConn.username || ''} 
                                            onChange={e => setNewConn({...newConn, username: e.target.value})} 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 uppercase block mb-2">密码</label>
                                        <input 
                                            className={INPUT_STYLE} 
                                            type="password" 
                                            placeholder="••••••••" 
                                            value={newConn.password || ''} 
                                            onChange={e => setNewConn({...newConn, password: e.target.value})} 
                                        />
                                    </div>
                                </div>

                                {/* 按钮组 */}
                                <div className="flex gap-3 pt-2">
                                    {editingId ? (
                                        <button 
                                            onClick={handleCancelEdit} 
                                            className="px-6 py-2.5 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-sm font-bold transition-colors border border-slate-300"
                                            title="取消编辑"
                                        >
                                            ✕ 取消
                                        </button>
                                    ) : null}
                                    
                                    <button 
                                        onClick={handleAddConnection} 
                                        className={`flex-1 px-6 py-2.5 rounded-lg flex items-center justify-center text-sm font-bold transition-colors text-white ${
                                            configTab === 'source' 
                                                ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800' 
                                                : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
                                        }`}
                                        title={editingId ? '保存修改' : '添加连接'}
                                    >
                                        {editingId ? '✓ 保存修改' : '+ 添加连接'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 max-h-[400px]">
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-slate-700 uppercase">已配置的连接</h4>
                                {/* 连接列表 - 表格形式 */}
                                {(configTab === 'source' ? sourceConns : targetConns).length > 0 ? (
                                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-6 py-3 text-left font-semibold text-slate-700">连接名称</th>
                                                    <th className="px-6 py-3 text-left font-semibold text-slate-700">用户名</th>
                                                    <th className="px-6 py-3 text-left font-semibold text-slate-700">主机</th>
                                                    <th className="px-6 py-3 text-right font-semibold text-slate-700">操作</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {(configTab === 'source' ? sourceConns : targetConns).map(conn => {
                                                    const connStr = conn.connectionString || conn.url || '';
                                                    const parsed = parseOracleConnectionString(connStr);
                                                    const hostDisplay = parsed.host ? `${parsed.host}:${parsed.port || '1521'}` : '-';
                                                    
                                                    return (
                                                        <tr key={conn.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-6 py-3 font-medium text-slate-900">{conn.name}</td>
                                                            <td className="px-6 py-3 text-slate-700">{conn.username}</td>
                                                            <td className="px-6 py-3 text-slate-700">{hostDisplay}</td>
                                                            <td className="px-6 py-3 text-right">
                                                                <div className="flex gap-2 justify-end">
                                                                    <button
                                                                        onClick={() => {
                                                                            handleEditConnection(conn);
                                                                            // 滚动到顶部表单
                                                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                                                        }}
                                                                        className="px-3 py-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded text-xs font-medium transition-colors"
                                                                        title="编辑连接"
                                                                    >
                                                                        ✎ 编辑
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleTestConnection(conn)}
                                                                        disabled={formTestingId !== null}
                                                                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                                                                            formTestingId !== null
                                                                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                                                : 'text-white bg-green-600 hover:bg-green-700'
                                                                        }`}
                                                                        title="测试数据库连接是否正常"
                                                                    >
                                                                        {formTestingId !== null ? '测试中...' : '✓ 测试'}
                                                                    </button>
                                                                    <button 
                                                                        onClick={(e) => handleDeleteConnection(e, conn.id, configTab)}
                                                                        className="px-3 py-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded text-xs font-medium transition-colors"
                                                                        title="删除连接"
                                                                    >
                                                                        🗑 删除
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-slate-300">
                                        <div className="text-4xl mb-3">📭</div>
                                        <div className="text-base font-bold text-slate-600">暂无{configTab === 'source' ? '源' : '目标'}数据库连接</div>
                                        <div className="text-sm text-slate-500 mt-2">请在上方输入连接信息并点击「+ 添加连接」</div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                            <div className="text-xs text-slate-600">💡 提示: 选择源和目标数据库后，点击「生成同步脚本」开始对比表结构</div>
                            <button onClick={() => setIsConfigOpen(false)} className="px-6 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-sm font-bold transition-colors">关闭</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};