import type {
  AnalysisDiagnostic,
  ApiModuleDefinition,
  ApiReference,
  ParsedVue
} from './types';

interface ResolvedApis {
  apis: ApiReference[];
  diagnostics: AnalysisDiagnostic[];
}

export const resolveDirectApis = (
  parsedVue: ParsedVue,
  apiModules: Map<string, ApiModuleDefinition>
): ResolvedApis => {
  const apis: ApiReference[] = [];
  const diagnostics: AnalysisDiagnostic[] = [];
  const seen = new Set<string>();
  const diagnosticKeys = new Set<string>();

  for (const call of parsedVue.apiCalls) {
    const modulePath = parsedVue.apiImports[call.alias];
    if (!modulePath) continue;

    const apiModule = apiModules.get(modulePath);
    if (!apiModule) {
      const key = `module:${modulePath}`;
      if (!diagnosticKeys.has(key)) {
        diagnosticKeys.add(key);
        diagnostics.push({
          id: `api-module-missing:${parsedVue.componentPath}:${modulePath}`,
          level: 'warning',
          code: 'API_MODULE_MISSING',
          message: `找不到导入的 API 文件：${modulePath}`,
          filePath: parsedVue.componentPath,
          relatedPath: modulePath,
          sourceLine: call.sourceLine
        });
      }
      continue;
    }

    const definition = apiModule.methods.get(call.methodName);
    if (!definition) {
      const key = `method:${modulePath}:${call.methodName}`;
      if (!diagnosticKeys.has(key)) {
        diagnosticKeys.add(key);
        diagnostics.push({
          id: `api-method-missing:${parsedVue.componentPath}:${modulePath}:${call.methodName}`,
          level: 'warning',
          code: 'API_METHOD_MISSING',
          message: `API 模块中找不到方法：${call.methodName}`,
          filePath: parsedVue.componentPath,
          relatedPath: modulePath,
          sourceLine: call.sourceLine
        });
      }
      continue;
    }

    const key = `${modulePath}:${call.methodName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const hasResolvedEndpoint = (definition.endpoints?.length || 0) > 0 || Boolean(definition.endpoint);
    if (!hasResolvedEndpoint) {
      diagnostics.push({
        id: `api-endpoint-unresolved:${parsedVue.componentPath}:${modulePath}:${call.methodName}`,
        level: 'warning',
        code: 'API_ENDPOINT_UNRESOLVED',
        message: `已找到 API 方法，但无法静态确定后端地址：${call.methodName}`,
        filePath: parsedVue.componentPath,
        relatedPath: modulePath,
        sourceLine: call.sourceLine
      });
    }

    apis.push({
      ...definition,
      importAlias: call.alias,
      callLine: call.sourceLine
    });
  }

  apis.sort((left, right) => left.callLine - right.callLine);
  return { apis, diagnostics };
};
