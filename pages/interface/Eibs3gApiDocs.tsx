import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Braces,
  ChevronDown,
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  FileCode2,
  Files,
  FolderOpen,
  GitBranch,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Shrink,
  UploadCloud,
  X
} from 'lucide-react';
import { recordAction } from '../../services/auditService';
import type {
  AnalysisDiagnostic,
  AnalysisProgress,
  AnalysisSummary,
  AnalysisWorkerResponse,
  RouteRoot,
  VueTreeNode
} from '../../services/eibs3gApiAnalyzer/types';

type PageStatus = 'idle' | 'analyzing' | 'ready' | 'building' | 'error';

const requestId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

const defaultExpandedNodes = (tree: VueTreeNode): Set<string> => {
  const expanded = new Set<string>();
  const visit = (node: VueTreeNode, depth: number) => {
    if (depth < 2 && node.children.length > 0) expanded.add(node.id);
    node.children.forEach(child => visit(child, depth + 1));
  };
  visit(tree, 0);
  return expanded;
};

const allExpandableNodes = (tree: VueTreeNode): Set<string> => {
  const expanded = new Set<string>();
  const visit = (node: VueTreeNode) => {
    if (node.children.length > 0) expanded.add(node.id);
    node.children.forEach(visit);
  };
  visit(tree);
  return expanded;
};

const filterEmptyLeaves = (node: VueTreeNode, keepRoot = false): VueTreeNode | null => {
  const children = node.children
    .map(child => filterEmptyLeaves(child))
    .filter((child): child is VueTreeNode => child !== null);

  if (!keepRoot && node.directApis.length === 0 && children.length === 0 && node.status !== 'cycle') {
    return null;
  }

  return { ...node, children };
};

interface TreeNodeCardProps {
  node: VueTreeNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: VueTreeNode) => void;
}

const TreeNodeCard: React.FC<TreeNodeCardProps> = ({ node, expanded, onToggle, onSelect }) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);

  return (
    <div className="relative">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          disabled={!hasChildren}
          data-audit-exclude="true"
          className="mt-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-blue-100 bg-white text-blue-700 shadow-sm transition-colors hover:bg-blue-50 disabled:border-transparent disabled:bg-transparent disabled:text-slate-300 disabled:shadow-none"
          aria-label={isExpanded ? '收起子组件' : '展开子组件'}
        >
          {hasChildren && (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
        </button>

        <button
          type="button"
          onClick={() => onSelect(node)}
          data-audit-exclude="true"
          className={`min-w-0 flex-1 rounded-lg border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md ${
            node.isRouteRoot ? 'border-blue-300 ring-4 ring-blue-50' : 'border-slate-200'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <FileCode2 size={17} className={node.isRouteRoot ? 'text-blue-700' : 'text-slate-500'} />
                <span className="break-all text-sm font-semibold text-blue-950">{node.fileName}</span>
                {node.isRouteRoot && (
                  <span className="rounded-md bg-blue-700 px-2 py-0.5 text-[11px] font-semibold text-white">路由顶点</span>
                )}
                {node.status === 'cycle' && (
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">循环引用</span>
                )}
                {node.status === 'parse-error' && (
                  <span className="rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">解析失败</span>
                )}
              </div>
              {node.isRouteRoot && node.routeTitle && (
                <p className="mt-1.5 text-sm font-medium text-blue-700">
                  {node.routeTitle}
                </p>
              )}
              {node.componentName && (
                <p className="mt-1 break-all text-xs text-slate-400">组件名：{node.componentName}</p>
              )}
            </div>
            <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              {node.directApis.length} 个直接接口
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {node.directApis.length > 0 ? node.directApis.map(api => (
              <div
                key={`${api.modulePath}:${api.methodName}`}
                className="rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Braces size={14} className="text-blue-700" />
                  <span className="break-all text-xs font-semibold text-blue-950">{api.methodName}</span>
                  {api.chineseName && (
                    <span className="text-xs text-slate-600">{api.chineseName}</span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-700">
                    {api.httpMethod}
                  </span>
                  <code className="break-all text-slate-600">{api.endpoint}</code>
                </div>
              </div>
            )) : (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400">
                本组件未直接调用已识别的 API
              </div>
            )}
          </div>
        </button>
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-[13px] mt-4 space-y-4 border-l-2 border-blue-100 pl-9">
          {node.children.map(child => (
            <div key={child.id} className="relative before:absolute before:-left-9 before:top-8 before:w-9 before:border-t-2 before:border-blue-100">
              <TreeNodeCard node={child} expanded={expanded} onToggle={onToggle} onSelect={onSelect} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface NodeDetailsProps {
  node: VueTreeNode;
  onClose: () => void;
}

const NodeDetails: React.FC<NodeDetailsProps> = ({ node, onClose }) => (
  <div className="fixed inset-0 z-50 flex justify-end bg-blue-950/35 backdrop-blur-sm" onClick={onClose}>
    <aside
      className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
      onClick={event => event.stopPropagation()}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-blue-100 bg-white px-6 py-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-blue-700">节点详情</p>
          <h3 className="mt-1 break-all text-lg font-semibold text-blue-950">{node.fileName}</h3>
        </div>
        <button type="button" onClick={onClose} data-audit-exclude="true" className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X size={20} />
        </button>
      </div>

      <div className="space-y-6 p-6">
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-400">完整路径</dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-700">{node.componentPath}</dd>
            </div>
            {node.componentName && (
              <div>
                <dt className="text-xs font-medium text-slate-400">组件 name</dt>
                <dd className="mt-1 break-all text-slate-700">{node.componentName}</dd>
              </div>
            )}
            {node.isRouteRoot && (
              <>
                {node.routeTitle && (
                  <div>
                    <dt className="text-xs font-medium text-slate-400">页面中文名</dt>
                    <dd className="mt-1 text-slate-700">{node.routeTitle}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium text-slate-400">路由地址</dt>
                  <dd className="mt-1 break-all font-mono text-xs text-slate-700">{node.routePath}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-400">路由来源</dt>
                  <dd className="mt-1 break-all font-mono text-xs text-slate-700">{node.routerFile}</dd>
                </div>
              </>
            )}
          </dl>
        </section>

        <section>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-950">
            <Database size={16} className="text-blue-700" />
            当前节点直接调用的接口（{node.directApis.length}）
          </h4>
          <div className="space-y-3">
            {node.directApis.length > 0 ? node.directApis.map(api => (
              <div key={`${api.modulePath}:${api.methodName}`} className="rounded-lg border border-blue-100 p-4">
                <div className="break-all text-sm font-semibold text-blue-950">{api.methodName}</div>
                {api.chineseName && <div className="mt-1 text-sm text-slate-600">{api.chineseName}</div>}
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="rounded bg-emerald-100 px-2 py-1 font-bold text-emerald-700">{api.httpMethod}</span>
                  <code className="break-all text-slate-700">{api.endpoint}</code>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
                  <div className="break-all">API 文件：{api.modulePath}:{api.sourceLine}</div>
                  <div className="mt-1">调用位置：{node.componentPath}:{api.callLine}</div>
                  <div className="mt-1">导入别名：{api.importAlias}</div>
                </div>
              </div>
            )) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-400">没有直接接口调用。</p>
            )}
          </div>
        </section>

        <section>
          <h4 className="mb-3 text-sm font-semibold text-blue-950">API 模块导入（{node.apiImports.length}）</h4>
          <div className="space-y-2">
            {node.apiImports.length > 0 ? node.apiImports.map(item => (
              <div key={`${item.alias}:${item.modulePath}`} className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-blue-800">{item.alias}</span>
                <span className="mx-2 text-slate-300">→</span>
                <span className="break-all font-mono">{item.modulePath}</span>
              </div>
            )) : <p className="text-sm text-slate-400">没有识别到 API 模块导入。</p>}
          </div>
        </section>

        <section>
          <h4 className="mb-3 text-sm font-semibold text-blue-950">Vue 子组件导入（{node.vueImports.length}）</h4>
          <div className="space-y-2">
            {node.vueImports.length > 0 ? node.vueImports.map(item => (
              <div key={`${item.localName}:${item.componentPath}`} className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <div><span className="font-semibold text-blue-800">{item.localName}</span> · 第 {item.sourceLine} 行</div>
                <div className="mt-1 break-all font-mono text-slate-500">{item.componentPath}</div>
              </div>
            )) : <p className="text-sm text-slate-400">没有识别到 Vue 子组件导入。</p>}
          </div>
        </section>

        {node.diagnostics.length > 0 && (
          <section>
            <h4 className="mb-3 text-sm font-semibold text-amber-800">节点诊断（{node.diagnostics.length}）</h4>
            <div className="space-y-2">
              {node.diagnostics.map(diagnostic => (
                <div key={diagnostic.id} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  {diagnostic.message}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  </div>
);

interface DiagnosticDrawerProps {
  diagnostics: AnalysisDiagnostic[];
  onClose: () => void;
}

const DiagnosticDrawer: React.FC<DiagnosticDrawerProps> = ({ diagnostics, onClose }) => (
  <div className="fixed inset-0 z-50 flex justify-end bg-blue-950/35 backdrop-blur-sm" onClick={onClose}>
    <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-amber-100 bg-white px-6 py-5">
        <div>
          <p className="text-xs font-semibold text-amber-700">容错与跳过记录</p>
          <h3 className="mt-1 text-lg font-semibold text-blue-950">分析诊断（{diagnostics.length}）</h3>
        </div>
        <button type="button" onClick={onClose} data-audit-exclude="true" className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X size={20} />
        </button>
      </div>
      <div className="space-y-3 p-6">
        {diagnostics.length > 0 ? diagnostics.map(diagnostic => (
          <div
            key={diagnostic.id}
            className={`rounded-lg border p-4 ${
              diagnostic.level === 'error'
                ? 'border-red-200 bg-red-50'
                : diagnostic.level === 'warning'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-blue-100 bg-blue-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {diagnostic.level === 'info'
                ? <Info size={17} className="mt-0.5 shrink-0 text-blue-600" />
                : <AlertTriangle size={17} className={`mt-0.5 shrink-0 ${diagnostic.level === 'error' ? 'text-red-600' : 'text-amber-600'}`} />}
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800">{diagnostic.code}</div>
                <div className="mt-1 text-sm text-slate-700">{diagnostic.message}</div>
                {diagnostic.filePath && (
                  <div className="mt-2 break-all font-mono text-xs text-slate-500">
                    {diagnostic.filePath}{diagnostic.sourceLine ? `:${diagnostic.sourceLine}` : ''}
                  </div>
                )}
                {diagnostic.relatedPath && (
                  <div className="mt-1 break-all font-mono text-xs text-slate-400">关联：{diagnostic.relatedPath}</div>
                )}
              </div>
            </div>
          </div>
        )) : (
          <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50 p-8 text-center text-sm text-emerald-700">
            本次分析没有产生跳过或错误记录。
          </div>
        )}
      </div>
    </aside>
  </div>
);

export const Eibs3gApiDocs: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const selectedFilesRef = useRef<File[]>([]);
  const initializeRequestRef = useRef('');
  const treeRequestRef = useRef('');
  const [status, setStatus] = useState<PageStatus>('idle');
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [error, setError] = useState('');
  const [rootName, setRootName] = useState('');
  const [routeRoots, setRouteRoots] = useState<RouteRoot[]>([]);
  const [selectedRootId, setSelectedRootId] = useState('');
  const [tree, setTree] = useState<VueTreeNode | null>(null);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [diagnostics, setDiagnostics] = useState<AnalysisDiagnostic[]>([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hideEmpty, setHideEmpty] = useState(false);
  const [selectedNode, setSelectedNode] = useState<VueTreeNode | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  const requestTree = useCallback((routeRootId: string) => {
    const worker = workerRef.current;
    if (!worker || !routeRootId) return;
    const id = requestId('tree');
    treeRequestRef.current = id;
    setSelectedRootId(routeRootId);
    setTree(null);
    setSelectedNode(null);
    setStatus('building');
    setError('');
    setProgress({ phase: 'tree', label: '准备构建页面组件树', completed: 0, total: 0, percent: 2 });
    worker.postMessage({ type: 'build-tree', requestId: id, routeRootId });
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL('../../workers/eibs3gApiAnalysisWorker.ts', import.meta.url), {
      type: 'module'
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
      const message = event.data;
      if (message.type === 'progress') {
        if (message.requestId === initializeRequestRef.current || message.requestId === treeRequestRef.current) {
          setProgress(message.progress);
        }
        return;
      }

      if (message.type === 'ready') {
        if (message.requestId !== initializeRequestRef.current) return;
        setRootName(message.rootName);
        setRouteRoots(message.routeRoots);
        setSummary(message.summary);
        setDiagnostics(message.diagnostics);
        setStatus('ready');
        setProgress(null);
        const firstRoot = message.routeRoots[0];
        if (firstRoot) requestTree(firstRoot.id);
        void recordAction(
          '接口管理 - 网银接口文档',
          `本地分析 src：路由顶点 ${message.routeRoots.length}，API ${message.summary.apiDefinitions}`
        ).catch(() => undefined);
        return;
      }

      if (message.type === 'tree') {
        if (message.requestId !== treeRequestRef.current) return;
        setTree(message.tree);
        setSummary(message.summary);
        setDiagnostics(message.diagnostics);
        setExpanded(defaultExpandedNodes(message.tree));
        setStatus('ready');
        setProgress(null);
        return;
      }

      if (message.requestId !== initializeRequestRef.current && message.requestId !== treeRequestRef.current) return;
      setError(message.message);
      setDiagnostics(message.diagnostics);
      setStatus('error');
      setProgress(null);
    };

    worker.onerror = event => {
      const detail = event.message || '未知运行错误';
      setError(`浏览器本地分析线程运行失败：${detail}。该过程不经过后端，因此后端控制台不会产生分析日志。`);
      setStatus('error');
      setProgress(null);
    };

    worker.onmessageerror = () => {
      setError('浏览器无法读取分析线程返回的数据，请刷新页面后重新选择 src 文件夹。');
      setStatus('error');
      setProgress(null);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [requestTree]);

  const startAnalysis = useCallback((files: File[]) => {
    const worker = workerRef.current;
    if (!worker || files.length === 0) return;

    worker.postMessage({ type: 'reset' });
    const id = requestId('initialize');
    initializeRequestRef.current = id;
    treeRequestRef.current = '';
    selectedFilesRef.current = files;
    setStatus('analyzing');
    setProgress({ phase: 'index', label: '准备读取 src 文件夹', completed: 0, total: files.length, percent: 1 });
    setError('');
    setRootName('');
    setRouteRoots([]);
    setSelectedRootId('');
    setTree(null);
    setSummary(null);
    setDiagnostics([]);
    setSelectedNode(null);
    setExpanded(new Set());
    worker.postMessage({ type: 'initialize', requestId: id, files });
  }, []);

  const handleFolderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length > 0) startAnalysis(files);
  };

  const filteredRoots = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return routeRoots;
    return routeRoots.filter(root => [root.title, root.routePath, root.routeName, root.componentPath]
      .some(value => value.toLowerCase().includes(keyword)));
  }, [routeRoots, search]);

  const displayedTree = useMemo(() => {
    if (!tree) return null;
    return hideEmpty ? filterEmptyLeaves(tree, true) : tree;
  }, [tree, hideEmpty]);

  const selectedRoot = useMemo(
    () => routeRoots.find(root => root.id === selectedRootId) || null,
    [routeRoots, selectedRootId]
  );

  const toggleNode = (id: string) => {
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isBusy = status === 'analyzing' || status === 'building';

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-[1520px] flex-col gap-6 p-6 lg:p-8">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFolderChange}
        {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
      />

      <section className="relative overflow-hidden rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-700 via-sky-400 to-emerald-500" />
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="mb-2 text-xs font-semibold text-blue-700">研发工具 · 接口管理</p>
            <h2 className="text-2xl font-semibold text-blue-950">网银接口文档</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              从路由页面出发，递归展示 Vue 组件依赖及每个节点直接调用的后端接口。
              源码仅在当前浏览器中解析，不会上传到服务器。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {selectedFilesRef.current.length > 0 && (
              <button
                type="button"
                onClick={() => startAnalysis(selectedFilesRef.current)}
                disabled={isBusy}
                className="flex items-center gap-2 rounded-md border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={17} className={isBusy ? 'animate-spin' : ''} />
                重新分析
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className="flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(29,78,216,0.18)] transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBusy ? <Loader2 size={17} className="animate-spin" /> : <FolderOpen size={17} />}
              选择 src 文件夹
            </button>
          </div>
        </div>

        {progress && (
          <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex items-center justify-between gap-4 text-xs font-medium text-blue-800">
              <span>{progress.label}</span>
              <span>
                {progress.total > 0 && `${Math.min(progress.completed, progress.total)}/${progress.total} · `}
                {progress.percent}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
              <div className="h-full rounded-full bg-blue-700 transition-all duration-200" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="mt-2 text-xs text-blue-700/70">
              文件读取与代码分析全部在当前浏览器的独立线程中执行，后端控制台不会输出此处的进度日志。
            </p>
          </div>
        )}

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">无法完成分析</div>
              <div className="mt-1">{error}</div>
            </div>
          </div>
        )}
      </section>

      {summary && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          {[
            { label: '已选文件', value: summary.files.totalSelected, icon: Files },
            { label: '路由文件', value: summary.files.routeFiles, icon: GitBranch },
            { label: '路由顶点', value: summary.routeRoots, icon: FileCode2 },
            { label: 'Vue 文件', value: summary.files.vueFiles, icon: Braces },
            { label: '已解析 Vue', value: summary.parsedVueFiles, icon: RefreshCw },
            { label: 'API 定义', value: summary.apiDefinitions, icon: Database }
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500">{item.label}</span>
                  <Icon size={15} className="text-blue-600" />
                </div>
                <div className="mt-2 text-2xl font-semibold text-blue-950">{item.value}</div>
              </div>
            );
          })}
        </section>
      )}

      {routeRoots.length === 0 && !isBusy ? (
        <section className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-blue-200 bg-white/70 p-10">
          <div className="max-w-2xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
              <UploadCloud size={30} />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-blue-950">选择网银前端项目的 src 文件夹</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              文件夹中需要包含 <code className="text-blue-700">api</code>、
              <code className="text-blue-700">router/modules</code> 和 <code className="text-blue-700">views</code>。
              系统只读取分析所需的 JavaScript 与 Vue 文件。
            </p>
            <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <GitBranch size={18} className="text-blue-700" />
                <div className="mt-2 text-sm font-semibold text-slate-800">路由作为顶点</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">读取 component 和 meta.title</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <Braces size={18} className="text-blue-700" />
                <div className="mt-2 text-sm font-semibold text-slate-800">递归 Vue 组件</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">只沿普通 script 的 .vue import</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <ShieldCheck size={18} className="text-emerald-600" />
                <div className="mt-2 text-sm font-semibold text-slate-800">浏览器本地处理</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">不上传文件，不依赖网络服务</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-7 inline-flex items-center gap-2 rounded-md bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
            >
              <FolderOpen size={17} />
              选择 src 文件夹
            </button>
          </div>
        </section>
      ) : routeRoots.length > 0 && (
        <section className="grid min-h-[620px] flex-1 gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
            <div className="border-b border-blue-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-blue-950">路由顶点</div>
                  <div className="mt-1 text-xs text-slate-400">{rootName || 'src'} · {routeRoots.length} 个页面</div>
                </div>
                <button
                  type="button"
                  onClick={() => setDiagnosticsOpen(true)}
                  data-audit-exclude="true"
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                    diagnostics.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {diagnostics.length > 0 ? <AlertTriangle size={13} /> : <ShieldCheck size={13} />}
                  诊断 {diagnostics.length}
                </button>
              </div>
              <div className="relative mt-4">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="搜索中文名、文件名或路由"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="max-h-[calc(100vh-20rem)] flex-1 space-y-2 overflow-y-auto p-3 xl:max-h-none">
              {filteredRoots.map(root => (
                <button
                  type="button"
                  key={root.id}
                  onClick={() => requestTree(root.id)}
                  disabled={status === 'analyzing'}
                  data-audit-exclude="true"
                  className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${
                    selectedRootId === root.id
                      ? 'border-blue-300 bg-blue-50 shadow-sm'
                      : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="truncate text-sm font-semibold text-blue-950">{root.title || fileName(root.componentPath)}</div>
                  <div className="mt-1 truncate text-xs text-slate-600">{fileName(root.componentPath)}</div>
                  {root.routePath && <div className="mt-1 truncate font-mono text-[11px] text-slate-400">{root.routePath}</div>}
                </button>
              ))}
              {filteredRoots.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-slate-400">没有匹配的路由页面</div>
              )}
            </div>
          </aside>

          <main className="min-w-0 overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-blue-100 bg-gradient-to-r from-blue-50/80 to-white px-5 py-4 md:flex-row md:items-center">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-blue-950">
                  {selectedRoot?.title || selectedRoot?.componentPath || '页面组件树'}
                </div>
                {selectedRoot && (
                  <div className="mt-1 truncate font-mono text-xs text-slate-500">{selectedRoot.componentPath}</div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHideEmpty(current => !current)}
                  data-audit-exclude="true"
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium ${
                    hideEmpty ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {hideEmpty ? <Eye size={14} /> : <EyeOff size={14} />}
                  {hideEmpty ? '显示空叶子' : '隐藏空叶子'}
                </button>
                <button
                  type="button"
                  onClick={() => tree && setExpanded(allExpandableNodes(tree))}
                  disabled={!tree}
                  data-audit-exclude="true"
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <GitBranch size={14} /> 全部展开
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(new Set())}
                  disabled={!tree}
                  data-audit-exclude="true"
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <Shrink size={14} /> 全部收起
                </button>
              </div>
            </div>

            <div className="h-[calc(100vh-18rem)] min-h-[520px] overflow-auto bg-[#f8fbff] p-5 md:p-7">
              {status === 'building' && !tree ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <Loader2 size={30} className="mx-auto animate-spin text-blue-700" />
                    <div className="mt-3 text-sm font-medium text-blue-950">正在递归构建组件树</div>
                    <div className="mt-1 text-xs text-slate-400">只解析当前路由能够到达的 Vue 文件</div>
                  </div>
                </div>
              ) : displayedTree ? (
                <div className="min-w-[620px]">
                  <TreeNodeCard node={displayedTree} expanded={expanded} onToggle={toggleNode} onSelect={setSelectedNode} />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">请选择一个路由页面</div>
              )}
            </div>
          </main>
        </section>
      )}

      {selectedNode && <NodeDetails node={selectedNode} onClose={() => setSelectedNode(null)} />}
      {diagnosticsOpen && <DiagnosticDrawer diagnostics={diagnostics} onClose={() => setDiagnosticsOpen(false)} />}
    </div>
  );
};
