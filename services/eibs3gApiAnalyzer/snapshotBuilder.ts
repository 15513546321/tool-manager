import { resolveDirectApis } from './apiResolver';
import { fileNameFromPath } from './pathResolver';
import type {
  AnalysisDiagnostic,
  ApiModuleDefinition,
  Eibs3gAnalysisSnapshot,
  IndexedProject,
  ParsedVue,
  PersistedVueNode,
  RouteRoot,
  VueTreeNode
} from './types';

interface ComponentGraphResult {
  componentsByPath: Record<string, PersistedVueNode>;
  diagnostics: AnalysisDiagnostic[];
}

type ProgressCallback = (completed: number, discovered: number) => void;

const uniqueDiagnostics = (diagnostics: AnalysisDiagnostic[]): AnalysisDiagnostic[] => {
  const byId = new Map<string, AnalysisDiagnostic>();
  diagnostics.forEach(diagnostic => byId.set(diagnostic.id, diagnostic));
  return Array.from(byId.values());
};

const collectCycleDiagnostics = (
  componentsByPath: Record<string, PersistedVueNode>
): AnalysisDiagnostic[] => {
  const state = new Map<string, 'visiting' | 'visited'>();
  const stack: string[] = [];
  const diagnostics: AnalysisDiagnostic[] = [];
  const cycleKeys = new Set<string>();

  const visit = (componentPath: string) => {
    state.set(componentPath, 'visiting');
    stack.push(componentPath);

    const node = componentsByPath[componentPath];
    for (const imported of node?.vueImports || []) {
      const childPath = imported.componentPath;
      if (!componentsByPath[childPath]) continue;

      if (state.get(childPath) === 'visiting') {
        const cycleStart = stack.lastIndexOf(childPath);
        const cycle = [...stack.slice(Math.max(0, cycleStart)), childPath];
        const key = cycle.join('>');
        if (!cycleKeys.has(key)) {
          cycleKeys.add(key);
          diagnostics.push({
            id: `vue-cycle:${key}`,
            level: 'warning',
            code: 'VUE_IMPORT_CYCLE',
            message: `检测到循环引用：${cycle.join(' → ')}`,
            filePath: componentPath,
            relatedPath: childPath,
            sourceLine: imported.sourceLine
          });
        }
      } else if (!state.has(childPath)) {
        visit(childPath);
      }
    }

    stack.pop();
    state.set(componentPath, 'visited');
  };

  Object.keys(componentsByPath).forEach(componentPath => {
    if (!state.has(componentPath)) visit(componentPath);
  });

  return diagnostics;
};

export const buildPersistedComponentGraph = async (
  project: IndexedProject,
  routeRoots: RouteRoot[],
  parseVue: (componentPath: string) => Promise<ParsedVue>,
  apiModules: Map<string, ApiModuleDefinition>,
  onProgress?: ProgressCallback
): Promise<ComponentGraphResult> => {
  const componentsByPath: Record<string, PersistedVueNode> = {};
  const diagnostics: AnalysisDiagnostic[] = [];
  const queued = new Set<string>();
  const queue: string[] = [];

  const enqueue = (componentPath: string) => {
    if (queued.has(componentPath)) return;
    queued.add(componentPath);
    queue.push(componentPath);
  };

  routeRoots.forEach(root => enqueue(root.componentPath));

  for (let index = 0; index < queue.length; index += 1) {
    const componentPath = queue[index];
    const parsedVue = await parseVue(componentPath);
    const resolved = resolveDirectApis(parsedVue, apiModules);
    const nodeDiagnostics = [...parsedVue.diagnostics, ...resolved.diagnostics];

    if (!parsedVue.parseFailed) {
      for (const imported of parsedVue.vueImports) {
        if (!project.files.has(imported.componentPath)) {
          nodeDiagnostics.push({
            id: `vue-branch-missing:${componentPath}:${imported.componentPath}`,
            level: 'warning',
            code: 'VUE_FILE_MISSING',
            message: `子组件文件不存在，已跳过该分支：${imported.componentPath}`,
            filePath: componentPath,
            relatedPath: imported.componentPath,
            sourceLine: imported.sourceLine
          });
          continue;
        }
        enqueue(imported.componentPath);
      }
    }

    componentsByPath[componentPath] = {
      componentPath,
      fileName: parsedVue.fileName,
      componentName: parsedVue.componentName,
      directApis: resolved.apis,
      apiImports: Object.entries(parsedVue.apiImports)
        .map(([alias, modulePath]) => ({ alias, modulePath })),
      vueImports: parsedVue.vueImports,
      diagnostics: uniqueDiagnostics(nodeDiagnostics),
      status: parsedVue.parseFailed
        ? 'parse-error'
        : resolved.apis.length === 0 && parsedVue.vueImports.length === 0
          ? 'empty'
          : 'ok'
    };
    diagnostics.push(...nodeDiagnostics);
    onProgress?.(index + 1, queue.length);
  }

  diagnostics.push(...collectCycleDiagnostics(componentsByPath));
  return {
    componentsByPath,
    diagnostics: uniqueDiagnostics(diagnostics)
  };
};

export const buildVueTreeFromSnapshot = (
  snapshot: Eibs3gAnalysisSnapshot,
  routeRoot: RouteRoot
): VueTreeNode | null => {
  const buildNode = (
    componentPath: string,
    ancestors: string[],
    isRouteRoot: boolean
  ): VueTreeNode | null => {
    if (ancestors.includes(componentPath)) {
      const cycle = [...ancestors, componentPath];
      const diagnostic: AnalysisDiagnostic = {
        id: `vue-cycle:${cycle.join('>')}`,
        level: 'warning',
        code: 'VUE_IMPORT_CYCLE',
        message: `检测到循环引用：${cycle.join(' → ')}`,
        filePath: componentPath
      };
      return {
        id: `${routeRoot.id}:${cycle.join('>')}:cycle`,
        componentPath,
        fileName: fileNameFromPath(componentPath),
        componentName: '',
        isRouteRoot: false,
        directApis: [],
        apiImports: [],
        vueImports: [],
        children: [],
        diagnostics: [diagnostic],
        status: 'cycle'
      };
    }

    const persisted = snapshot.componentsByPath[componentPath];
    if (!persisted) return null;

    const uniqueChildren = Array.from(new Set(
      persisted.vueImports.map(imported => imported.componentPath)
    ));
    const children = persisted.status === 'parse-error'
      ? []
      : uniqueChildren
        .map(childPath => buildNode(childPath, [...ancestors, componentPath], false))
        .filter((child): child is VueTreeNode => child !== null);

    return {
      id: `${routeRoot.id}:${[...ancestors, componentPath].join('>')}`,
      componentPath,
      fileName: persisted.fileName,
      componentName: persisted.componentName,
      isRouteRoot,
      routeTitle: isRouteRoot ? routeRoot.title : undefined,
      routePath: isRouteRoot ? routeRoot.routePath : undefined,
      routerFile: isRouteRoot ? routeRoot.routerFile : undefined,
      directApis: persisted.directApis,
      apiImports: persisted.apiImports,
      vueImports: persisted.vueImports,
      children,
      diagnostics: persisted.diagnostics,
      status: persisted.status === 'parse-error'
        ? 'parse-error'
        : persisted.directApis.length === 0 && children.length === 0
          ? 'empty'
          : 'ok'
    };
  };

  return buildNode(routeRoot.componentPath, [], true);
};
