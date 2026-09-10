import { parse } from '@babel/parser';
import type * as t from '@babel/types';
import type {
  AnalysisDiagnostic,
  ApiDefinition,
  ApiModuleDefinition,
  IndexedProject
} from './types';
import { isNodeType, walkAst } from './astUtils';
import { pathsByPrefix } from './fileIndex';

interface ApiParseResult {
  modules: Map<string, ApiModuleDefinition>;
  definitionCount: number;
  diagnostics: AnalysisDiagnostic[];
}

type ProgressCallback = (completed: number, total: number) => void;

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options']);

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

const propertyName = (node: t.ObjectMethod | t.ObjectProperty): string => {
  if (isNodeType<t.Identifier>(node.key, 'Identifier')) return node.key.name;
  if (
    isNodeType<t.StringLiteral>(node.key, 'StringLiteral')
    || isNodeType<t.NumericLiteral>(node.key, 'NumericLiteral')
  ) return String(node.key.value);
  return '';
};

const staticString = (node: t.Node | null | undefined): string => {
  if (isNodeType<t.StringLiteral>(node, 'StringLiteral')) return node.value;
  if (isNodeType<t.TemplateLiteral>(node, 'TemplateLiteral') && node.expressions.length === 0) {
    return node.quasis.map(quasi => quasi.value.cooked ?? quasi.value.raw).join('');
  }
  return '';
};

const findHttpCall = (
  node: t.ObjectMethod | t.FunctionExpression | t.ArrowFunctionExpression,
  transportAliases: Set<string>
): { httpMethod: string; endpoint: string } | null => {
  let result: { httpMethod: string; endpoint: string } | null = null;

  walkAst(node.body, candidate => {
    if (
      !isNodeType<t.CallExpression>(candidate, 'CallExpression')
      && !isNodeType<t.OptionalCallExpression>(candidate, 'OptionalCallExpression')
    ) return false;
    const callee = candidate.callee;
    if (
      !isNodeType<t.MemberExpression>(callee, 'MemberExpression')
      && !isNodeType<t.OptionalMemberExpression>(callee, 'OptionalMemberExpression')
    ) return false;
    if (!isNodeType<t.Identifier>(callee.object, 'Identifier') || !transportAliases.has(callee.object.name)) return false;

    let method = '';
    if (isNodeType<t.Identifier>(callee.property, 'Identifier')) method = callee.property.name;
    else if (isNodeType<t.StringLiteral>(callee.property, 'StringLiteral')) method = callee.property.value;
    method = method.toLowerCase();
    if (!HTTP_METHODS.has(method)) return false;

    const endpoint = staticString(candidate.arguments[0] as t.Node | undefined);
    if (!endpoint) return false;

    result = { httpMethod: method.toUpperCase(), endpoint };
    return true;
  });

  return result;
};

const cleanComment = (value: string): string => value
  .split(/\r?\n/)
  .map(line => line.replace(/^\s*\*\s?/, '').trim())
  .filter(Boolean)
  .join(' ')
  .trim();

const immediateComment = (node: t.Node): string => {
  const comments = node.leadingComments || [];
  const startLine = node.loc?.start.line;
  if (!startLine) return '';

  const closest = [...comments]
    .reverse()
    .find(comment => comment.loc && startLine - comment.loc.end.line <= 1);

  return closest ? cleanComment(closest.value) : '';
};

const functionFromProperty = (
  property: t.ObjectMethod | t.ObjectProperty
): t.ObjectMethod | t.FunctionExpression | t.ArrowFunctionExpression | null => {
  if (isNodeType<t.ObjectMethod>(property, 'ObjectMethod')) return property;
  if (
    isNodeType<t.FunctionExpression>(property.value, 'FunctionExpression')
    || isNodeType<t.ArrowFunctionExpression>(property.value, 'ArrowFunctionExpression')
  ) {
    return property.value;
  }
  return null;
};

const parseApiModule = (modulePath: string, source: string): ApiModuleDefinition => {
  const ast = parseJavaScript(source);
  const objectDeclarations = new Map<string, t.ObjectExpression>();
  const transportAliases = new Set<string>(['remote']);
  let exportObject: t.ObjectExpression | null = null;

  walkAst(ast, node => {
    if (isNodeType<t.ImportDeclaration>(node, 'ImportDeclaration')) {
      if (!/\/services\/remote(?:\.[a-z0-9]+)?$/i.test(node.source.value)) return;
      const defaultSpecifier = node.specifiers.find(specifier => (
        isNodeType<t.ImportDefaultSpecifier>(specifier, 'ImportDefaultSpecifier')
      ));
      if (defaultSpecifier) transportAliases.add(defaultSpecifier.local.name);
      return;
    }

    if (isNodeType<t.VariableDeclarator>(node, 'VariableDeclarator')) {
      if (
        isNodeType<t.Identifier>(node.id, 'Identifier')
        && isNodeType<t.ObjectExpression>(node.init, 'ObjectExpression')
      ) objectDeclarations.set(node.id.name, node.init);
      return;
    }

    if (isNodeType<t.ExportDefaultDeclaration>(node, 'ExportDefaultDeclaration')) {
      const declaration = node.declaration;
      if (isNodeType<t.ObjectExpression>(declaration, 'ObjectExpression')) exportObject = declaration;
      else if (isNodeType<t.Identifier>(declaration, 'Identifier')) {
        exportObject = objectDeclarations.get(declaration.name) || null;
      }
    }
  });

  const methods = new Map<string, ApiDefinition>();
  if (!exportObject) return { modulePath, methods };

  for (const property of (exportObject as t.ObjectExpression).properties) {
    if (
      !isNodeType<t.ObjectMethod>(property, 'ObjectMethod')
      && !isNodeType<t.ObjectProperty>(property, 'ObjectProperty')
    ) continue;
    const methodName = propertyName(property);
    const functionNode = functionFromProperty(property);
    if (!methodName || !functionNode) continue;

    const httpCall = findHttpCall(functionNode, transportAliases);
    if (!httpCall) continue;

    methods.set(methodName, {
      modulePath,
      methodName,
      chineseName: immediateComment(property),
      httpMethod: httpCall.httpMethod,
      endpoint: httpCall.endpoint,
      sourceLine: property.loc?.start.line || 1
    });
  }

  return { modulePath, methods };
};

export const parseApiFiles = async (
  project: IndexedProject,
  onProgress?: ProgressCallback
): Promise<ApiParseResult> => {
  const paths = pathsByPrefix(project, 'api/', '.js');
  const modules = new Map<string, ApiModuleDefinition>();
  const diagnostics: AnalysisDiagnostic[] = [];
  let definitionCount = 0;

  for (let index = 0; index < paths.length; index += 1) {
    const modulePath = paths[index];
    const file = project.files.get(modulePath);
    if (!file) continue;

    try {
      const parsed = parseApiModule(modulePath, await file.text());
      modules.set(modulePath, parsed);
      definitionCount += parsed.methods.size;
    } catch (error) {
      diagnostics.push({
        id: `api-parse:${modulePath}`,
        level: 'warning',
        code: 'API_PARSE_FAILED',
        message: error instanceof Error ? error.message : 'API 文件解析失败',
        filePath: modulePath
      });
    }

    onProgress?.(index + 1, paths.length);
  }

  return { modules, definitionCount, diagnostics };
};
