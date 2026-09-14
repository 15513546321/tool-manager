import { parse } from '@babel/parser';
import type * as t from '@babel/types';
import type {
  AnalysisDiagnostic,
  ConfigEndpointCatalog,
  ConfigEndpointDefinition,
  IndexedProject
} from './types';
import { isNodeType, walkAst } from './astUtils';
import { pathsByPrefix } from './fileIndex';

interface ConfigEndpointParseResult {
  catalog: ConfigEndpointCatalog;
  definitionCount: number;
  diagnostics: AnalysisDiagnostic[];
}

type ProgressCallback = (completed: number, total: number) => void;

const parseJavaScript = (source: string) => parse(source, {
  sourceType: 'unambiguous',
  allowReturnOutsideFunction: true,
  plugins: [
    'dynamicImport',
    'objectRestSpread',
    'optionalChaining',
    'classProperties',
    'decorators-legacy',
    'jsx'
  ]
});

const staticString = (node: t.StringLiteral | t.TemplateLiteral): string => {
  if (isNodeType<t.StringLiteral>(node, 'StringLiteral')) return node.value;
  if (node.expressions.length > 0) return '';
  return node.quasis.map(quasi => quasi.value.cooked ?? quasi.value.raw).join('');
};

const looksLikeBackendEndpoint = (value: string): boolean => (
  value.includes('/') && /\.do(?:[?#].*)?$/i.test(value.trim())
);

const cleanComment = (value: string): string => value
  .replace(/^\s*\/\//, '')
  .replace(/^\s*\/\*/, '')
  .replace(/\*\/\s*$/, '')
  .trim();

const trailingLineComment = (sourceLines: string[], node: t.Node): string => {
  const end = node.loc?.end;
  if (!end) return '';
  const restOfLine = (sourceLines[end.line - 1] || '').slice(end.column);
  const lineComment = restOfLine.match(/\/\/\s*(.*)$/);
  if (lineComment) return cleanComment(lineComment[1]);
  const blockComment = restOfLine.match(/\/\*\s*(.*?)\s*\*\//);
  return blockComment ? cleanComment(blockComment[1]) : '';
};

export const endpointMethodName = (endpoint: string): string => {
  const withoutQuery = endpoint.trim().split(/[?#]/, 1)[0];
  const fileName = withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1);
  return fileName.replace(/\.do$/i, '');
};

const parseConfigFile = (
  sourcePath: string,
  source: string
): ConfigEndpointDefinition[] => {
  const ast = parseJavaScript(source);
  const sourceLines = source.split(/\r?\n/);
  const definitions: ConfigEndpointDefinition[] = [];

  walkAst(ast, node => {
    if (
      !isNodeType<t.StringLiteral>(node, 'StringLiteral')
      && !isNodeType<t.TemplateLiteral>(node, 'TemplateLiteral')
    ) return;

    const endpoint = staticString(node).trim();
    if (!looksLikeBackendEndpoint(endpoint)) return;
    definitions.push({
      endpoint,
      chineseName: trailingLineComment(sourceLines, node),
      sourcePath,
      sourceLine: node.loc?.start.line || 1
    });
  });

  return definitions;
};

export const parseConfigEndpointFiles = async (
  project: IndexedProject,
  onProgress?: ProgressCallback
): Promise<ConfigEndpointParseResult> => {
  const paths = pathsByPrefix(project, 'config/', '.js');
  const byEndpoint = new Map<string, ConfigEndpointDefinition>();
  const diagnostics: AnalysisDiagnostic[] = [];

  for (let index = 0; index < paths.length; index += 1) {
    const sourcePath = paths[index];
    const file = project.files.get(sourcePath);
    if (!file) continue;

    try {
      for (const definition of parseConfigFile(sourcePath, await file.text())) {
        const existing = byEndpoint.get(definition.endpoint);
        if (!existing || (!existing.chineseName && definition.chineseName)) {
          byEndpoint.set(definition.endpoint, definition);
        }
      }
    } catch (error) {
      diagnostics.push({
        id: `config-endpoint-parse:${sourcePath}`,
        level: 'warning',
        code: 'CONFIG_ENDPOINT_PARSE_FAILED',
        message: error instanceof Error ? error.message : '配置接口文件解析失败',
        filePath: sourcePath
      });
    }

    onProgress?.(index + 1, paths.length);
  }

  const byMethodName = new Map<string, ConfigEndpointDefinition[]>();
  byEndpoint.forEach(definition => {
    const methodName = endpointMethodName(definition.endpoint).toLowerCase();
    if (!methodName) return;
    const matches = byMethodName.get(methodName) || [];
    matches.push(definition);
    byMethodName.set(methodName, matches);
  });

  return {
    catalog: { byEndpoint, byMethodName },
    definitionCount: byEndpoint.size,
    diagnostics
  };
};
