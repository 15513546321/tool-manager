import React, { useState } from 'react';
import { Server, ArrowRight, RefreshCw, Check, X, Search, Database, Lock, User, FileText, ArrowRightLeft, Lightbulb } from 'lucide-react';
import { recordAction } from '../../services/auditService';
import { ConfirmModal } from '../../components/ConfirmModal';

const INPUT_STYLE = "w-full pl-3 pr-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700";

interface NacosConfig {
  dataId: string;
  group: string;
  content: string;
  md5?: string;
  // Metadata for matching
  env?: string; 
}

interface DiffItem extends NacosConfig {
  targetDataId?: string;
  targetContent?: string;
  status: 'same' | 'diff' | 'missing_target' | 'missing_source';
  matchType: 'exact' | 'pattern';
  suggestion?: string;
}

export const NacosSync: React.FC = () => {
    // --- Connection State ---
    const [sourceUrl, setSourceUrl] = useState('http://localhost:8848');
    const [sourceNs, setSourceNs] = useState('dev');
    const [sourceUser, setSourceUser] = useState('nacos');
    const [sourcePass, setSourcePass] = useState('nacos');

    const [targetUrl, setTargetUrl] = useState('http://192.168.1.200:8848');
    const [targetNs, setTargetNs] = useState('prod');
    const [targetUser, setTargetUser] = useState('nacos');
    const [targetPass, setTargetPass] = useState('nacos');
    
    // --- Data State ---
    const [diffList, setDiffList] = useState<DiffItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState<DiffItem | null>(null);

    // --- Modal State ---
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    // --- Mock Fetch Logic ---
    const fetchConfigs = async (ns: string): Promise<NacosConfig[]> => {
        // Simulate API delay
        await new Promise(r => setTimeout(r, 600));
        
        // Return mock data based on namespace
        if (ns.includes('dev')) {
            return [
                { dataId: 'application-dev.yaml', group: 'DEFAULT_GROUP', content: `server:\n  port: 8080\nspring:\n  profiles: dev\n  datasource:\n    url: jdbc:mysql://dev-db:3306/db`, env: 'dev' },
                { dataId: 'redis.properties', group: 'DEFAULT_GROUP', content: 'host=192.168.1.5\nport=6379', env: 'dev' },
                { dataId: 'gateway-routes.json', group: 'DEFAULT_GROUP', content: '[{"id": "service-a", "uri": "lb://service-a"}]', env: 'dev' },
                { dataId: 'new-feature-switch.properties', group: 'DEFAULT_GROUP', content: 'feature.x.enabled=true', env: 'dev' }
            ];
        } else {
            // Prod
            return [
                { dataId: 'application-prod.yaml', group: 'DEFAULT_GROUP', content: `server:\n  port: 8080\nspring:\n  profiles: prod\n  datasource:\n    url: jdbc:mysql://prod-db:3306/db`, env: 'prod' }, // Matches pattern
                { dataId: 'redis.properties', group: 'DEFAULT_GROUP', content: 'host=10.0.0.5\nport=6379', env: 'prod' }, // Matches exact
                // gateway missing
            ];
        }
    };

    const handleCompare = async () => {
        setLoading(true);
        setDiffList([]);
        try {
            const sourceConfigs = await fetchConfigs(sourceNs);
            const targetConfigs = await fetchConfigs(targetNs);

            const results: DiffItem[] = [];

            // 1. Iterate Source to find matches in Target
            for (const s of sourceConfigs) {
                let match: NacosConfig | undefined;
                let matchType: 'exact' | 'pattern' = 'exact';

                // A. Exact Match
                match = targetConfigs.find(t => t.dataId === s.dataId && t.group === s.group);

                // B. Pattern Match (if no exact match)
                // Rule: If source DataID contains Source Namespace, try replacing it with Target Namespace
                if (!match && s.dataId.includes(sourceNs) && targetNs) {
                    const expectedTargetDataId = s.dataId.split(sourceNs).join(targetNs);
                    match = targetConfigs.find(t => t.dataId === expectedTargetDataId && t.group === s.group);
                    if (match) matchType = 'pattern';
                }

                // C. Determine Status
                let status: DiffItem['status'] = 'same';
                let suggestion = s.content;

                if (!match) {
                    status = 'missing_target';
                    // Suggestion: Content from source, maybe replacing namespace keywords
                    suggestion = s.content.split(sourceNs).join(targetNs);
                } else {
                    if (s.content !== match.content) {
                        status = 'diff';
                        // Suggestion: Source content adapted to target
                        suggestion = s.content.split(sourceNs).join(targetNs);
                    }
                }

                results.push({
                    ...s,
                    targetDataId: match?.dataId,
                    targetContent: match?.content,
                    status,
                    matchType,
                    suggestion
                });
            }

            // 2. Find items in Target that are missing in Source (Optional, usually we focus on syncing Source -> Target)
            // For completeness, we can list them as extra
            targetConfigs.forEach(t => {
                const sourceMatch = sourceConfigs.find(s => {
                    if (s.dataId === t.dataId) return true;
                    if (s.dataId.includes(sourceNs) && t.dataId === s.dataId.split(sourceNs).join(targetNs)) return true;
                    return false;
                });

                if (!sourceMatch) {
                    results.push({
                        dataId: t.dataId, // Target ID as primary here
                        group: t.group,
                        content: '', // No source content
                        env: targetNs,
                        targetDataId: t.dataId,
                        targetContent: t.content,
                        status: 'missing_source',
                        matchType: 'exact'
                    });
                }
            });

            setDiffList(results);
            recordAction('数据同步', `Nacos Compare: ${sourceNs} -> ${targetNs}`);
        } catch (e) {
            // Use console error instead of alert for failure
            console.error('Comparison failed:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = (item: DiffItem) => {
        const targetName = item.targetDataId || (item.matchType === 'pattern' ? item.dataId.split(sourceNs).join(targetNs) : item.dataId);
        
        setConfirmState({
            isOpen: true,
            title: '确认同步',
            message: (
                <div>
                    <p className="mb-2">确认将配置推送至目标环境?</p>
                    <div className="bg-slate-50 p-2 rounded border border-slate-100 font-mono text-xs">
                        <div>Target DataID: <span className="text-purple-600 font-bold">{targetName}</span></div>
                        <div>Target Namespace: <span className="text-purple-600 font-bold">{targetNs}</span></div>
                    </div>
                </div>
            ),
            onConfirm: () => {
                // Optimistic update
                setDiffList(prev => prev.map(p => 
                    p.dataId === item.dataId ? { ...p, status: 'same', targetContent: p.suggestion, targetDataId: targetName } : p
                ));
                setSelectedItem(null);
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
                confirmText="同步推送"
            />

            <div className="flex justify-between items-center mb-6">
                <div>
                   <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                     <Server className="text-blue-600"/> Nacos 配置同步
                   </h2>
                   <p className="text-slate-500 text-sm mt-1">支持跨环境智能匹配 (Dev &rarr; Prod) 与配置建议</p>
                </div>
            </div>

            {/* Connection Bar */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row items-start md:items-end gap-4">
                <div className="flex-1 space-y-3 w-full">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase"><Database size={12}/> 源环境 (Source)</div>
                    <div className="grid grid-cols-2 gap-2">
                        <input className={INPUT_STYLE} value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="http://localhost:8848" />
                        <input className={INPUT_STYLE} value={sourceNs} onChange={e => setSourceNs(e.target.value)} placeholder="Namespace (e.g. dev)" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                            <User className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
                            <input className={`${INPUT_STYLE} pl-8`} value={sourceUser} onChange={e => setSourceUser(e.target.value)} placeholder="Username" />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
                            <input className={`${INPUT_STYLE} pl-8`} type="password" value={sourcePass} onChange={e => setSourcePass(e.target.value)} placeholder="Password" />
                        </div>
                    </div>
                </div>
                
                <div className="hidden md:flex pb-10 text-slate-300">
                    <ArrowRight size={24} />
                </div>

                <div className="flex-1 space-y-3 w-full">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-600 uppercase"><Database size={12}/> 目标环境 (Target)</div>
                    <div className="grid grid-cols-2 gap-2">
                        <input className={INPUT_STYLE} value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="http://192.168.1.200:8848" />
                        <input className={INPUT_STYLE} value={targetNs} onChange={e => setTargetNs(e.target.value)} placeholder="Namespace (e.g. prod)" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                            <User className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
                            <input className={`${INPUT_STYLE} pl-8`} value={targetUser} onChange={e => setTargetUser(e.target.value)} placeholder="Username" />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
                            <input className={`${INPUT_STYLE} pl-8`} type="password" value={targetPass} onChange={e => setTargetPass(e.target.value)} placeholder="Password" />
                        </div>
                    </div>
                </div>

                <div className="w-full md:w-auto flex flex-col justify-end h-full pt-4 md:pt-0">
                    <button 
                        onClick={handleCompare}
                        disabled={loading}
                        className="h-10 px-6 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 mb-0.5 whitespace-nowrap"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/> 开始比对
                    </button>
                </div>
            </div>

            {/* Results Table */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[300px]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-slate-700">比对结果 ({diffList.length})</h3>
                    <div className="flex gap-4 text-xs font-medium">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> 一致</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> 差异</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span> 缺失</span>
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-3 font-semibold text-slate-700">Source Data ID</th>
                                <th className="px-6 py-3 font-semibold text-slate-700">Target Data ID</th>
                                <th className="px-6 py-3 font-semibold text-slate-700">Match Type</th>
                                <th className="px-6 py-3 font-semibold text-slate-700">Status</th>
                                <th className="px-6 py-3 font-semibold text-slate-700 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {diffList.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-mono text-blue-700">
                                        {item.status === 'missing_source' ? '-' : item.dataId}
                                    </td>
                                    <td className="px-6 py-3 font-mono text-purple-700">
                                        {item.targetDataId || '-'}
                                    </td>
                                    <td className="px-6 py-3 text-xs">
                                        {item.matchType === 'pattern' && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Pattern ({sourceNs}&rarr;{targetNs})</span>}
                                        {item.matchType === 'exact' && <span className="text-slate-400">Exact Name</span>}
                                    </td>
                                    <td className="px-6 py-3">
                                        {item.status === 'same' && <span className="text-green-600 font-bold flex items-center gap-1"><Check size={14}/> Consistent</span>}
                                        {item.status === 'diff' && <span className="text-red-600 font-bold flex items-center gap-1"><X size={14}/> Modified</span>}
                                        {item.status === 'missing_target' && <span className="text-orange-500 font-bold">Missing in Target</span>}
                                        {item.status === 'missing_source' && <span className="text-slate-400 font-bold">Extra in Target</span>}
                                    </td>
                                    <td className="px-6 py-3 text-right flex justify-end gap-2">
                                        <button 
                                            onClick={() => setSelectedItem(item)}
                                            className="px-3 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 text-xs font-bold transition-colors"
                                        >
                                            详情
                                        </button>
                                        {item.status !== 'same' && item.status !== 'missing_source' && (
                                            <button 
                                                onClick={() => handleSync(item)}
                                                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-bold transition-colors shadow-sm"
                                            >
                                                Sync
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {diffList.length === 0 && !loading && (
                                <tr><td colSpan={5} className="text-center py-10 text-slate-400">暂无数据，请点击开始比对</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Diff Modal */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-6xl h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center border-b border-slate-700">
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <FileText size={18}/> 配置差异对比
                                </h3>
                                <div className="text-xs text-slate-400 mt-1 flex gap-4 font-mono">
                                    <span>Source: {selectedItem.dataId}</span>
                                    {selectedItem.targetDataId && <span>Target: {selectedItem.targetDataId}</span>}
                                </div>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="flex-1 flex overflow-hidden">
                            {/* Source */}
                            <div className="flex-1 flex flex-col border-r border-slate-200 bg-slate-50">
                                <div className="p-2 border-b border-slate-200 text-xs font-bold text-blue-600 bg-blue-50 text-center uppercase tracking-wide">
                                    源环境 (Source) - {sourceNs}
                                </div>
                                <textarea readOnly className="flex-1 p-4 font-mono text-sm resize-none bg-transparent outline-none text-slate-700" value={selectedItem.content || '(Empty)'} />
                            </div>

                            {/* Target */}
                            <div className="flex-1 flex flex-col border-r border-slate-200 bg-white">
                                <div className="p-2 border-b border-slate-200 text-xs font-bold text-purple-600 bg-purple-50 text-center uppercase tracking-wide">
                                    目标环境 (Target) - {targetNs}
                                </div>
                                <textarea readOnly className="flex-1 p-4 font-mono text-sm resize-none bg-transparent outline-none text-slate-700" value={selectedItem.targetContent || '(Not found)'} />
                            </div>

                            {/* Suggestion */}
                            <div className="flex-1 flex flex-col bg-slate-50">
                                <div className="p-2 border-b border-slate-200 text-xs font-bold text-green-600 bg-green-50 text-center uppercase tracking-wide flex justify-center items-center gap-1">
                                    <Lightbulb size={12}/> 建议修改结果
                                </div>
                                <textarea readOnly className="flex-1 p-4 font-mono text-sm resize-none bg-transparent outline-none text-slate-700" value={selectedItem.suggestion || ''} />
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                            <button onClick={() => setSelectedItem(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 font-medium">关闭</button>
                            <button onClick={() => handleSync(selectedItem)} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-lg shadow-blue-500/30">
                                采纳建议并同步
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};