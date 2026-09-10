import { parse } from '@babel/parser';
import type * as t from '@babel/types';
import type { IndexedProject, ParsedVue, VueApiCall, VueImportDefinition } from './types';
import { isNodeType, walkAst } from './astUtils';
import {
  fileNameFromPath,
  resolveApiImportPath,
  resolveVueImportPath
} from './pathResolver';

interface VueParser {
  parseVue: (componentPath: string) => Promise<ParsedVue>;
  getParsedCount: () => number;
  clear: () => void;
}

interface ExtractedScript {
  content: string;
  startLine: number;
  hasSetupOnly: boolean;
}

const extractOrdinaryScript = (source: string): ExtractedScript => {
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match: RegExpExecArray | null;
  let hasSetupOnly = false;

  while ((match = pattern.exec(source)) !== null) {
    const attributes = match[1] || '';
    if (/\bsetup\b/i.test(attributes)) {
      hasSetupOnly = true;
      continue;
    }

    const contentStart = match.index + match[0].indexOf(match[2]);
    return {
      content: match[2],
      startLine: source.slice(0, contentStart).split(/\r?\n/).length - 1,
      hasSetupOnly: false
    };
  }

  return { content: '', startLine: 0, hasSetupOnly };
};

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

const memberName = (node: t.MemberExpression | t.OptionalMemberExpression): string => {
  if (isNodeType<t.Identifier>(node.property, 'Identifier')) return node.property.name;
  if (isNodeType<t.StringLiteral>(node.property, 'StringLiteral')) return node.property.value;
  return '';
};

const emptyParsedVue = (componentPath: string): ParsedVue => ({
  componentPath,
  fileName: fileNameFromPath(componentPath),
  componentName: '',
  apiImports: {},
  vueImports: [],
  apiCalls: [],
  diagnostics: [],
  parseFailed: false
});

const parseVueSource = (componentPath: string, source: string): ParsedVue => {
  const result = emptyParsedVue(componentPath);
  const script = extractOrdinaryScript(source);

  if (!script.content) {
    if (script.hasSetupOnly) {
      result.diagnostics.push({
        id: `vue-script-setup:${componentPath}`,
        level: 'info',
        code: 'SCRIPT_SETUP_UNSUPPORTED',
        message: '第一版不解析 <script setup>，当前节点按无普通脚本处理。',
        filePath: componentPath
      });
    }
    return result;
  }

  try {
    const ast = parseJavaScript(script.content);
    const vueImports: VueImportDefinition[] = [];
    const apiImports: Record<string, string> = {};
    const objectDeclarations = new Map<string, t.ObjectExpression>();
    let exportObject: t.ObjectExpression | null = null;

    walkAst(ast, node => {
      if (isNodeType<t.ImportDeclaration>(node, 'ImportDeclaration')) {
        const importSource = node.source.value;
        const defaultSpecifier = node.specifiers.find(specifier => (
          isNodeType<t.ImportDefaultSpecifier>(specifier, 'ImportDefaultSpecifier')
        ));
        if (!defaultSpecifier) return;

        const apiModulePath = resolveApiImportPath(importSource);
        if (apiModulePath) {
          apiImports[defaultSpecifier.local.name] = apiModulePath;
          return;
        }

        if (!importSource.endsWith('.vue')) return;
        const childPath = resolveVueImportPath(importSource, componentPath);
        if (!childPath) return;

        vueImports.push({
          localName: defaultSpecifier.local.name,
          source: importSource,
          componentPath: childPath,
          sourceLine: (node.loc?.start.line || 1) + script.startLine
        });
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

    const apiCalls: VueApiCall[] = [];
    walkAst(ast, node => {
      if (
        !isNodeType<t.CallExpression>(node, 'CallExpression')
        && !isNodeType<t.OptionalCallExpression>(node, 'OptionalCallExpression')
      ) return;

      const callee = node.callee;
      if (
        !isNodeType<t.MemberExpression>(callee, 'MemberExpression')
        && !isNodeType<t.OptionalMemberExpression>(callee, 'OptionalMemberExpression')
      ) return;
      if (!isNodeType<t.Identifier>(callee.object, 'Identifier')) return;

      const alias = callee.object.name;
      if (!apiImports[alias]) return;
      const methodName = memberName(callee);
      if (!methodName) return;

      apiCalls.push({
        alias,
        methodName,
        sourceLine: (node.loc?.start.line || 1) + script.startLine
      });
    });

    result.apiImports = apiImports;
    result.vueImports = vueImports;
    result.apiCalls = apiCalls;

    if (exportObject) {
      const nameProperty = objectProperty(exportObject as t.ObjectExpression, 'name');
      result.componentName = nameProperty ? staticString(nameProperty.value) : '';
    }
  } catch (error) {
    const parseError = error as Error & { loc?: { line?: number } };
    result.parseFailed = true;
    result.diagnostics.push({
      id: `vue-parse:${componentPath}`,
      level: 'warning',
      code: 'VUE_SCRIPT_PARSE_FAILED',
      message: parseError.message || 'Vue script 解析失败',
      filePath: componentPath,
      sourceLine: parseError.loc?.line ? parseError.loc.line + script.startLine : undefined
    });
  }

  return result;
};

export const createVueParser = (project: IndexedProject): VueParser => {
  const cache = new Map<string, Promise<ParsedVue>>();

  const parseVue = (componentPath: string): Promise<ParsedVue> => {
    const cached = cache.get(componentPath);
    if (cached) return cached;

    const promise = (async () => {
      const file = project.files.get(componentPath);
      if (!file) {
        const missing = emptyParsedVue(componentPath);
        missing.parseFailed = true;
        missing.diagnostics.push({
          id: `vue-missing:${componentPath}`,
          level: 'warning',
          code: 'VUE_FILE_MISSING',
          message: '未在所选 src 文件夹中找到该 Vue 文件。',
          filePath: componentPath
        });
        return missing;
      }

      try {
        return parseVueSource(componentPath, await file.text());
      } catch (error) {
        const failed = emptyParsedVue(componentPath);
        failed.parseFailed = true;
        failed.diagnostics.push({
          id: `vue-read:${componentPath}`,
          level: 'warning',
          code: 'VUE_FILE_READ_FAILED',
          message: error instanceof Error ? error.message : 'Vue 文件读取失败',
          filePath: componentPath
        });
        return failed;
      }
    })();

    cache.set(componentPath, promise);
    return promise;
  };

  return {
    parseVue,
    getParsedCount: () => cache.size,
    clear: () => cache.clear()
  };
};
