import { parseApiFiles } from '../services/eibs3gApiAnalyzer/apiParser';
import { parseConfigEndpointFiles } from '../services/eibs3gApiAnalyzer/configEndpointParser';
import { createFileIndex, validateFileIndex } from '../services/eibs3gApiAnalyzer/fileIndex';
import { parseRouteFiles } from '../services/eibs3gApiAnalyzer/routeParser';
import { buildPersistedComponentGraph } from '../services/eibs3gApiAnalyzer/snapshotBuilder';
import { buildVueTree } from '../services/eibs3gApiAnalyzer/treeBuilder';
import { createVueParser } from '../services/eibs3gApiAnalyzer/vueParser';
import type {
  AnalysisDiagnostic,
  AnalysisProgress,
  AnalysisSummary,
  AnalysisWorkerRequest,
  AnalysisWorkerResponse,
  ApiModuleDefinition,
  IndexedProject,
  RouteRoot
} from '../services/eibs3gApiAnalyzer/types';

interface WorkerSession {
  project: IndexedProject;
  apiModules: Map<string, ApiModuleDefinition>;
  apiDefinitionCount: number;
  configEndpointCount: number;
  routeRoots: RouteRoot[];
  diagnostics: AnalysisDiagnostic[];
  vueParser: ReturnType<typeof createVueParser>;
}

const workerScope: any = self;
let session: WorkerSession | null = null;
let sessionGeneration = 0;

const post = (message: AnalysisWorkerResponse) => workerScope.postMessage(message);

const progress = (
  requestId: string,
  phase: AnalysisProgress['phase'],
  label: string,
  completed: number,
  total: number,
  percent: number
) => post({
  type: 'progress',
  requestId,
  progress: { phase, label, completed, total, percent }
});

const uniqueDiagnostics = (diagnostics: AnalysisDiagnostic[]): AnalysisDiagnostic[] => {
  const byId = new Map<string, AnalysisDiagnostic>();
  diagnostics.forEach(diagnostic => byId.set(diagnostic.id, diagnostic));
  return Array.from(byId.values());
};

const summaryFor = (current: WorkerSession): AnalysisSummary => ({
  files: current.project.stats,
  apiDefinitions: current.apiDefinitionCount,
  configEndpoints: current.configEndpointCount,
  routeRoots: current.routeRoots.length,
  parsedVueFiles: current.vueParser.getParsedCount()
});

const initialize = async (requestId: string, files: File[], generation: number) => {
  progress(requestId, 'index', '建立 src 文件索引', 0, files.length, 2);
  const project = createFileIndex(files);
  progress(requestId, 'index', '文件索引已建立', project.stats.indexed, project.stats.indexed, 15);

  validateFileIndex(project);

  progress(requestId, 'config', '解析 config 接口地址清单', 0, project.stats.configFiles || 0, 15);
  const configResult = await parseConfigEndpointFiles(project, (completed, total) => {
    if (completed !== 1 && completed !== total && completed % 10 !== 0) return;
    const ratio = total === 0 ? 1 : completed / total;
    progress(requestId, 'config', '解析 config 接口地址清单', completed, total, 15 + Math.round(ratio * 10));
  });
  if (generation !== sessionGeneration) return;
  progress(
    requestId,
    'config',
    'config 接口地址清单已解析',
    project.stats.configFiles || 0,
    project.stats.configFiles || 0,
    25
  );

  const apiResult = await parseApiFiles(project, configResult.catalog, (completed, total) => {
    if (completed !== 1 && completed !== total && completed % 10 !== 0) return;
    const ratio = total === 0 ? 1 : completed / total;
    progress(requestId, 'api', '解析 API 接口字典', completed, total, 25 + Math.round(ratio * 25));
  });
  if (generation !== sessionGeneration) return;

  const routeResult = await parseRouteFiles(project, (completed, total) => {
    if (completed !== 1 && completed !== total && completed % 10 !== 0) return;
    const ratio = total === 0 ? 1 : completed / total;
    progress(requestId, 'route', '解析路由顶点', completed, total, 50 + Math.round(ratio * 15));
  });
  if (generation !== sessionGeneration) return;

  const diagnostics = [
    ...configResult.diagnostics,
    ...apiResult.diagnostics,
    ...routeResult.diagnostics
  ];
  const routeRoots = routeResult.routeRoots.filter(root => {
    if (project.files.has(root.componentPath)) return true;
    diagnostics.push({
      id: `route-component-missing:${root.id}`,
      level: 'warning',
      code: 'ROUTE_COMPONENT_MISSING',
      message: `路由 component 对应的 Vue 文件不存在，已放弃该顶点：${root.componentPath}`,
      filePath: root.routerFile,
      relatedPath: root.componentPath,
      sourceLine: root.sourceLine
    });
    return false;
  });

  if (routeRoots.length === 0) {
    throw new Error('没有找到可用的路由顶点，请检查 router/modules 中的 component 路径。');
  }

  const currentSession: WorkerSession = {
    project,
    apiModules: apiResult.modules,
    apiDefinitionCount: apiResult.definitionCount,
    configEndpointCount: configResult.definitionCount,
    routeRoots,
    diagnostics: uniqueDiagnostics(diagnostics),
    vueParser: createVueParser(project)
  };
  session = currentSession;

  progress(requestId, 'snapshot', '整理完整组件关系', 0, routeRoots.length, 65);
  let lastSnapshotPercent = 65;
  const graphResult = await buildPersistedComponentGraph(
    project,
    routeRoots,
    currentSession.vueParser.parseVue,
    currentSession.apiModules,
    (completed, discovered) => {
      const ratio = discovered === 0 ? 1 : completed / discovered;
      lastSnapshotPercent = Math.max(
        lastSnapshotPercent,
        65 + Math.round(ratio * 34)
      );
      progress(
        requestId,
        'snapshot',
        `整理可持久化组件关系（${completed}/${discovered}）`,
        completed,
        discovered,
        lastSnapshotPercent
      );
    }
  );
  if (generation !== sessionGeneration || session !== currentSession) return;

  currentSession.diagnostics = uniqueDiagnostics([
    ...currentSession.diagnostics,
    ...graphResult.diagnostics
  ]);
  const summary = summaryFor(currentSession);
  const snapshot = {
    schemaVersion: 1 as const,
    rootName: project.rootName,
    sourceFingerprint: project.sourceFingerprint,
    analyzedAt: new Date().toISOString(),
    summary,
    routeRoots,
    componentsByPath: graphResult.componentsByPath,
    diagnostics: currentSession.diagnostics
  };

  progress(requestId, 'snapshot', '完整分析结果已生成', Object.keys(graphResult.componentsByPath).length, Object.keys(graphResult.componentsByPath).length, 100);
  post({
    type: 'ready',
    requestId,
    rootName: project.rootName,
    routeRoots,
    summary,
    diagnostics: currentSession.diagnostics,
    snapshot
  });
};

const buildTree = async (requestId: string, routeRootId: string, generation: number) => {
  if (!session) throw new Error('请先选择并分析 src 文件夹。');
  const currentSession = session;
  const routeRoot = currentSession.routeRoots.find(root => root.id === routeRootId);
  if (!routeRoot) throw new Error('找不到所选路由顶点，请重新分析。');

  let parsedNodes = 0;
  progress(requestId, 'tree', '构建页面组件树', 0, 0, 5);
  const result = await buildVueTree(
    currentSession.project,
    routeRoot,
    currentSession.vueParser.parseVue,
    currentSession.apiModules,
    () => {
      parsedNodes += 1;
      progress(
        requestId,
        'tree',
        `递归解析页面组件（${parsedNodes}）`,
        parsedNodes,
        0,
        Math.min(92, 10 + parsedNodes)
      );
    }
  );
  if (generation !== sessionGeneration || session !== currentSession) return;

  currentSession.diagnostics = uniqueDiagnostics([...currentSession.diagnostics, ...result.diagnostics]);
  progress(requestId, 'tree', '组件树构建完成', parsedNodes, parsedNodes, 100);
  post({
    type: 'tree',
    requestId,
    routeRootId,
    tree: result.tree,
    summary: summaryFor(currentSession),
    diagnostics: currentSession.diagnostics
  });
};

workerScope.onmessage = async (event: MessageEvent<AnalysisWorkerRequest>) => {
  const message = event.data;
  if (!message || !('type' in message)) return;

  if (message.type === 'reset') {
    sessionGeneration += 1;
    session?.vueParser.clear();
    session = null;
    return;
  }

  try {
    if (message.type === 'initialize') {
      const generation = ++sessionGeneration;
      await initialize(message.requestId, message.files, generation);
    } else {
      await buildTree(message.requestId, message.routeRootId, sessionGeneration);
    }
  } catch (error) {
    post({
      type: 'error',
      requestId: message.requestId,
      message: error instanceof Error ? error.message : '分析过程发生未知错误',
      diagnostics: session?.diagnostics || []
    });
  }
};

export {};
