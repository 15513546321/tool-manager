import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Download, Folder, Eye, X, FileJson, ChevronDown, FileCode, Layers, ChevronLeft, ChevronRight, Activity, ArrowRightLeft, Info, GitBranch, Network, Settings, Lock, Key, Globe, AlertTriangle } from 'lucide-react';
import {
  parseProjectFiles,
  FileEntry,
  clearMiddleProjectChainParserCache,
  createMiddleProjectChainResolver
} from '../../services/xmlParser';
import { XmlTransaction, XmlField, DownstreamCallChain, TransactionCallExpandToken, TransactionChainCall } from '../../types';
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

interface SharedWorkspaceState {
  middleReady: boolean;
  middleEntriesAvailable: boolean;
  middleProjectName: string;
  middleEntryCount: number;
  middleCachedAt: number;
  chainCount: number;
  chainMap: Record<string, DownstreamCallChain>;
}

interface SharedMiddleEntriesPayload {
  projectName: string;
  cachedAt: number;
  entryCount: number;
  entries: FileEntry[];
}

interface MiddleResolveWorkerRequest {
  type: 'resolve-downstream';
  requestId: string;
  serviceKey: string;
  downstreamCall: string;
  maxDepth?: number;
  entries?: FileEntry[];
}

interface MiddleResolveNodeLayerRequest {
  type: 'resolve-node-layer';
  requestId: string;
  serviceKey: string;
  expandToken: TransactionCallExpandToken;
  entries?: FileEntry[];
}

interface MiddleResetWorkerRequest {
  type: 'reset-cache';
}

type MiddleWorkerRequest = MiddleResolveWorkerRequest | MiddleResolveNodeLayerRequest | MiddleResetWorkerRequest;

interface MiddleWorkerProgressResponse {
  type: 'progress';
  requestId: string;
  progress: number;
}

interface MiddleWorkerDownstreamResultResponse {
  type: 'result-downstream';
  requestId: string;
  chain: DownstreamCallChain;
}

interface MiddleWorkerNodeLayerResultResponse {
  type: 'result-node-layer';
  requestId: string;
  children: TransactionChainCall[];
}

interface MiddleWorkerErrorResponse {
  type: 'error';
  requestId: string;
  message: string;
}

type MiddleWorkerResponse =
  | MiddleWorkerProgressResponse
  | MiddleWorkerDownstreamResultResponse
  | MiddleWorkerNodeLayerResultResponse
  | MiddleWorkerErrorResponse;

interface PendingResolveChainWorkerRequest {
  kind: 'chain';
  downstreamCall: string;
  resolve: (chain: DownstreamCallChain | undefined) => void;
  reject: (reason?: unknown) => void;
}

interface PendingResolveNodeLayerWorkerRequest {
  kind: 'node-layer';
  resolve: (children: TransactionChainCall[]) => void;
  reject: (reason?: unknown) => void;
}

type PendingWorkerRequest = PendingResolveChainWorkerRequest | PendingResolveNodeLayerWorkerRequest;

interface MiddleSourceFileMeta {
  file: File;
  key: string;
  lowerPath: string;
  lowerName: string;
  isJava: boolean;
  isXml: boolean;
  isYaml: boolean;
  isProperties: boolean;
}

const MIDDLE_SCAN_CHUNK_SIZE = 300;
const MIDDLE_MAX_FILE_BYTES = 2 * 1024 * 1024; // Skip oversized non-code artifacts for upload responsiveness.
const MIDDLE_GLOBAL_SERVICE_KEY = '__all__';
const MIDDLE_SERVICE_JAVA_FILE_LIMIT = 320;
const MIDDLE_SERVICE_APP_CONFIG_LIMIT = 48;
const MIDDLE_SERVICE_RESOLVER_FILE_LIMIT = 64;
const MIDDLE_REFERENCE_HINT_JAVA_LIMIT = 360;
const MIDDLE_WORKER_CHAIN_TIMEOUT_MS = 45_000;
const MIDDLE_WORKER_NODE_LAYER_TIMEOUT_MS = 30_000;
const MIDDLE_IGNORED_PATH_SEGMENTS = [
  '/.git/',
  '/.idea/',
  '/node_modules/',
  '/target/',
  '/dist/',
  '/build/',
  '/logs/',
  '/log/',
  '/ffdc/',
  '/doc/',
  '/doc(',
  '/docs/'
];

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

const enrichTransactionsWithChains = (
  transactions: XmlTransaction[],
  chainMap: Record<string, DownstreamCallChain>
): XmlTransaction[] => {
  if (!transactions || transactions.length === 0) return [];

  return transactions.map(transaction => {
    const matchedChains = transaction.downstreamCalls
      .map(call => chainMap[call])
      .filter((chain): chain is DownstreamCallChain => Boolean(chain));

    return {
      ...transaction,
      downstreamChains: matchedChains
    };
  });
};

export const DocManagement: React.FC = () => {
  const [transactions, setTransactions] = useState<XmlTransaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<XmlTransaction | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const middleFileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMiddleProcessing, setIsMiddleProcessing] = useState(false);
  const [middleProjectName, setMiddleProjectName] = useState('');
  const [middleChainMap, setMiddleChainMap] = useState<Record<string, DownstreamCallChain>>({});
  const [middleDownstreamTotal, setMiddleDownstreamTotal] = useState(0);
  const [middleUploadProgress, setMiddleUploadProgress] = useState<{
    scanned: number;
    total: number;
    accepted: number;
    skipped: number;
  } | null>(null);
  const [resolvingDownstreamMap, setResolvingDownstreamMap] = useState<Record<string, boolean>>({});
  const [resolvingDownstreamProgressMap, setResolvingDownstreamProgressMap] = useState<Record<string, number>>({});
  const [expandingCallNodeMap, setExpandingCallNodeMap] = useState<Record<string, boolean>>({});
  const [expandedCallNodeMap, setExpandedCallNodeMap] = useState<Record<string, boolean>>({});
  const [loadedCallNodeMap, setLoadedCallNodeMap] = useState<Record<string, boolean>>({});
  const [middleIndexReady, setMiddleIndexReady] = useState(false);
  const [expandedDownstreamMap, setExpandedDownstreamMap] = useState<Record<string, boolean>>({});
  const middleSourceFilesRef = useRef<File[]>([]);
  const middleSourceMetaRef = useRef<MiddleSourceFileMeta[]>([]);
  const middleServiceFilePoolRef = useRef<Record<string, MiddleSourceFileMeta[]>>({});
  const middleResolverFilesRef = useRef<File[]>([]);
  const middleServiceResolverRef = useRef<Record<string, boolean>>({});
  const middleServiceEntriesRef = useRef<Record<string, FileEntry[]>>({});
  const middleServiceEntriesLoadingRef = useRef<Record<string, Promise<FileEntry[]>>>({});
  const middleFileContentCacheRef = useRef<Record<string, string>>({});
  const middleAllEntriesRef = useRef<FileEntry[]>([]);
  const middleChainMapRef = useRef<Record<string, DownstreamCallChain>>({});
  const resolvingDownstreamMapRef = useRef<Record<string, boolean>>({});
  const middleWorkerRef = useRef<Worker | null>(null);
  const pendingWorkerRequestsRef = useRef<Record<string, PendingWorkerRequest>>({});
  const pendingWorkerTimeoutRef = useRef<Record<string, number>>({});
  const sharedMiddleEntriesLoadingRef = useRef<Promise<boolean> | null>(null);
  
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

  const applyMiddleChains = (items: XmlTransaction[]): XmlTransaction[] => {
    return enrichTransactionsWithChains(items, middleChainMap);
  };

  const getChainForCall = (transaction: XmlTransaction, downstreamCall: string): DownstreamCallChain | undefined => {
    return transaction.downstreamChains?.find(chain => chain.downstreamCall === downstreamCall) || middleChainMap[downstreamCall];
  };

  const buildTransactionsFromCachedInterfaces = (interfaces: any[]): XmlTransaction[] => {
    return interfaces.map((iface: any) => ({
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
  };

  const resetMiddleWorkerCacheOnly = () => {
    middleServiceResolverRef.current = {};
    middleServiceEntriesLoadingRef.current = {};
    clearMiddleProjectChainParserCache();
    const pendingRequests = pendingWorkerRequestsRef.current;
    Object.keys(pendingRequests).forEach(key => {
      pendingRequests[key].reject(new Error('shared middle workspace reset'));
      clearPendingWorkerTimeout(key);
    });
    pendingWorkerRequestsRef.current = {};
    Object.keys(pendingWorkerTimeoutRef.current).forEach(clearPendingWorkerTimeout);
    if (middleWorkerRef.current) {
      const resetMessage: MiddleWorkerRequest = { type: 'reset-cache' };
      middleWorkerRef.current.postMessage(resetMessage);
    }
  };

  const applySharedMiddleEntries = (projectName: string, entries: FileEntry[]) => {
    middleSourceFilesRef.current = [];
    middleSourceMetaRef.current = [];
    middleServiceFilePoolRef.current = {};
    middleResolverFilesRef.current = [];
    middleFileContentCacheRef.current = {};
    middleServiceEntriesRef.current = {
      [MIDDLE_GLOBAL_SERVICE_KEY]: entries
    };
    middleAllEntriesRef.current = entries;
    resetMiddleWorkerCacheOnly();
    setMiddleProjectName(projectName || 'shared-middle-project');
    setMiddleIndexReady(entries.length > 0);
  };

  const applySharedWorkspaceSummary = (workspace?: SharedWorkspaceState) => {
    const nextChainMap = workspace?.chainMap || {};
    setMiddleProjectName(workspace?.middleProjectName || '');
    setMiddleIndexReady(Boolean(workspace?.middleReady));
    setMiddleChainMap(nextChainMap);
  };

  const ensureSharedMiddleEntriesLoaded = async (): Promise<boolean> => {
    if (middleAllEntriesRef.current.length > 0) return true;
    if (!middleIndexReady) return false;

    if (sharedMiddleEntriesLoadingRef.current) {
      return sharedMiddleEntriesLoadingRef.current;
    }

    sharedMiddleEntriesLoadingRef.current = (async () => {
      try {
        const result = await apiService.docManagementApi.getSharedMiddleEntries();
        const payload = result?.data as SharedMiddleEntriesPayload | undefined;
        if (!result?.success || !payload || !Array.isArray(payload.entries) || payload.entries.length === 0) {
          return false;
        }
        applySharedMiddleEntries(payload.projectName, payload.entries);
        return true;
      } catch (err) {
        console.warn('Failed to restore shared middle entries:', err);
        return false;
      } finally {
        sharedMiddleEntriesLoadingRef.current = null;
      }
    })();

    return sharedMiddleEntriesLoadingRef.current;
  };

  const buildDownstreamToggleKey = (transaction: XmlTransaction, downstreamCall: string, scope: 'list' | 'modal'): string => {
    return `${scope}::${transaction.module}::${transaction.id}::${downstreamCall}`;
  };

  const isDownstreamExpanded = (key: string): boolean => {
    return !!expandedDownstreamMap[key];
  };

  const toggleDownstreamExpanded = (key: string) => {
    setExpandedDownstreamMap(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const buildChainCallNodeKey = (
    downstreamCall: string,
    beanName: string,
    pathKey: string,
    callId: string
  ): string => {
    return `${downstreamCall}::${beanName}::${pathKey}::${callId}`;
  };

  const getChainCallNodeKey = (
    downstreamCall: string,
    beanName: string,
    call: TransactionChainCall
  ): string => {
    return buildChainCallNodeKey(downstreamCall, beanName, call.pathKey || '', call.call);
  };

  const getChainCallIdentity = (call: TransactionChainCall): string => {
    return `${call.type}|${call.call}|${call.pathKey || ''}|${call.nestLevel || 0}|${call.description || ''}|${call.tableName || ''}|${
      call.downstreamInterfaceCode || ''
    }`;
  };

  const getCallPathStack = (call: TransactionChainCall): string[] => {
    return (call.pathKey || '')
      .split('>')
      .map(item => item.trim())
      .filter(Boolean);
  };

  const getCallFullPath = (call: TransactionChainCall): string => {
    const stack = getCallPathStack(call);
    stack.push(call.call);
    return stack.join('>');
  };

  const hasExpandableChildren = (call: TransactionChainCall): boolean => {
    return (call.type === 'local-service' || call.type === 'rpc-service') && Boolean(call.expandToken);
  };

  const isDescendantCall = (call: TransactionChainCall, ancestorFullPath: string): boolean => {
    const path = call.pathKey || '';
    return path === ancestorFullPath || path.startsWith(`${ancestorFullPath}>`);
  };

  const buildMiddleFileKey = (file: File): string => file.webkitRelativePath || file.name;

  const normalizeMiddlePath = (path: string): string => path.replace(/\\/g, '/').toLowerCase();

  const isMiddleSourceFileName = (lowerName: string): boolean => {
    return (
      lowerName.endsWith('.java') ||
      lowerName.endsWith('.xml') ||
      lowerName.endsWith('.yml') ||
      lowerName.endsWith('.yaml') ||
      lowerName.endsWith('.properties')
    );
  };

  const shouldIgnoreMiddlePath = (lowerPath: string): boolean => {
    return MIDDLE_IGNORED_PATH_SEGMENTS.some(segment => lowerPath.includes(segment));
  };

  const isServicePathMatched = (lowerPath: string, serviceName: string): boolean => {
    if (!serviceName) return false;
    return (
      lowerPath.includes(`/${serviceName}/`) ||
      lowerPath.includes(`-${serviceName}/`) ||
      lowerPath.includes(`-${serviceName}-`) ||
      lowerPath.includes(`_${serviceName}/`) ||
      lowerPath.includes(`_${serviceName}_`)
    );
  };

  const toClassName = (beanName: string): string => {
    if (!beanName) return '';
    return beanName.charAt(0).toUpperCase() + beanName.slice(1);
  };

  const parseDownstreamCallParts = (downstreamCall: string): { serviceName: string; apiServiceBean: string } => {
    const segments = downstreamCall
      .split('.')
      .map(item => item.trim())
      .filter(Boolean);
    return {
      serviceName: (segments[0] || '').toLowerCase(),
      apiServiceBean: (segments[1] || '').toLowerCase()
    };
  };

  const getAllMiddleSourceMetas = (): MiddleSourceFileMeta[] => {
    if (middleSourceMetaRef.current.length > 0) {
      return middleSourceMetaRef.current;
    }

    return middleSourceFilesRef.current.map(file => {
      const key = buildMiddleFileKey(file);
      const lowerPath = normalizeMiddlePath(key);
      const lowerName = file.name.toLowerCase();
      return {
        file,
        key,
        lowerPath,
        lowerName,
        isJava: lowerName.endsWith('.java'),
        isXml: lowerName.endsWith('.xml'),
        isYaml: lowerName.endsWith('.yml') || lowerName.endsWith('.yaml'),
        isProperties: lowerName.endsWith('.properties')
      } as MiddleSourceFileMeta;
    });
  };

  const selectMiddleFilesForDownstream = (downstreamCall: string): File[] => {
    const { serviceName, apiServiceBean } = parseDownstreamCallParts(downstreamCall);
    const apiClassName = toClassName(apiServiceBean).toLowerCase();
    const selected: File[] = [];
    const selectedKeys = new Set<string>();
    const allMetas = getAllMiddleSourceMetas();
    const getServiceFilePool = (key: string): MiddleSourceFileMeta[] => {
      const cacheKey = key || '__all__';
      const cached = middleServiceFilePoolRef.current[cacheKey];
      if (cached) return cached;
      const matched = key ? allMetas.filter(meta => isServicePathMatched(meta.lowerPath, key)) : allMetas;
      const pool = matched.length > 0 ? matched : allMetas;
      middleServiceFilePoolRef.current[cacheKey] = pool;
      return pool;
    };
    const servicePool = getServiceFilePool(serviceName);
    const apiImplModulePrefixes = new Set(
      servicePool
        .filter(
          meta =>
            meta.isJava &&
            (meta.lowerName === `${apiClassName}impl.java` || meta.lowerPath.endsWith(`/${apiClassName}impl.java`))
        )
        .map(meta => {
          const marker = '/src/main/java/';
          const idx = meta.lowerPath.indexOf(marker);
          return idx >= 0 ? meta.lowerPath.slice(0, idx + marker.length) : '';
        })
        .filter(Boolean)
    );

    const addFile = (file: File) => {
      const key = buildMiddleFileKey(file);
      if (selectedKeys.has(key)) return;
      selectedKeys.add(key);
      selected.push(file);
    };

    const javaCandidates: Array<{ meta: MiddleSourceFileMeta; score: number }> = [];
    const appConfigCandidates: Array<{ meta: MiddleSourceFileMeta; score: number }> = [];
    const resolverCandidates: Array<{ meta: MiddleSourceFileMeta; score: number }> = [];

    servicePool.forEach(meta => {
      const { lowerPath, lowerName, isJava, isXml, isYaml, isProperties } = meta;

      const servicePathMatched =
        !!serviceName && isServicePathMatched(lowerPath, serviceName);
      const apiPathMatched =
        !!apiServiceBean &&
        (lowerPath.includes(apiServiceBean) ||
          lowerPath.includes(apiClassName) ||
          lowerName.includes(apiServiceBean) ||
          lowerName.includes(`${apiClassName}impl`));
      const sameApiModuleMatched =
        apiImplModulePrefixes.size > 0 &&
        Array.from(apiImplModulePrefixes).some(prefix => lowerPath.startsWith(prefix)) &&
        (lowerPath.includes('/application/') ||
          lowerPath.includes('/api/') ||
          lowerPath.includes('/service/') ||
          lowerPath.includes('/mapper/') ||
          lowerPath.includes('/trs/'));
      const appConfigMatched =
        (isYaml || isProperties) && (lowerPath.includes('bootstart') || lowerName.startsWith('application'));

      if (isJava) {
        const serviceScopedJavaMatched =
          (servicePathMatched || sameApiModuleMatched) &&
          (lowerPath.includes('/api/') ||
            lowerPath.includes('/service/') ||
            lowerPath.includes('/mapper/') ||
            lowerPath.includes('/trs') ||
            lowerName.includes('service') ||
            lowerName.includes('mapper') ||
            lowerName.startsWith('trs'));
        if (apiPathMatched || serviceScopedJavaMatched || sameApiModuleMatched) {
          let score = 0;
          if (apiPathMatched) score += 120;
          if (serviceScopedJavaMatched) score += 40;
          if (servicePathMatched) score += 15;
          if (sameApiModuleMatched) score += 36;
          if (lowerPath.includes('/api/')) score += 12;
          if (lowerPath.includes('/service/')) score += 10;
          if (lowerPath.includes('/mapper/')) score += 8;
          if (lowerName.includes(`${apiClassName}impl`)) score += 20;
          if (lowerName.includes('service')) score += 6;
          if (lowerName.includes('mapper')) score += 5;
          javaCandidates.push({ meta, score });
        }
      }

      if (appConfigMatched) {
        let score = 0;
        if (servicePathMatched) score += 12;
        if (lowerPath.includes('/bootstart/')) score += 6;
        if (lowerName.startsWith('application')) score += 5;
        appConfigCandidates.push({ meta, score });
      }

    });

    allMetas.forEach(meta => {
      if (!meta.isXml || !meta.lowerPath.includes('resolver')) return;
      let score = 0;
      if (meta.lowerName === 'resolver.xml') score += 20;
      if (meta.lowerPath.includes('/src/main/resources/')) score += 20;
      if (meta.lowerPath.includes('/router-center/')) score += 10;
      if (meta.lowerPath.includes('/pisces-router-')) score += 8;
      if (serviceName && (meta.lowerPath.includes(`router-${serviceName}`) || meta.lowerPath.includes(`/${serviceName}/`))) {
        score += 30;
      }
      resolverCandidates.push({ meta, score });
    });

    javaCandidates
      .sort((left, right) => {
        const scoreDiff = right.score - left.score;
        if (scoreDiff !== 0) return scoreDiff;
        return left.meta.lowerPath.length - right.meta.lowerPath.length;
      })
      .slice(0, MIDDLE_SERVICE_JAVA_FILE_LIMIT)
      .forEach(item => addFile(item.meta.file));

    appConfigCandidates
      .sort((left, right) => {
        const scoreDiff = right.score - left.score;
        if (scoreDiff !== 0) return scoreDiff;
        return left.meta.lowerPath.length - right.meta.lowerPath.length;
      })
      .slice(0, MIDDLE_SERVICE_APP_CONFIG_LIMIT)
      .forEach(item => addFile(item.meta.file));

    resolverCandidates
      .sort((left, right) => {
        const scoreDiff = right.score - left.score;
        if (scoreDiff !== 0) return scoreDiff;
        return left.meta.lowerPath.length - right.meta.lowerPath.length;
      })
      .slice(0, MIDDLE_SERVICE_RESOLVER_FILE_LIMIT)
      .forEach(item => addFile(item.meta.file));

    const hasJava = selected.some(file => file.name.toLowerCase().endsWith('.java'));
    if (!hasJava) {
      allMetas.forEach(meta => {
        const { file, lowerName } = meta;
        if (!lowerName.endsWith('.java')) return;
        if (
          lowerName.includes(apiServiceBean) ||
          lowerName.includes(apiClassName) ||
          lowerName.includes(`${apiClassName}impl`)
        ) {
          addFile(file);
        }
      });
    }

    const stillNoJava = selected.every(file => !file.name.toLowerCase().endsWith('.java'));
    if (stillNoJava && serviceName) {
      allMetas.forEach(meta => {
        if (!meta.isJava) return;
        if (isServicePathMatched(meta.lowerPath, serviceName)) addFile(meta.file);
      });
    }

    return selected;
  };

  const extractApiImplBeanHints = (content: string): string[] => {
    const hints = new Set<string>();
    const add = (value?: string) => {
      const normalized = (value || '').trim();
      if (!normalized) return;
      hints.add(normalized);
    };

    const qualifierRegex = /@Qualifier\(\s*["']([^"']+)["']\s*\)/g;
    let qualifierMatch: RegExpExecArray | null;
    while ((qualifierMatch = qualifierRegex.exec(content)) !== null) {
      add(qualifierMatch[1]);
    }

    const resourceNameRegex = /@Resource\(\s*name\s*=\s*["']([^"']+)["']\s*\)/g;
    let resourceNameMatch: RegExpExecArray | null;
    while ((resourceNameMatch = resourceNameRegex.exec(content)) !== null) {
      add(resourceNameMatch[1]);
    }

    const resourceValueRegex = /@Resource\(\s*["']([^"']+)["']\s*\)/g;
    let resourceValueMatch: RegExpExecArray | null;
    while ((resourceValueMatch = resourceValueRegex.exec(content)) !== null) {
      add(resourceValueMatch[1]);
    }

    const fieldRegex =
      /(?:private|protected|public)\s+[A-Za-z0-9_$.<>,?\s\[\]]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g;
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldRegex.exec(content)) !== null) {
      const fieldName = (fieldMatch[1] || '').trim();
      if (!fieldName) continue;
      if (fieldName.startsWith('trs') || fieldName.startsWith('api')) {
        add(fieldName);
      }
    }

    return Array.from(hints);
  };

  const normalizeTypeHint = (rawType: string): string => {
    const compact = rawType
      .replace(/<[^>]+>/g, ' ')
      .replace(/\[\]/g, ' ')
      .trim();
    if (!compact) return '';
    const base = compact.split(/\s+/)[0] || '';
    const simpleName = base.split('.').pop()?.trim() || '';
    return /^[A-Z]/.test(simpleName) ? simpleName : '';
  };

  const isTraceableTypeHint = (className: string): boolean => {
    return /Service$|Mapper$|Impl$/.test(className) || /^(Api|Rt|Trs)[A-Z]/.test(className);
  };

  const buildTypeHintVariants = (className: string): string[] => {
    if (!className) return [];
    const variants = new Set<string>();
    variants.add(className.toLowerCase());
    if (className.endsWith('Impl')) {
      variants.add(className.slice(0, -4).toLowerCase());
    } else {
      variants.add(`${className}Impl`.toLowerCase());
    }
    return Array.from(variants);
  };

  const extractReferencedTypeHints = (content: string): string[] => {
    const hints = new Set<string>();
    const add = (rawType?: string) => {
      const className = normalizeTypeHint(rawType || '');
      if (!className || !isTraceableTypeHint(className)) return;
      hints.add(className);
    };

    const fieldTypeRegex =
      /(?:private|protected|public)\s+(?:static\s+|final\s+|volatile\s+|transient\s+)*([A-Za-z_][A-Za-z0-9_$.]*(?:\s*<[^;=]+>)?)\s+[A-Za-z_][A-Za-z0-9_]*\s*(?:=[^;]*)?;/g;
    let fieldTypeMatch: RegExpExecArray | null;
    while ((fieldTypeMatch = fieldTypeRegex.exec(content)) !== null) {
      add(fieldTypeMatch[1]);
    }

    return Array.from(hints);
  };

  const enrichSelectedMiddleFilesByApiHints = async (
    downstreamCall: string,
    selectedFiles: File[]
  ): Promise<File[]> => {
    if (selectedFiles.length === 0) return selectedFiles;
    const { apiServiceBean } = parseDownstreamCallParts(downstreamCall);
    if (!apiServiceBean) return selectedFiles;
    const apiClassName = toClassName(apiServiceBean).toLowerCase();
    if (!apiClassName) return selectedFiles;

    const selected = [...selectedFiles];
    const selectedKeys = new Set(selected.map(file => buildMiddleFileKey(file)));
    const allMetas = getAllMiddleSourceMetas();

    const addFile = (file: File) => {
      const key = buildMiddleFileKey(file);
      if (selectedKeys.has(key)) return;
      selectedKeys.add(key);
      selected.push(file);
    };

    const apiImplFiles = selected.filter(file => {
      const key = buildMiddleFileKey(file).toLowerCase();
      const lowerName = file.name.toLowerCase();
      return lowerName === `${apiClassName}impl.java` || key.endsWith(`/${apiClassName}impl.java`);
    });

    if (apiImplFiles.length === 0) return selected;

    const beanHints = new Set<string>();
    for (const file of apiImplFiles) {
      const path = buildMiddleFileKey(file);
      let content = middleFileContentCacheRef.current[path];
      if (content === undefined) {
        content = await file.text();
        middleFileContentCacheRef.current[path] = content;
      }
      extractApiImplBeanHints(content).forEach(hint => beanHints.add(hint));
    }

    if (beanHints.size === 0) return selected;

    const classNameHints = new Set<string>();
    Array.from(beanHints).forEach(hint => {
      const className = toClassName(hint);
      if (!className) return;
      classNameHints.add(className.toLowerCase());
      classNameHints.add(`${className}Impl`.toLowerCase());
    });
    if (classNameHints.size === 0) return selected;

    allMetas.forEach(meta => {
      if (!meta.isJava) return;
      const className = meta.lowerName.endsWith('.java') ? meta.lowerName.slice(0, -5) : meta.lowerName;
      if (classNameHints.has(className)) {
        addFile(meta.file);
      }
    });

    return selected;
  };

  const enrichSelectedMiddleFilesByReferencedTypes = async (selectedFiles: File[]): Promise<File[]> => {
    if (selectedFiles.length === 0) return selectedFiles;

    const selected = [...selectedFiles];
    const selectedKeys = new Set(selected.map(file => buildMiddleFileKey(file)));
    const allMetas = getAllMiddleSourceMetas();
    const javaClassMap: Record<string, MiddleSourceFileMeta[]> = {};
    allMetas.forEach(meta => {
      if (!meta.isJava) return;
      const className = meta.lowerName.endsWith('.java') ? meta.lowerName.slice(0, -5) : meta.lowerName;
      if (!javaClassMap[className]) javaClassMap[className] = [];
      javaClassMap[className].push(meta);
    });

    const pendingJavaFiles = selected.filter(file => file.name.toLowerCase().endsWith('.java'));
    const scannedKeys = new Set<string>();
    let appendedJavaCount = 0;

    while (pendingJavaFiles.length > 0) {
      const file = pendingJavaFiles.shift();
      if (!file) continue;
      const path = buildMiddleFileKey(file);
      if (scannedKeys.has(path)) continue;
      scannedKeys.add(path);

      let content = middleFileContentCacheRef.current[path];
      if (content === undefined) {
        content = await file.text();
        middleFileContentCacheRef.current[path] = content;
      }

      const classHints = new Set<string>();
      extractReferencedTypeHints(content).forEach(hint => {
        buildTypeHintVariants(hint).forEach(variant => classHints.add(variant));
      });

      if (classHints.size === 0) continue;

      Array.from(classHints).forEach(classHint => {
        const matchedMetas = javaClassMap[classHint] || [];
        matchedMetas.forEach(meta => {
          if (selectedKeys.has(meta.key)) return;
          selectedKeys.add(meta.key);
          selected.push(meta.file);
          if (meta.isJava && appendedJavaCount < MIDDLE_REFERENCE_HINT_JAVA_LIMIT) {
            pendingJavaFiles.push(meta.file);
            appendedJavaCount += 1;
          }
        });
      });

      if (appendedJavaCount >= MIDDLE_REFERENCE_HINT_JAVA_LIMIT) {
        break;
      }
    }

    return selected;
  };

  const prepareFocusedMiddleFilesForDownstream = async (downstreamCall: string): Promise<File[]> => {
    const initialFiles = selectMiddleFilesForDownstream(downstreamCall);
    const withApiHints = await enrichSelectedMiddleFilesByApiHints(downstreamCall, initialFiles);
    return enrichSelectedMiddleFilesByReferencedTypes(withApiHints);
  };

  const mergeFileEntries = (baseEntries: FileEntry[], additionalEntries: FileEntry[]): FileEntry[] => {
    if (additionalEntries.length === 0) return baseEntries;
    const merged = [...baseEntries];
    const seenPaths = new Set(baseEntries.map(entry => entry.path));
    additionalEntries.forEach(entry => {
      if (seenPaths.has(entry.path)) return;
      seenPaths.add(entry.path);
      merged.push(entry);
    });
    return merged;
  };

  const readMiddleFilesAsEntries = async (
    files: File[],
    downstreamCall: string,
    progressStart: number,
    progressEnd: number
  ): Promise<FileEntry[]> => {
    if (files.length === 0) return [];
    const entries: FileEntry[] = [];
    let completed = 0;
    const chunkSize = 12;

    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      const chunkEntries = await Promise.all(
        chunk.map(async file => {
          const path = buildMiddleFileKey(file);
          let content = middleFileContentCacheRef.current[path];
          if (content === undefined) {
            content = await file.text();
            middleFileContentCacheRef.current[path] = content;
          }
          return { name: file.name, path, content };
        })
      );
      entries.push(...chunkEntries);
      completed += chunk.length;
      const ratio = completed / files.length;
      const progress = Math.min(progressEnd, Math.round(progressStart + (progressEnd - progressStart) * ratio));
      setResolvingDownstreamProgressMap(prev => ({
        ...prev,
        [downstreamCall]: progress
      }));
      // Yield to UI so progress can refresh.
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }

    return entries;
  };

  const buildAllMiddleEntriesForUpload = async (
    files: File[],
    totalScannedFiles: number,
    skippedCount: number
  ): Promise<FileEntry[]> => {
    if (files.length === 0) return [];

    const entries: FileEntry[] = [];
    const chunkSize = 24;

    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      const chunkEntries = await Promise.all(
        chunk.map(async file => {
          const path = buildMiddleFileKey(file);
          let content = middleFileContentCacheRef.current[path];
          if (content === undefined) {
            content = await file.text();
            middleFileContentCacheRef.current[path] = content;
          }
          return { name: file.name, path, content };
        })
      );
      entries.push(...chunkEntries);
      setMiddleUploadProgress({
        scanned: totalScannedFiles,
        total: totalScannedFiles,
        accepted: entries.length,
        skipped: skippedCount
      });
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }

    return entries;
  };

  const loadMiddleEntriesByServiceKey = async (
    serviceKey: string,
    downstreamCall: string,
    progressStart: number,
    progressEnd: number,
    fileSelector: () => File[] | Promise<File[]>
  ): Promise<FileEntry[]> => {
    const cached = middleServiceEntriesRef.current[serviceKey];
    if (cached) return cached;

    const pending = middleServiceEntriesLoadingRef.current[serviceKey];
    if (pending) {
      setResolvingDownstreamProgressMap(prev => ({
        ...prev,
        [downstreamCall]: Math.max(prev[downstreamCall] || 1, progressStart)
      }));
      return pending;
    }

    const loadingPromise = (async () => {
      const files = await fileSelector();
      const entries = await readMiddleFilesAsEntries(files, downstreamCall, progressStart, progressEnd);
      middleServiceEntriesRef.current[serviceKey] = entries;
      return entries;
    })();
    middleServiceEntriesLoadingRef.current[serviceKey] = loadingPromise;

    try {
      return await loadingPromise;
    } finally {
      delete middleServiceEntriesLoadingRef.current[serviceKey];
    }
  };

  const prepareServiceEntriesForDownstream = async (
    downstreamCall: string
  ): Promise<{ serviceKey: string; entries: FileEntry[] } | null> => {
    if (middleAllEntriesRef.current.length === 0) {
      const restored = await ensureSharedMiddleEntriesLoaded();
      if (!restored) return null;
    }

    setResolvingDownstreamProgressMap(prev => ({
      ...prev,
      [downstreamCall]: Math.max(prev[downstreamCall] || 1, 72)
    }));

    return {
      serviceKey: MIDDLE_GLOBAL_SERVICE_KEY,
      entries: middleAllEntriesRef.current
    };
  };

  const prepareAllEntriesForDownstream = async (
    downstreamCall: string
  ): Promise<{ serviceKey: string; entries: FileEntry[] } | null> => {
    return prepareServiceEntriesForDownstream(downstreamCall);
  };

  const countChainCalls = (chain: DownstreamCallChain): number => {
    return chain.domainServices.reduce((total, domain) => total + domain.transactionCalls.length, 0);
  };

  const collectChainCalls = (chain: DownstreamCallChain): TransactionChainCall[] => {
    return chain.domainServices.flatMap(domain => domain.transactionCalls);
  };

  const countChainDescribedCalls = (chain: DownstreamCallChain): number => {
    let total = 0;
    chain.domainServices.forEach(domain => {
      domain.transactionCalls.forEach(call => {
        if (call.description && call.description.trim()) total += 1;
      });
    });
    return total;
  };

  const countChainDownstreamCodes = (chain: DownstreamCallChain): number => {
    return collectChainCalls(chain).filter(
      call => call.type === 'downstream' && Boolean(call.downstreamInterfaceCode && call.downstreamInterfaceCode.trim())
    ).length;
  };

  const chooseRicherChain = (
    primary: DownstreamCallChain | undefined,
    fallback: DownstreamCallChain | undefined
  ): DownstreamCallChain | undefined => {
    if (!primary) return fallback;
    if (!fallback) return primary;

    const primaryScore =
      countChainCalls(primary) * 3 +
      countChainDescribedCalls(primary) * 2 +
      countChainDownstreamCodes(primary) * 3 +
      (primary.apiDescription ? 2 : 0) -
      (primary.unresolvedReason ? 8 : 0);
    const fallbackScore =
      countChainCalls(fallback) * 3 +
      countChainDescribedCalls(fallback) * 2 +
      countChainDownstreamCodes(fallback) * 3 +
      (fallback.apiDescription ? 2 : 0) -
      (fallback.unresolvedReason ? 8 : 0);
    return fallbackScore > primaryScore ? fallback : primary;
  };

  const clearPendingWorkerTimeout = (requestId: string) => {
    const timeoutId = pendingWorkerTimeoutRef.current[requestId];
    if (timeoutId === undefined) return;
    window.clearTimeout(timeoutId);
    delete pendingWorkerTimeoutRef.current[requestId];
  };

  const resolveDownstreamChainInWorker = async (
    serviceKey: string,
    downstreamCall: string,
    maxDepth: number,
    entriesForInit?: FileEntry[]
  ): Promise<DownstreamCallChain | undefined> => {
    const worker = middleWorkerRef.current;
    if (!worker) {
      const fallbackEntries = entriesForInit || middleServiceEntriesRef.current[serviceKey] || [];
      if (fallbackEntries.length === 0) return undefined;
      const resolver = createMiddleProjectChainResolver(fallbackEntries);
      return resolver.resolveOne(downstreamCall, { maxDepth });
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return await new Promise<DownstreamCallChain | undefined>((resolve, reject) => {
      pendingWorkerRequestsRef.current[requestId] = {
        kind: 'chain',
        downstreamCall,
        resolve,
        reject
      };
      pendingWorkerTimeoutRef.current[requestId] = window.setTimeout(() => {
        const pending = pendingWorkerRequestsRef.current[requestId];
        if (!pending || pending.kind !== 'chain') return;
        delete pendingWorkerRequestsRef.current[requestId];
        clearPendingWorkerTimeout(requestId);
        pending.reject(new Error(`resolve chain timeout after ${MIDDLE_WORKER_CHAIN_TIMEOUT_MS}ms`));
      }, MIDDLE_WORKER_CHAIN_TIMEOUT_MS);

      const request: MiddleWorkerRequest = {
        type: 'resolve-downstream',
        requestId,
        serviceKey,
        downstreamCall,
        maxDepth,
        entries: entriesForInit
      };
      worker.postMessage(request);
    });
  };

  const resolveCallNodeLayerInWorker = async (
    serviceKey: string,
    expandToken: TransactionCallExpandToken,
    entriesForInit?: FileEntry[]
  ): Promise<TransactionChainCall[]> => {
    const worker = middleWorkerRef.current;
    if (!worker) {
      const fallbackEntries = entriesForInit || middleServiceEntriesRef.current[serviceKey] || [];
      if (fallbackEntries.length === 0) return [];
      const resolver = createMiddleProjectChainResolver(fallbackEntries);
      return resolver.resolveCallLayer(expandToken);
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return await new Promise<TransactionChainCall[]>((resolve, reject) => {
      pendingWorkerRequestsRef.current[requestId] = {
        kind: 'node-layer',
        resolve,
        reject
      };
      pendingWorkerTimeoutRef.current[requestId] = window.setTimeout(() => {
        const pending = pendingWorkerRequestsRef.current[requestId];
        if (!pending || pending.kind !== 'node-layer') return;
        delete pendingWorkerRequestsRef.current[requestId];
        clearPendingWorkerTimeout(requestId);
        pending.reject(new Error(`resolve node layer timeout after ${MIDDLE_WORKER_NODE_LAYER_TIMEOUT_MS}ms`));
      }, MIDDLE_WORKER_NODE_LAYER_TIMEOUT_MS);

      const request: MiddleWorkerRequest = {
        type: 'resolve-node-layer',
        requestId,
        serviceKey,
        expandToken,
        entries: entriesForInit
      };
      worker.postMessage(request);
    });
  };

  const resetMiddleResolverState = () => {
    sharedMiddleEntriesLoadingRef.current = null;
    middleSourceFilesRef.current = [];
    middleSourceMetaRef.current = [];
    middleServiceFilePoolRef.current = {};
    middleResolverFilesRef.current = [];
    middleServiceResolverRef.current = {};
    middleServiceEntriesRef.current = {};
    middleServiceEntriesLoadingRef.current = {};
    middleFileContentCacheRef.current = {};
    middleAllEntriesRef.current = [];
    middleChainMapRef.current = {};
    resolvingDownstreamMapRef.current = {};
    resetMiddleWorkerCacheOnly();
    setMiddleProjectName('');
    setMiddleChainMap({});
    setMiddleDownstreamTotal(0);
    setMiddleUploadProgress(null);
    setResolvingDownstreamMap({});
    setResolvingDownstreamProgressMap({});
    setExpandingCallNodeMap({});
    setExpandedCallNodeMap({});
    setLoadedCallNodeMap({});
    setMiddleIndexReady(false);
    setExpandedDownstreamMap({});
  };

  const resolveDownstreamByPreparedEntries = async (
    downstreamCall: string,
    preparedEntries: { serviceKey: string; entries: FileEntry[] }
  ): Promise<DownstreamCallChain | undefined> => {
    const needInitEntries = !middleServiceResolverRef.current[preparedEntries.serviceKey];
    const chain = await resolveDownstreamChainInWorker(
      preparedEntries.serviceKey,
      downstreamCall,
      0,
      needInitEntries ? preparedEntries.entries : undefined
    );
    middleServiceResolverRef.current[preparedEntries.serviceKey] = true;
    return chain;
  };

  const ensureDownstreamChainResolved = async (
    downstreamCall: string,
    options?: { forceAllEntries?: boolean; forceRefresh?: boolean }
  ): Promise<DownstreamCallChain | undefined> => {
    const normalizedCall = downstreamCall.trim();
    if (!normalizedCall) return undefined;

    const existing = middleChainMapRef.current[normalizedCall];
    if (existing && !options?.forceAllEntries && !options?.forceRefresh) return existing;

    if (resolvingDownstreamMapRef.current[normalizedCall]) return existing;
    if (!middleIndexReady) return undefined;

    setResolvingDownstreamMap(prev => ({
      ...prev,
      [normalizedCall]: true
    }));
    setResolvingDownstreamProgressMap(prev => ({
      ...prev,
      [normalizedCall]: 1
    }));

    try {
      // Yield once so the "解析中" state can render before heavy parsing.
      await new Promise<void>(resolve => setTimeout(resolve, 0));

      let resolvedChain: DownstreamCallChain | undefined;
      if (options?.forceAllEntries) {
        const preparedAll = await prepareAllEntriesForDownstream(normalizedCall);
        if (!preparedAll) return existing;
        const allChain = await resolveDownstreamByPreparedEntries(normalizedCall, preparedAll);
        if (!allChain) return existing;
        resolvedChain = chooseRicherChain(existing, allChain) || allChain;
      } else {
        const preparedService = await prepareServiceEntriesForDownstream(normalizedCall);
        if (!preparedService) return existing;
        const serviceChain = await resolveDownstreamByPreparedEntries(normalizedCall, preparedService);
        if (!serviceChain) return existing;
        resolvedChain = chooseRicherChain(existing, serviceChain) || serviceChain;
      }

      if (!resolvedChain) return undefined;

      setResolvingDownstreamProgressMap(prev => ({
        ...prev,
        [normalizedCall]: 100
      }));
      setMiddleChainMap(prev => {
        if (prev[normalizedCall]) {
          const richer = chooseRicherChain(prev[normalizedCall], resolvedChain) || prev[normalizedCall];
          if (richer === prev[normalizedCall]) return prev;
          return {
            ...prev,
            [normalizedCall]: richer
          };
        }
        return {
          ...prev,
          [normalizedCall]: resolvedChain
        };
      });
      return resolvedChain;
    } catch (err) {
      console.error(`Failed to resolve downstream chain for ${normalizedCall}`, err);
      return existing;
    } finally {
      setResolvingDownstreamMap(prev => {
        if (!prev[normalizedCall]) return prev;
        const next = { ...prev };
        delete next[normalizedCall];
        return next;
      });
      setResolvingDownstreamProgressMap(prev => {
        if (!prev[normalizedCall]) return prev;
        const next = { ...prev };
        delete next[normalizedCall];
        return next;
      });
    }
  };

  const mergeCallNodeChildren = (
    downstreamCall: string,
    beanName: string,
    parentCall: TransactionChainCall,
    children: TransactionChainCall[]
  ) => {
    if (!children || children.length === 0) return;
    setMiddleChainMap(prev => {
      const chain = prev[downstreamCall];
      if (!chain) return prev;

      const domainIndex = chain.domainServices.findIndex(domain => domain.beanName === beanName);
      if (domainIndex < 0) return prev;

      const targetDomain = chain.domainServices[domainIndex];
      const existingCalls = targetDomain.transactionCalls || [];
      const existingIdentities = new Set(existingCalls.map(item => getChainCallIdentity(item)));
      const newChildren = children.filter(item => !existingIdentities.has(getChainCallIdentity(item)));
      if (newChildren.length === 0) return prev;

      const parentNodeKey = getChainCallNodeKey(downstreamCall, beanName, parentCall);
      const parentIndex = existingCalls.findIndex(item => getChainCallNodeKey(downstreamCall, beanName, item) === parentNodeKey);
      if (parentIndex < 0) return prev;

      const parentFullPath = getCallFullPath(parentCall);
      let insertAt = parentIndex + 1;
      while (insertAt < existingCalls.length && isDescendantCall(existingCalls[insertAt], parentFullPath)) {
        insertAt += 1;
      }

      const nextCalls = [
        ...existingCalls.slice(0, insertAt),
        ...newChildren,
        ...existingCalls.slice(insertAt)
      ];

      const nextDomainServices = [...chain.domainServices];
      nextDomainServices[domainIndex] = {
        ...targetDomain,
        transactionCalls: nextCalls
      };

      return {
        ...prev,
        [downstreamCall]: {
          ...chain,
          domainServices: nextDomainServices
        }
      };
    });
  };

  const isCallVisibleUnderLazyTree = (
    downstreamCall: string,
    beanName: string,
    call: TransactionChainCall,
    expandableNodeKeys: Set<string>
  ): boolean => {
    const ancestors = getCallPathStack(call);
    if (ancestors.length === 0) return true;

    for (let i = 0; i < ancestors.length; i += 1) {
      const ancestorPath = ancestors.slice(0, i).join('>');
      const ancestorCall = ancestors[i];
      const ancestorNodeKey = buildChainCallNodeKey(downstreamCall, beanName, ancestorPath, ancestorCall);
      if (!expandableNodeKeys.has(ancestorNodeKey)) continue;
      if (!expandedCallNodeMap[ancestorNodeKey]) return false;
    }
    return true;
  };

  const findCallByNodeKey = (
    downstreamCall: string,
    beanName: string,
    nodeKey: string
  ): TransactionChainCall | undefined => {
    const chain = middleChainMapRef.current[downstreamCall];
    if (!chain) return undefined;
    const domain = chain.domainServices.find(item => item.beanName === beanName);
    if (!domain) return undefined;
    return domain.transactionCalls.find(item => getChainCallNodeKey(downstreamCall, beanName, item) === nodeKey);
  };

  const handleCallNodeToggle = async (
    downstreamCall: string,
    beanName: string,
    call: TransactionChainCall
  ) => {
    if (!hasExpandableChildren(call)) return;

    const initialNodeKey = getChainCallNodeKey(downstreamCall, beanName, call);
    let targetCall = call;
    let targetExpandToken = call.expandToken;

    if (!targetExpandToken) {
      await ensureDownstreamChainResolved(downstreamCall, { forceRefresh: true });
      const refreshed = findCallByNodeKey(downstreamCall, beanName, initialNodeKey);
      if (refreshed?.expandToken) {
        targetCall = refreshed;
        targetExpandToken = refreshed.expandToken;
      } else {
        return;
      }
    }

    const nodeKey = getChainCallNodeKey(downstreamCall, beanName, targetCall);
    const isExpanded = !!expandedCallNodeMap[nodeKey];

    if (isExpanded) {
      setExpandedCallNodeMap(prev => ({
        ...prev,
        [nodeKey]: false
      }));
      return;
    }

    setExpandedCallNodeMap(prev => ({
      ...prev,
      [nodeKey]: true
    }));

    if (loadedCallNodeMap[nodeKey] || expandingCallNodeMap[nodeKey]) {
      return;
    }

    setExpandingCallNodeMap(prev => ({
      ...prev,
      [nodeKey]: true
    }));

    let mergedChildrenCount = 0;
    try {
      const prepared = await prepareServiceEntriesForDownstream(downstreamCall);
      if (!prepared) return;

      const needInitEntries = !middleServiceResolverRef.current[prepared.serviceKey];
      let children = await resolveCallNodeLayerInWorker(
        prepared.serviceKey,
        targetExpandToken,
        needInitEntries ? prepared.entries : undefined
      );
      middleServiceResolverRef.current[prepared.serviceKey] = true;

      // If service-scoped layer is empty, retry once with full uploaded code.
      if (children.length === 0 && prepared.serviceKey !== '__all__') {
        const preparedAll = await prepareAllEntriesForDownstream(downstreamCall);
        if (preparedAll) {
          const needInitAll = !middleServiceResolverRef.current[preparedAll.serviceKey];
          const allChildren = await resolveCallNodeLayerInWorker(
            preparedAll.serviceKey,
            targetExpandToken,
            needInitAll ? preparedAll.entries : undefined
          );
          middleServiceResolverRef.current[preparedAll.serviceKey] = true;
          if (allChildren.length > children.length) {
            children = allChildren;
          }
        }
      }

      mergedChildrenCount = children.length;
      mergeCallNodeChildren(downstreamCall, beanName, targetCall, children);
    } catch (err) {
      console.error(`Failed to resolve next layer for ${downstreamCall}`, err);
    } finally {
      setExpandingCallNodeMap(prev => {
        if (!prev[nodeKey]) return prev;
        const next = { ...prev };
        delete next[nodeKey];
        return next;
      });
      if (mergedChildrenCount > 0) {
        setLoadedCallNodeMap(prev => ({
          ...prev,
          [nodeKey]: true
        }));
      }
    }
  };

  const handleDownstreamToggle = (transaction: XmlTransaction, downstreamCall: string, scope: 'list' | 'modal') => {
    const toggleKey = buildDownstreamToggleKey(transaction, downstreamCall, scope);
    const expanded = isDownstreamExpanded(toggleKey);

    if (expanded) {
      toggleDownstreamExpanded(toggleKey);
      return;
    }

    toggleDownstreamExpanded(toggleKey);

    const chain = getChainForCall(transaction, downstreamCall);
    if (!middleIndexReady) return;
    if (!chain) {
      void ensureDownstreamChainResolved(downstreamCall);
    }
  };

  useEffect(() => {
    const worker = new Worker(new URL('../../workers/middleChainWorker.ts', import.meta.url), {
      type: 'module'
    });
    middleWorkerRef.current = worker;

    worker.onmessage = (event: MessageEvent<MiddleWorkerResponse>) => {
      const message = event.data;
      if (!message || !('type' in message)) return;

      if (message.type === 'progress') {
        const pending = pendingWorkerRequestsRef.current[message.requestId];
        if (!pending || pending.kind !== 'chain') return;
        setResolvingDownstreamProgressMap(prev => ({
          ...prev,
          [pending.downstreamCall]: Math.max(prev[pending.downstreamCall] || 1, Math.min(99, message.progress))
        }));
        return;
      }

      if (message.type === 'result-downstream') {
        const pending = pendingWorkerRequestsRef.current[message.requestId];
        if (!pending || pending.kind !== 'chain') return;
        delete pendingWorkerRequestsRef.current[message.requestId];
        clearPendingWorkerTimeout(message.requestId);
        pending.resolve(message.chain);
        return;
      }

      if (message.type === 'result-node-layer') {
        const pending = pendingWorkerRequestsRef.current[message.requestId];
        if (!pending || pending.kind !== 'node-layer') return;
        delete pendingWorkerRequestsRef.current[message.requestId];
        clearPendingWorkerTimeout(message.requestId);
        pending.resolve(message.children || []);
        return;
      }

      if (message.type === 'error') {
        const pending = pendingWorkerRequestsRef.current[message.requestId];
        if (!pending) return;
        delete pendingWorkerRequestsRef.current[message.requestId];
        clearPendingWorkerTimeout(message.requestId);
        pending.reject(new Error(message.message));
      }
    };

    worker.onerror = err => {
      console.error('Middle chain worker crashed', err);
    };

    return () => {
      const pendingRequests = pendingWorkerRequestsRef.current;
      Object.keys(pendingRequests).forEach(key => {
        pendingRequests[key].reject(new Error('worker terminated'));
        clearPendingWorkerTimeout(key);
      });
      pendingWorkerRequestsRef.current = {};
      Object.keys(pendingWorkerTimeoutRef.current).forEach(clearPendingWorkerTimeout);
      worker.terminate();
      middleWorkerRef.current = null;
    };
  }, []);
  
  // Load configuration and restore shared caches without forcing a git refresh.
  const loadAndFetchData = async () => {
    console.log('Starting cached workspace restore sequence...');
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

        try {
          const cachedResult = await apiService.configApi.getByKey('doc-management-interface-cache');
          if (cachedResult?.configValue) {
            const cacheData = JSON.parse(cachedResult.configValue);
            if (Array.isArray(cacheData.interfaces) && cacheData.interfaces.length > 0) {
              const cachedTransactions = buildTransactionsFromCachedInterfaces(cacheData.interfaces);
              setTransactions(applyMiddleChains(cachedTransactions));
              setSourceMode(cacheData.repoUrl === 'local-upload' ? 'local' : 'online');
              recordAction('接口管理 - 文档管理', `初始化 - 从共享接口缓存加载 ${cachedTransactions.length} 个接口`);
              console.log(`✓ Restored ${cachedTransactions.length} interfaces from shared cache`);
            } else {
              console.log('No cached interfaces found in doc-management-interface-cache');
            }
          } else {
            console.log('No doc-management-interface-cache found');
          }
        } catch (cacheErr) {
          console.warn('Failed to restore interface cache:', cacheErr);
        }

        try {
          const sharedWorkspaceResult = await apiService.docManagementApi.getSharedWorkspace();
          if (sharedWorkspaceResult?.success && sharedWorkspaceResult.data) {
            applySharedWorkspaceSummary(sharedWorkspaceResult.data as SharedWorkspaceState);
            const workspace = sharedWorkspaceResult.data as SharedWorkspaceState;
            if (workspace.middleReady) {
              console.log(
                `✓ Restored shared middle workspace summary: ${workspace.middleProjectName || 'unnamed'} (${workspace.middleEntryCount} files, ${workspace.chainCount} cached chains)`
              );
            } else {
              console.log('No shared middle workspace available');
            }
          }
        } catch (workspaceErr) {
          console.warn('Failed to restore shared workspace summary:', workspaceErr);
        }

        if (!repoUrl || !selectedBranch) {
          console.log('Skipping remote refresh on load: missing repoUrl or branch configuration');
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

    useEffect(() => {
      middleChainMapRef.current = middleChainMap;
    }, [middleChainMap]);

    useEffect(() => {
      if (!middleIndexReady || !middleProjectName.trim()) return;

      const timeoutId = window.setTimeout(() => {
        apiService.docManagementApi
          .saveSharedChainMap({ chainMap: middleChainMapRef.current })
          .catch(err => console.warn('Failed to persist shared chain cache:', err));
      }, 600);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }, [middleChainMap, middleIndexReady, middleProjectName]);

  useEffect(() => {
    resolvingDownstreamMapRef.current = resolvingDownstreamMap;
  }, [resolvingDownstreamMap]);

    useEffect(() => {
      setTransactions(prev => (prev.length === 0 ? prev : enrichTransactionsWithChains(prev, middleChainMap)));
    }, [middleChainMap]);

    useEffect(() => {
      if (!middleIndexReady) {
        setMiddleDownstreamTotal(0);
        return;
      }
      const downstreamCalls = Array.from(new Set(transactions.flatMap(item => item.downstreamCalls)));
      setMiddleDownstreamTotal(downstreamCalls.length);
    }, [transactions, middleIndexReady]);

    useEffect(() => {
      if (!selectedTransaction) return;
      const latest = transactions.find(
        item => item.id === selectedTransaction.id && item.module === selectedTransaction.module
      );
      if (latest && latest !== selectedTransaction) {
        setSelectedTransaction(latest);
      }
    }, [transactions, selectedTransaction]);

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

  const resolvedDownstreamCount = Object.keys(middleChainMap).length;
  const resolvingDownstreamCount = Object.keys(resolvingDownstreamMap).length;
  const downstreamResolveProgress =
    middleDownstreamTotal > 0 ? Math.min(100, Math.round((resolvedDownstreamCount / middleDownstreamTotal) * 100)) : 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsProcessing(true);
    resetMiddleResolverState();
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
        setCurrentPage(1);
        setTransactions(newTransactions);

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

  const handleMiddleCodeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    if (transactions.length === 0) {
      alert('请先上传网银工程，再上传中台代码进行链路展开。');
      e.target.value = '';
      return;
    }

    setIsMiddleProcessing(true);
    setMiddleProjectName('');
    setMiddleChainMap({});
    setMiddleDownstreamTotal(0);
    setMiddleUploadProgress({
      scanned: 0,
      total: fileList.length,
      accepted: 0,
      skipped: 0
    });
    setResolvingDownstreamMap({});
    setResolvingDownstreamProgressMap({});
    setExpandingCallNodeMap({});
    setExpandedCallNodeMap({});
    setLoadedCallNodeMap({});
    setMiddleIndexReady(false);
    setExpandedDownstreamMap({});
    middleSourceFilesRef.current = [];
    middleSourceMetaRef.current = [];
    middleServiceFilePoolRef.current = {};
    middleResolverFilesRef.current = [];
    middleServiceResolverRef.current = {};
    middleServiceEntriesRef.current = {};
    middleServiceEntriesLoadingRef.current = {};
    middleFileContentCacheRef.current = {};
    middleAllEntriesRef.current = [];
    middleChainMapRef.current = {};
    resolvingDownstreamMapRef.current = {};
    clearMiddleProjectChainParserCache();
    const pendingRequests = pendingWorkerRequestsRef.current;
    Object.keys(pendingRequests).forEach(key => {
      pendingRequests[key].reject(new Error('middle resolver upload reset'));
      clearPendingWorkerTimeout(key);
    });
    pendingWorkerRequestsRef.current = {};
    Object.keys(pendingWorkerTimeoutRef.current).forEach(clearPendingWorkerTimeout);
    if (middleWorkerRef.current) {
      const resetMessage: MiddleWorkerRequest = { type: 'reset-cache' };
      middleWorkerRef.current.postMessage(resetMessage);
    }
    const sourceFiles: File[] = [];
    let skippedByPath = 0;
    let skippedBySize = 0;
    let skippedByType = 0;
    const totalFileCount = fileList.length;

    for (let offset = 0; offset < totalFileCount; offset += MIDDLE_SCAN_CHUNK_SIZE) {
      const end = Math.min(totalFileCount, offset + MIDDLE_SCAN_CHUNK_SIZE);
      for (let i = offset; i < end; i += 1) {
        const file = fileList[i];
        const key = buildMiddleFileKey(file);
        const lowerPath = normalizeMiddlePath(key);
        const lowerName = file.name.toLowerCase();

        if (shouldIgnoreMiddlePath(lowerPath)) {
          skippedByPath += 1;
          continue;
        }

        if (!isMiddleSourceFileName(lowerName)) {
          skippedByType += 1;
          continue;
        }

        if (file.size > MIDDLE_MAX_FILE_BYTES) {
          skippedBySize += 1;
          continue;
        }

        sourceFiles.push(file);
      }

      setMiddleUploadProgress({
        scanned: end,
        total: totalFileCount,
        accepted: sourceFiles.length,
        skipped: skippedByPath + skippedBySize + skippedByType
      });
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }

    try {
      const downstreamCalls = Array.from(new Set(transactions.flatMap(item => item.downstreamCalls)));
      if (downstreamCalls.length === 0) {
        alert('当前网银接口没有可解析的下游接口。');
        return;
      }

      if (sourceFiles.length === 0) {
        alert('未识别到可用于解析的中台代码文件（java/xml/yml/properties）。');
        return;
      }

      const rootFolder = fileList[0].webkitRelativePath?.split('/')[0] || '';
      const sourceMetas: MiddleSourceFileMeta[] = sourceFiles.map(file => {
        const key = buildMiddleFileKey(file);
        const lowerPath = normalizeMiddlePath(key);
        const lowerName = file.name.toLowerCase();
        return {
          file,
          key,
          lowerPath,
          lowerName,
          isJava: lowerName.endsWith('.java'),
          isXml: lowerName.endsWith('.xml'),
          isYaml: lowerName.endsWith('.yml') || lowerName.endsWith('.yaml'),
          isProperties: lowerName.endsWith('.properties')
        };
      });

      middleSourceFilesRef.current = sourceFiles;
      middleSourceMetaRef.current = sourceMetas;
      middleServiceFilePoolRef.current = {};
      middleResolverFilesRef.current = sourceMetas
        .filter(meta => meta.isXml && meta.lowerPath.includes('resolver'))
        .map(meta => meta.file);
      const allEntries = await buildAllMiddleEntriesForUpload(
        sourceFiles,
        totalFileCount,
        skippedByPath + skippedBySize + skippedByType
      );
      middleServiceResolverRef.current = {};
      middleServiceEntriesRef.current = {
        [MIDDLE_GLOBAL_SERVICE_KEY]: allEntries
      };
      middleAllEntriesRef.current = allEntries;
      setMiddleIndexReady(true);
      setMiddleChainMap({});
      setMiddleProjectName(rootFolder || 'middle-project');
      setMiddleDownstreamTotal(downstreamCalls.length);
      setCurrentPage(1);

      let sharedSaveWarning = '';
      try {
        await apiService.docManagementApi.saveSharedMiddleEntries({
          projectName: rootFolder || 'middle-project',
          entries: allEntries
        });
      } catch (persistErr) {
        console.warn('Failed to persist shared middle workspace:', persistErr);
        sharedSaveWarning = `\n注意：服务器共享缓存保存失败，其他操作员暂时还不能直接复用。\n错误: ${
          persistErr instanceof Error ? persistErr.message : '未知错误'
        }`;
      }

      alert(
        `中台代码已准备完成：加载 ${allEntries.length} 个源码文件（跳过路径 ${skippedByPath}、超大文件 ${skippedBySize}、无关类型 ${skippedByType}），网银下游调用 ${downstreamCalls.length} 条。点击某个下游接口时才会懒解析该接口的内部链路。${
          sharedSaveWarning || '\n共享缓存已保存到服务器，其他操作员可直接复用。'
        }`
      );

      recordAction(
        '接口管理 - 文档管理',
        `本地上传中台代码 - 项目: ${rootFolder || 'middle-project'}, 已准备文件 ${sourceFiles.length} 个, 跳过 ${skippedByPath + skippedBySize + skippedByType} 个, 下游调用总数 ${downstreamCalls.length}`
      );
    } catch (err) {
      console.error('Failed to resolve downstream chains from middle project', err);
      alert('中台代码准备失败，请检查控制台日志。');
    } finally {
      setIsMiddleProcessing(false);
      setMiddleUploadProgress(null);
      e.target.value = '';
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
        setCurrentPage(1);
        setTransactions(applyMiddleChains(newTransactions));
        setSourceMode('online');
        
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
        try {
          await apiService.configApi.delete('doc-management-interface-cache');
        } catch (cacheDeleteErr) {
          console.warn('Failed to clear interface cache config:', cacheDeleteErr);
        }
        setTransactions([]);
        setSelectedTransaction(null);
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

  const renderDownstreamChainDetails = (chain: DownstreamCallChain) => {
    const resolveCallNestLevel = (call: TransactionChainCall): number => {
      const pathDepth = call.pathKey
        ? call.pathKey
            .split('>')
            .map(item => item.trim())
            .filter(Boolean).length
        : 0;
      return typeof call.nestLevel === 'number' ? Math.max(0, call.nestLevel) : Math.max(0, pathDepth);
    };

    const renderCallItem = (
      beanName: string,
      index: number,
      call: TransactionChainCall
    ) => {
      const commonClass =
        'text-[11px] px-2 py-1 rounded border font-mono flex flex-wrap items-center gap-2 break-all w-full';
      const nestLevel = resolveCallNestLevel(call);
      const containerStyle = { marginLeft: `${nestLevel * 44}px` };
      const nestedClass = nestLevel > 0 ? 'pl-5 border-l-[3px] border-slate-300/90' : '';
      const nodeKey = getChainCallNodeKey(chain.downstreamCall, beanName, call);
      const canExpandNode = hasExpandableChildren(call);
      const isNodeExpanded = !!expandedCallNodeMap[nodeKey];
      const isNodeLoading = !!expandingCallNodeMap[nodeKey];
      const descriptionText = (call.description || '').trim() || '未解析到描述';

      const nodeToggle = canExpandNode ? (
        <button
          type="button"
          className="inline-flex items-center justify-center w-4 h-4 rounded border border-slate-300 text-slate-500 hover:bg-slate-100 transition-colors"
          onClick={() => {
            void handleCallNodeToggle(chain.downstreamCall, beanName, call);
          }}
          title={isNodeExpanded ? '收起下一层' : '展开下一层'}
        >
          {isNodeLoading ? (
            <Activity size={11} className="animate-spin" />
          ) : isNodeExpanded ? (
            <ChevronDown size={11} />
          ) : (
            <ChevronRight size={11} />
          )}
        </button>
      ) : null;

      if (call.type === 'local-service') {
        return (
          <div key={`${beanName}-local-${index}`} className={nestedClass} style={containerStyle}>
            <div className={`${commonClass} bg-sky-50 border-sky-200 text-sky-800`}>
              {nodeToggle}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 font-semibold">本地服务</span>
              <span>{call.call}</span>
              <span className="text-sky-600">({descriptionText})</span>
            </div>
          </div>
        );
      }

      if (call.type === 'rpc-service') {
        return (
          <div key={`${beanName}-rpc-${index}`} className={nestedClass} style={containerStyle}>
            <div className={`${commonClass} bg-indigo-50 border-indigo-200 text-indigo-800`}>
              {nodeToggle}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-semibold">RPC服务</span>
              <span>{call.call}</span>
              <span className="text-indigo-700">({descriptionText})</span>
            </div>
          </div>
        );
      }

      if (call.type === 'database') {
        return (
          <div key={`${beanName}-db-${index}`} className={nestedClass} style={containerStyle}>
            <div className={`${commonClass} bg-emerald-50 border-emerald-200 text-emerald-800`}>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">数据库</span>
              <span>{call.call}</span>
              {call.tableName && <span className="text-emerald-700">表: {call.tableName}</span>}
            </div>
          </div>
        );
      }

      return (
        <div key={`${beanName}-down-${index}`} className={nestedClass} style={containerStyle}>
          <div className={`${commonClass} bg-amber-50 border-amber-200 text-amber-800`}>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">下游服务</span>
            <span>{call.call}</span>
            <span className="text-amber-700">({descriptionText})</span>
            <span className="text-amber-700">接口码: {(call.downstreamInterfaceCode || '').trim() || '未解析到接口码'}</span>
          </div>
        </div>
      );
    };

    return (
      <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 space-y-2">
        <div className="text-[10px] text-slate-600 font-mono">
          <span className="text-slate-500">service:</span> {chain.serviceName} |{' '}
          <span className="text-slate-500">api:</span> {chain.apiServiceBean}.{chain.apiMethod} |{' '}
          <span className="text-slate-500">描述:</span> {chain.apiDescription || '未解析到中文描述'}
        </div>

        {chain.unresolvedReason && (
          <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            {chain.unresolvedReason}
          </div>
        )}

        {chain.domainServices.map((domain, idx) => (
          <div key={`${domain.beanName}-${idx}`} className="rounded border border-slate-200 bg-white p-2 space-y-1">
            <div className="text-[10px] text-slate-700 font-mono break-all">
              <span className="text-slate-500">交易实现bean：</span>{domain.beanName}
            </div>

            {domain.transactionCalls.length > 0 ? (
              <div className="overflow-x-auto pb-1">
                {(() => {
                  const expandableNodeKeys = new Set(
                    domain.transactionCalls
                      .filter(item => hasExpandableChildren(item))
                      .map(item => getChainCallNodeKey(chain.downstreamCall, domain.beanName, item))
                  );
                  const visibleCalls = domain.transactionCalls.filter(item =>
                    isCallVisibleUnderLazyTree(chain.downstreamCall, domain.beanName, item, expandableNodeKeys)
                  );
                  const maxNestLevel = visibleCalls.reduce((max, item) => Math.max(max, resolveCallNestLevel(item)), 0);
                  const minWidth = Math.max(760, 760 + maxNestLevel * 88);

                  return (
                    <div className="space-y-1 min-w-max pr-1" style={{ minWidth: `${minWidth}px` }}>
                      {visibleCalls.map((call, callIndex) => renderCallItem(domain.beanName, callIndex, call))}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-[10px] text-slate-400 italic">未解析到交易链路</div>
            )}
          </div>
        ))}
      </div>
    );
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
	           {isMiddleProcessing && middleUploadProgress && (
	             <div className="mt-1 space-y-1">
	               <p className="text-xs text-amber-700 font-medium">
	                 中台文件扫描中：{middleUploadProgress.scanned}/{middleUploadProgress.total}，已纳入{' '}
	                 {middleUploadProgress.accepted}，已跳过 {middleUploadProgress.skipped}
	               </p>
	               <div className="w-64 h-1.5 rounded bg-amber-100 overflow-hidden">
	                 <div
	                   className="h-full bg-amber-500 transition-all duration-200"
	                   style={{
	                     width: `${Math.min(
	                       100,
	                       Math.round((middleUploadProgress.scanned / Math.max(1, middleUploadProgress.total)) * 100)
	                     )}%`
	                   }}
	                 />
	               </div>
	             </div>
	           )}
	           {middleProjectName && (
	             <div className="mt-1 space-y-1">
	               <p className="text-xs text-amber-700 font-medium">
	                 中台代码已准备：{middleProjectName}
               </p>
               <p className="text-xs text-amber-700">
                 解析进度：{resolvedDownstreamCount}/{middleDownstreamTotal || 0}
                 {resolvingDownstreamCount > 0 ? `（解析中 ${resolvingDownstreamCount}）` : ''}
               </p>
               {middleDownstreamTotal > 0 && (
                 <div className="w-64 h-1.5 rounded bg-amber-100 overflow-hidden">
                   <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${downstreamResolveProgress}%` }} />
                 </div>
               )}
             </div>
           )}
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

            <input
                type="file"
                ref={middleFileInputRef}
                className="hidden"
                multiple
                // @ts-ignore
                webkitdirectory=""
                onChange={handleMiddleCodeUpload}
            />
            
            <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
                {isProcessing ? <Activity className="animate-spin" size={18}/> : <Folder size={18} />}
                {isProcessing ? 'Processing...' : '上传网银代码'}
            </button>

            <button
                onClick={() => middleFileInputRef.current?.click()}
                disabled={isMiddleProcessing || transactions.length === 0}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                title={transactions.length === 0 ? '请先上传网银工程' : '上传中台工程并准备懒加载解析'}
            >
                {isMiddleProcessing ? <Activity className="animate-spin" size={18}/> : <Folder size={18} />}
                {isMiddleProcessing ? '准备中...' : '上传中台代码'}
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
                <p className="text-slate-500 mt-2 max-w-sm">Please select the <strong>online banking project root directory</strong>. After that, upload the middle-platform project to expand downstream chains.</p>
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
                                          {t.downstreamCalls.map((call, idx) => {
                                            const chain = getChainForCall(t, call);
                                            const toggleKey = buildDownstreamToggleKey(t, call, 'list');
                                            const expanded = isDownstreamExpanded(toggleKey);
                                            const resolving = !!resolvingDownstreamMap[call];
                                            const resolvingProgress = resolvingDownstreamProgressMap[call] || 0;
                                            const canExpand = Boolean(chain) || middleIndexReady;

                                            return (
                                              <div key={idx}>
                                                <button
                                                  type="button"
                                                  className={`w-full text-left text-[10px] px-2 py-1 rounded border font-mono flex items-center gap-1 ${
                                                    chain
                                                      ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                                                      : canExpand
                                                        ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                                                        : 'bg-amber-50 border-amber-100 text-amber-700'
                                                  }`}
                                                  onClick={() => {
                                                    if (!canExpand) return;
                                                    handleDownstreamToggle(t, call, 'list');
                                                  }}
                                                  title={
                                                    chain
                                                      ? '点击展开中台链路'
                                                      : canExpand
                                                        ? '点击按需解析并展开中台链路'
                                                        : '请先上传中台代码'
                                                  }
                                                >
                                                  {resolving ? (
                                                    <span className="inline-flex items-center gap-1">
                                                      <Activity size={11} className="animate-spin" />
                                                      <span>{resolvingProgress}%</span>
                                                    </span>
                                                  ) : canExpand ? (
                                                    expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                                                  ) : (
                                                    <ArrowRightLeft size={10} />
                                                  )}
                                                  <span className="break-all">{call}</span>
                                                </button>

                                                {expanded && (
                                                  chain ? (
                                                    <div className="space-y-1">
                                                      {renderDownstreamChainDetails(chain)}
                                                    </div>
                                                  ) : resolving ? (
                                                    <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] text-blue-700 flex items-center gap-1">
                                                      <Activity size={11} className="animate-spin" />
                                                      正在解析中台链路... {resolvingProgress}%
                                                    </div>
                                                  ) : (
                                                    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
                                                      {middleIndexReady ? '链路暂未解析，点击上方接口可重试。' : '请先上传中台代码。'}
                                                    </div>
                                                  )
                                                )}
                                              </div>
                                            );
                                          })}
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
                         <div className="bg-amber-50 rounded-lg border border-amber-100 p-3 space-y-2">
                             {selectedTransaction.downstreamCalls.map((call, idx) => {
                               const chain = getChainForCall(selectedTransaction, call);
                               const toggleKey = buildDownstreamToggleKey(selectedTransaction, call, 'modal');
                               const expanded = isDownstreamExpanded(toggleKey);
                               const resolving = !!resolvingDownstreamMap[call];
                               const resolvingProgress = resolvingDownstreamProgressMap[call] || 0;
                               const canExpand = Boolean(chain) || middleIndexReady;

                               return (
                                 <div key={idx}>
                                   <button
                                     type="button"
                                     className={`w-full text-left text-xs px-2 py-1 rounded border font-mono flex items-center gap-1 ${
                                       chain
                                         ? 'bg-white border-amber-300 text-amber-900 hover:bg-amber-100'
                                         : canExpand
                                           ? 'bg-white border-amber-300 text-amber-900 hover:bg-amber-100'
                                           : 'bg-amber-50 border-amber-200 text-amber-800'
                                     }`}
                                     onClick={() => {
                                       if (!canExpand) return;
                                       handleDownstreamToggle(selectedTransaction, call, 'modal');
                                     }}
                                     title={
                                       chain
                                         ? '点击展开中台链路'
                                         : canExpand
                                           ? '点击按需解析并展开中台链路'
                                           : '请先上传中台代码'
                                     }
                                   >
                                     {resolving ? (
                                       <span className="inline-flex items-center gap-1">
                                         <Activity size={12} className="animate-spin" />
                                         <span>{resolvingProgress}%</span>
                                       </span>
                                     ) : canExpand ? (
                                       expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                                     ) : (
                                       <ArrowRightLeft size={12} />
                                     )}
                                     <span className="break-all">{call}</span>
                                   </button>
                                   {expanded && (
                                     chain ? (
                                       <div className="space-y-1">
                                         {renderDownstreamChainDetails(chain)}
                                       </div>
                                     ) : resolving ? (
                                       <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-blue-700 flex items-center gap-1">
                                         <Activity size={12} className="animate-spin" />
                                         正在解析中台链路... {resolvingProgress}%
                                       </div>
                                     ) : (
                                       <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500">
                                         {middleIndexReady ? '链路暂未解析，点击上方接口可重试。' : '请先上传中台代码。'}
                                       </div>
                                     )
                                   )}
                                 </div>
                               );
                             })}
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
