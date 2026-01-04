import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Download, Folder, Eye, X, FileJson, ChevronDown, FileCode, Layers, ChevronLeft, ChevronRight, Activity, ArrowRightLeft, Info, GitBranch, Network, Settings, Lock, Key, Globe, AlertTriangle } from 'lucide-react';
import { parseProjectFiles, FileEntry } from '../../services/xmlParser';
import { XmlTransaction, XmlField } from '../../types';
import { recordAction } from '../../services/auditService';
import { apiService } from '../../services/apiService';

// 增强的配置类型定义 - 与Gitee管理复用相同的认证类型
interface OnlineSourceConfig {
  repoUrl: string;
  authType: 'token' | 'ssh';
  authUsername?: string;
  authPassword?: string;
  authToken?: string;
  sshKeyContent?: string;
  sshPassphrase?: string;
  branch: string;
  branches: string[];
  isConnected: boolean;
  connectionError?: string;
}

// Helper to escape XML special characters
const escapeXml = (unsafe: string | undefined | null) => {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

// Recursive Field Renderer for Modal
const FieldTree: React.FC<{ fields: XmlField[]; depth?: number }> = ({ fields, depth = 0 }) => {
  if (!fields || fields.length === 0) return <div className="text-slate-400 italic text-xs py-1">None</div>;

  return (
    <div className="space-y-1">
      {fields.map((f, i) => (
        <div key={i}>
          <div 
            className="flex items-start text-sm py-1 border-b border-slate-50 hover:bg-slate-50 rounded px-1"
            style={{ paddingLeft: `${depth * 12}px` }}
          >
            <div className="flex-1 font-mono text-slate-700 flex gap-2">
               {f.children && f.children.length > 0 && <ChevronDown size={14} className="mt-1 text-slate-400"/>}
               <span className={f.children ? 'font-bold text-slate-800' : ''}>
                 {f.name || <span className="text-slate-400 italic">&lt;{f.type}&gt;</span>}
               </span>
               <span className="text-xs text-slate-400 px-2 py-0.5 bg-slate-100 rounded self-start">{f.type}</span>
            </div>
            <div className="flex-1 text-slate-600">{f.description}</div>
            <div className="flex-1 text-slate-500 text-xs font-mono truncate" title={f.style}>
              {f.style || f.pattern || '-'}
            </div>
          </div>
          {f.children && (
            <FieldTree fields={f.children} depth={depth + 1} />
          )}
        </div>
      ))}
    </div>
  );
};

export const DocManagement: React.FC = () => {
  const [transactions, setTransactions] = useState<XmlTransaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<XmlTransaction | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState<'all' | 'id' | 'name' | 'module' | 'downstream'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 数据源选择模式
  const [sourceMode, setSourceMode] = useState<'local' | 'online'>('online');
  const [onlineConfig, setOnlineConfig] = useState<OnlineSourceConfig>({
    repoUrl: '',
    authType: 'token',
    authUsername: undefined,
    authPassword: undefined,
    authToken: undefined,
    sshKeyContent: undefined,
    sshPassphrase: undefined,
    branch: '',
    branches: [],
    isConnected: false,
    connectionError: undefined
  });
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  // Load configuration and try to fetch data (Auto-load)
  const loadAndFetchData = async () => {
    console.log('Starting auto-load sequence...');
    try {
      // 重新加载认证方式 - 如果数据库中没有，使用默认值 'token'
      let authType = 'token';  // 默认使用 token 方式
      try {
        const authTypeResult = await apiService.configApi.getByKey('doc-management-auth-type');
        if (authTypeResult?.configValue) {
          authType = JSON.parse(authTypeResult.configValue);
        }
      } catch (err) {
        console.warn('Failed to load auth type, using default (token):', err);
      }
      
      let repoUrl = '';
      let accessToken = '';
      let privateKey = '';
      let publicKey = '';
      let selectedBranch = '';
      
      // 从对应的认证类型配置中加载
      if (authType === 'token') {
        try {
          const tokenResult = await apiService.configApi.getByKey('doc-management-token-config');
          if (tokenResult && tokenResult.configValue) {
            const tokenConfig = JSON.parse(tokenResult.configValue);
            repoUrl = tokenConfig.repoUrl || '';
            accessToken = tokenConfig.accessToken || '';
            console.log('✓ Loaded token config:', { repoUrl: repoUrl.substring(0, 30) });
          }
        } catch (err) {
          console.warn('Failed to load token config:', err);
        }
      } else if (authType === 'ssh') {
        try {
          const sshResult = await apiService.configApi.getByKey('doc-management-ssh-config');
          if (sshResult && sshResult.configValue) {
            const sshConfig = JSON.parse(sshResult.configValue);
            repoUrl = sshConfig.repoUrl || '';
            privateKey = sshConfig.privateKey || '';
            publicKey = sshConfig.publicKey || '';
            console.log('✓ Loaded SSH config:', { repoUrl: repoUrl.substring(0, 30) });
          }
        } catch (err) {
          console.warn('Failed to load SSH config:', err);
        }
      }
      
      // 加载上次选择的分支
      try {
        const branchResult = await apiService.configApi.getByKey('doc-management-selected-branch');
        if (branchResult && branchResult.configValue) {
          try {
            selectedBranch = JSON.parse(branchResult.configValue);
          } catch (e) {
            // 如果不是JSON格式，直接作为字符串使用
            selectedBranch = branchResult.configValue;
          }
          console.log('✓ Loaded selected branch:', selectedBranch);
        }
      } catch (err) {
        console.warn('Failed to load selected branch:', err);
      }
      
      // 更新状态 - 确保所有字段都被正确初始化
      const finalAuthType = (authType === 'ssh' ? 'ssh' : 'token') as ('token' | 'ssh');

        // 尝试从独立配置中获取分支（如果之前没获取到）
        if (!selectedBranch) {
          try {
            const branchResult = await apiService.configApi.getByKey('doc-management-selected-branch');
            if (branchResult && branchResult.configValue) {
              try {
                selectedBranch = JSON.parse(branchResult.configValue);
              } catch (e) {
                selectedBranch = branchResult.configValue;
              }
            }
          } catch (err) {
            console.warn('Failed to load selected branch from separate config:', err);
          }
        }
        
        setOnlineConfig({
          repoUrl,
          authType: finalAuthType,
          authUsername: finalAuthType === 'ssh' ? publicKey : undefined,
          authPassword: undefined,
          authToken: finalAuthType === 'token' ? accessToken : undefined,
          sshKeyContent: finalAuthType === 'ssh' ? privateKey : undefined,
          sshPassphrase: undefined,
          branch: selectedBranch,
          branches: [],  // 分支列表初始为空，只在测试连接后才填充
          isConnected: false,
          connectionError: undefined
        });
        
        // 如果有有效的仓库配置，尝试从后端 code 目录加载 (skipGitFetch=false)
        if (repoUrl && selectedBranch) {
          console.log('Initiating fetch from backend...');
          setIsProcessing(true);
          try {
             // Fetch from backend with skipGitFetch=false (尝试同步最新代码)
             const response = await fetch('/api/nacos-sync/fetch-git-repository', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  repoUrl: repoUrl,
                  branch: selectedBranch,
                  authType: finalAuthType,
                  accessToken: finalAuthType === 'token' ? accessToken : undefined,
                  privateKey: finalAuthType === 'ssh' ? privateKey : undefined,
                  skipGitFetch: false // 关键修改：尝试 git pull 同步代码，后端已做降级处理（失败则使用现有代码）
                })
             });
             const result = await response.json();
             
             if (result.success && Array.isArray(result.data) && result.data.length > 0) {
                 const newTransactions = parseProjectFiles(result.data);
                 setTransactions(newTransactions);
                 setSourceMode('online');
                 
                 // UPDATE CACHE HERE
                 const remoteInterfaces = newTransactions.map(t => ({
                    id: t.id,
                    name: t.trsName,
                    module: t.module,
                    description: '',
                    inputs: t.inputs,
                    outputs: t.outputs,
                    downstreamCalls: t.downstreamCalls,
                    filePath: t.filePath
                 }));
                 try {
                     await apiService.configApi.save({
                        configKey: 'doc-management-interface-cache',
                        configValue: JSON.stringify({
                            interfaces: remoteInterfaces,
                            timestamp: Date.now(),
                            repoUrl: repoUrl,
                            branch: selectedBranch
                        }),
                        configType: 'DOC_MANAGEMENT',
                        description: 'Document Management interface cache'
                     });
                     console.log('✓ Updated interface cache in database');
                 } catch (cacheErr) {
                     console.warn('Failed to update interface cache:', cacheErr);
                 }

                 recordAction('接口管理 - 文档管理', `初始化 - 从本地代码缓存加载 ${newTransactions.length} 个接口`);
                 console.log(`✓ Loaded ${newTransactions.length} interfaces from local code cache`);
             } else {
                 // 如果失败（比如 code 目录不存在），回退到读取数据库缓存
                 console.warn('Failed to load from code cache or empty, falling back to DB cache. Reason:', result.message);
                 throw new Error(result.message || "Code cache empty or invalid");
             }
          } catch (e) {
             console.warn('Error loading from code cache, trying DB cache:', e);
             // 回退逻辑：尝试从数据库缓存加载
             const cachedResult = await apiService.configApi.getByKey('doc-management-interface-cache');
             if (cachedResult && cachedResult.configValue) {
                const cacheData = JSON.parse(cachedResult.configValue);
                if (cacheData.interfaces && Array.isArray(cacheData.interfaces)) {
                  const transactions = cacheData.interfaces.map((iface: any) => ({
                    id: iface.id,
                    trsName: iface.name,
                    module: iface.module,
                    actionRef: '',
                    template: 'ExecuteLogTemplate',
                    inputs: iface.inputs || [],
                    outputs: iface.outputs || [],
                    filePath: iface.filePath || '',
                    actionClass: '',
                    downstreamCalls: iface.downstreamCalls || []
                  }));
                  setTransactions(transactions);
                  setSourceMode('online');
                  recordAction('接口管理 - 文档管理', `初始化 - 从数据库缓存加载 ${transactions.length} 个接口`);
                  alert(`无法连接到代码仓库，已加载本地缓存的 ${transactions.length} 个接口。\n错误: ${e instanceof Error ? e.message : '未知错误'}`);
                } else {
                    alert(`无法连接到代码仓库，且本地没有缓存数据。\n错误: ${e instanceof Error ? e.message : '未知错误'}`);
                }
             } else {
                 alert(`无法连接到代码仓库，且本地没有缓存数据。\n错误: ${e instanceof Error ? e.message : '未知错误'}`);
             }
          } finally {
             setIsProcessing(false);
          }
        } else {
            console.log('Skipping auto-load: Missing repoUrl or branch configuration');
        }
      } catch (err) {
        console.warn('Failed to load saved configuration:', err);
        // 即使加载失败，也要初始化onlineConfig，避免undefined错误
        setOnlineConfig({
          repoUrl: '',
          authType: 'token',
          branch: '',
          branches: [],
          isConnected: false,
          connectionError: undefined
        });
      }
    };

    // Initial load
    useEffect(() => {
      loadAndFetchData();
    }, []);

    // Open config dialog
    const handleOpenConfig = () => {
        setIsConfigOpen(true);
    };



  // 接口检索功能 - 根据选择的字段进行过滤
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    
    const query = searchQuery.toLowerCase();
    
    return transactions.filter(t => {
      switch(searchField) {
        case 'id':
          return t.id.toLowerCase().includes(query);
        case 'name':
          return t.trsName.toLowerCase().includes(query);
        case 'module':
          return t.module.toLowerCase().includes(query);
        case 'downstream':
          return t.downstreamCalls.some(call => call.toLowerCase().includes(query));
        case 'all':
        default:
          return (
            t.id.toLowerCase().includes(query) ||
            t.trsName.toLowerCase().includes(query) ||
            t.module.toLowerCase().includes(query) ||
            (t.filePath && t.filePath.toLowerCase().includes(query)) ||
            t.downstreamCalls.some(call => call.toLowerCase().includes(query))
          );
      }
    });
  }, [transactions, searchQuery, searchField]);

  // 基于过滤结果进行分页（关键修复：搜索时显示过滤后的完整结果集）
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  
  const currentTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  // Group transactions by Module - 基于分页后的实际接口数据
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, XmlTransaction[]> = {};
    currentTransactions.forEach(t => {
      if (!groups[t.module]) groups[t.module] = [];
      groups[t.module].push(t);
    });
    return groups;
  }, [currentTransactions]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsProcessing(true);
    const files: FileEntry[] = [];

    // Read all files first
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const lowerName = file.name.toLowerCase();
      // Accept XML, Java, Properties (case-insensitive)
      if (lowerName.endsWith('.xml') || lowerName.endsWith('.java') || lowerName.endsWith('.properties')) {
        try {
            const text = await file.text();
            const path = file.webkitRelativePath || file.name;
            files.push({ name: file.name, path, content: text });
        } catch (err) {
            console.error(`Failed to read file ${file.name}`, err);
        }
      }
    }

    // Process using Project Parser
    try {
        const newTransactions = parseProjectFiles(files);
        setTransactions(prev => {
            setCurrentPage(1); 
            return newTransactions; 
        });

        // Update cache with local files so they persist on refresh (until next online fetch)
        const localInterfaces = newTransactions.map(t => ({
            id: t.id,
            name: t.trsName,
            module: t.module,
            description: '',
            inputs: t.inputs,
            outputs: t.outputs,
            downstreamCalls: t.downstreamCalls,
            filePath: t.filePath
        }));
        try {
            await apiService.configApi.save({
                configKey: 'doc-management-interface-cache',
                configValue: JSON.stringify({
                    interfaces: localInterfaces,
                    timestamp: Date.now(),
                    repoUrl: 'local-upload',
                    branch: 'local'
                }),
                configType: 'DOC_MANAGEMENT',
                description: 'Document Management interface cache (Local Upload)'
            });
        } catch (cacheErr) {
            console.warn('Failed to cache local upload:', cacheErr);
        }

        // Log
        recordAction('接口管理 - 文档管理', `按钮:加载文件夹 - 已加载 ${newTransactions.length} 个接口文件`);
    } catch (err) {
        console.error("Failed to parse project files", err);
        alert("Parsing failed. Check console for details.");
    } finally {
        setIsProcessing(false);
    }
  };

  // 处理认证类型切换 - 从数据库加载对应认证方式的配置
  const handleAuthTypeChange = async (newAuthType: 'token' | 'ssh') => {
    console.log('Switching auth type to:', newAuthType);
    
    try {
      let repoUrl = '';
      let accessToken = '';
      let privateKey = '';
      let publicKey = '';
      let selectedBranch = '';

      // 从数据库加载新认证方式的配置 - 使用独立的doc-management-*配置key
      if (newAuthType === 'token') {
        try {
          const tokenResult = await apiService.configApi.getByKey('doc-management-token-config');
          if (tokenResult && tokenResult.configValue) {
            const tokenConfig = JSON.parse(tokenResult.configValue);
            repoUrl = tokenConfig.repoUrl || '';
            accessToken = tokenConfig.accessToken || '';
            console.log('✓ Loaded Token config from database:', { repoUrl: repoUrl.substring(0, 30) + '...', hasToken: !!accessToken });
          }
        } catch (err) {
          console.warn('Failed to load Token config from database:', err);
        }
      } else if (newAuthType === 'ssh') {
        try {
          const sshResult = await apiService.configApi.getByKey('doc-management-ssh-config');
          if (sshResult && sshResult.configValue) {
            const sshConfig = JSON.parse(sshResult.configValue);
            repoUrl = sshConfig.repoUrl || '';
            privateKey = sshConfig.privateKey || '';
            publicKey = sshConfig.publicKey || '';
            console.log('✓ Loaded SSH config from database:', { repoUrl: repoUrl.substring(0, 30) + '...', hasKeys: !!privateKey });
          }
        } catch (err) {
          console.warn('Failed to load SSH config from database:', err);
        }
      }
      
      // 加载上次选择的分支
      try {
        const branchResult = await apiService.configApi.getByKey('doc-management-selected-branch');
        if (branchResult && branchResult.configValue) {
          selectedBranch = JSON.parse(branchResult.configValue);
        }
      } catch (err) {
        console.warn('Failed to load selected branch:', err);
      }

      // 使用新的认证方式和加载的凭证更新配置 - 分支列表清空，只在测试连接后才填充
      setOnlineConfig({
        repoUrl,
        authType: newAuthType,
        authUsername: newAuthType === 'token' ? undefined : publicKey,
        authPassword: newAuthType === 'token' ? undefined : onlineConfig.authPassword,
        authToken: newAuthType === 'token' ? accessToken : undefined,
        sshKeyContent: newAuthType === 'ssh' ? privateKey : undefined,
        sshPassphrase: newAuthType === 'ssh' ? onlineConfig.sshPassphrase : undefined,
        branch: selectedBranch,
        branches: [],  // 分支列表始终清空，只在测试连接后才填充
        isConnected: false,
        connectionError: undefined
      });
    } catch (err) {
      console.error('Error switching auth type:', err);
    }
  };

  const handleTestConnection = async () => {
    if (!onlineConfig.repoUrl.trim()) {
      alert('请输入仓库URL');
      return;
    }

    setIsTesting(true);
    try {
      // 使用与Gitee管理相同的连接测试API - /api/gitee/test-connection
      // 这保证了连接逻辑与Gitee管理功能一致
      const response = await fetch('/api/gitee/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repoUrl: onlineConfig.repoUrl,
          authType: onlineConfig.authType === 'token' ? 'token' : 'ssh',
          accessToken: onlineConfig.authType === 'token' ? onlineConfig.authToken : undefined,
          privateKey: onlineConfig.authType === 'ssh' ? onlineConfig.sshKeyContent : undefined
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 连接成功 - 需要单独调用API获取真实的分支列表
        let branches: string[] = [];
        
        try {
          // 调用/api/gitee/branches API获取真实分支列表
          const branchResponse = await fetch('/api/gitee/branches', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              repoUrl: onlineConfig.repoUrl,
              authType: onlineConfig.authType,
              accessToken: onlineConfig.authType === 'token' ? onlineConfig.authToken : undefined,
              privateKey: onlineConfig.authType === 'ssh' ? onlineConfig.sshKeyContent : undefined,
              searchQuery: '',
              pageNumber: 1,
              pageSize: 100  // 获取前100个分支
            })
          });
          
          const branchResult = await branchResponse.json();
          console.log('Branch API response:', branchResult);
          
          // 处理分页响应结构 - /api/gitee/branches 返回 PaginatedResponse
          if (branchResult.success && branchResult.data?.items && Array.isArray(branchResult.data.items)) {
            // 提取分支名称，支持两种格式：
            // 1. {name: "branch-name"} 格式
            // 2. 直接的字符串值
            branches = branchResult.data.items.map((b: any) => {
              if (typeof b === 'string') {
                return b;
              } else if (b.name) {
                return b.name;
              }
              return '';
            }).filter((name: string) => name !== '');
          }
          
          console.log(`✓ Fetched ${branches.length} real branches:`, branches);
        } catch (err) {
          console.warn('Failed to fetch branches from API:', err);
          // 如果获取分支失败，不使用任何默认值，保持为空
          branches = [];
        }
        
        const updated = {
          ...onlineConfig,
          isConnected: true,
          connectionError: undefined,
          branches: branches
        };
        
        // 保存配置到数据库 - 使用独立的doc-management-*配置key
        try {
          if (onlineConfig.authType === 'token') {
            // Save token config with branch
            await apiService.configApi.save({
              configKey: 'doc-management-token-config',
              configValue: JSON.stringify({
                repoUrl: updated.repoUrl,
                accessToken: updated.authToken,
                branch: onlineConfig.branch
              }),
              configType: 'DOC_MANAGEMENT',
              description: 'Document Management HTTPS/Token authentication'
            });
            console.log('✓ Token config saved');
          } else if (onlineConfig.authType === 'ssh') {
            // Save SSH config with branch
            await apiService.configApi.save({
              configKey: 'doc-management-ssh-config',
              configValue: JSON.stringify({
                repoUrl: updated.repoUrl,
                privateKey: updated.sshKeyContent,
                publicKey: updated.authUsername,
                branch: onlineConfig.branch
              }),
              configType: 'DOC_MANAGEMENT',
              description: 'Document Management SSH authentication'
            });
            console.log('✓ SSH config saved');
          }
          
          // 同时保存认证类型
          await apiService.configApi.save({
            configKey: 'doc-management-auth-type',
            configValue: JSON.stringify(onlineConfig.authType),
            configType: 'DOC_MANAGEMENT',
            description: 'Document Management authentication type (token or ssh)'
          });
        } catch (err) {
          console.warn('Failed to save config to database:', err);
        }
        
        setOnlineConfig(updated);
        alert('✅ 连接成功！已获取分支列表');
        recordAction('接口管理 - 文档管理', `在线连接测试成功 - URL: ${onlineConfig.repoUrl}, 分支数: ${branches.length}`);
      } else {
        const errorMsg = result.message || '连接失败';
        setOnlineConfig(prev => ({
          ...prev,
          isConnected: false,
          connectionError: errorMsg
        }));
        alert(`❌ ${errorMsg}`);
        recordAction('接口管理 - 文档管理', `在线连接测试失败 - ${errorMsg}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      setOnlineConfig(prev => ({
        ...prev,
        isConnected: false,
        connectionError: `连接失败: ${errorMsg}`
      }));
      console.error('Test connection error:', err);
      alert(`❌ 连接出错: ${errorMsg}`);
      recordAction('接口管理 - 文档管理', `在线连接测试异常 - ${errorMsg}`);
    } finally {
      setIsTesting(false);
    }
  };

  // 在线获取代码并解析 - 与Gitee管理复用相同的连接逻辑
  // silent参数：true时不显示alert和对话框操作，仅记录日志（用于自动加载）
  const handleFetchOnline = async (silent: boolean = false) => {
    // 如果是静默模式且没有必要的配置，直接返回不报错
    if (silent) {
      if (!onlineConfig.repoUrl?.trim()) {
        console.log('Auto-load skipped: no repository URL');
        return;
      }
      if (!onlineConfig.branch?.trim()) {
        console.log('Auto-load skipped: no branch selected');
        return;
      }
    } else {
      // 交互模式：显示提示
      if (!onlineConfig.repoUrl.trim()) {
        alert('请输入仓库URL');
        return;
      }

      if (!onlineConfig.isConnected) {
        alert('请先测试连接');
        return;
      }
    }

    setIsProcessing(true);
    try {
      // 调用后端API获取仓库代码
      // 注：仓库代码获取使用nacos-sync接口，它使用git命令行工具
      // 认证信息（authType/accessToken/privateKey）需要在系统环境中配置
      // （例如：SSH key agent或git credentials）
      const response = await fetch('/api/nacos-sync/fetch-git-repository', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repoUrl: onlineConfig.repoUrl,
          branch: onlineConfig.branch,
          authType: onlineConfig.authType === 'token' ? 'token' : 'ssh',
          accessToken: onlineConfig.authType === 'token' ? onlineConfig.authToken : undefined,
          privateKey: onlineConfig.authType === 'ssh' ? onlineConfig.sshKeyContent : undefined
        })
      });

      const result = await response.json();
      
      if (result.success && result.data && Array.isArray(result.data)) {
        // 使用获取到的文件数据进行本地解析
        const newTransactions = parseProjectFiles(result.data);
        setTransactions(prev => {
          setCurrentPage(1);
          return newTransactions;
        });
        
        // 缓存接口清单到数据库
        const remoteInterfaces = newTransactions.map(t => ({
          id: t.id,
          name: t.trsName,
          module: t.module,
          description: '',
          inputs: t.inputs,
          outputs: t.outputs,
          downstreamCalls: t.downstreamCalls,
          filePath: t.filePath
        }));
        
        await apiService.configApi.save({
          configKey: 'doc-management-interface-cache',
          configValue: JSON.stringify({
            interfaces: remoteInterfaces,
            timestamp: Date.now(),
            repoUrl: onlineConfig.repoUrl,
            branch: onlineConfig.branch
          }),
          configType: 'DOC_MANAGEMENT',
          description: 'Document Management interface cache'
        });
        
        if (!silent) {
          alert(`✅ 成功获取并解析 ${newTransactions.length} 个接口！`);
          setIsConfigOpen(false);
        }
        
        console.log(`✓ Auto-loaded ${newTransactions.length} interfaces from ${onlineConfig.repoUrl}`);
        recordAction('接口管理 - 文档管理', `在线获取 - 分支: ${onlineConfig.branch}, 已加载 ${newTransactions.length} 个接口`);
      } else {
        const errorMsg = result.message || '获取失败';
        if (!silent) {
          alert(`❌ ${errorMsg}`);
        }
        console.warn('Failed to fetch online:', errorMsg);
        recordAction('接口管理 - 文档管理', `在线获取失败 - ${errorMsg}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      console.error('Fetch online error:', err);
      if (!silent) {
        alert(`❌ 获取失败: ${errorMsg}`);
      }
      // 静默模式下失败不报错，仅记录日志
      console.warn('Auto-load failed:', errorMsg);
      recordAction('接口管理 - 文档管理', `在线获取异常 - ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 清理在线缓存
  const handleClearCache = async () => {
    if (!confirm('确定要清理本地代码缓存吗？清理后下次获取将重新拉取代码。')) {
      return;
    }
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/nacos-sync/clear-git-cache', {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        alert('✅ ' + result.message);
        recordAction('接口管理 - 文档管理', '清理在线代码缓存');
      } else {
        alert('❌ ' + (result.message || '清理失败'));
      }
    } catch (err) {
      console.error('Clear cache error:', err);
      alert('❌ 清理失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate XML Spreadsheet 2003 format
  const handleExportExcel = () => {
    recordAction('接口管理 - 文档管理', '按钮:导出 Excel - 导出当前接口列表');
    let xmlBody = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SubHeader">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
   <Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Hyperlink">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#0563C1" ss:Underline="Single"/>
  </Style>
  <Style ss:ID="CellBorder">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="ErrorCell">
   <Interior ss:Color="#FFC7CE" ss:Pattern="Solid"/>
   <Font ss:Color="#9C0006"/>
  </Style>
 </Styles>`;

    // Store mappings of Transaction ID -> Unique Sheet Name
    const sheetNameMap: Record<string, string> = {};
    const usedSheetNames = new Set<string>();

    const getSafeSheetName = (id: string, nameHint: string) => {
        // Excel Sheet Limit: 31 chars, no []*:?/\
        let base = (id || nameHint || 'Untitled').replace(/[:\\/?*\[\]]/g, '').trim();
        if (base.length > 25) base = base.substring(0, 25);
        if (base.length === 0) base = 'Sheet';

        let unique = base;
        let counter = 1;
        while(usedSheetNames.has(unique.toLowerCase())) {
            unique = `${base}_${counter}`;
            counter++;
        }
        usedSheetNames.add(unique.toLowerCase());
        return unique;
    };

    // 2. Summary Sheet
    xmlBody += `
 <Worksheet ss:Name="Summary">
  <Table ss:ExpandedColumnCount="6" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
   <Column ss:Width="150"/>
   <Column ss:Width="200"/>
   <Column ss:Width="150"/>
   <Column ss:Width="200"/>
   <Column ss:Width="150"/>
   <Column ss:Width="100"/>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Transaction ID</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Description</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Template</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Downstream Interface Calls</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Path</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Link</Data></Cell>
   </Row>`;

    transactions.forEach(t => {
      try {
          const sheetName = getSafeSheetName(t.id, 'Trans');
          sheetNameMap[t.id] = sheetName;
          const downstreamStr = t.downstreamCalls.join('; ') || 'None';

          xmlBody += `
       <Row>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.id)}</Data></Cell>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.trsName)}</Data></Cell>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.template)}</Data></Cell>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(downstreamStr)}</Data></Cell>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.filePath)}</Data></Cell>
        <Cell ss:StyleID="CellBorder" ss:HRef="#'${sheetName}'!A1"><Data ss:Type="String">Go to Detail</Data></Cell>
       </Row>`;
      } catch (e) {
          console.error(`Error adding summary row for ${t.id}`, e);
          xmlBody += `<Row><Cell ss:StyleID="ErrorCell"><Data ss:Type="String">Error Exporting ${escapeXml(t.id)}</Data></Cell></Row>`;
      }
    });

    xmlBody += `
  </Table>
 </Worksheet>`;



    // 4. Individual Sheets
    const recursiveRowBuilder = (fields: XmlField[], depth: number): string => {
        let rows = '';
        fields.forEach(f => {
            const indent = ' '.repeat(depth * 4);
            const name = f.children ? `[+] ${f.name}` : f.name;
            const type = f.type === 'field' ? (f.style || 'String') : f.type;
            
            rows += `
   <Row>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${indent}${escapeXml(name)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(f.description)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(type)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(f.pattern || f.style)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${f.children ? 'Complex' : 'Simple'}</Data></Cell>
   </Row>`;
            
            if (f.children && f.children.length > 0) {
                rows += recursiveRowBuilder(f.children, depth + 1);
            }
        });
        return rows;
    };

    transactions.forEach(t => {
      try {
          const safeSheetName = sheetNameMap[t.id];
          // Skip if no sheet name allocated (meaning failed summary)
          if (!safeSheetName) return;

          xmlBody += `
     <Worksheet ss:Name="${safeSheetName}">
      <Table ss:ExpandedColumnCount="5" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
       <Column ss:Width="200"/>
       <Column ss:Width="200"/>
       <Column ss:Width="100"/>
       <Column ss:Width="150"/>
       <Column ss:Width="80"/>
       
       <Row>
         <Cell ss:HRef="#'Summary'!A1" ss:StyleID="Hyperlink"><Data ss:Type="String">&lt;&lt; Back to Summary</Data></Cell>
       </Row>
       <Row ss:Height="20"/>
       
       <Row>
        <Cell ss:StyleID="Header" ss:MergeAcross="4"><Data ss:Type="String">${escapeXml(t.trsName)} (${escapeXml(t.id)})</Data></Cell>
       </Row>
       <Row>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">Module</Data></Cell>
        <Cell ss:StyleID="CellBorder" ss:MergeAcross="3"><Data ss:Type="String">${escapeXml(t.module)}</Data></Cell>
       </Row>
       <Row>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">Action Class</Data></Cell>
        <Cell ss:StyleID="CellBorder" ss:MergeAcross="3"><Data ss:Type="String">${escapeXml(t.actionClass)}</Data></Cell>
       </Row>
       <Row>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">Template</Data></Cell>
        <Cell ss:StyleID="CellBorder" ss:MergeAcross="3"><Data ss:Type="String">${escapeXml(t.template)}</Data></Cell>
       </Row>

       <Row ss:Height="15"/>
       <Row>
        <Cell ss:StyleID="SubHeader" ss:MergeAcross="4"><Data ss:Type="String">Downstream Interface Calls</Data></Cell>
       </Row>
       ${t.downstreamCalls.length > 0 ? t.downstreamCalls.map(call => `
       <Row>
         <Cell ss:StyleID="CellBorder" ss:MergeAcross="4"><Data ss:Type="String">${escapeXml(call)}</Data></Cell>
       </Row>`).join('') : '<Row><Cell ss:StyleID="CellBorder" ss:MergeAcross="4"><Data ss:Type="String">None</Data></Cell></Row>'}
       
       <Row ss:Height="15"/>
       <Row>
        <Cell ss:StyleID="SubHeader" ss:MergeAcross="4"><Data ss:Type="String">Input Parameters</Data></Cell>
       </Row>
       <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Name</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Description</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Type</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Format</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Struct</Data></Cell>
       </Row>
       ${t.inputs.length > 0 ? recursiveRowBuilder(t.inputs, 0) : '<Row><Cell ss:StyleID="CellBorder" ss:MergeAcross="4"><Data ss:Type="String">None</Data></Cell></Row>'}
       
       <Row ss:Height="15"/>
       <Row>
        <Cell ss:StyleID="SubHeader" ss:MergeAcross="4"><Data ss:Type="String">Output Parameters</Data></Cell>
       </Row>
       <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Name</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Description</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Type</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Format</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Struct</Data></Cell>
       </Row>
       ${t.outputs.length > 0 ? recursiveRowBuilder(t.outputs, 0) : '<Row><Cell ss:StyleID="CellBorder" ss:MergeAcross="4"><Data ss:Type="String">None</Data></Cell></Row>'}
       
      </Table>
     </Worksheet>`;
      } catch (e) {
          console.error(`Error generating details sheet for ${t.id}`, e);
      }
    });

    xmlBody += `</Workbook>`;

    const blob = new Blob([xmlBody], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `interface_spec_${new Date().toISOString().slice(0,10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 导出单个接口为 Excel（兼容代码生成导入格式）
  const handleExportSingleInterface = (t: XmlTransaction) => {
    recordAction('接口管理 - 文档管理', `按钮:下载接口 - 下载接口 [${t.id}]`);
    
    let xmlBody = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellBorder">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Summary">
  <Table ss:ExpandedColumnCount="6" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
   <Column ss:Width="150"/>
   <Column ss:Width="200"/>
   <Column ss:Width="150"/>
   <Column ss:Width="200"/>
   <Column ss:Width="150"/>
   <Column ss:Width="100"/>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Transaction ID</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Description</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Template</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Downstream Interface Calls</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Path</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Module</Data></Cell>
   </Row>`;
    
    try {
      const downstreamStr = t.downstreamCalls.join('; ') || 'None';
      xmlBody += `
   <Row>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.id)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.trsName)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.template)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(downstreamStr)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.filePath)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.module)}</Data></Cell>
   </Row>`;
    } catch (e) {
      console.error(`Error exporting interface ${t.id}`, e);
    }
    
    xmlBody += `
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Interface Detail">
  <Table ss:ExpandedColumnCount="5" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
   <Column ss:Width="200"/>
   <Column ss:Width="200"/>
   <Column ss:Width="100"/>
   <Column ss:Width="150"/>
   <Column ss:Width="80"/>
   <Row>
    <Cell ss:StyleID="Header" ss:MergeAcross="4"><Data ss:Type="String">${escapeXml(t.trsName)} (${escapeXml(t.id)})</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">Module</Data></Cell>
    <Cell ss:StyleID="CellBorder" ss:MergeAcross="3"><Data ss:Type="String">${escapeXml(t.module)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">Template</Data></Cell>
    <Cell ss:StyleID="CellBorder" ss:MergeAcross="3"><Data ss:Type="String">${escapeXml(t.template)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">Action Class</Data></Cell>
    <Cell ss:StyleID="CellBorder" ss:MergeAcross="3"><Data ss:Type="String">${escapeXml(t.actionClass)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">Downstream Calls</Data></Cell>
    <Cell ss:StyleID="CellBorder" ss:MergeAcross="3"><Data ss:Type="String">${t.downstreamCalls.join('; ')}</Data></Cell>
   </Row>
   <Row ss:Height="20"/>
   <Row>
    <Cell ss:StyleID="Header" ss:MergeAcross="4"><Data ss:Type="String">Request Parameters</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Description</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Type</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Format</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Struct</Data></Cell>
   </Row>`;
    
    const recursiveRowBuilder = (fields: XmlField[], depth: number): string => {
      let rows = '';
      fields.forEach(f => {
        const indent = ' '.repeat(depth * 2);
        const name = f.children ? `[+] ${f.name}` : f.name;
        const type = f.type === 'field' ? (f.style || 'String') : f.type;
        
        rows += `
   <Row>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${indent}${escapeXml(name)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(f.description)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(type)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(f.pattern || f.style)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${f.children ? 'Complex' : 'Simple'}</Data></Cell>
   </Row>`;
        
        if (f.children && f.children.length > 0) {
          rows += recursiveRowBuilder(f.children, depth + 1);
        }
      });
      return rows;
    };
    
    xmlBody += t.inputs.length > 0 ? recursiveRowBuilder(t.inputs, 0) : '<Row><Cell ss:StyleID="CellBorder" ss:MergeAcross="4"><Data ss:Type="String">None</Data></Cell></Row>';
    
    xmlBody += `
   <Row ss:Height="20"/>
   <Row>
    <Cell ss:StyleID="Header" ss:MergeAcross="4"><Data ss:Type="String">Output Parameters</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Description</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Type</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Format</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Struct</Data></Cell>
   </Row>
   ${t.outputs.length > 0 ? recursiveRowBuilder(t.outputs, 0) : '<Row><Cell ss:StyleID="CellBorder" ss:MergeAcross="4"><Data ss:Type="String">None</Data></Cell></Row>'}
  </Table>
 </Worksheet>
</Workbook>`;
    
    const blob = new Blob([xmlBody], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${t.id}_${new Date().toISOString().slice(0,10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewDetails = (t: XmlTransaction) => {
      setSelectedTransaction(t);
      recordAction('接口管理 - 文档管理', `按钮:查看详情 - 查看接口 [${t.id}]`);
  };

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Interface Documentation</h2>
           <p className="text-slate-500 text-sm flex items-center gap-1">
             <Info size={14} className="text-blue-500" />
             <span className="font-medium text-slate-600">支持在线获取和本地上传两种方式</span>
           </p>
        </div>
        
        <div className="flex gap-3">
            <input 
                type="file" 
                ref={fileInputRef}
                className="hidden"
                multiple
                // @ts-ignore
                webkitdirectory="" 
                onChange={handleFileUpload}
            />
            
            <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
                {isProcessing ? <Activity className="animate-spin" size={18}/> : <Folder size={18} />}
                {isProcessing ? 'Processing...' : '本地上传'}
            </button>

            <button 
                onClick={handleOpenConfig}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
            >
                <GitBranch size={18} />
                在线获取
            </button>

            {transactions.length > 0 && (
                <button 
                    onClick={handleExportExcel}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                >
                    <Download size={18} />
                    导出Excel
                </button>
            )}
        </div>
      </div>

      {/* 接口搜索栏 */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input 
                type="text"
                placeholder="搜索接口 ID、名称、模块或下游调用..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <select 
              value={searchField}
              onChange={(e) => setSearchField(e.target.value as any)}
              className="px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">全部</option>
              <option value="id">按ID</option>
              <option value="name">按名称</option>
              <option value="module">按模块</option>
              <option value="downstream">按下游调用</option>
            </select>
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="text-slate-400 hover:text-slate-600 p-2"
              >
                <X size={18} />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="mt-2 text-sm text-slate-600">
              搜索结果: {filteredTransactions.length} / {transactions.length}
            </div>
          )}
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
            <div className="p-6 text-center">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileJson size={32} />
                </div>
                <h3 className="text-lg font-medium text-slate-900">No Interfaces Loaded</h3>
                <p className="text-slate-500 mt-2 max-w-sm">Please select the <strong>online banking project root directory</strong>. We will scan XML configurations, Java files, and Properties files.</p>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-6 text-blue-600 font-medium hover:underline"
                >
                    Browse Files
                </button>
            </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <div className="overflow-auto flex-1 relative">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-700">Module / ID</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Description (CN)</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Implementation</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Downstream Interfaces</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 text-center">I/O</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 text-center">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(groupedTransactions).map(([module, rawTrans]) => {
                    const trans = rawTrans as XmlTransaction[];
                    return (
                        <React.Fragment key={module}>
                            {/* Group Header with Module Name */}
                            <tr className="bg-slate-100">
                                <td colSpan={6} className="px-6 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                                    <Layers size={14} />
                                    {module}
                                    <span className="font-normal text-slate-400 ml-2">({trans.length} in this page)</span>
                                </td>
                            </tr>
                            {trans.map(t => (
                                <tr key={`${t.module}-${t.id}`} className="hover:bg-slate-50 group transition-colors">
                                    <td className="px-6 py-3">
                                      <div className="flex flex-col">
                                        <span className="font-mono text-blue-600 font-medium text-sm">{t.id}</span>
                                        <span className="text-[10px] text-slate-400 mt-1 truncate max-w-[200px]" title={t.filePath}>
                                          {t.filePath}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-3">
                                      <div className="text-slate-800 font-medium">{t.trsName || 'No description'}</div>
                                    </td>
                                    <td className="px-6 py-3">
                                      <div className="flex flex-col">
                                         <div className="flex items-center gap-1 text-slate-700">
                                            <FileCode size={14} className="text-purple-500"/>
                                            <span className="font-mono text-xs">{t.actionRef}</span>
                                         </div>
                                         <span className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[250px]" title={t.actionClass}>
                                            {t.actionClass || ''}
                                         </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-3">
                                      {t.downstreamCalls.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                          {t.downstreamCalls.map((call, idx) => (
                                            <div key={idx} className="text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-100 font-mono">
                                              {call}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic">无</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <div className="flex justify-center gap-2">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium border border-blue-100" title="Input Fields">
                                                {t.inputs.length}
                                            </span>
                                            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs font-medium border border-purple-100" title="Output Fields">
                                                {t.outputs.length}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <div className="flex justify-center gap-1">
                                            <button 
                                                onClick={() => handleViewDetails(t)}
                                                className="text-slate-400 hover:text-blue-600 p-2 rounded hover:bg-blue-50 transition-all"
                                                title="View Details"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleExportSingleInterface(t)}
                                                className="text-slate-400 hover:text-green-600 p-2 rounded hover:bg-green-50 transition-all"
                                                title="Download"
                                            >
                                                <Download size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </React.Fragment>
                    );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="border-t border-slate-200 p-4 bg-slate-50 flex items-center justify-between">
             <div className="text-sm text-slate-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, transactions.length)} of {transactions.length} entries
             </div>
             <div className="flex items-center gap-2">
                <button 
                   onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                   disabled={currentPage === 1}
                   className="p-2 border border-slate-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                   <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium text-slate-700 px-2">
                   Page {currentPage} of {Math.max(1, totalPages)}
                </span>
                <button 
                   onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                   disabled={currentPage === totalPages || totalPages === 0}
                   className="p-2 border border-slate-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                   <ChevronRight size={16} />
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Detailed Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
             {/* Header */}
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-start bg-slate-50">
               <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold font-mono text-blue-600">{selectedTransaction.id}</h3>
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                        {selectedTransaction.module}
                    </span>
                  </div>
                  <p className="text-slate-800 mt-1 font-bold text-lg">{selectedTransaction.trsName}</p>
                  <p className="text-slate-500 text-xs mt-1 font-mono">{selectedTransaction.filePath}</p>
                  
                  <div className="flex flex-col mt-3 text-xs bg-slate-50 p-2 rounded border border-slate-100">
                      <div className="flex gap-2 mb-1">
                        <span className="font-bold text-slate-600">Action Ref:</span>
                        <span className="font-mono text-slate-800">{selectedTransaction.actionRef}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-bold text-slate-600">Class:</span>
                        <span className="font-mono text-purple-600">{selectedTransaction.actionClass}</span>
                      </div>
                  </div>
               </div>
               <button 
                 onClick={() => setSelectedTransaction(null)}
                 className="text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-200 transition-colors"
               >
                 <X size={20} />
               </button>
             </div>
             
             {/* Content */}
             <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
               {/* Downstream & Inputs */}
               <div className="flex-1 overflow-y-auto p-6 bg-white space-y-6">
                 {/* Downstream */}
                 {selectedTransaction.downstreamCalls.length > 0 && (
                     <div>
                         <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2 pb-2 border-b border-slate-100">
                           <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                           Downstream Interfaces
                         </h4>
                         <div className="bg-amber-50 rounded-lg border border-amber-100 p-3">
                             <ul className="space-y-1">
                                {selectedTransaction.downstreamCalls.map((call, idx) => (
                                    <li key={idx} className="text-xs font-mono text-amber-800 flex items-center gap-2">
                                        <ArrowRightLeft size={10} />
                                        {call}
                                    </li>
                                ))}
                             </ul>
                         </div>
                     </div>
                 )}

                 <div>
                     <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
                       <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                       Request Parameters
                     </h4>
                     <div className="bg-slate-50 rounded-lg border border-slate-100 p-4">
                        <div className="flex text-xs font-semibold text-slate-400 mb-2 px-1">
                            <div className="flex-1">Name / Type</div>
                            <div className="flex-1">Description</div>
                            <div className="flex-1">Style</div>
                        </div>
                        <FieldTree fields={selectedTransaction.inputs} />
                     </div>
                 </div>
               </div>

               {/* Outputs */}
               <div className="flex-1 overflow-y-auto p-6 bg-white">
                 <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
                   <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                   Response Parameters
                 </h4>
                 <div className="bg-slate-50 rounded-lg border border-slate-100 p-4">
                    <div className="flex text-xs font-semibold text-slate-400 mb-2 px-1">
                        <div className="flex-1">Name / Type</div>
                        <div className="flex-1">Description</div>
                        <div className="flex-1">Type/Info</div>
                    </div>
                    <FieldTree fields={selectedTransaction.outputs} />
                 </div>
               </div>
             </div>
          </div>
        </div>
      )}

      {/* 在线获取配置对话框 */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-y-auto max-h-[90vh] animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <GitBranch size={20} className="text-purple-600" />
                在线仓库配置 (HTTP/SSH 认证)
              </h3>
              <button 
                onClick={() => setIsConfigOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Auth Type Selector - Hidden HTTPS/Token option */}
              <div className="flex gap-6 mb-4">
                {/* HTTPS + Token option hidden */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="authType" 
                    checked={onlineConfig.authType === 'ssh'}
                    onChange={() => handleAuthTypeChange('ssh')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700 flex items-center gap-1"><Key size={14}/> SSH Key</span>
                </label>
              </div>

              <div className="space-y-4 max-w-4xl bg-slate-50 p-4 rounded-lg border border-slate-100">
                {onlineConfig.authType === 'token' ? (
                  // HTTPS / Token Config
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Repository URL (HTTPS)</label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                          <input 
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400"
                            placeholder="https://gitee.com/username/repo.git" 
                            value={onlineConfig.repoUrl}
                            onChange={e => setOnlineConfig({...onlineConfig, repoUrl: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Personal Access Token</label>
                      <input 
                        className="w-full pl-4 pr-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400"
                        type="password"
                        placeholder="Your Gitee Personal Access Token" 
                        value={onlineConfig.authToken || ''}
                        onChange={e => setOnlineConfig({...onlineConfig, authToken: e.target.value})}
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
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400"
                          placeholder="git@gitee.com:username/repo.git" 
                          value={onlineConfig.repoUrl}
                          onChange={e => setOnlineConfig({...onlineConfig, repoUrl: e.target.value})}
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

              {/* 分支选择 */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Branch (分支)</label>
                <div className="flex gap-2">
                  {onlineConfig.branches.length > 0 ? (
                    // 有分支列表时，提供下拉选择或手动输入
                    <>
                      <select 
                        value={onlineConfig.branch}
                        onChange={(e) => {
                          const newBranch = e.target.value;
                          setOnlineConfig({...onlineConfig, branch: newBranch});
                          // 保存分支选择到数据库
                          apiService.configApi.save({
                            configKey: 'doc-management-selected-branch',
                            configValue: newBranch,
                            configType: 'DOC_MANAGEMENT',
                            description: 'Document Management selected branch'
                          }).catch(err => console.warn('Failed to save selected branch:', err));
                        }}
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700"
                      >
                        <option value="">-- 选择分支 --</option>
                        {onlineConfig.branches.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                      <span className="text-slate-500 px-2 py-2 text-sm">或</span>
                      <input 
                        type="text"
                        placeholder="手动输入分支名称"
                        value={onlineConfig.branch}
                        onChange={(e) => {
                          const newBranch = e.target.value;
                          setOnlineConfig({...onlineConfig, branch: newBranch});
                        }}
                        onBlur={() => {
                          // 保存分支选择到数据库
                          if (onlineConfig.branch.trim()) {
                            apiService.configApi.save({
                              configKey: 'doc-management-selected-branch',
                              configValue: onlineConfig.branch,
                              configType: 'DOC_MANAGEMENT',
                              description: 'Document Management selected branch'
                            }).catch(err => console.warn('Failed to save selected branch:', err));
                          }
                        }}
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700"
                      />
                    </>
                  ) : (
                    // 没有分支列表时，提供手动输入
                    <input 
                      type="text"
                      placeholder="请先测试连接以获取分支列表，或手动输入分支名称"
                      value={onlineConfig.branch}
                      onChange={(e) => {
                        const newBranch = e.target.value;
                        setOnlineConfig({...onlineConfig, branch: newBranch});
                      }}
                      onBlur={() => {
                        // 保存分支选择到数据库
                        if (onlineConfig.branch.trim()) {
                          apiService.configApi.save({
                            configKey: 'doc-management-selected-branch',
                            configValue: onlineConfig.branch,
                            configType: 'DOC_MANAGEMENT',
                            description: 'Document Management selected branch'
                          }).catch(err => console.warn('Failed to save selected branch:', err));
                        }
                      }}
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700"
                    />
                  )}
                  <button 
                    onClick={handleTestConnection}
                    disabled={isTesting || !onlineConfig.repoUrl.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-bold flex items-center gap-2 whitespace-nowrap shadow-sm transition-colors"
                  >
                    {isTesting ? <Activity className="animate-spin" size={16} /> : <Network size={16} />}
                    {isTesting ? '测试中...' : '测试连接'}
                  </button>
                </div>
              </div>

              {/* 连接状态提示 */}
              {onlineConfig.isConnected && (
                <div className="bg-green-50 border border-green-300 rounded-lg p-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <p className="text-sm text-green-700 font-medium">✅ 连接成功！已获取分支列表</p>
                </div>
              )}

              {onlineConfig.connectionError && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-3">
                  <p className="text-sm text-red-700 font-medium">❌ {onlineConfig.connectionError}</p>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
                <p className="font-bold mb-2">📋 支持的认证方式:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><strong>HTTP Token</strong>: Token 认证，推荐用于 Gitee/GitHub</li>
                  <li><strong>SSH Key</strong>: SSH 密钥认证，适合服务器部署</li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0">
              <button 
                onClick={() => setIsConfigOpen(false)}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
              >
                取消
              </button>
              <button 
                onClick={() => handleFetchOnline(false)}
                disabled={isProcessing || !onlineConfig.repoUrl.trim() || !onlineConfig.isConnected}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? <Activity className="animate-spin" size={16} /> : <Download size={16} />}
                {isProcessing ? '获取中...' : '获取并解析'}
              </button>
            </div>
            
            {/* 缓存管理区域 */}
            <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <GitBranch size={14} />
                <span>当前缓存分支: {onlineConfig.branch || '无'}</span>
              </div>
              <button 
                onClick={handleClearCache}
                disabled={isProcessing}
                className="text-red-600 hover:text-red-800 hover:underline flex items-center gap-1"
              >
                <AlertTriangle size={12} />
                清理本地代码缓存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};