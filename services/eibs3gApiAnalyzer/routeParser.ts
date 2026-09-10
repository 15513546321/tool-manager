import { parse } from '@babel/parser';
import type * as t from '@babel/types';
import type { AnalysisDiagnostic, IndexedProject, RouteRoot } from './types';
import { isNodeType, walkAst } from './astUtils';
import { pathsByPrefix } from './fileIndex';
import { resolveRouteComponentPath } from './pathResolver';

interface RouteParseResult {
  routeRoots: RouteRoot[];
  diagnostics: AnalysisDiagnostic[];
}

type ProgressCallback = (completed: number, total: number) => void;

const parseJavaScript = (source: string) => parse(source, {
  sourceType: 'unambiguous',
  plugins: [
    'dynamicImport',
    'objectRestSpread',
    'optionalChaining',
    'classProperties',
    'decorators-legacy',
    'jsx'
  ]
});

const propertyName = (node: t.ObjectMethod | t.ObjectProperty): string => {
  if (isNodeType<t.Identifier>(node.key, 'Identifier')) return node.key.name;
  if (
    isNodeType<t.StringLiteral>(node.key, 'StringLiteral')
    || isNodeType<t.NumericLiteral>(node.key, 'NumericLiteral')
  ) return String(node.key.value);
  return '';
};

const objectProperty = (node: t.ObjectExpression, name: string): t.ObjectProperty | null => {
  const property = node.properties.find(candidate => (
    isNodeType<t.ObjectProperty>(candidate, 'ObjectProperty') && propertyName(candidate) === name
  ));
  return property && isNodeType<t.ObjectProperty>(property, 'ObjectProperty') ? property : null;
};

const staticString = (node: t.Node | null | undefined): string => {
  if (isNodeType<t.StringLiteral>(node, 'StringLiteral')) return node.value;
  if (isNodeType<t.TemplateLiteral>(node, 'TemplateLiteral') && node.expressions.length === 0) {
    return node.quasis.map(quasi => quasi.value.cooked ?? quasi.value.raw).join('');
  }
  return '';
};

const displayString = (node: t.Node | null | undefined, source: string): string => {
  const value = staticString(node);
  if (value) return value;
  if (node?.start != null && node.end != null) return source.slice(node.start, node.end).trim();
  return '';
};

const walkForDynamicImport = (value: unknown): string => {
  if (!value || typeof value !== 'object') return '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = walkForDynamicImport(item);
      if (found) return found;
    }
    return '';
  }

  const node = value as t.Node;
  if (
    isNodeType<t.CallExpression>(node, 'CallExpression')
    && isNodeType<t.Import>(node.callee, 'Import')
  ) {
    return staticString(node.arguments[0] as t.Node | undefined);
  }
  if (node.type === 'ImportExpression') {
    return staticString((node as unknown as { source: t.Node }).source);
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (['loc', 'start', 'end', 'extra', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) {
      continue;
    }
    const found = walkForDynamicImport(child);
    if (found) return found;
  }
  return '';
};

const parseRouteFile = (routerFile: string, source: string): RouteRoot[] => {
  const ast = parseJavaScript(source);
  const roots: RouteRoot[] = [];

  walkAst(ast, node => {
    if (!isNodeType<t.ObjectExpression>(node, 'ObjectExpression')) return;
    const componentProperty = objectProperty(node, 'component');
    if (!componentProperty) return;

    const componentImport = walkForDynamicImport(componentProperty.value);
    const componentPath = resolveRouteComponentPath(componentImport);
    if (!componentPath) return;

    const pathProperty = objectProperty(node, 'path');
    const nameProperty = objectProperty(node, 'name');
    const metaProperty = objectProperty(node, 'meta');
    let title = '';

    if (metaProperty && isNodeType<t.ObjectExpression>(metaProperty.value, 'ObjectExpression')) {
      const titleProperty = objectProperty(metaProperty.value, 'title');
      title = titleProperty ? staticString(titleProperty.value) : '';
    }

    const sourceLine = node.loc?.start.line || 1;
    roots.push({
      id: `${routerFile}:${sourceLine}:${componentPath}`,
      routePath: pathProperty ? displayString(pathProperty.value, source) : '',
      routeName: nameProperty ? displayString(nameProperty.value, source) : '',
      title,
      componentPath,
      routerFile,
      sourceLine
    });
  });

  return roots;
};

export const parseRouteFiles = async (
  project: IndexedProject,
  onProgress?: ProgressCallback
): Promise<RouteParseResult> => {
  const paths = pathsByPrefix(project, 'router/modules/', '.js');
  const routeRoots: RouteRoot[] = [];
  const diagnostics: AnalysisDiagnostic[] = [];

  for (let index = 0; index < paths.length; index += 1) {
    const routerFile = paths[index];
    const file = project.files.get(routerFile);
    if (!file) continue;

    try {
      routeRoots.push(...parseRouteFile(routerFile, await file.text()));
    } catch (error) {
      diagnostics.push({
        id: `route-parse:${routerFile}`,
        level: 'warning',
        code: 'ROUTE_PARSE_FAILED',
        message: error instanceof Error ? error.message : '路由文件解析失败',
        filePath: routerFile
      });
    }

    onProgress?.(index + 1, paths.length);
  }

  routeRoots.sort((left, right) => (
    (left.title || left.componentPath)
      .localeCompare(right.title || right.componentPath, 'zh-CN')
  ));

  return { routeRoots, diagnostics };
};
