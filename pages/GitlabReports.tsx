import React, { useState, useEffect, useMemo } from 'react';
import {GitBranch, Search, Download, Settings, RefreshCw, Save, Plus, Trash2, ExternalLink, ShieldCheck, LayoutTemplate, Filter, User, Tag, Flag, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Database, TABLE } from '../services/database';
import { recordAction } from '../services/auditService';
import * as XLSX from 'xlsx';

const INPUT_STYLE = "w-full pl-3 pr-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400";
const SELECT_STYLE = "w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 appearance-none cursor-pointer";

// --- Types ---

interface GitLabSettings {
  host: string;
  token: string;
}

interface ReportColumn {
  id: string;
  field: string;
  title: string;
  visible: boolean;
}

interface DropdownOption {
  label: string;
  value: string | number;
}

type ReportType = 'projects' | 'issues' | 'merge_requests';

// --- Constants & Defaults ---

const FIELD_DEFINITIONS: Record<ReportType, { value: string; label: string }[]> = {
  projects: [
    { value: 'id', label: 'ID' },
    { value: 'name', label: 'Project Name' },
    { value: 'path_with_namespace', label: 'Full Path' },
    { value: 'description', label: 'Description' },
    { value: 'star_count', label: 'Stars' },
    { value: 'forks_count', label: 'Forks' },
    { value: 'last_activity_at', label: 'Last Activity' },
    { value: 'web_url', label: 'Web URL' }
  ],
  issues: [
    { value: 'iid', label: 'Issue ID' },
    { value: 'title', label: 'Title' },
    { value: 'state', label: 'State' },
    { value: 'author.name', label: 'Author' },
    { value: 'assignee.name', label: 'Assignee' }, // Simple handling, complex array handling in render
    { value: 'milestone.title', label: 'Milestone' },
    { value: 'labels', label: 'Labels' },
    { value: 'created_at', label: 'Created At' },
    { value: 'updated_at', label: 'Updated At' },
    { value: 'web_url', label: 'Web URL' }
  ],
  merge_requests: [
    { value: 'iid', label: 'MR ID' },
    { value: 'title', label: 'Title' },
    { value: 'state', label: 'State' },
    { value: 'author.name', label: 'Author' },
    { value: 'assignee.name', label: 'Assignee' },
    { value: 'source_branch', label: 'Source Branch' },
    { value: 'target_branch', label: 'Target Branch' },
    { value: 'created_at', label: 'Created At' },
    { value: 'web_url', label: 'Web URL' }
  ]
};

const DEFAULT_COLUMNS: Record<ReportType, ReportColumn[]> = {
  projects: [
    { id: 'p1', field: 'name', title: '项目名称', visible: true },
    { id: 'p2', field: 'path_with_namespace', title: '完整路径', visible: true },
    { id: 'p3', field: 'description', title: '描述', visible: true },
    { id: 'p4', field: 'last_activity_at', title: '最后活跃', visible: true },
    { id: 'p5', field: 'star_count', title: '热度', visible: true },
  ],
  issues: [
    { id: 'i1', field: 'iid', title: '编号', visible: true },
    { id: 'i2', field: 'title', title: '标题', visible: true },
    { id: 'i3', field: 'state', title: '状态', visible: true },
    { id: 'i4', field: 'assignee.name', title: '指派给', visible: true },
    { id: 'i5', field: 'milestone.title', title: '里程碑', visible: true },
    { id: 'i6', field: 'labels', title: '标记', visible: true },
    { id: 'i7', field: 'created_at', title: '创建时间', visible: true },
  ],
  merge_requests: [
    { id: 'm1', field: 'iid', title: '编号', visible: true },
    { id: 'm2', field: 'title', title: '标题', visible: true },
    { id: 'm3', field: 'state', title: '状态', visible: true },
    { id: 'm4', field: 'author.name', title: '作者', visible: true },
    { id: 'm5', field: 'source_branch', title: '源分支', visible: true },
    { id: 'm6', field: 'target_branch', title: '目标分支', visible: true },
  ]
};

export const GitlabReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'report' | 'config'>('report');
  const [settings, setSettings] = useState<GitLabSettings>({ 
    host: 'https://gitlab.com', 
    token: '' 
  });
  
  // --- Report State ---
  const [reportType, setReportType] = useState<ReportType>('issues'); // Default to Issues for rich filtering
  const [columnsMap, setColumnsMap] = useState<Record<ReportType, ReportColumn[]>>(DEFAULT_COLUMNS);
  
  // --- Filter State ---
  const [targetProjectId, setTargetProjectId] = useState<string>('278964'); // Default to gitlab-org/gitlab (ID: 278964) for testing
  const [filters, setFilters] = useState({
    state: 'opened',
    assignee_id: '',
    author_id: '',
    milestone: '',
    labels: '',
    search: ''
  });

  // --- Pagination State ---
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 0,
    isTotalUnknown: false
  });

  // --- Dynamic Options State ---
  const [options, setOptions] = useState<{
    projects: DropdownOption[];
    users: DropdownOption[];
    milestones: DropdownOption[];
    labels: DropdownOption[];
  }>({
    projects: [{ label: 'gitlab-org/gitlab (Test)', value: '278964' }],
    users: [],
    milestones: [],
    labels: []
  });

  // --- Data State ---
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Column Config State for UI
  const [newColumnField, setNewColumnField] = useState('');
  const [newColumnTitle, setNewColumnTitle] = useState('');

  // Initial Load from DB
  useEffect(() => {
    const saved = Database.findObject<{settings: GitLabSettings, columnsMap: Record<ReportType, ReportColumn[]>}>(TABLE.GITLAB_SETTINGS);
    if (saved) {
      if(saved.settings) setSettings(saved.settings);
      if(saved.columnsMap) setColumnsMap(saved.columnsMap);
    }
  }, []);

  // Reset context filters when project changes
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      assignee_id: '',
      milestone: '',
      labels: ''
    }));
    // Reset pagination
    setPagination(prev => ({ ...prev, page: 1, total: 0, totalPages: 0, isTotalUnknown: false }));
    setData([]);
  }, [targetProjectId, reportType]);

  const apiFetch = async (endpoint: string, returnHeaders = false) => {
    const baseUrl = settings.host.replace(/\/$/, '');
    const headers: Record<string, string> = {};
    if (settings.token) {
        headers['PRIVATE-TOKEN'] = settings.token;
    }
    
    const res = await fetch(`${baseUrl}/api/v4${endpoint}`, { headers });
    
    if (res.status === 401) throw new Error("Unauthorized. Please check your Access Token.");
    if (res.status === 404) throw new Error("Resource not found. Check Project ID or URL.");
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    
    const data = await res.json();
    return returnHeaders ? { data, headers: res.headers } : data;
  };

  const fetchProjectsForDropdown = async () => {
    try {
      // membership=true to get projects user is member of
      const data = await apiFetch('/projects?membership=true&simple=true&per_page=100&order_by=last_activity_at');
      const opts = data.map((p: any) => ({ label: p.name_with_namespace || p.name, value: p.id }));
      setOptions(prev => ({ ...prev, projects: opts }));
    } catch (e) { console.error("Failed to load projects", e); }
  };

  const fetchProjectContextOptions = async (projectId: string) => {
    setOptionsLoading(true);
    
    // Helper to allow partial success (Promise.allSettled behavior logic)
    const fetchSafe = async (url: string) => {
        try {
            return await apiFetch(url);
        } catch (e) {
            console.warn(`Failed to fetch ${url}`, e);
            return []; // Return empty array on failure
        }
    };

    try {
      // Parallel fetch for Members, Milestones, and Labels
      // We limit to 100 items for dropdown performance
      // Note: /members often requires auth even for public projects
      const [members, milestones, labels] = await Promise.all([
        settings.token ? fetchSafe(`/projects/${projectId}/members/all?per_page=100`) : Promise.resolve([]),
        fetchSafe(`/projects/${projectId}/milestones?state=active&per_page=100`),
        fetchSafe(`/projects/${projectId}/labels?per_page=100`)
      ]);

      setOptions(prev => ({
        ...prev,
        users: Array.isArray(members) ? members.map((u: any) => ({ label: u.name, value: u.id })) : [],
        milestones: Array.isArray(milestones) ? milestones.map((m: any) => ({ label: m.title, value: m.title })) : [],
        labels: Array.isArray(labels) ? labels.map((l: any) => ({ label: l.name, value: l.name })) : []
      }));
    } finally {
      setOptionsLoading(false);
    }
  };

  // Extract metadata from loaded data as fallback/augmentation for filters
  useEffect(() => {
    if (data.length > 0) {
        setOptions(prev => {
            const newUsers = [...prev.users];
            const newMilestones = [...prev.milestones];
            const newLabels = [...prev.labels];
            let changed = false;

            // Extract Authors / Assignees
            data.forEach(item => {
                // Assignees
                if (item.assignee && !newUsers.some(u => u.value === item.assignee.id)) {
                    newUsers.push({ label: item.assignee.name, value: item.assignee.id });
                    changed = true;
                }
                if (item.assignees && Array.isArray(item.assignees)) {
                    item.assignees.forEach((a: any) => {
                        if(!newUsers.some(u => u.value === a.id)) {
                            newUsers.push({ label: a.name, value: a.id });
                            changed = true;
                        }
                    });
                }
                // Authors
                if (item.author && !newUsers.some(u => u.value === item.author.id)) {
                     newUsers.push({ label: item.author.name, value: item.author.id });
                     changed = true;
                }

                // Milestones
                if (item.milestone && !newMilestones.some(m => m.value === item.milestone.title)) {
                    newMilestones.push({ label: item.milestone.title, value: item.milestone.title });
                    changed = true;
                }

                // Labels
                if (item.labels && Array.isArray(item.labels)) {
                    item.labels.forEach((l: string) => {
                         if (!newLabels.some(lbl => lbl.value === l)) {
                             newLabels.push({ label: l, value: l });
                             changed = true;
                         }
                    });
                }
            });
            
            if (changed) {
                return {
                    ...prev,
                    users: newUsers.sort((a,b) => a.label.localeCompare(b.label)),
                    milestones: newMilestones,
                    labels: newLabels.sort((a,b) => a.label.localeCompare(b.label))
                };
            }
            return prev;
        });
    }
  }, [data]);

  // Load Projects for Dropdown on mount/settings change
  useEffect(() => {
    if (settings.token) {
      fetchProjectsForDropdown();
    }
  }, [settings.token, settings.host]);

  // Load Context Options (Users, Milestones, Labels) when Project changes OR on mount if default is set
  useEffect(() => {
    if (targetProjectId) {
      fetchProjectContextOptions(targetProjectId);
    } else {
      setOptions(prev => ({ ...prev, users: [], milestones: [], labels: [] }));
    }
  }, [targetProjectId, settings.token]);


  const saveConfig = () => {
    Database.saveObject(TABLE.GITLAB_SETTINGS, { settings, columnsMap });
    recordAction('GitLab报表', '保存配置 - 更新了连接或列定义');
    alert('配置已保存');
  };

  const fetchData = async (targetPage = 1) => {
    // Allow public fetch if no token is set but we are targeting the default public project
    if (!settings.token && targetProjectId !== '278964') {
        return setError("请先配置 Access Token (或者使用默认测试项目 ID: 278964)");
    }
    
    setLoading(true);
    setError(null);

    try {
      let endpoint = '';
      const params = new URLSearchParams();
      params.append('page', targetPage.toString());
      params.append('per_page', pagination.perPage.toString());

      if (reportType === 'projects') {
        endpoint = '/projects';
        params.append('membership', 'true');
        params.append('simple', 'false'); // Need details for stats
        if (filters.search) params.append('search', filters.search);
        // Note: Projects don't support assignee/milestone filtering directly
      } else {
        // Issues or MRs
        const resource = reportType === 'issues' ? 'issues' : 'merge_requests';
        
        // Scope by Project if selected, else Global
        if (targetProjectId) {
          endpoint = `/projects/${targetProjectId}/${resource}`;
        } else {
          endpoint = `/${resource}`;
          params.append('scope', 'all'); // Required for global queries sometimes
        }

        // Apply filters
        if (filters.state && filters.state !== 'all') params.append('state', filters.state);
        if (filters.assignee_id) params.append('assignee_id', filters.assignee_id);
        if (filters.author_id) params.append('author_id', filters.author_id);
        if (filters.milestone) params.append('milestone', filters.milestone);
        if (filters.labels) params.append('labels', filters.labels);
        if (filters.search) params.append('search', filters.search);
      }

      const { data, headers } = await apiFetch(`${endpoint}?${params.toString()}`, true);
      
      const totalHeader = headers.get('x-total');
      const totalPagesHeader = headers.get('x-total-pages');

      if (totalHeader) {
          // Standard pagination with known total
          setPagination(prev => ({
              ...prev,
              page: targetPage,
              total: parseInt(totalHeader, 10),
              totalPages: parseInt(totalPagesHeader || '0', 10),
              isTotalUnknown: false
          }));
      } else {
          // Fallback when headers are missing (e.g. CORS issues)
          // We assume if we got full page of data, there might be more
          setPagination(prev => ({
              ...prev,
              page: targetPage,
              total: 0,
              totalPages: 0,
              isTotalUnknown: true
          }));
      }

      setData(data);
      recordAction('GitLab报表', `查询数据 - ${reportType} (Page ${targetPage}, Items ${data.length})`);

    } catch (err: any) {
      setError(err.message || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  // --- Helpers for Display ---
  
  const getNestedValue = (obj: any, path: string) => {
    if (!obj) return '';
    if (!path.includes('.')) {
        // Handle Arrays specifically for labels
        if (path === 'labels' && Array.isArray(obj[path])) {
            return obj[path].join(', ');
        }
        return obj[path];
    }
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  // --- Export ---
  
  const handleExport = () => {
    if (data.length === 0) return alert("无数据");
    const currentCols = columnsMap[reportType];
    const exportData = data.map(row => {
      const map: any = {};
      currentCols.forEach(c => {
        if (c.visible) map[c.title] = getNestedValue(row, c.field);
      });
      return map;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `gitlab_${reportType}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // --- UI Components ---

  const renderFilterBar = () => {
    // Projects report has fewer filters
    if (reportType === 'projects') {
      return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 flex gap-4">
           <div className="flex-1">
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">关键词搜索</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                <input 
                  className={`${INPUT_STYLE} pl-9`} 
                  placeholder="搜索项目名称..." 
                  value={filters.search}
                  onChange={e => setFilters({...filters, search: e.target.value})}
                />
              </div>
           </div>
        </div>
      );
    }

    // Issues & MRs Filters
    return (
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Target Project (Context) */}
          <div className="md:col-span-2">
             <label className="text-xs font-bold text-blue-600 uppercase mb-1 flex items-center gap-1">
               <ShieldCheck size={12}/> 目标项目 (加载下拉选项)
             </label>
             <div className="relative">
                <select 
                  className={SELECT_STYLE}
                  value={targetProjectId}
                  onChange={e => setTargetProjectId(e.target.value)}
                >
                  <option value="">-- 全局查询 --</option>
                  <option value="278964">gitlab-org/gitlab (Test)</option>
                  {options.projects.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                {/* Manual Input fallback */}
                <input 
                   className="absolute top-0 right-0 w-16 h-full opacity-0 cursor-text"
                   placeholder="Or type ID"
                   onChange={(e) => { if(e.target.value) setTargetProjectId(e.target.value) }}
                />
             </div>
          </div>

          <div>
             <label className="text-xs font-bold text-slate-500 uppercase mb-1">状态 (STATE)</label>
             <select 
                className={SELECT_STYLE}
                value={filters.state}
                onChange={e => setFilters({...filters, state: e.target.value})}
             >
                <option value="opened">开启 (Opened)</option>
                <option value="closed">关闭 (Closed)</option>
                <option value="merged">已合并 (Merged)</option>
                <option value="all">全部 (All)</option>
             </select>
          </div>

          <div>
             <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <User size={12}/> 指派给 (ASSIGNEE)
             </label>
             <select 
                className={SELECT_STYLE}
                value={filters.assignee_id}
                onChange={e => setFilters({...filters, assignee_id: e.target.value})}
                disabled={!targetProjectId}
             >
                <option value="">{optionsLoading ? 'Loading...' : '所有'}</option>
                {options.users.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
             </select>
          </div>

          <div>
             <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <Flag size={12}/> 里程碑 (MILESTONE)
             </label>
             <select 
                className={SELECT_STYLE}
                value={filters.milestone}
                onChange={e => setFilters({...filters, milestone: e.target.value})}
                disabled={!targetProjectId}
             >
                <option value="">{optionsLoading ? 'Loading...' : '所有'}</option>
                {options.milestones.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
             </select>
          </div>

          <div>
             <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <Tag size={12}/> 标记 (LABEL)
             </label>
             <select 
                className={SELECT_STYLE}
                value={filters.labels}
                onChange={e => setFilters({...filters, labels: e.target.value})}
                disabled={!targetProjectId}
             >
                <option value="">{optionsLoading ? 'Loading...' : '所有'}</option>
                {options.labels.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
             </select>
          </div>
      </div>
    );
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <GitBranch className="text-orange-600"/> GitLab 数据报表
           </h2>
           <p className="text-slate-500 text-sm mt-1">支持多条件查询、动态下拉列表与数据导出 (默认使用公开仓库进行测试)</p>
        </div>
        
        <div className="flex gap-2 bg-slate-200 p-1 rounded-lg">
             <button 
                onClick={() => setActiveTab('report')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'report' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500'}`}
             >
                <LayoutTemplate size={16} /> 报表视图
             </button>
             <button 
                onClick={() => setActiveTab('config')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'config' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
             >
                <Settings size={16} /> 设置
             </button>
        </div>
      </div>

      {activeTab === 'report' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Report Type Selector */}
            <div className="mb-4 flex gap-4 items-center">
               <label className="text-sm font-bold text-slate-700">报表类型:</label>
               <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                  {(['projects', 'issues', 'merge_requests'] as ReportType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => { setReportType(type); setData([]); setPagination(p => ({...p, page: 1, total: 0})); }}
                      className={`px-3 py-1.5 text-xs font-bold rounded capitalize transition-colors ${reportType === type ? 'bg-orange-100 text-orange-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      {type.replace('_', ' ')}
                    </button>
                  ))}
               </div>
            </div>

            {renderFilterBar()}

            {/* Action Bar */}
            <div className="flex justify-between items-center mb-4">
               <div className="text-sm text-slate-500 font-mono">
                  {loading ? '加载中...' : `本页 ${data.length} 条数据`} 
                  {targetProjectId && !optionsLoading && !loading && ' (Context Loaded)'}
                  {optionsLoading && ' (Loading Options...)'}
               </div>
               <div className="flex gap-3">
                  <button 
                    onClick={() => fetchData(1)} 
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-colors shadow-sm disabled:opacity-50"
                  >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    执行查询
                  </button>
                  <button 
                    onClick={handleExport}
                    disabled={data.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Download size={16} />
                    导出 Excel
                  </button>
               </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-sm mb-4 flex justify-between">
                    <span>Error: {error}</span>
                    <button onClick={() => setError(null)}><Filter size={14}/></button>
                </div>
            )}

            {/* Table */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
               <div className="overflow-auto flex-1">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                     <tr>
                       {columnsMap[reportType].filter(c => c.visible).map(col => (
                         <th key={col.id} className="px-6 py-4 font-semibold text-slate-700 bg-slate-50">
                            {col.title}
                         </th>
                       ))}
                       <th className="px-6 py-4 font-semibold text-slate-700 bg-slate-50 text-right">Link</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {data.length > 0 ? data.map((row, idx) => (
                       <tr key={idx} className="hover:bg-slate-50">
                         {columnsMap[reportType].filter(c => c.visible).map(col => {
                           const val = getNestedValue(row, col.field);
                           return (
                             <td key={col.id} className="px-6 py-3 text-slate-600 max-w-xs truncate" title={String(val)}>
                               {/* Special rendering for certain fields */}
                               {col.field === 'state' ? (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${val === 'opened' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {val}
                                  </span>
                               ) : (
                                  val || '-'
                               )}
                             </td>
                           );
                         })}
                         <td className="px-6 py-3 text-right">
                            <a href={row.web_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800">
                                <ExternalLink size={16}/>
                            </a>
                         </td>
                       </tr>
                     )) : (
                       <tr>
                         <td colSpan={10} className="text-center py-12 text-slate-400">
                            暂无数据
                         </td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
               
               {/* Pagination */}
               <div className="border-t border-slate-200 p-3 bg-slate-50 flex items-center justify-between">
                   <div className="text-sm text-slate-500 font-medium">
                        {!pagination.isTotalUnknown ? (
                            `显示 ${(pagination.page - 1) * pagination.perPage + 1} - ${Math.min(pagination.page * pagination.perPage, pagination.total)} 条，共 ${pagination.total} 条`
                        ) : (
                            `第 ${pagination.page} 页 (总数未知)`
                        )}
                   </div>
                   <div className="flex items-center gap-2">
                        <button 
                            disabled={pagination.page <= 1 || loading}
                            onClick={() => fetchData(pagination.page - 1)}
                            className="p-2 border border-slate-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-white shadow-sm transition-colors text-slate-600"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-bold text-slate-700 px-2 bg-white border border-slate-200 rounded py-1">
                            {pagination.page}
                        </span>
                        <button 
                            disabled={(!pagination.isTotalUnknown && pagination.page >= pagination.totalPages) || (pagination.isTotalUnknown && data.length < pagination.perPage) || loading}
                            onClick={() => fetchData(pagination.page + 1)}
                            className="p-2 border border-slate-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-white shadow-sm transition-colors text-slate-600"
                        >
                            <ChevronRight size={16} />
                        </button>
                   </div>
               </div>
            </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Connection Settings */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <ShieldCheck className="text-blue-600" size={20}/> 连接设置
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">GitLab Host</label>
                            <input 
                                className={INPUT_STYLE} 
                                value={settings.host}
                                onChange={e => setSettings({...settings, host: e.target.value})}
                                placeholder="https://gitlab.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Access Token</label>
                            <input 
                                className={INPUT_STYLE} 
                                type="password"
                                value={settings.token}
                                onChange={e => setSettings({...settings, token: e.target.value})}
                                placeholder="Leave empty for public projects"
                            />
                        </div>
                    </div>
                </div>

                {/* Column Config */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-slate-800">列配置 ({reportType})</h3>
                        <div className="flex bg-slate-100 rounded p-1">
                             {(['projects', 'issues', 'merge_requests'] as ReportType[]).map(t => (
                               <button 
                                 key={t}
                                 onClick={() => setReportType(t)}
                                 className={`px-3 py-1 text-xs font-bold rounded capitalize ${reportType === t ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}
                               >
                                 {t.replace('_', ' ')}
                               </button>
                             ))}
                        </div>
                    </div>

                    {/* Add Column */}
                    <div className="bg-slate-50 p-4 rounded-lg flex gap-4 items-end mb-4 border border-slate-100">
                        <div className="flex-1">
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">中文标题</label>
                           <input className={INPUT_STYLE} value={newColumnTitle} onChange={e => setNewColumnTitle(e.target.value)} placeholder="e.g. 指派人" />
                        </div>
                        <div className="flex-1">
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">API 字段 (Key)</label>
                           <select className={INPUT_STYLE} value={newColumnField} onChange={e => setNewColumnField(e.target.value)}>
                              <option value="">-- Select --</option>
                              {FIELD_DEFINITIONS[reportType].map(f => (
                                <option key={f.value} value={f.value}>{f.label} ({f.value})</option>
                              ))}
                           </select>
                        </div>
                        <button 
                           onClick={() => {
                             if(newColumnTitle && newColumnField) {
                               setColumnsMap(prev => ({
                                 ...prev,
                                 [reportType]: [...prev[reportType], { id: Date.now().toString(), title: newColumnTitle, field: newColumnField, visible: true }]
                               }));
                               setNewColumnTitle('');
                             }
                           }}
                           className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold h-[38px] mb-[1px]"
                        >
                           <Plus size={18}/>
                        </button>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                       {columnsMap[reportType].map((col, idx) => (
                         <div key={col.id} className="flex justify-between items-center p-3 border-b border-slate-100 last:border-0 bg-white hover:bg-slate-50">
                            <span className="font-bold text-sm text-slate-700 w-1/3">{col.title}</span>
                            <span className="font-mono text-xs text-slate-500 w-1/3">{col.field}</span>
                            <div className="flex gap-2">
                               <button 
                                 onClick={() => {
                                   const newCols = [...columnsMap[reportType]];
                                   newCols[idx].visible = !newCols[idx].visible;
                                   setColumnsMap(prev => ({...prev, [reportType]: newCols}));
                                 }}
                                 className={`text-xs px-2 py-1 rounded font-bold ${col.visible ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}
                               >
                                 {col.visible ? '显示' : '隐藏'}
                               </button>
                               <button 
                                 onClick={() => {
                                   const newCols = columnsMap[reportType].filter(c => c.id !== col.id);
                                   setColumnsMap(prev => ({...prev, [reportType]: newCols}));
                                 }}
                                 className="text-red-400 hover:bg-red-50 p-1 rounded"
                               >
                                 <Trash2 size={14}/>
                               </button>
                            </div>
                         </div>
                       ))}
                    </div>
                </div>

                <div className="flex justify-end">
                   <button onClick={saveConfig} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 flex items-center gap-2">
                      <Save size={18}/> 保存配置
                   </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
