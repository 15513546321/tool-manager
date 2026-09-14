import { parse } from '@babel/parser';
import type * as t from '@babel/types';
import type {
  AnalysisDiagnostic,
  ApiDefinition,
  ApiEndpointTarget,
  ApiModuleDefinition,
  ConfigEndpointCatalog,
  ConfigEndpointDefinition,
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

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;

interface RequestCall {
  httpMethod: string;
  transportMethod: string;
  endpoints: string[];
}

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

const uniqueStrings = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

const combineStrings = (left: string[], right: string[]): string[] => {
  const combined: string[] = [];
  left.forEach(leftValue => right.forEach(rightValue => combined.push(leftValue + rightValue)));
  return uniqueStrings(combined);
};

const resolveStaticStrings = (
  node: t.Node | null | undefined,
  bindings: Map<string, t.Node>,
  resolving = new Set<string>()
): string[] => {
  if (!node) return [];
  if (isNodeType<t.StringLiteral>(node, 'StringLiteral')) return [node.value];

  if (isNodeType<t.Identifier>(node, 'Identifier')) {
    if (resolving.has(node.name)) return [];
    const bound = bindings.get(node.name);
    if (!bound) return [];
    const nextResolving = new Set(resolving);
    nextResolving.add(node.name);
    return resolveStaticStrings(bound, bindings, nextResolving);
  }

  if (isNodeType<t.ConditionalExpression>(node, 'ConditionalExpression')) {
    return uniqueStrings([
      ...resolveStaticStrings(node.consequent, bindings, resolving),
      ...resolveStaticStrings(node.alternate, bindings, resolving)
    ]);
  }

  if (isNodeType<t.TemplateLiteral>(node, 'TemplateLiteral')) {
    let values = [''];
    node.quasis.forEach((quasi, index) => {
      values = values.map(value => value + (quasi.value.cooked ?? quasi.value.raw));
      const expression = node.expressions[index];
      if (!expression) return;
      const expressionValues = resolveStaticStrings(expression as t.Node, bindings, resolving);
      values = expressionValues.length > 0 ? combineStrings(values, expressionValues) : [];
    });
    return uniqueStrings(values);
  }

  if (isNodeType<t.BinaryExpression>(node, 'BinaryExpression') && node.operator === '+') {
    const left = resolveStaticStrings(node.left as t.Node, bindings, resolving);
    const right = resolveStaticStrings(node.right as t.Node, bindings, resolving);
    return left.length > 0 && right.length > 0 ? combineStrings(left, right) : [];
  }

  return [];
};

const normalizeHttpMethod = (transportMethod: string): string => {
  const baseMethod = HTTP_METHODS.find(method => (
    transportMethod === method
    || (
      transportMethod.startsWith(method)
      && /^[A-Z]/.test(transportMethod.slice(method.length, method.length + 1))
    )
  ));
  return baseMethod ? baseMethod.toUpperCase() : '';
};

const findHttpCalls = (
  node: t.ObjectMethod | t.FunctionExpression | t.ArrowFunctionExpression,
  transportAliases: Set<string>
): RequestCall[] => {
  const bindings = new Map<string, t.Node>();
  const calls: RequestCall[] = [];

  walkAst(node.body, candidate => {
    if (
      isNodeType<t.VariableDeclarator>(candidate, 'VariableDeclarator')
      && isNodeType<t.Identifier>(candidate.id, 'Identifier')
      && candidate.init
    ) {
      bindings.set(candidate.id.name, candidate.init);
    }
  });

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

    let transportMethod = '';
    if (isNodeType<t.Identifier>(callee.property, 'Identifier')) transportMethod = callee.property.name;
    else if (isNodeType<t.StringLiteral>(callee.property, 'StringLiteral')) transportMethod = callee.property.value;
    const httpMethod = normalizeHttpMethod(transportMethod);
    if (!httpMethod) return false;

    calls.push({
      httpMethod,
      transportMethod,
      endpoints: resolveStaticStrings(candidate.arguments[0] as t.Node | undefined, bindings)
    });
    return false;
  });

  return calls;
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

const methodCatalogCandidates = (
  methodName: string,
  catalog: ConfigEndpointCatalog
): ConfigEndpointDefinition[] => {
  const names = new Set<string>([methodName.toLowerCase()]);
  const withoutStageSuffix = methodName.replace(/(?:Confirm|Conf|Pre)$/i, '');
  if (withoutStageSuffix !== methodName) names.add(withoutStageSuffix.toLowerCase());

  const byEndpoint = new Map<string, ConfigEndpointDefinition>();
  names.forEach(name => {
    (catalog.byMethodName.get(name) || []).forEach(definition => {
      byEndpoint.set(definition.endpoint, definition);
    });
  });
  return Array.from(byEndpoint.values());
};

const endpointTarget = (
  endpoint: string,
  httpMethod: string,
  transportMethod: string,
  catalog: ConfigEndpointCatalog
): ApiEndpointTarget => {
  const configDefinition = catalog.byEndpoint.get(endpoint);
  return {
    endpoint,
    httpMethod,
    transportMethod,
    chineseName: configDefinition?.chineseName || '',
    configPath: configDefinition?.sourcePath,
    configLine: configDefinition?.sourceLine
  };
};

const parseApiModule = (
  modulePath: string,
  source: string,
  configCatalog: ConfigEndpointCatalog
): ApiModuleDefinition => {
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

    const requestCalls = findHttpCalls(functionNode, transportAliases);
    const targetsByKey = new Map<string, ApiEndpointTarget>();
    requestCalls.forEach(call => {
      call.endpoints.forEach(endpoint => {
        const target = endpointTarget(endpoint, call.httpMethod, call.transportMethod, configCatalog);
        targetsByKey.set(`${target.httpMethod}:${target.endpoint}`, target);
      });
    });

    if (targetsByKey.size === 0) {
      const fallbackCall = requestCalls[0];
      methodCatalogCandidates(methodName, configCatalog).forEach(definition => {
        const target = endpointTarget(
          definition.endpoint,
          fallbackCall?.httpMethod || 'UNKNOWN',
          fallbackCall?.transportMethod || '',
          configCatalog
        );
        targetsByKey.set(`${target.httpMethod}:${target.endpoint}`, target);
      });
    }

    const endpointTargets = Array.from(targetsByKey.values());
    const firstRequest = requestCalls[0];
    const firstTarget = endpointTargets[0];

    methods.set(methodName, {
      modulePath,
      methodName,
      chineseName: immediateComment(property) || firstTarget?.chineseName || '',
      httpMethod: firstTarget?.httpMethod || firstRequest?.httpMethod || 'UNKNOWN',
      endpoint: firstTarget?.endpoint || '',
      transportMethod: firstTarget?.transportMethod || firstRequest?.transportMethod || '',
      endpoints: endpointTargets,
      sourceLine: property.loc?.start.line || 1
    });
  }

  return { modulePath, methods };
};

export const parseApiFiles = async (
  project: IndexedProject,
  configCatalog: ConfigEndpointCatalog,
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
      const parsed = parseApiModule(modulePath, await file.text(), configCatalog);
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
