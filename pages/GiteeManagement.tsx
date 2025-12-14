import React, { useState, useEffect } from 'react';
import { GitPullRequest, Search, Download, Settings, RefreshCw, Save, Key, User, Calendar, FileText, ArrowRight, Lock, Globe, GitBranch, CheckSquare, Square, FolderOpen, AlertTriangle, Code2, Eye, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { apiService } from '../services/apiService';
import { recordAction } from '../services/auditService';
import { GiteeConfig, GiteeBranch, GiteeCommit } from '../types';
import * as XLSX from 'xlsx';

const INPUT_STYLE = "w-full pl-3 pr-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400";
const TEXTAREA_STYLE = "w-full p-3 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 font-mono resize-none";

// Export Field Configuration Types
interface ExportField {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  type?: 'text' | 'single-choice' | 'multi-choice';
  options?: string[];
}

// Changeset item with branch information
interface ChangesetItem {
  branch: string;
  requirementGroup?: string;
  commitHash: string;
  author: string;
  date: string;
  filePath: string;
  message: string;
}

// Mock Data
const MOCK_BRANCHES: GiteeBranch[] = [
  { name: 'master', lastCommitHash: 'a1b2c3d', lastUpdated: '2023-10-25 10:00' },
  { name: 'develop', lastCommitHash: 'e5f6g7h', lastUpdated: '2023-10-24 15:30' },
  { name: 'feature/req-20231024-pay', lastCommitHash: 'i8j9k0l', lastUpdated: '2023-10-24 09:15' },
  { name: 'feature/req-20231020-login', lastCommitHash: 'm1n2o3p', lastUpdated: '2023-10-20 11:00' },
  { name: 'bugfix/issue-2024-001', lastCommitHash: 'p1q2r3s', lastUpdated: '2023-10-19 08:30' },
];

const MOCK_COMMITS: GiteeCommit[] = [
  { id: 'a1b2c3d4e5f6g7h8i9j0', shortId: 'a1b2c3d', message: 'feat: add payment gateway integration', author: 'DevUser', date: '2023-10-25 10:00', filesChanged: 5 },
  { id: 'b2c3d4e5f6g7h8i9j0k1', shortId: 'b2c3d4e', message: 'fix: login timeout issue', author: 'Admin', date: '2023-10-24 16:20', filesChanged: 2 },
  { id: 'c3d4e5f6g7h8i9j0k1l2', shortId: 'c3d4e5f', message: 'docs: update api spec', author: 'DevUser', date: '2023-10-24 09:15', filesChanged: 1 },
];

// Default Export Fields Configuration
const DEFAULT_EXPORT_FIELDS: ExportField[] = [
  { id: 'filePath', label: '文件路径', value: 'file_path', visible: true, type: 'text' },
  { id: 'branch', label: '分支', value: 'branch', visible: true, type: 'text' },
  { id: 'commitHash', label: '提交ID', value: 'commit_hash', visible: true, type: 'text' },
  { id: 'message', label: '信息', value: 'commit_message', visible: true, type: 'text' },
  { id: 'author', label: '作者', value: 'commit_author', visible: true, type: 'text' },
  { id: 'date', label: '提交时间', value: 'commit_date', visible: true, type: 'text' },
  { id: 'reviewStatus', label: '评审状态', value: 'review_status', visible: false, type: 'single-choice', options: ['已评审', '未评审', '待复评'] },
  { id: 'fileStatus', label: '文件状态', value: 'file_status', visible: false, type: 'single-choice', options: ['新增', '修改', '删除'] },
];

export const GiteeManagement: React.FC = () => {
  // Config State
  const [config, setConfig] = useState<GiteeConfig>({ 
      repoUrl: '', 
      authType: 'token', 
      accessToken: '', 
      privateKey: '',
      publicKey: ''
  });
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Data State
  const [branches, setBranches] = useState<GiteeBranch[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set());
  const [commits, setCommits] = useState<GiteeCommit[]>([]);
  
  // Changeset Data - now structured with branch info
  const [changesetData, setChangesetData] = useState<Map<string, ChangesetItem[]>>(new Map());
  const [changesetOpen, setChangesetOpen] = useState(false);
  const [selectedCommitDetail, setSelectedCommitDetail] = useState<ChangesetItem | null>(null);
  
  // Export Configuration
  const [exportFields, setExportFields] = useState<ExportField[]>(DEFAULT_EXPORT_FIELDS);
  const [isExportConfigOpen, setIsExportConfigOpen] = useState(false);

  // Load Config from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gitee-config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig({ ...config, ...parsed });
      } catch (e) {
        console.error('Failed to load Gitee config:', e);
      }
    }
    
    // Load and clean up old export fields config
    const savedFields = localStorage.getItem('gitee-export-fields');
    if (savedFields) {
      try {
        const parsed = JSON.parse(savedFields);
        // Filter out old fields that are no longer in DEFAULT_EXPORT_FIELDS
        const validFieldIds = DEFAULT_EXPORT_FIELDS.map(f => f.id);
        const filteredFields = parsed.filter((f: any) => validFieldIds.includes(f.id));
        if (filteredFields.length > 0) {
          setExportFields(filteredFields);
        }
      } catch (e) {
        console.error('Failed to load export fields config:', e);
      }
    }
  }, []);

  const saveConfig = () => {
    localStorage.setItem('gitee-config', JSON.stringify(config));
    recordAction('Gitee管理', `保存配置 - 方式: ${config.authType === 'token' ? 'HTTPS/Token' : 'SSH'}`);
    setIsConfigOpen(false);
    alert('连接配置已保存');
  };

  const saveExportFieldsConfig = () => {
    localStorage.setItem('gitee-export-fields', JSON.stringify(exportFields));
    recordAction('Gitee管理', '保存导出字段配置');
    setIsExportConfigOpen(false);
    alert('导出字段配置已保存');
  };

  const handleSearch = async () => {
    setLoading(true);
    setBranches([]);
    setCommits([]);
    setSelectedBranches(new Set());
    
    setTimeout(() => {
        let results = MOCK_BRANCHES;
        if (searchQuery) {
            results = MOCK_BRANCHES.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        setBranches(results);
        setLoading(false);
        recordAction('Gitee管理', `查询分支 - 关键词: ${searchQuery || 'ALL'}`);
    }, 800);
  };

  const toggleBranchSelection = (branchName: string) => {
    const newSelected = new Set(selectedBranches);
    if (newSelected.has(branchName)) {
      newSelected.delete(branchName);
    } else {
      newSelected.add(branchName);
    }
    setSelectedBranches(newSelected);
  };

  const toggleAllBranches = () => {
    if (selectedBranches.size === branches.length && branches.length > 0) {
      setSelectedBranches(new Set());
    } else {
      setSelectedBranches(new Set(branches.map(b => b.name)));
    }
  };

  const handleFetchMultiBranchChanges = () => {
    if (selectedBranches.size === 0) {
      alert('请先选择至少一个分支');
      return;
    }

    setLoading(true);

    setTimeout(() => {
        // Generate mock changeset data for each branch
        const newChangesetData = new Map<string, ChangesetItem[]>();
        
        const allAuthors = ['DevUser', 'Admin', 'TestUser', 'ReviewUser'];
        const dates = ['2023-10-25 10:00', '2023-10-24 16:20', '2023-10-24 09:15', '2023-10-20 11:00'];
        const messages = ['feat: add payment gateway integration', 'fix: login timeout issue', 'docs: update api spec', 'refactor: optimize database queries'];
        
        selectedBranches.forEach((branchName, index) => {
          const items: ChangesetItem[] = [];
          const commitCount = 2 + Math.floor(Math.random() * 3);
          
          for (let i = 0; i < commitCount; i++) {
            items.push({
              branch: branchName,
              commitHash: `${String.fromCharCode(97 + i)}1b2c3d${i}`,
              author: allAuthors[i % allAuthors.length],
              date: dates[i % dates.length],
              filePath: `src/main/java/com/bank/service/${i === 0 ? 'PaymentService' : 'AuthService'}.java`,
              message: messages[i % messages.length],
            });
          }
          newChangesetData.set(branchName, items);
        });
        
        setChangesetData(newChangesetData);
        setLoading(false);
        setChangesetOpen(true);
        recordAction('Gitee管理', `拉取多分支变更集 - 分支数: ${selectedBranches.size}`);
    }, 1000);
  };

  const handleDownloadChangeset = async () => {
    if (changesetData.size === 0) {
      alert('请先导出变更集');
      return;
    }

    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      
      // Get visible fields in order
      const visibleFields = exportFields.filter(f => f.visible);
      
      // Prepare export data
      const exportData: any[] = [];
      
      // Iterate through each branch in order
      Array.from(changesetData.keys()).sort().forEach(branchName => {
        const items = changesetData.get(branchName) || [];
        
        items.forEach(item => {
          const row: any = {};
          // Use the ordered visible fields
          visibleFields.forEach(field => {
            if (field.id === 'branch') {
              row[field.label] = item.branch;
            } else if (field.id === 'filePath') {
              row[field.label] = item.filePath;
            } else if (field.id === 'commitHash') {
              row[field.label] = item.commitHash;
            } else if (field.id === 'message') {
              row[field.label] = item.message;
            } else if (field.id === 'author') {
              row[field.label] = item.author;
            } else if (field.id === 'date') {
              row[field.label] = item.date;
            } else if (field.id === 'reviewStatus') {
              row[field.label] = '未评审';
            } else if (field.id === 'fileStatus') {
              row[field.label] = '修改';
            } else {
              row[field.label] = '';
            }
          });
          
          // Only add rows that have actual file path data
          if (item.filePath && item.filePath.trim()) {
            exportData.push(row);
          }
        });
      });

      // Prepare validation rules for backend
      const validationRules: any[] = [];
      visibleFields.forEach((field, colIdx) => {
        if (field.type === 'single-choice' && field.options && field.options.length > 0) {
          validationRules.push({
            columnIndex: colIdx,
            columnName: field.label,
            options: field.options
          });
        }
      });

      console.log('Export Data:', { headers: visibleFields.map(f => f.label), dataCount: exportData.length, sample: exportData.slice(0, 2) });

      // Call backend to generate Excel with validation
      const response = await fetch('/api/gitee/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: `gitee_changeset_${timestamp}`,
          headers: visibleFields.map(f => f.label),
          data: exportData,
          validationRules: validationRules
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`导出失败: ${response.status} - ${errorText}`);
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gitee_changeset_${timestamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      recordAction('Gitee管理', `导出多分支变更集Excel - 记录数: ${exportData.length}`);
    } catch (error: any) {
      alert('导出失败: ' + error.message);
    }
  };

  const handleDownloadList = () => {
    if (changesetData.size === 0) {
      alert('请先导出变更集');
      return;
    }

    // Build content organized by branch - only file paths
    const lines: string[] = [];
    
    Array.from(changesetData.keys()).sort().forEach(branchName => {
      lines.push(`=== 分支: ${branchName} ===`);
      const items = changesetData.get(branchName) || [];
      items.forEach(item => {
        lines.push(item.filePath);
      });
      lines.push('');
    });

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `gitee_changeset_${timestamp}.txt`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    recordAction('Gitee管理', `导出变更清单文件: ${filename}`);
  };

  // Download single commit detail as TXT
  const downloadCommitDetailTxt = (item: ChangesetItem) => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const lines = [
      `分支: ${item.branch}`,
      `提交ID: ${item.commitHash}`,
      `作者: ${item.author}`,
      `时间: ${item.date}`,
      `信息: ${item.message}`,
      `文件: ${item.filePath}`,
    ];
    
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commit_${item.commitHash}_${timestamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    recordAction('Gitee管理', `导出单个提交记录TXT: ${item.commitHash}`);
  };

  // Download single branch as TXT (only file list)
  const downloadBranchTxt = (branchName: string) => {
    const items = changesetData.get(branchName) || [];
    if (items.length === 0) {
      alert('该分支没有提交记录');
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const lines = [`=== 分支: ${branchName} ===`];
    items.forEach(item => {
      lines.push(item.filePath);
    });

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gitee_${branchName}_${timestamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    recordAction('Gitee管理', `导出单个分支TXT: ${branchName}`);
  };

  // Download single branch as Excel
  const downloadBranchExcel = async (branchName: string) => {
    const items = changesetData.get(branchName) || [];
    if (items.length === 0) {
      alert('该分支没有提交记录');
      return;
    }

    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const visibleFields = exportFields.filter(f => f.visible);
      
      // Prepare export data
      const exportData: any[] = [];

      items.forEach(item => {
        const row: any = {};
        // Use ordered visible fields
        visibleFields.forEach(field => {
          if (field.id === 'branch') {
            row[field.label] = item.branch;
          } else if (field.id === 'filePath') {
            row[field.label] = item.filePath;
          } else if (field.id === 'commitHash') {
            row[field.label] = item.commitHash;
          } else if (field.id === 'message') {
            row[field.label] = item.message;
          } else if (field.id === 'author') {
            row[field.label] = item.author;
          } else if (field.id === 'date') {
            row[field.label] = item.date;
          } else if (field.id === 'reviewStatus') {
            row[field.label] = '未评审';
          } else if (field.id === 'fileStatus') {
            row[field.label] = '修改';
          } else {
            row[field.label] = '';
          }
        });
        
        if (item.filePath && item.filePath.trim()) {
          exportData.push(row);
        }
      });

      // Prepare validation rules for backend
      const validationRules: any[] = [];
      visibleFields.forEach((field, colIdx) => {
        if (field.type === 'single-choice' && field.options && field.options.length > 0) {
          validationRules.push({
            columnIndex: colIdx,
            columnName: field.label,
            options: field.options
          });
        }
      });

      // Call backend to generate Excel with validation
      const response = await fetch('/api/gitee/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: `gitee_${branchName}`,
          headers: visibleFields.map(f => f.label),
          data: exportData,
          validationRules: validationRules
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`导出失败: ${response.status} - ${errorText}`);
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gitee_${branchName}_${timestamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      recordAction('Gitee管理', `导出单个分支Excel: ${branchName}, 记录数: ${exportData.length}`);
    } catch (error: any) {
      alert('导出失败: ' + error.message);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <GitPullRequest className="text-red-600"/> Gitee 代码管理
           </h2>
           <p className="text-slate-500 text-sm mt-1">支持多分支选择、按需求分组导出变更集，导出字段可配置</p>
        </div>
        <div className="flex gap-2">
          <button 
              onClick={() => setIsExportConfigOpen(!isExportConfigOpen)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all shadow-sm ${isExportConfigOpen ? 'bg-slate-200 text-slate-700' : 'bg-white text-green-600 border border-slate-200 hover:bg-slate-50'}`}
          >
              <FolderOpen size={18}/> {isExportConfigOpen ? '收起配置' : '导出字段'}
          </button>
          <button 
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all shadow-sm ${isConfigOpen ? 'bg-slate-200 text-slate-700' : 'bg-white text-blue-600 border border-slate-200 hover:bg-slate-50'}`}
          >
              <Settings size={18}/> {isConfigOpen ? '收起配置' : '连接配置'}
          </button>
        </div>
      </div>

      {/* Export Fields Config Panel */}
      {isExportConfigOpen && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6 animate-in fade-in slide-in-from-top-4">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <FolderOpen size={18} className="text-green-500"/> 导出字段配置
              </h3>
              <p className="text-xs text-slate-500 mb-4">拖拽上下箭头调整字段顺序，打钩选择要导出的字段</p>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                  {exportFields.map((field, idx) => (
                      <div key={field.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                  {/* Move buttons */}
                                  <div className="flex flex-col gap-1">
                                      <button
                                          onClick={() => {
                                              if (idx > 0) {
                                                  const updated = [...exportFields];
                                                  [updated[idx], updated[idx - 1]] = [updated[idx - 1], updated[idx]];
                                                  setExportFields(updated);
                                              }
                                          }}
                                          disabled={idx === 0}
                                          className="text-slate-400 hover:text-blue-600 disabled:opacity-30 transition-colors p-0.5"
                                          title="上移"
                                      >
                                          <ChevronUp size={16} />
                                      </button>
                                      <button
                                          onClick={() => {
                                              if (idx < exportFields.length - 1) {
                                                  const updated = [...exportFields];
                                                  [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
                                                  setExportFields(updated);
                                              }
                                          }}
                                          disabled={idx === exportFields.length - 1}
                                          className="text-slate-400 hover:text-blue-600 disabled:opacity-30 transition-colors p-0.5"
                                          title="下移"
                                      >
                                          <ChevronDown size={16} />
                                      </button>
                                  </div>

                                  {/* Visibility toggle */}
                                  <button
                                      onClick={() => {
                                          const updated = [...exportFields];
                                          updated[idx].visible = !updated[idx].visible;
                                          setExportFields(updated);
                                      }}
                                      className="text-slate-500 hover:text-blue-600 transition-colors"
                                  >
                                      {field.visible ? <CheckSquare size={20} /> : <Square size={20} />}
                                  </button>

                                  {/* Field info */}
                                  <div>
                                      <div className="font-bold text-slate-700 text-sm">{field.label}</div>
                                      <div className="text-xs text-slate-500 font-mono">{field.value}</div>
                                  </div>
                              </div>
                              {field.type && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{field.type}</span>}
                          </div>
                          
                          {/* Options editor for single-choice fields */}
                          {field.type === 'single-choice' && field.options && (
                              <div className="mt-2 pl-8 border-l-2 border-blue-200">
                                  <label className="text-xs font-bold text-slate-600 uppercase block mb-2">选项配置</label>
                                  <div className="flex flex-wrap gap-2">
                                      {field.options.map((option, optIdx) => (
                                          <div key={optIdx} className="flex items-center gap-1 bg-white border border-blue-300 rounded px-2 py-1">
                                              <input
                                                  type="text"
                                                  value={option}
                                                  onChange={(e) => {
                                                      const updated = [...exportFields];
                                                      if (updated[idx].options) {
                                                          updated[idx].options[optIdx] = e.target.value;
                                                          setExportFields(updated);
                                                      }
                                                  }}
                                                  className="text-xs bg-transparent border-none outline-none w-20"
                                              />
                                              <button
                                                  onClick={() => {
                                                      const updated = [...exportFields];
                                                      if (updated[idx].options) {
                                                          updated[idx].options = updated[idx].options!.filter((_, i) => i !== optIdx);
                                                          setExportFields(updated);
                                                      }
                                                  }}
                                                  className="text-red-500 hover:text-red-700 text-sm font-bold"
                                              >
                                                  ×
                                              </button>
                                          </div>
                                      ))}
                                      <button
                                          onClick={() => {
                                              const updated = [...exportFields];
                                              if (updated[idx].options) {
                                                  updated[idx].options.push('新选项');
                                                  setExportFields(updated);
                                              }
                                          }}
                                          className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded font-bold"
                                      >
                                          + 添加选项
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>
                  ))}
              </div>
              <div className="flex justify-end pt-4 gap-2">
                  <button onClick={() => setIsExportConfigOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">取消</button>
                  <button onClick={saveExportFieldsConfig} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2 shadow-sm transition-colors">
                      <Save size={18}/> 保存字段配置
                  </button>
              </div>
          </div>
      )}

      {/* Config Panel */}
      {isConfigOpen && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6 animate-in fade-in slide-in-from-top-4">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Settings size={18} className="text-blue-500"/> 连接设置
              </h3>
              
              {/* Auth Type Selector */}
              <div className="flex gap-6 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="authType" 
                        checked={config.authType === 'token'}
                        onChange={() => setConfig({...config, authType: 'token'})}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700 flex items-center gap-1"><Lock size={14}/> HTTPS + Token (推荐)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="authType" 
                        checked={config.authType === 'ssh'}
                        onChange={() => setConfig({...config, authType: 'ssh'})}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700 flex items-center gap-1"><Key size={14}/> SSH Key</span>
                  </label>
              </div>

              <div className="space-y-4 max-w-4xl bg-slate-50 p-4 rounded-lg border border-slate-100">
                  {config.authType === 'token' ? (
                      // HTTPS / Token Config
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Repository URL (HTTPS)</label>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                                    <input 
                                        className={`${INPUT_STYLE} pl-10`} 
                                        placeholder="https://gitee.com/username/repo.git" 
                                        value={config.repoUrl}
                                        onChange={e => setConfig({...config, repoUrl: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Username (Optional)</label>
                                <input 
                                    className={INPUT_STYLE} 
                                    placeholder="e.g. dev_user" 
                                    value={config.username || ''}
                                    onChange={e => setConfig({...config, username: e.target.value})}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Personal Access Token</label>
                            <input 
                                className={INPUT_STYLE} 
                                type="password"
                                placeholder="Your Gitee Personal Access Token" 
                                value={config.accessToken || ''}
                                onChange={e => setConfig({...config, accessToken: e.target.value})}
                            />
                            <p className="text-[10px] text-slate-400 mt-1">建议使用 Token 代替密码以提高安全性。</p>
                        </div>
                      </>
                  ) : (
                      // SSH Config
                      <>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Repository URL (SSH)</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                                <input 
                                    className={`${INPUT_STYLE} pl-10`} 
                                    placeholder="git@gitee.com:username/repo.git" 
                                    value={config.repoUrl}
                                    onChange={e => setConfig({...config, repoUrl: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Public Key (公钥)</label>
                                <textarea 
                                    className={TEXTAREA_STYLE} 
                                    rows={4}
                                    placeholder="ssh-rsa AAAA... (Optional for display/verification)" 
                                    value={config.publicKey || ''}
                                    onChange={e => setConfig({...config, publicKey: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Private Key (私钥)</label>
                                <textarea 
                                    className={TEXTAREA_STYLE} 
                                    rows={4}
                                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..." 
                                    value={config.privateKey || ''}
                                    onChange={e => setConfig({...config, privateKey: e.target.value})}
                                />
                            </div>
                        </div>
                      </>
                  )}
              </div>
              
              <div className="flex justify-end pt-4">
                  <button onClick={saveConfig} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-colors">
                      <Save size={18}/> 保存并测试连接
                  </button>
              </div>
          </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
          {/* Left: Branch Search & Multi-Select */}
          <div className="w-full md:w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-700 mb-2">需求分支查询</h3>
                  <div className="relative mb-3">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                      <input 
                          className={`${INPUT_STYLE} pl-9 pr-12`} 
                          placeholder="输入需求编号或分支名..." 
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      />
                      <button 
                          onClick={handleSearch}
                          className="absolute right-1 top-1 bg-slate-200 hover:bg-slate-300 p-1.5 rounded text-slate-600 transition-colors"
                      >
                          <ArrowRight size={16}/>
                      </button>
                  </div>
                  {branches.length > 0 && (
                      <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-600 font-medium">
                              已选中: <span className="font-bold text-blue-600">{selectedBranches.size}</span> / {branches.length}
                          </span>
                          <button
                              onClick={toggleAllBranches}
                              className="text-xs font-bold text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
                          >
                              {selectedBranches.size === branches.length && branches.length > 0 ? '取消全选' : '全选'}
                          </button>
                      </div>
                  )}
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                  {branches.length > 0 ? (
                      branches.map(branch => (
                          <div 
                              key={branch.name}
                              onClick={() => toggleBranchSelection(branch.name)}
                              className={`p-3 rounded-lg cursor-pointer border mb-2 transition-all ${selectedBranches.has(branch.name) ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50'}`}
                          >
                              <div className="flex justify-between items-start gap-2">
                                  <div className="flex items-start gap-2 flex-1 min-w-0">
                                      <input 
                                          type="checkbox"
                                          checked={selectedBranches.has(branch.name)}
                                          onChange={() => toggleBranchSelection(branch.name)}
                                          onClick={e => e.stopPropagation()}
                                          className="mt-0.5 text-blue-600 rounded focus:ring-blue-500"
                                      />
                                      <div className="min-w-0 flex-1">
                                          <div className={`font-bold text-sm truncate ${selectedBranches.has(branch.name) ? 'text-blue-700' : 'text-slate-700'}`}>
                                              {branch.name}
                                          </div>
                                          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                              <Calendar size={12}/> {branch.lastUpdated}
                                          </div>
                                      </div>
                                  </div>
                                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono shrink-0">
                                      {branch.lastCommitHash}
                                  </span>
                              </div>
                          </div>
                      ))
                  ) : (
                      <div className="text-center py-10 text-slate-400 text-sm">
                          {loading ? '正在查询...' : '暂无数据，请输入关键词查询'}
                      </div>
                  )}
              </div>
              
              {selectedBranches.size > 0 && (
                  <div className="p-4 border-t border-slate-100 bg-slate-50">
                      <button
                          onClick={handleFetchMultiBranchChanges}
                          disabled={loading || selectedBranches.size === 0}
                          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                      >
                          <GitBranch size={16}/>
                          {loading ? '处理中...' : `导出 ${selectedBranches.size} 个分支变更`}
                      </button>
                  </div>
              )}
          </div>

          {/* Right: Changeset Display */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-700">变更集预览</h3>
                      {changesetData.size > 0 && <span className="text-xs font-mono bg-green-100 text-green-700 px-2 py-0.5 rounded">{changesetData.size}个分支</span>}
                  </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                  {changesetData.size > 0 ? (
                      <div className="space-y-4">
                          {Array.from(changesetData.keys()).sort().map(branchName => (
                              <div key={branchName} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                                  {/* Branch Header with Export Buttons */}
                                  <div className="bg-blue-50 border-b border-blue-100 px-4 py-3 sticky top-0 z-10">
                                      <div className="flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-2">
                                              <GitBranch size={16} className="text-blue-700"/>
                                              <h4 className="font-bold text-blue-700">{branchName}</h4>
                                              <span className="text-xs bg-blue-200 text-blue-700 px-2 py-0.5 rounded">
                                                  {(changesetData.get(branchName) || []).length} 条提交
                                              </span>
                                          </div>
                                          <div className="flex gap-2">
                                              <button
                                                  onClick={() => downloadBranchTxt(branchName)}
                                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
                                              >
                                                  <Download size={14}/> TXT
                                              </button>
                                              <button
                                                  onClick={() => downloadBranchExcel(branchName).catch(e => alert('导出失败: ' + e.message))}
                                                  className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
                                              >
                                                  <Download size={14}/> Excel
                                              </button>
                                          </div>
                                      </div>
                                  </div>
                                  
                                  {/* Commits List */}
                                  <div className="divide-y divide-slate-100">
                                      {(changesetData.get(branchName) || []).map((item, idx) => (
                                          <div key={idx} className="p-3 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedCommitDetail(item)}>
                                              <div className="flex items-start justify-between gap-2">
                                                  <div className="flex-1 min-w-0">
                                                      <div className="flex items-center gap-2 mb-1">
                                                          <code className="text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                                                              {item.commitHash}
                                                          </code>
                                                          <span className="text-xs text-slate-500">{item.author}</span>
                                                      </div>
                                                      <div className="text-sm text-slate-700 font-mono truncate mb-1">
                                                          {item.message}
                                                      </div>
                                                      <div className="text-xs text-slate-500 flex items-center gap-1">
                                                          <FileText size={12}/> {item.filePath}
                                                      </div>
                                                      <div className="text-xs text-slate-400 mt-1">
                                                          <Calendar size={12} className="inline mr-1"/>
                                                          {item.date}
                                                      </div>
                                                  </div>
                                                  <Eye size={16} className="text-slate-400 hover:text-blue-600 flex-shrink-0 mt-1"/>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-300">
                          <GitPullRequest size={48} className="mb-4 opacity-50"/>
                          <p className="text-lg font-medium">请在左侧选择分支并导出</p>
                      </div>
                  )}
              </div>

              {changesetData.size > 0 && (
                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2 justify-end">
                      <button 
                          onClick={handleDownloadList}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
                      >
                          <Download size={16}/> 下载 TXT
                      </button>
                      <button 
                          onClick={() => handleDownloadChangeset().catch(e => alert('导出失败: ' + e.message))}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
                      >
                          <Download size={16}/> 导出 Excel
                      </button>
                  </div>
              )}
          </div>
      </div>

      {/* Commit Detail Modal - View & Export Single Commit */}
      {selectedCommitDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="text-lg font-bold text-slate-800">提交记录详情</h3>
                          <p className="text-xs text-slate-500 font-mono mt-1">分支: {selectedCommitDetail.branch}</p>
                      </div>
                      <button onClick={() => setSelectedCommitDetail(null)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {/* Commit Info */}
                      <div className="space-y-3">
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">提交ID</label>
                              <div className="mt-1 p-3 bg-slate-100 rounded-lg font-mono text-sm text-slate-700">
                                  {selectedCommitDetail.commitHash}
                              </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase">作者</label>
                                  <div className="mt-1 p-3 bg-slate-50 rounded-lg text-sm text-slate-700 flex items-center gap-2">
                                      <User size={16} className="text-blue-500"/> {selectedCommitDetail.author}
                                  </div>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-slate-500 uppercase">提交时间</label>
                                  <div className="mt-1 p-3 bg-slate-50 rounded-lg text-sm text-slate-700 flex items-center gap-2">
                                      <Calendar size={16} className="text-green-500"/> {selectedCommitDetail.date}
                                  </div>
                              </div>
                          </div>
                          
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">提交信息</label>
                              <div className="mt-1 p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
                                  {selectedCommitDetail.message}
                              </div>
                          </div>
                          
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">文件路径</label>
                              <div className="mt-1 p-3 bg-slate-50 rounded-lg text-sm text-slate-700 font-mono flex items-center gap-2">
                                  <FileText size={16} className="text-orange-500"/> {selectedCommitDetail.filePath}
                              </div>
                          </div>
                      </div>
                  </div>
                  
                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button onClick={() => setSelectedCommitDetail(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium">关闭</button>
                      <button 
                        onClick={() => {
                          if (selectedCommitDetail) {
                            downloadCommitDetailTxt(selectedCommitDetail);
                            setSelectedCommitDetail(null);
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold flex items-center gap-2 shadow-sm"
                      >
                          <Download size={16}/> 导出 TXT
                      </button>
                      <button 
                        onClick={() => {
                          // Export single commit as Excel
                          if (selectedCommitDetail) {
                            const timestamp = new Date().toISOString().slice(0, 10);
                            const exportData = [{
                              '分支': selectedCommitDetail.branch,
                              '提交ID': selectedCommitDetail.commitHash,
                              '作者': selectedCommitDetail.author,
                              '时间': selectedCommitDetail.date,
                              '信息': selectedCommitDetail.message,
                              '文件': selectedCommitDetail.filePath,
                            }];
                            const wb = XLSX.utils.book_new();
                            const ws = XLSX.utils.json_to_sheet(exportData);
                            XLSX.utils.book_append_sheet(wb, ws, "Commit");
                            XLSX.writeFile(wb, `commit_${selectedCommitDetail.commitHash}_${timestamp}.xlsx`);
                            recordAction('Gitee管理', `导出单个提交记录Excel: ${selectedCommitDetail.commitHash}`);
                            setSelectedCommitDetail(null);
                          }
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-bold flex items-center gap-2 shadow-sm"
                      >
                          <Download size={16}/> 导出 Excel
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
