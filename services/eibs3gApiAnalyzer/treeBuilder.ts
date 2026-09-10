import type {
  AnalysisDiagnostic,
  ApiModuleDefinition,
  IndexedProject,
  ParsedVue,
  RouteRoot,
  VueTreeNode
} from './types';
import { resolveDirectApis } from './apiResolver';
import { fileNameFromPath } from './pathResolver';

interface TreeBuildResult {
  tree: VueTreeNode;
  diagnostics: AnalysisDiagnostic[];
}

export const buildVueTree = async (
  project: IndexedProject,
  routeRoot: RouteRoot,
  parseVue: (componentPath: string) => Promise<ParsedVue>,
  apiModules: Map<string, ApiModuleDefinition>,
  onNodeParsed?: () => void
): Promise<TreeBuildResult> => {
  const allDiagnostics: AnalysisDiagnostic[] = [];

  const buildNode = async (
    componentPath: string,
    ancestors: string[],
    isRouteRoot: boolean
  ): Promise<VueTreeNode | null> => {
    if (ancestors.includes(componentPath)) {
      const diagnostic: AnalysisDiagnostic = {
        id: `vue-cycle:${[...ancestors, componentPath].join('>')}`,
        level: 'warning',
        code: 'VUE_IMPORT_CYCLE',
        message: `检测到循环引用：${[...ancestors, componentPath].join(' → ')}`,
        filePath: componentPath
      };
      allDiagnostics.push(diagnostic);
      return {
        id: `${componentPath}:cycle:${ancestors.length}`,
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

    if (!project.files.has(componentPath)) {
      allDiagnostics.push({
        id: `vue-branch-missing:${ancestors.join('>')}:${componentPath}`,
        level: 'warning',
        code: 'VUE_FILE_MISSING',
        message: `子组件文件不存在，已跳过该分支：${componentPath}`,
        filePath: ancestors[ancestors.length - 1],
        relatedPath: componentPath
      });
      return null;
    }

    const parsedVue = await parseVue(componentPath);
    onNodeParsed?.();
    const resolved = resolveDirectApis(parsedVue, apiModules);
    const nodeDiagnostics = [...parsedVue.diagnostics, ...resolved.diagnostics];
    allDiagnostics.push(...nodeDiagnostics);
    const children: VueTreeNode[] = [];

    if (!parsedVue.parseFailed) {
      const uniqueChildPaths = Array.from(new Set(parsedVue.vueImports.map(item => item.componentPath)));
      const builtChildren = await Promise.all(uniqueChildPaths.map(childPath => buildNode(
        childPath,
        [...ancestors, componentPath],
        false
      )));
      children.push(...builtChildren.filter((child): child is VueTreeNode => child !== null));
    }

    return {
      id: `${routeRoot.id}:${[...ancestors, componentPath].join('>')}`,
      componentPath,
      fileName: parsedVue.fileName,
      componentName: parsedVue.componentName,
      isRouteRoot,
      routeTitle: isRouteRoot ? routeRoot.title : undefined,
      routePath: isRouteRoot ? routeRoot.routePath : undefined,
      routerFile: isRouteRoot ? routeRoot.routerFile : undefined,
      directApis: resolved.apis,
      apiImports: Object.entries(parsedVue.apiImports).map(([alias, modulePath]) => ({ alias, modulePath })),
      vueImports: parsedVue.vueImports,
      children,
      diagnostics: nodeDiagnostics,
      status: parsedVue.parseFailed
        ? 'parse-error'
        : resolved.apis.length === 0 && children.length === 0
          ? 'empty'
          : 'ok'
    };
  };

  const tree = await buildNode(routeRoot.componentPath, [], true);
  if (!tree) {
    throw new Error(`路由顶点文件不存在：${routeRoot.componentPath}`);
  }

  return { tree, diagnostics: allDiagnostics };
};
