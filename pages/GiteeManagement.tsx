import React, { useState, useEffect } from 'react';
import { GitPullRequest, Search, Download, Settings, RefreshCw, Save, Key, User, Calendar, FileText, ArrowRight, Lock, Globe, GitBranch, CheckSquare, Square, FolderOpen, AlertTriangle, Code2, Eye, ChevronUp, ChevronDown, Trash2, X } from 'lucide-react';
import { apiService } from '../services/apiService';
import { recordAction } from '../services/auditService';
import { Pagination } from '../components/Pagination';
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

// Excel Export Style Configuration
interface ExcelExportStyle {
  rowHeight: number; // 行高，单位为点(pt)
  columnWidth: number; // 默认列宽，单位为字符数
  headerRowHeight: number; // 表头行高
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

// Analysis collection item - represents a selected branch for analysis
interface AnalysisItem {
  id: string; // UUID for unique identification
  branchName: string;
  addedTime: string; // When it was added to the collection
  description?: string; // Optional description
}

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

// Default Excel Export Style Configuration
const DEFAULT_EXCEL_STYLE: ExcelExportStyle = {
  rowHeight: 18,
  columnWidth: 20,
  headerRowHeight: 22
};

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
  const [branchNameFilter, setBranchNameFilter] = useState(''); // Branch name filter for branch search
  const [branchAuthorFilter, setBranchAuthorFilter] = useState(''); // Author filter for branches (last commit author)
  const [authorFilter, setAuthorFilter] = useState(''); // Author filter for commits
  const [loading, setLoading] = useState(false);
  
  // Data State
  const [branches, setBranches] = useState<GiteeBranch[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set());
  const [commits, setCommits] = useState<GiteeCommit[]>([]);
  
  // Analysis Collection - stores selected branches for later analysis
  const [analysisList, setAnalysisList] = useState<AnalysisItem[]>([]);
  const [isAnalysisListOpen, setIsAnalysisListOpen] = useState(false);
  
  // Changeset Data - now structured with branch info
  const [changesetData, setChangesetData] = useState<Map<string, ChangesetItem[]>>(new Map());
  const [changesetOpen, setChangesetOpen] = useState(false);
  const [selectedCommitDetail, setSelectedCommitDetail] = useState<ChangesetItem | null>(null);
  
  // Pagination state for each branch (branch name -> { page, size })
  const [branchPagination, setBranchPagination] = useState<Map<string, { page: number; size: number }>>(new Map());
  
  // Export Configuration
  const [exportFields, setExportFields] = useState<ExportField[]>(DEFAULT_EXPORT_FIELDS);
  const [isExportConfigOpen, setIsExportConfigOpen] = useState(false);
  
  // Excel Export Style Configuration
  const [excelExportStyle, setExcelExportStyle] = useState<ExcelExportStyle>(DEFAULT_EXCEL_STYLE);
  const [isExcelStyleOpen, setIsExcelStyleOpen] = useState(false);

  // Load Config from backend
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Load auth type first - this determines which config to use
        const authTypeResult = await apiService.configApi.getByKey('gitee-auth-type');
        const authType = authTypeResult ? authTypeResult.configValue : 'token';
        console.log('Loaded auth type:', authType);

        let repoUrl = '';
        let accessToken = '';
        let privateKey = '';
        let publicKey = '';

        // Load ONLY the config that matches the current auth type
        // This prevents loading Token config when in SSH mode or vice versa
        try {
          if (authType === 'token') {
            const tokenResult = await apiService.configApi.getByKey('gitee-token-config');
            if (tokenResult && tokenResult.configValue) {
              const tokenConfig = JSON.parse(tokenResult.configValue);
              repoUrl = tokenConfig.repoUrl || '';
              accessToken = tokenConfig.accessToken || '';
              console.log('✓ Loaded Token config from database');
            }
            // Explicitly do NOT load SSH config to prevent mixing
          } else if (authType === 'ssh') {
            const sshResult = await apiService.configApi.getByKey('gitee-ssh-config');
            if (sshResult && sshResult.configValue) {
              const sshConfig = JSON.parse(sshResult.configValue);
              repoUrl = sshConfig.repoUrl || '';
              privateKey = sshConfig.privateKey || '';
              publicKey = sshConfig.publicKey || '';
              console.log('✓ Loaded SSH config from database');
            }
            // Explicitly do NOT load Token config to prevent mixing
          }
        } catch (err) {
          console.error('Failed to load auth credentials:', err);
        }

        setConfig({
          repoUrl,
          authType,
          accessToken,
          privateKey,
          publicKey
        });
      } catch (err) {
        console.warn('Failed to load config from backend, trying localStorage:', err);
        // Fallback to localStorage with separated keys per auth type
        const authType = (localStorage.getItem('gitee-auth-type') || 'token') as 'token' | 'ssh';
        
        let repoUrl = '';
        let accessToken = '';
        let privateKey = '';
        let publicKey = '';

        // Load ONLY from localStorage key that matches authType
        if (authType === 'token') {
          const tokenConfig = localStorage.getItem('gitee-token-config');
          if (tokenConfig) {
            const parsed = JSON.parse(tokenConfig);
            repoUrl = parsed.repoUrl || '';
            accessToken = parsed.accessToken || '';
          }
        } else if (authType === 'ssh') {
          const sshConfig = localStorage.getItem('gitee-ssh-config');
          if (sshConfig) {
            const parsed = JSON.parse(sshConfig);
            repoUrl = parsed.repoUrl || '';
            privateKey = parsed.privateKey || '';
            publicKey = parsed.publicKey || '';
          }
        }

        setConfig({
          repoUrl,
          authType,
          accessToken,
          privateKey,
          publicKey
        });
      }
    };
    
    loadConfig();
    
    // Load export fields configuration
    const loadExportFields = async () => {
      try {
        const result = await apiService.configApi.getByKey('gitee-export-fields');
        if (result) {
          const parsed = JSON.parse(result.configValue);
          const validFieldIds = DEFAULT_EXPORT_FIELDS.map(f => f.id);
          const filteredFields = parsed.filter((f: any) => validFieldIds.includes(f.id));
          if (filteredFields.length > 0) {
            setExportFields(filteredFields);
          }
        }
      } catch (err) {
        // Fallback to localStorage
        const savedFields = localStorage.getItem('gitee-export-fields');
        if (savedFields) {
          try {
            const parsed = JSON.parse(savedFields);
            const validFieldIds = DEFAULT_EXPORT_FIELDS.map(f => f.id);
            const filteredFields = parsed.filter((f: any) => validFieldIds.includes(f.id));
            if (filteredFields.length > 0) {
              setExportFields(filteredFields);
            }
          } catch (e) {
            console.error('Failed to load export fields config:', e);
          }
        }
      }
    };
    
    loadExportFields();
    
    // Load Excel export style configuration
    const loadExcelStyle = async () => {
      try {
        const result = await apiService.configApi.getByKey('gitee-excel-style');
        if (result) {
          const parsed = JSON.parse(result.configValue);
          setExcelExportStyle({
            rowHeight: parsed.rowHeight || DEFAULT_EXCEL_STYLE.rowHeight,
            columnWidth: parsed.columnWidth || DEFAULT_EXCEL_STYLE.columnWidth,
            headerRowHeight: parsed.headerRowHeight || DEFAULT_EXCEL_STYLE.headerRowHeight
          });
        }
      } catch (err) {
        // Fallback to localStorage
        const savedStyle = localStorage.getItem('gitee-excel-style');
        if (savedStyle) {
          try {
            const parsed = JSON.parse(savedStyle);
            setExcelExportStyle({
              rowHeight: parsed.rowHeight || DEFAULT_EXCEL_STYLE.rowHeight,
              columnWidth: parsed.columnWidth || DEFAULT_EXCEL_STYLE.columnWidth,
              headerRowHeight: parsed.headerRowHeight || DEFAULT_EXCEL_STYLE.headerRowHeight
            });
          } catch (e) {
            console.error('Failed to load excel style config:', e);
          }
        }
      }
    };
    
    loadExcelStyle();
  }, []);

  // Load analysis list from backend or localStorage
  useEffect(() => {
    const loadAnalysisList = async () => {
      try {
        const result = await apiService.configApi.getByKey('gitee-analysis-list');
        if (result && result.configValue) {
          const parsed = JSON.parse(result.configValue);
          if (Array.isArray(parsed)) {
            setAnalysisList(parsed);
          }
        }
      } catch (err) {
        // Fallback to localStorage
        const saved = localStorage.getItem('gitee-analysis-list');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              setAnalysisList(parsed);
            }
          } catch (e) {
            console.error('Failed to load analysis list:', e);
          }
        }
      }
    };
    
    loadAnalysisList();
  }, []);

  // Handle auth type switching - load config from database for the selected auth type
  const handleAuthTypeChange = async (newAuthType: 'token' | 'ssh') => {
    console.log('Switching auth type to:', newAuthType);
    
    try {
      let repoUrl = '';
      let accessToken = '';
      let privateKey = '';
      let publicKey = '';

      // Load config for the new auth type from database
      if (newAuthType === 'token') {
        try {
          const tokenResult = await apiService.configApi.getByKey('gitee-token-config');
          if (tokenResult && tokenResult.configValue) {
            const tokenConfig = JSON.parse(tokenResult.configValue);
            repoUrl = tokenConfig.repoUrl || '';
            accessToken = tokenConfig.accessToken || '';
            console.log('✓ Loaded Token config from database:', { repoUrl: repoUrl.substring(0, 30) + '...', hasToken: !!accessToken });
          }
        } catch (err) {
          console.warn('Failed to load Token config from database:', err);
          // Try localStorage as fallback
          const localToken = localStorage.getItem('gitee-token-config');
          if (localToken) {
            const tokenConfig = JSON.parse(localToken);
            repoUrl = tokenConfig.repoUrl || '';
            accessToken = tokenConfig.accessToken || '';
            console.log('✓ Loaded Token config from localStorage');
          }
        }
      } else if (newAuthType === 'ssh') {
        try {
          const sshResult = await apiService.configApi.getByKey('gitee-ssh-config');
          if (sshResult && sshResult.configValue) {
            const sshConfig = JSON.parse(sshResult.configValue);
            repoUrl = sshConfig.repoUrl || '';
            privateKey = sshConfig.privateKey || '';
            publicKey = sshConfig.publicKey || '';
            console.log('✓ Loaded SSH config from database:', { repoUrl: repoUrl.substring(0, 30) + '...', hasKeys: !!privateKey });
          }
        } catch (err) {
          console.warn('Failed to load SSH config from database:', err);
          // Try localStorage as fallback
          const localSsh = localStorage.getItem('gitee-ssh-config');
          if (localSsh) {
            const sshConfig = JSON.parse(localSsh);
            repoUrl = sshConfig.repoUrl || '';
            privateKey = sshConfig.privateKey || '';
            publicKey = sshConfig.publicKey || '';
            console.log('✓ Loaded SSH config from localStorage');
          }
        }
      }

      // Update config with new auth type and loaded credentials
      setConfig({
        repoUrl,
        authType: newAuthType,
        accessToken,
        privateKey,
        publicKey
      });
    } catch (err) {
      console.error('Error switching auth type:', err);
    }
  };

  const saveConfig = async () => {
    // Validation
    if (!config.repoUrl || !config.repoUrl.trim()) {
      alert('请输入仓库地址');
      return;
    }

    if (config.authType === 'token' && !config.accessToken) {
      alert('请输入 Access Token');
      return;
    }

    if (config.authType === 'ssh' && !config.privateKey) {
      alert('请输入私钥');
      return;
    }

    try {
      setLoading(true);
      
      // Test connection to Gitee
      const response = await fetch('/api/gitee/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: config.repoUrl,
          authType: config.authType,
          accessToken: config.authType === 'token' ? config.accessToken : undefined,
          privateKey: config.authType === 'ssh' ? config.privateKey : undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Connection test failed');
      }

      const result = await response.json();
      
      // Check if connection test succeeded
      // ApiResponse format: { success: boolean, message: string, data: {...} }
      if (!result.success) {
        throw new Error(result.message || 'Connection test failed');
      }
      
      // Save config to backend - use separate keys for token and SSH configs
      try {
        // Save auth type
        const authTypeRes = await apiService.configApi.save({
          configKey: 'gitee-auth-type',
          configValue: config.authType,
          configType: 'GITEE',
          description: 'Gitee authentication type (token or ssh)'
        });
        console.log('✓ Auth type saved:', authTypeRes);

        // Save auth credentials and repo URL separately based on auth type
        // Both Token and SSH configs are kept independent - no deletion
        if (config.authType === 'token') {
          // Save token config with repo URL
          const tokenRes = await apiService.configApi.save({
            configKey: 'gitee-token-config',
            configValue: JSON.stringify({
              repoUrl: config.repoUrl,
              accessToken: config.accessToken
            }),
            configType: 'GITEE',
            description: 'Gitee HTTPS/Token authentication'
          });
          console.log('✓ Token config saved (SSH config preserved in database):', tokenRes);
        } else if (config.authType === 'ssh') {
          // Save SSH config with repo URL
          const sshRes = await apiService.configApi.save({
            configKey: 'gitee-ssh-config',
            configValue: JSON.stringify({
              repoUrl: config.repoUrl,
              privateKey: config.privateKey,
              publicKey: config.publicKey
            }),
            configType: 'GITEE',
            description: 'Gitee SSH authentication'
          });
          console.log('✓ SSH config saved (Token config preserved in database):', sshRes);
        }
      } catch (err) {
        console.error('Failed to save config to backend:', err);
        // Do NOT fallback to localStorage - user must fix and retry
        throw new Error(`配置保存失败: ${err instanceof Error ? err.message : '未知错误'}`);
      }

      // Verify configuration was saved
      try {
        const validateRes = await fetch('/api/gitee/validate-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoUrl: config.repoUrl,
            authType: config.authType,
            accessToken: config.authType === 'token' ? config.accessToken : undefined,
            privateKey: config.authType === 'ssh' ? config.privateKey : undefined,
            publicKey: config.authType === 'ssh' ? config.publicKey : undefined
          })
        });
        
        const validateResult = await validateRes.json();
        if (validateResult.success && validateResult.data?.valid) {
          console.log('✓ Configuration validation passed');
        } else {
          console.warn('Configuration validation warning:', validateResult.data?.reason || validateResult.message);
        }
      } catch (err) {
        console.warn('Failed to validate configuration:', err);
      }

      recordAction('Gitee管理', `保存配置 - 方式: ${config.authType === 'token' ? 'HTTPS/Token' : 'SSH'} - 连接测试成功`);
      setIsConfigOpen(false);
      alert('✓ 连接配置已保存，连接测试成功！');
    } catch (error) {
      console.error('Failed to test connection:', error);
      // Don't save config if connection test fails
      alert(`✗ 连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const saveExportFieldsConfig = async () => {
    try {
      await apiService.configApi.save({
        configKey: 'gitee-export-fields',
        configValue: JSON.stringify(exportFields),
        configType: 'GITEE',
        description: 'Gitee export fields configuration'
      });
    } catch (err) {
      console.warn('Failed to save to backend, using localStorage:', err);
      localStorage.setItem('gitee-export-fields', JSON.stringify(exportFields));
    }
    recordAction('Gitee管理', '保存导出字段配置');
    setIsExportConfigOpen(false);
    alert('导出字段配置已保存');
  };

  const saveExcelStyleConfig = async () => {
    try {
      const result = await apiService.configApi.save({
        configKey: 'gitee-excel-style',
        configValue: JSON.stringify(excelExportStyle),
        configType: 'GITEE',
        description: 'Gitee Excel export style configuration'
      });
      
      // 验证保存成功
      if (result) {
        console.log('✓ Excel样式配置已保存到数据库:', excelExportStyle);
        // 同时保存到localStorage作为备份
        localStorage.setItem('gitee-excel-style', JSON.stringify(excelExportStyle));
      }
    } catch (err) {
      console.warn('Failed to save to backend, using localStorage:', err);
      localStorage.setItem('gitee-excel-style', JSON.stringify(excelExportStyle));
      alert('⚠️ 保存到数据库失败，已保存到本地存储。请检查网络连接。');
    }
    recordAction('Gitee管理', '保存Excel导出样式配置');
    setIsExcelStyleOpen(false);
    alert('✅ Excel导出样式配置已保存，新导出的文件将应用此样式');
  };

  const handleSearch = async () => {
    if (!config.repoUrl || !config.repoUrl.trim()) {
      alert('请先配置 Gitee 仓库地址');
      setIsConfigOpen(true);
      return;
    }

    setLoading(true);
    setBranches([]);
    setCommits([]);
    setSelectedBranches(new Set());
    
    try {
      // Call backend API to fetch branches from Gitee
      const response = await fetch('/api/gitee/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: config.repoUrl,
          authType: config.authType,
          accessToken: config.accessToken,
          privateKey: config.privateKey,
          searchQuery: searchQuery,
          branchName: branchNameFilter || undefined, // Pass branch name filter if specified
          author: branchAuthorFilter || undefined // Pass branch author filter if specified
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      console.log('🔍 Branches API response:', result);
      console.log('📦 result.data:', result.data);
      console.log('📦 result.data?.items:', result.data?.items);
      
      // Handle paginated response structure - PaginatedResponse uses 'items' field
      const branchesData = result.data?.items || [];
      console.log('✅ branchesData extracted:', branchesData);
      console.log('✅ branchesData is array?', Array.isArray(branchesData));
      console.log('✅ branchesData length:', branchesData.length);
      
      if (Array.isArray(branchesData) && branchesData.length > 0) {
        const typedBranches: GiteeBranch[] = branchesData.map(b => ({
          name: b.name || '',
          lastCommitHash: b.lastCommitHash || 'N/A',
          lastUpdated: b.lastUpdated || 'N/A'
        }));
        console.log('✅ Typed branches:', typedBranches);
        setBranches(typedBranches);
      } else {
        console.log('⚠️ No branches data found');
        setBranches([]);
      }
      recordAction('Gitee管理', `查询分支 - 关键词: ${searchQuery || 'ALL'}`);
    } catch (error) {
      console.error('Failed to fetch branches:', error);
      alert(`获取分支失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  // Add selected branches to analysis collection
  const handleAddToAnalysis = async () => {
    if (selectedBranches.size === 0) {
      alert('请先选择至少一个分支');
      return;
    }

    const newItems: AnalysisItem[] = Array.from(selectedBranches).map(branchName => ({
      id: `${branchName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      branchName,
      addedTime: new Date().toLocaleString('zh-CN')
    }));

    const updatedList = [...analysisList, ...newItems];
    setAnalysisList(updatedList);

    // Save to backend
    try {
      await apiService.configApi.save({
        configKey: 'gitee-analysis-list',
        configValue: JSON.stringify(updatedList),
        configType: 'GITEE',
        description: 'Gitee analysis collection - selected branches for analysis'
      });
      console.log('✓ Analysis list saved to backend');
    } catch (err) {
      console.warn('Failed to save to backend, using localStorage:', err);
      localStorage.setItem('gitee-analysis-list', JSON.stringify(updatedList));
    }

    recordAction('Gitee管理', `添加分支到分析集合 - 数量: ${newItems.length}`);
    alert(`✓ 已添加 ${newItems.length} 个分支到分析集合`);
    setSelectedBranches(new Set());
  };

  // Remove analysis item from collection
  const handleRemoveFromAnalysis = async (itemId: string) => {
    const updatedList = analysisList.filter(item => item.id !== itemId);
    setAnalysisList(updatedList);

    // Save to backend
    try {
      await apiService.configApi.save({
        configKey: 'gitee-analysis-list',
        configValue: JSON.stringify(updatedList),
        configType: 'GITEE',
        description: 'Gitee analysis collection - selected branches for analysis'
      });
      console.log('✓ Analysis list updated and saved to backend');
    } catch (err) {
      console.warn('Failed to save to backend, using localStorage:', err);
      localStorage.setItem('gitee-analysis-list', JSON.stringify(updatedList));
    }

    recordAction('Gitee管理', `从分析集合中删除分支: ${analysisList.find(item => item.id === itemId)?.branchName}`);
  };

  // Clear all items from analysis collection
  const handleClearAnalysis = async () => {
    if (analysisList.length === 0) {
      alert('分析集合为空');
      return;
    }

    if (!window.confirm('确定要清空分析集合中的所有项目吗？')) {
      return;
    }

    setAnalysisList([]);

    // Save to backend
    try {
      await apiService.configApi.save({
        configKey: 'gitee-analysis-list',
        configValue: JSON.stringify([]),
        configType: 'GITEE',
        description: 'Gitee analysis collection - selected branches for analysis'
      });
      console.log('✓ Analysis list cleared and saved to backend');
    } catch (err) {
      console.warn('Failed to save to backend, using localStorage:', err);
      localStorage.setItem('gitee-analysis-list', JSON.stringify([]));
    }

    recordAction('Gitee管理', '清空分析集合');
    alert('✓ 分析集合已清空');
  };

  // Fetch changesets for all branches in analysis collection
  const handleFetchAnalysisChangesets = async () => {
    if (analysisList.length === 0) {
      alert('分析集合为空，请先添加分支');
      return;
    }

    if (!config.repoUrl || !config.repoUrl.trim()) {
      alert('请先配置 Gitee 仓库地址');
      setIsConfigOpen(true);
      return;
    }

    setLoading(true);

    try {
      // Extract branch names from analysis list
      const branches = analysisList.map(item => item.branchName);

      // Call backend API to fetch changesets
      const response = await fetch('/api/gitee/changesets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: config.repoUrl,
          authType: config.authType,
          accessToken: config.accessToken,
          privateKey: config.privateKey,
          branches,
          author: authorFilter || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      const newChangesetData = new Map<string, ChangesetItem[]>();
      const newPagination = new Map<string, { page: number; size: number }>();
      
      if (result.data && Array.isArray(result.data)) {
        // Group items by branch
        const branchMap = new Map<string, any[]>();
        result.data.forEach((item: any) => {
          const branchName = item.branch;
          if (!branchMap.has(branchName)) {
            branchMap.set(branchName, []);
          }
          branchMap.get(branchName)!.push(item);
        });
        
        // Process each branch
        branchMap.forEach((items, branchName) => {
          const changesetItems: ChangesetItem[] = items.map((item: any) => ({
            branch: item.branch,
            commitHash: item.commitHash,
            author: item.author,
            date: item.date,
            filePath: item.filePath,
            message: item.message,
            requirementGroup: item.requirementGroup
          }));
          
          // Deduplicate within each branch
          const deduplicatedItems = deduplicateChangesetItems(changesetItems);
          
          newChangesetData.set(branchName, deduplicatedItems);
          newPagination.set(branchName, { page: 1, size: 10 });
        });
      }
      
      setChangesetData(newChangesetData);
      setBranchPagination(newPagination);
      recordAction('Gitee管理', `从分析集合导出变更集 - 分支数: ${analysisList.length}`);
    } catch (error) {
      console.error('Failed to fetch changesets:', error);
      alert(`获取变更集失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
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
    // Get filtered branches based on branchNameFilter
    const filteredBranches = branches.filter(b => !branchNameFilter || b.name.toLowerCase().includes(branchNameFilter.toLowerCase()));
    
    if (selectedBranches.size === filteredBranches.length && filteredBranches.length > 0) {
      setSelectedBranches(new Set());
    } else {
      setSelectedBranches(new Set(filteredBranches.map(b => b.name)));
    }
  };

  // Helper function to deduplicate changeset items within a branch
  // Deduplication is based on the combination of commitHash and filePath
  const deduplicateChangesetItems = (items: ChangesetItem[]): ChangesetItem[] => {
    const seen = new Set<string>();
    const deduplicated: ChangesetItem[] = [];
    
    items.forEach(item => {
      // Create a unique key combining commitHash and filePath
      const key = `${item.commitHash}|${item.filePath.trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(item);
      }
    });
    
    return deduplicated;
  };

  const handleFetchMultiBranchChanges = async () => {
    if (selectedBranches.size === 0) {
      alert('请先选择至少一个分支');
      return;
    }

    if (!config.repoUrl || !config.repoUrl.trim()) {
      alert('请先配置 Gitee 仓库地址');
      setIsConfigOpen(true);
      return;
    }

    setLoading(true);

    try {
      // Call backend API to fetch changesets from Gitee
      const response = await fetch('/api/gitee/changesets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: config.repoUrl,
          authType: config.authType,
          accessToken: config.accessToken,
          privateKey: config.privateKey,
          branches: Array.from(selectedBranches),
          author: authorFilter || undefined // Pass author filter if specified
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      const newChangesetData = new Map<string, ChangesetItem[]>();
      const newPagination = new Map<string, { page: number; size: number }>();
      
      if (result.data && Array.isArray(result.data)) {
        // Group items by branch first
        const branchMap = new Map<string, any[]>();
        result.data.forEach((item: any) => {
          const branchName = item.branch;
          if (!branchMap.has(branchName)) {
            branchMap.set(branchName, []);
          }
          branchMap.get(branchName)!.push(item);
        });
        
        // Process each branch: convert to ChangesetItem and deduplicate
        branchMap.forEach((items, branchName) => {
          const changesetItems: ChangesetItem[] = items.map((item: any) => ({
            branch: item.branch,
            commitHash: item.commitHash,
            author: item.author,
            date: item.date,
            filePath: item.filePath,
            message: item.message,
            requirementGroup: item.requirementGroup
          }));
          
          // Deduplicate within each branch
          const deduplicatedItems = deduplicateChangesetItems(changesetItems);
          
          newChangesetData.set(branchName, deduplicatedItems);
          newPagination.set(branchName, { page: 1, size: 10 });
        });
      }
      
      setChangesetData(newChangesetData);
      setBranchPagination(newPagination);
      recordAction('Gitee管理', `获取变更集 - 分支: ${Array.from(selectedBranches).join(',')}`);
    } catch (error) {
      console.error('Failed to fetch changesets:', error);
      alert(`获取变更集失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  // Pagination handlers
  const handleBranchPageChange = (branchName: string, page: number) => {
    const items = changesetData.get(branchName) || [];
    const pagination = branchPagination.get(branchName) || { page: 1, size: 10 };
    const totalPages = Math.ceil(items.length / pagination.size);
    const newPage = Math.max(1, Math.min(page, totalPages || 1));
    
    setBranchPagination(new Map(branchPagination).set(branchName, { ...pagination, page: newPage }));
  };

  const handleBranchPageSizeChange = (branchName: string, size: number) => {
    setBranchPagination(new Map(branchPagination).set(branchName, { page: 1, size }));
  };

  const getPaginatedItems = (branchName: string) => {
    const items = changesetData.get(branchName) || [];
    const pagination = branchPagination.get(branchName) || { page: 1, size: 10 };
    const start = (pagination.page - 1) * pagination.size;
    return items.slice(start, start + pagination.size);
  };

  const handleDownloadChangeset = async () => {
    if (changesetData.size === 0) {
      alert('请先导出变更集');
      return;
    }

    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      
      // Collect all items from all branches
      const allItems: ChangesetItem[] = [];
      Array.from(changesetData.keys()).sort().forEach(branchName => {
        const items = changesetData.get(branchName) || [];
        allItems.push(...items);
      });
      
      // Use the same prepare function for consistent data format
      const { exportData, visibleFields } = prepareExportData(allItems);

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
      console.log('✓ 应用Excel样式配置:', excelExportStyle);

      // Call backend to generate Excel with validation and style configuration
      const response = await fetch('/api/gitee/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: `gitee_changeset_${timestamp}`,
          headers: visibleFields.map(f => f.label),
          data: exportData,
          validationRules: validationRules,
          excelStyle: excelExportStyle
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

  const handleDownloadList = async () => {
    if (changesetData.size === 0) {
      alert('请先导出变更集');
      return;
    }

    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      
      // Generate TXT content - organized by branch with file lists
      const lines: string[] = [];
      lines.push(`=== Gitee 分支变更汇总 ===`);
      lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
      lines.push('');

      let totalFiles = 0;
      let totalCommits = 0;

      // Add each branch section - list unique files
      Array.from(changesetData.keys()).sort().forEach(branchName => {
        const items = changesetData.get(branchName) || [];
        
        // Collect unique files for this branch
        const uniqueFiles = new Set<string>();
        items.forEach(item => {
          // Split by newlines in case filePath contains multiple files
          const files = item.filePath ? item.filePath.split('\n').filter(f => f.trim()) : [];
          files.forEach(f => uniqueFiles.add(f.trim()));
        });

        const fileCount = uniqueFiles.size;
        const commitCount = items.length;
        totalFiles += fileCount;
        totalCommits += commitCount;
        
        lines.push(`\n【分支】${branchName}`);
        lines.push(`【提交数】${commitCount}`);
        lines.push(`【文件数】${fileCount}`);
        lines.push(`【变更的文件列表】`);
        
        // List all unique files for this branch
        Array.from(uniqueFiles).sort().forEach(filePath => {
          lines.push(`  - ${filePath}`);
        });
      });

      lines.push('');
      lines.push(`=== 统计汇总 ===`);
      lines.push(`分支总数: ${changesetData.size}`);
      lines.push(`提交总数: ${totalCommits}`);
      lines.push(`涉及文件总数: ${totalFiles}`);

      // Create and download TXT file
      const content = lines.join('\n');
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gitee_changeset_list_${timestamp}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      recordAction('Gitee管理', `导出分支变更汇总 - 分支数: ${changesetData.size}, 提交数: ${totalCommits}, 文件数: ${totalFiles}`);
    } catch (error: any) {
      alert('导出失败: ' + error.message);
    }
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

  // Helper function to prepare export data from items
  const prepareExportData = (items: ChangesetItem[]): { exportData: any[], visibleFields: ExportField[] } => {
    const visibleFields = exportFields.filter(f => f.visible);
    const exportData: any[] = [];

    items.forEach(item => {
      // If filePath contains multiple files (separated by newlines), create one row per file
      const files = item.filePath ? item.filePath.split('\n').filter((f: string) => f.trim()) : [''];
      
      files.forEach(filePath => {
        const row: any = {};
        // Use ordered visible fields to build row
        visibleFields.forEach(field => {
          if (field.id === 'branch') {
            row[field.label] = item.branch;
          } else if (field.id === 'filePath') {
            row[field.label] = filePath.trim(); // One file per row
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
        
        exportData.push(row);
      });
    });

    return { exportData, visibleFields };
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
      const { exportData, visibleFields } = prepareExportData(items);
      
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

      console.log('✓ 应用Excel样式配置:', excelExportStyle);

      // Call backend to generate Excel with validation and style configuration
      const response = await fetch('/api/gitee/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: `gitee_${branchName}`,
          headers: visibleFields.map(f => f.label),
          data: exportData,
          validationRules: validationRules,
          excelStyle: excelExportStyle
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
              onClick={() => setIsAnalysisListOpen(!isAnalysisListOpen)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all shadow-sm relative ${isAnalysisListOpen ? 'bg-slate-200 text-slate-700' : 'bg-white text-red-600 border border-slate-200 hover:bg-slate-50'}`}
          >
              <CheckSquare size={18}/> {isAnalysisListOpen ? '收起集合' : '分析集合'}
              {analysisList.length > 0 && <span className="absolute top-0 right-0 text-xs bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center">{analysisList.length}</span>}
          </button>
          <button 
              onClick={() => setIsExcelStyleOpen(!isExcelStyleOpen)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all shadow-sm ${isExcelStyleOpen ? 'bg-slate-200 text-slate-700' : 'bg-white text-purple-600 border border-slate-200 hover:bg-slate-50'}`}
          >
              <Settings size={18}/> {isExcelStyleOpen ? '收起样式' : 'Excel样式'}
          </button>
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

      {/* Excel Style Config Panel */}
      {isExcelStyleOpen && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6 animate-in fade-in slide-in-from-top-4">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Settings size={18} className="text-purple-500"/> Excel导出样式配置
              </h3>
              <p className="text-xs text-slate-500 mb-6">调整导出Excel文件的行高、列宽等样式设置</p>
              
              <div className="space-y-6">
                  {/* Row Height */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <label className="block font-bold text-slate-700 mb-3 text-sm">数据行高 (点/pt)</label>
                      <div className="flex items-center gap-4">
                          <input
                              type="range"
                              min="1"
                              max="100"
                              value={excelExportStyle.rowHeight}
                              onChange={(e) => setExcelExportStyle({ ...excelExportStyle, rowHeight: parseInt(e.target.value) })}
                              className="flex-1 h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer"
                          />
                          <input
                              type="number"
                              min="1"
                              max="100"
                              value={excelExportStyle.rowHeight}
                              onChange={(e) => setExcelExportStyle({ ...excelExportStyle, rowHeight: Math.max(1, parseInt(e.target.value) || 18) })}
                              className={INPUT_STYLE}
                              style={{ width: '80px' }}
                          />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">当前: {excelExportStyle.rowHeight}pt</p>
                  </div>

                  {/* Header Row Height */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <label className="block font-bold text-slate-700 mb-3 text-sm">表头行高 (点/pt)</label>
                      <div className="flex items-center gap-4">
                          <input
                              type="range"
                              min="1"
                              max="100"
                              value={excelExportStyle.headerRowHeight}
                              onChange={(e) => setExcelExportStyle({ ...excelExportStyle, headerRowHeight: parseInt(e.target.value) })}
                              className="flex-1 h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer"
                          />
                          <input
                              type="number"
                              min="1"
                              max="100"
                              value={excelExportStyle.headerRowHeight}
                              onChange={(e) => setExcelExportStyle({ ...excelExportStyle, headerRowHeight: Math.max(1, parseInt(e.target.value) || 22) })}
                              className={INPUT_STYLE}
                              style={{ width: '80px' }}
                          />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">当前: {excelExportStyle.headerRowHeight}pt</p>
                  </div>

                  {/* Column Width */}
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <label className="block font-bold text-slate-700 mb-3 text-sm">默认列宽 (字符数)</label>
                      <div className="flex items-center gap-4">
                          <input
                              type="range"
                              min="1"
                              max="100"
                              value={excelExportStyle.columnWidth}
                              onChange={(e) => setExcelExportStyle({ ...excelExportStyle, columnWidth: parseInt(e.target.value) })}
                              className="flex-1 h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer"
                          />
                          <input
                              type="number"
                              min="1"
                              max="100"
                              value={excelExportStyle.columnWidth}
                              onChange={(e) => setExcelExportStyle({ ...excelExportStyle, columnWidth: Math.max(1, parseInt(e.target.value) || 20) })}
                              className={INPUT_STYLE}
                              style={{ width: '80px' }}
                          />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">当前: {excelExportStyle.columnWidth} 字符</p>
                  </div>

                  {/* Preview */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs font-bold text-blue-700 mb-2">效果预览</p>
                      <div style={{ 
                          height: `${excelExportStyle.rowHeight}px`, 
                          backgroundColor: '#f0f0f0', 
                          border: '1px solid #ccc',
                          width: `${excelExportStyle.columnWidth * 8}px`,
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: '8px',
                          fontSize: '12px'
                      }}>
                          示例数据
                      </div>
                  </div>
              </div>

              <div className="flex justify-end pt-4 gap-2">
                  <button onClick={() => setIsExcelStyleOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">取消</button>
                  <button onClick={() => {
                      setExcelExportStyle(DEFAULT_EXCEL_STYLE);
                  }} className="bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700 transition-colors">
                      恢复默认
                  </button>
                  <button onClick={saveExcelStyleConfig} className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 flex items-center gap-2 shadow-sm transition-colors">
                      <Save size={18}/> 保存样式
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
                        onChange={() => handleAuthTypeChange('token')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700 flex items-center gap-1"><Lock size={14}/> HTTPS + Token (推荐)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="authType" 
                        checked={config.authType === 'ssh'}
                        onChange={() => handleAuthTypeChange('ssh')}
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
                        
                        {/* SSH Configuration Helper */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-slate-700">
                          <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                            <AlertTriangle size={16} className="text-blue-600" />
                            SSH 连接配置示例
                          </h4>
                          <div className="space-y-2 text-xs font-mono bg-white p-2 rounded border border-blue-100">
                            <p className="text-slate-600"><strong>仓库地址:</strong></p>
                            <p className="bg-slate-50 p-1 rounded text-slate-700">git@gitee.com:your_username/your_repo.git</p>
                            
                            <p className="text-slate-600 mt-3"><strong>SSH 密钥生成命令:</strong></p>
                            <p className="bg-slate-50 p-1 rounded text-slate-700">ssh-keygen -t ed25519 -C "your_email@example.com"</p>
                            
                            <p className="text-slate-600 mt-3"><strong>获取公钥内容:</strong></p>
                            <p className="bg-slate-50 p-1 rounded text-slate-700">cat ~/.ssh/id_ed25519.pub</p>
                            
                            <p className="text-slate-600 mt-3"><strong>获取私钥内容:</strong></p>
                            <p className="bg-slate-50 p-1 rounded text-slate-700">cat ~/.ssh/id_ed25519</p>
                            
                            <p className="text-slate-600 mt-3"><strong>Gitee 配置:</strong></p>
                            <p className="bg-slate-50 p-1 rounded text-slate-700">设置 → 安全设置 → SSH公钥 → 添加上方的公钥内容</p>
                          </div>
                          <p className="text-slate-500 text-xs mt-2">提示: 建议使用 ed25519 算法，更安全、密钥更小</p>
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

      {/* Analysis Collection Panel */}
      {isAnalysisListOpen && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6 animate-in fade-in slide-in-from-top-4">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <CheckSquare size={18} className="text-red-500"/> 分析集合 ({analysisList.length})
              </h3>
              <p className="text-sm text-slate-600 mb-4">在这里管理选择的分支，可以多次查询并持续添加分支到集合中，最后统一导出变更集。</p>

              {analysisList.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
                      {analysisList.map((item, idx) => (
                          <div key={item.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-red-300 flex items-center justify-between gap-3 transition-all">
                              <div className="flex-1 min-w-0">
                                  <div className="font-bold text-slate-700 text-sm">{idx + 1}. {item.branchName}</div>
                                  <div className="text-xs text-slate-400 mt-1">{item.addedTime}</div>
                              </div>
                              <button
                                  onClick={() => handleRemoveFromAnalysis(item.id)}
                                  className="p-1.5 hover:bg-red-100 text-red-600 rounded transition-colors shrink-0"
                                  title="删除"
                              >
                                  <Trash2 size={16}/>
                              </button>
                          </div>
                      ))}
                  </div>
              ) : (
                  <div className="text-center py-8 text-slate-400 text-sm mb-4">
                      暂无分支，查询后添加分支到集合
                  </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                  {analysisList.length > 0 && (
                      <>
                          <button 
                              onClick={handleFetchAnalysisChangesets}
                              disabled={loading || analysisList.length === 0}
                              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
                          >
                              <Download size={16}/>
                              {loading ? '导出中...' : '导出变更集'}
                          </button>
                          <button 
                              onClick={handleClearAnalysis}
                              className="bg-slate-300 hover:bg-slate-400 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
                          >
                              <X size={16}/>
                              清空集合
                          </button>
                      </>
                  )}
                  <button 
                      onClick={() => setIsAnalysisListOpen(false)}
                      className="text-slate-600 hover:bg-slate-100 px-4 py-2 rounded-lg text-sm font-medium"
                  >
                      关闭
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
                  <div className="relative mb-3">
                      <GitBranch className="absolute left-3 top-2.5 text-slate-400" size={14}/>
                      <input 
                          type="text"
                          placeholder="按分支名称过滤..."
                          value={branchNameFilter}
                          onChange={(e) => setBranchNameFilter(e.target.value)}
                          className={`${INPUT_STYLE} pl-9 pr-8 text-xs`}
                      />
                      {branchNameFilter && (
                          <button
                              onClick={() => setBranchNameFilter('')}
                              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                          >
                              <X size={14}/>
                          </button>
                      )}
                  </div>
                  <div className="relative mb-3">
                      <User className="absolute left-3 top-2.5 text-slate-400" size={14}/>
                      <input 
                          type="text"
                          placeholder="按分支提交人过滤..."
                          value={branchAuthorFilter}
                          onChange={(e) => setBranchAuthorFilter(e.target.value)}
                          className={`${INPUT_STYLE} pl-9 pr-8 text-xs`}
                      />
                      {branchAuthorFilter && (
                          <button
                              onClick={() => setBranchAuthorFilter('')}
                              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                          >
                              <X size={14}/>
                          </button>
                      )}
                  </div>
                  {branches.length > 0 && (
                      <div className="space-y-2">
                          <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-600 font-medium">
                                  已选中: <span className="font-bold text-blue-600">{selectedBranches.size}</span> / {branches.filter(b => !branchNameFilter || b.name.toLowerCase().includes(branchNameFilter.toLowerCase())).length}
                              </span>
                              <button
                                  onClick={toggleAllBranches}
                                  className="text-xs font-bold text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
                              >
                                  {selectedBranches.size === branches.filter(b => !branchNameFilter || b.name.toLowerCase().includes(branchNameFilter.toLowerCase())).length && branches.filter(b => !branchNameFilter || b.name.toLowerCase().includes(branchNameFilter.toLowerCase())).length > 0 ? '取消全选' : '全选'}
                              </button>
                          </div>
                          <div className="relative">
                              <User className="absolute left-3 top-2.5 text-slate-400" size={14}/>
                              <input 
                                  type="text"
                                  placeholder="按作者名称过滤提交记录..."
                                  value={authorFilter}
                                  onChange={(e) => setAuthorFilter(e.target.value)}
                                  className={`${INPUT_STYLE} pl-9 pr-3 text-xs`}
                              />
                              {authorFilter && (
                                  <button
                                      onClick={() => setAuthorFilter('')}
                                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                                  >
                                      <X size={14}/>
                                  </button>
                              )}
                          </div>
                      </div>
                  )}
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                  {branches.length > 0 ? (
                      branches
                        .filter(branch => !branchNameFilter || branch.name.toLowerCase().includes(branchNameFilter.toLowerCase()))
                        .map(branch => (
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
                                              <Calendar size={12}/> 
                                              {branch.lastUpdated && branch.lastUpdated !== 'N/A' && branch.lastUpdated !== 'Unknown' 
                                                ? new Date(branch.lastUpdated).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                                                : '暂无信息'}
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
                  <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-2">
                      <button
                          onClick={handleAddToAnalysis}
                          disabled={loading || selectedBranches.size === 0}
                          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                      >
                          <CheckSquare size={16}/>
                          {loading ? '处理中...' : `添加 ${selectedBranches.size} 个分支到集合`}
                      </button>
                      <button
                          onClick={handleFetchMultiBranchChanges}
                          disabled={loading || selectedBranches.size === 0}
                          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                      >
                          <GitBranch size={16}/>
                          {loading ? '处理中...' : `直接导出 ${selectedBranches.size} 个分支变更`}
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
                                      {getPaginatedItems(branchName).map((item, idx) => (
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

                                  {/* Pagination for this branch */}
                                  {(() => {
                                    const items = changesetData.get(branchName) || [];
                                    const pagination = branchPagination.get(branchName) || { page: 1, size: 10 };
                                    const totalPages = Math.ceil(items.length / pagination.size);
                                    return items.length > pagination.size ? (
                                      <Pagination
                                        currentPage={pagination.page}
                                        totalPages={totalPages}
                                        pageSize={pagination.size}
                                        totalItems={items.length}
                                        onPageChange={(page) => handleBranchPageChange(branchName, page)}
                                        onPageSizeChange={(size) => handleBranchPageSizeChange(branchName, size)}
                                      />
                                    ) : null;
                                  })()}
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
                          <Download size={16}/> 下载清单
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
                              <label className="text-xs font-bold text-slate-500 uppercase">文件清单</label>
                              <div className="mt-1 p-3 bg-slate-50 rounded-lg text-sm text-slate-700 font-mono">
                                  <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                                      {selectedCommitDetail.filePath}
                                  </pre>
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
