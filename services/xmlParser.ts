import {
  XmlTransaction,
  XmlField,
  DownstreamCallChain,
  DomainServiceCallChain,
  TransactionChainCall,
  TransactionCallExpandToken
} from '../types';

// --- Helper: Parse Fields Recursively ---
const parseChildren = (element: Element): XmlField[] => {
  const fields: XmlField[] = [];
  const children = Array.from(element.children);
  
  children.forEach(child => {
    const type = child.tagName.toLowerCase(); // Normalize tag name to lowercase
    
    // Special handling for <fields> wrapper inside <field-list>: flatten it
    // This ensures that children of <fields> become direct children of the parent in our model
    if (type === 'fields') {
        const grandChildren = parseChildren(child);
        fields.push(...grandChildren);
        return;
    }

    const name = child.getAttribute("name") || "";
    const description = child.getAttribute("description") || "";
    const pattern = child.getAttribute("pattern") || undefined;
    
    const field: XmlField = {
      name,
      description,
      type,
      pattern
    };

    if (type === 'field') {
      field.style = child.textContent?.trim() || "";
    }
    
    if (child.children.length > 0) {
      field.children = parseChildren(child);
    }
    
    // Include if it has a name OR it is an object (objects inside arrays might not have names)
    if (name || type === 'object') {
       fields.push(field);
    }
  });
  
  return fields;
};

// --- Helper: Java Parsing ---
const extractJavaDownstreamCalls = (content: string): string[] => {
  const calls: Set<string> = new Set();
  const lines = content.split('\n');
  let currentId = '', currentName = '', currentTrans = '';
  
  lines.forEach(line => {
    const idMatch = line.match(/"serviceId"\s*,\s*"([^"]+)"/);
    if (idMatch) currentId = idMatch[1];
    
    const nameMatch = line.match(/"serviceName"\s*,\s*"([^"]+)"/);
    if (nameMatch) currentName = nameMatch[1];
    
    const transMatch = line.match(/"transId"\s*,\s*"([^"]+)"/);
    if (transMatch) currentTrans = transMatch[1];
    
    if (currentId && currentName && currentTrans) {
      calls.add(`${currentId}.${currentName}.${currentTrans}`);
      currentId = ''; 
      currentName = ''; 
      currentTrans = '';
    }
  });

  return Array.from(calls);
};

// --- Helper: Path Normalization ---
const normalizePath = (path: string): string => {
  // Replace Windows backslashes with forward slashes
  return path.replace(/\\/g, '/');
};

// --- Helper: Get Module Name from Path ---
const getModuleName = (filePath: string): string => {
  const normalized = normalizePath(filePath);
  const parts = normalized.split('/');
  
  // If it's in a directory structure, take the parent folder as module name
  if (parts.length > 1) {
      return parts[parts.length - 2];
  }
  
  // Fallback: use filename without extension
  const fileName = parts[parts.length - 1];
  return fileName.replace(/\.[^/.]+$/, "");
};

export interface FileEntry {
  name: string;
  path: string;
  content: string;
}

interface JavaFieldMeta {
  name: string;
  type: string;
  qualifier?: string;
}

interface JavaClassMeta {
  className: string;
  isInterface: boolean;
  path: string;
  content: string; // stripped comments, used for structural parsing
  sourceContent: string; // raw content, used for annotations/JavaDoc descriptions
  extendsName?: string;
  implementsNames: string[];
  serviceBeanNames: string[];
  fields: Record<string, JavaFieldMeta>;
  methodNames?: string[];
}

interface JavaFieldMethodCall {
  fieldName: string;
  methodName: string;
}

const stripJavaComments = (content: string): string => {
  // Remove block comments first, then line comments.
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
};

const toClassName = (serviceBean: string): string => {
  if (!serviceBean) return '';
  return serviceBean.charAt(0).toUpperCase() + serviceBean.slice(1);
};

const toBeanLikeName = (className: string): string => {
  if (!className) return className;
  return className.charAt(0).toLowerCase() + className.slice(1);
};

const uniqueStrings = (items: string[]): string[] => {
  return Array.from(new Set(items.filter(Boolean)));
};

const MAX_TRANSACTION_CHAIN_DEPTH = 100;
const MAX_TRANSACTION_CHAIN_BREADTH = 100;
const MAX_TRANSACTION_CHAIN_TOTAL_CALLS = 6000;
const MAX_TRANSACTION_CHAIN_PARSE_TIME_MS = 2600;
const MAX_DOMAIN_FALLBACK_METHODS = 6;
const DISPATCH_METHOD_NAMES = new Set(['execute', 'query', 'doexecute']);
const JAVA_CONTROL_KEYWORDS = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'return',
  'new',
  'throw',
  'this',
  'super',
  'case',
  'do',
  'try',
  'synchronized'
]);

const normalizeJavaType = (rawType: string): string => {
  const withoutGenerics = rawType.replace(/<[^>]*>/g, '').trim();
  const clean = withoutGenerics.split(/\s+/).pop() || withoutGenerics;
  const parts = clean.split('.');
  return parts[parts.length - 1] || clean;
};

const stripJavaGenericSuffix = (rawType: string): string => {
  const trimmed = rawType.trim();
  const genericStart = trimmed.indexOf('<');
  return (genericStart >= 0 ? trimmed.slice(0, genericStart) : trimmed).trim();
};

const splitTopLevelJavaTypes = (rawTypes: string): string[] => {
  const items: string[] = [];
  let current = '';
  let genericDepth = 0;

  for (const ch of rawTypes) {
    if (ch === '<') {
      genericDepth += 1;
      current += ch;
      continue;
    }
    if (ch === '>') {
      genericDepth = Math.max(0, genericDepth - 1);
      current += ch;
      continue;
    }
    if (ch === ',' && genericDepth === 0) {
      const normalized = stripJavaGenericSuffix(current);
      if (normalized) items.push(normalized);
      current = '';
      continue;
    }
    current += ch;
  }

  const tail = stripJavaGenericSuffix(current);
  if (tail) items.push(tail);

  return items;
};

const isTraceableTypeName = (rawType: string): boolean => {
  const lower = normalizeJavaType(rawType).toLowerCase();
  return (
    lower.endsWith('service') ||
    lower.endsWith('mapper') ||
    lower.startsWith('trs') ||
    lower.startsWith('api')
  );
};

const extractDeclaredMethodNames = (content: string, className: string): string[] => {
  const methodNames: string[] = [];
  const seen = new Set<string>();
  const methodRegex =
    /(?:^|\n)\s*(?:@\w+(?:\([^)]*\))?\s*)*(?:public|protected|private)?\s*(?:static\s+|final\s+|synchronized\s+|abstract\s+|native\s+|default\s+)*[A-Za-z0-9_$.<>,?\[\]\s]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^;{}]*\)\s*(?:throws\s+[^{]+)?\{/gm;
  let match: RegExpExecArray | null;

  while ((match = methodRegex.exec(content)) !== null) {
    const methodName = match[1];
    if (!methodName) continue;
    if (methodName === className) continue;
    if (JAVA_CONTROL_KEYWORDS.has(methodName)) continue;
    if (seen.has(methodName)) continue;
    seen.add(methodName);
    methodNames.push(methodName);
  }

  return methodNames;
};

const parseJavaClassMeta = (file: FileEntry): JavaClassMeta | null => {
  const normalizedPath = normalizePath(file.path);
  const sourceContent = file.content;
  const content = stripJavaComments(sourceContent);
  const classHeaderMatch = content.match(/\b(class|interface)\s+([A-Za-z0-9_]+)[^{]*\{/m);

  if (!classHeaderMatch) {
    return null;
  }

  const className = classHeaderMatch[2];
  const header = classHeaderMatch[0];
  const classKind = classHeaderMatch[1];
  const extendsName = classKind === 'class'
    ? stripJavaGenericSuffix(header.match(/\bextends\s+([A-Za-z0-9_$.]+(?:\s*<[^{}]*>)?)/)?.[1] || '')
    : '';
  const implementsNames: string[] = [];
  const implementsMatch = header.match(/\bimplements\s+([^{]+)/);
  if (implementsMatch) {
    implementsNames.push(
      ...splitTopLevelJavaTypes(implementsMatch[1])
        .map(item => item.trim())
        .filter(Boolean)
    );
  }
  // For interface declarations, "extends" means inherited interfaces.
  if (classKind === 'interface') {
    const extendsMatch = header.match(/\bextends\s+([^{]+)/);
    if (extendsMatch) {
      implementsNames.push(
        ...splitTopLevelJavaTypes(extendsMatch[1])
          .map(item => item.trim())
          .filter(Boolean)
      );
    }
  }

  const serviceBeanNames = uniqueStrings(
    Array.from(
      content.matchAll(
        /@(Service|Component|Named)\s*\(\s*(?:(?:value|name)\s*=\s*)?["']([^"']+)["']\s*\)/g
      )
    ).map(match => match[2])
  );

  const fields: Record<string, JavaFieldMeta> = {};
  const fieldRegex =
    /((?:@\w+(?:\([^)]*\))?\s*)*)(?:private|protected|public)\s+([A-Za-z0-9_$.<>,?\s\[\]]+)\s+([A-Za-z0-9_]+)\s*;/gm;
  let fieldMatch: RegExpExecArray | null;

  while ((fieldMatch = fieldRegex.exec(content)) !== null) {
    const annotations = fieldMatch[1] || '';
    const type = fieldMatch[2].replace(/\s+/g, ' ').trim();
    const name = fieldMatch[3];

    if (!name || !type) continue;

    const qualifierMatch = annotations.match(/@Qualifier\(\s*["']([^"']+)["']\s*\)/);
    const resourceNameMatch = annotations.match(/@Resource\(\s*name\s*=\s*["']([^"']+)["']\s*\)/);
    const resourceValueMatch = annotations.match(/@Resource\(\s*["']([^"']+)["']\s*\)/);
    const hasResource = /@Resource\b/.test(annotations);

    fields[name] = {
      name,
      type,
      qualifier: qualifierMatch?.[1] || resourceNameMatch?.[1] || resourceValueMatch?.[1] || (hasResource ? name : undefined)
    };
  }

  return {
    className,
    isInterface: classKind === 'interface',
    path: normalizedPath,
    content,
    sourceContent,
    extendsName,
    implementsNames,
    serviceBeanNames,
    fields
  };
};

const javaClassMetaCache = new Map<string, JavaClassMeta | null>();
const javaMethodBodyCache = new Map<string, string | null>();
const javaDeclaredMethodNamesCache = new Map<string, string[]>();

const buildJavaClassMetaCacheKey = (file: FileEntry): string => {
  const normalizedPath = normalizePath(file.path);
  const content = file.content || '';
  const previewHead = content.slice(0, 160);
  const previewTail = content.slice(-160);
  return `${normalizedPath}::${content.length}::${previewHead}::${previewTail}`;
};

const resolveJavaClassMeta = (file: FileEntry): JavaClassMeta | null => {
  const cacheKey = buildJavaClassMetaCacheKey(file);
  if (javaClassMetaCache.has(cacheKey)) {
    return javaClassMetaCache.get(cacheKey) || null;
  }
  const parsed = parseJavaClassMeta(file);
  javaClassMetaCache.set(cacheKey, parsed);
  return parsed;
};

const buildMethodBodyCacheKey = (ownerPath: string, methodName: string, contentLength: number): string => {
  return `${normalizePath(ownerPath)}::${methodName}::${contentLength}`;
};

const resolveMethodBodyFromClass = (classMeta: JavaClassMeta, methodName: string): string | null => {
  const cacheKey = buildMethodBodyCacheKey(classMeta.path, methodName, classMeta.content.length);
  if (javaMethodBodyCache.has(cacheKey)) {
    return javaMethodBodyCache.get(cacheKey) || null;
  }
  const body = extractMethodBody(classMeta.content, methodName);
  javaMethodBodyCache.set(cacheKey, body);
  return body;
};

const buildDeclaredMethodNamesCacheKey = (ownerPath: string, contentLength: number): string => {
  return `${normalizePath(ownerPath)}::declared-methods::${contentLength}`;
};

const resolveDeclaredMethodNames = (classMeta: JavaClassMeta): string[] => {
  if (classMeta.methodNames && classMeta.methodNames.length > 0) return classMeta.methodNames;
  const cacheKey = buildDeclaredMethodNamesCacheKey(classMeta.path, classMeta.content.length);
  if (javaDeclaredMethodNamesCache.has(cacheKey)) {
    return javaDeclaredMethodNamesCache.get(cacheKey) || [];
  }
  const methodNames = extractDeclaredMethodNames(classMeta.content, classMeta.className);
  javaDeclaredMethodNamesCache.set(cacheKey, methodNames);
  classMeta.methodNames = methodNames;
  return methodNames;
};

const extractMethodBody = (content: string, methodName: string): string | null => {
  const escapedMethod = escapeRegExp(methodName);
  const methodRegex = new RegExp(`\\b${escapedMethod}\\s*\\([^)]*\\)\\s*(?:throws\\s+[^{]+)?\\{`, 'g');
  const match = methodRegex.exec(content);

  if (!match) return null;

  const openBraceIndex = content.indexOf('{', match.index);
  if (openBraceIndex < 0) return null;

  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = openBraceIndex; i < content.length; i++) {
    const ch = content[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (inSingleQuote) {
      if (ch === '\'') inSingleQuote = false;
      continue;
    }

    if (inDoubleQuote) {
      if (ch === '"') inDoubleQuote = false;
      continue;
    }

    if (ch === '\'') {
      inSingleQuote = true;
      continue;
    }

    if (ch === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return content.slice(openBraceIndex + 1, i);
      }
    }
  }

  return null;
};

const extractFieldMethodCalls = (
  content: string,
  fields: Record<string, JavaFieldMeta>
): JavaFieldMethodCall[] => {
  const calls: JavaFieldMethodCall[] = [];
  const seen = new Set<string>();
  const callRegex =
    /\b(?:this\s*\.\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = callRegex.exec(content)) !== null) {
    const fieldName = match[1];
    const methodName = match[2];

    if (!fields[fieldName]) continue;

    const key = `${fieldName}.${methodName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    calls.push({ fieldName, methodName });
  }

  return calls;
};

const dedupeFieldMethodCalls = (calls: JavaFieldMethodCall[]): JavaFieldMethodCall[] => {
  const seen = new Set<string>();
  const deduped: JavaFieldMethodCall[] = [];

  calls.forEach(call => {
    const key = `${call.fieldName}.${call.methodName}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(call);
  });

  return deduped;
};

const extractLocalTraceableFields = (methodBody: string): Record<string, JavaFieldMeta> => {
  const fields: Record<string, JavaFieldMeta> = {};
  const declarationRegex =
    /(?:^|\n)\s*(?:final\s+)?([A-Za-z0-9_$.<>,?\[\]\s]+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;]+);/gm;
  let match: RegExpExecArray | null;

  while ((match = declarationRegex.exec(methodBody)) !== null) {
    const rawType = match[1]?.replace(/\s+/g, ' ').trim();
    const variableName = match[2]?.trim();
    const rhs = match[3] || '';
    if (!rawType || !variableName) continue;
    if (!isTraceableTypeName(rawType)) continue;

    const beanByGetBean = rhs.match(/getBean\s*\(\s*["']([^"']+)["']\s*\)/i);
    const beanBySpring = rhs.match(/@Qualifier\s*\(\s*["']([^"']+)["']\s*\)/i);

    fields[variableName] = {
      name: variableName,
      type: rawType,
      qualifier: beanByGetBean?.[1] || beanBySpring?.[1]
    };
  }

  return fields;
};

const extractDirectLocalMethodCalls = (
  methodBody: string,
  ownerClass: JavaClassMeta,
  currentMethodName?: string
): string[] => {
  if (!currentMethodName) return [];
  const declaredMethodList = resolveDeclaredMethodNames(ownerClass);
  if (declaredMethodList.length === 0) return [];

  const declaredMethods = new Set(declaredMethodList);
  const directCalls: string[] = [];
  const seen = new Set<string>();
  const callRegex = /(?:\b([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = callRegex.exec(methodBody)) !== null) {
    const ownerPrefix = match[1];
    const methodName = match[2];
    if (!methodName) continue;
    if (methodName === currentMethodName) continue;
    if (!declaredMethods.has(methodName)) continue;
    if (JAVA_CONTROL_KEYWORDS.has(methodName)) continue;
    if (ownerPrefix && ownerPrefix !== 'this') continue;

    if (seen.has(methodName)) continue;
    seen.add(methodName);
    directCalls.push(methodName);
    if (directCalls.length >= MAX_TRANSACTION_CHAIN_BREADTH) break;
  }

  return directCalls;
};

const isRouterService = (field: JavaFieldMeta): boolean => {
  const typeName = normalizeJavaType(field.type).toLowerCase();
  const fieldName = field.name.toLowerCase();
  return /^rt[a-z0-9_]*service$/.test(typeName) || /^rt[a-z0-9_]*service$/.test(fieldName);
};

const isInternalService = (field: JavaFieldMeta): boolean => {
  if (isRouterService(field)) return false;
  const typeName = normalizeJavaType(field.type).toLowerCase();
  const fieldName = field.name.toLowerCase();
  return typeName.endsWith('service') || fieldName.endsWith('service');
};

const isDispatchMethod = (methodName: string): boolean => {
  return DISPATCH_METHOD_NAMES.has(methodName.toLowerCase());
};

const isTrsLikeBean = (field: JavaFieldMeta): boolean => {
  const typeName = normalizeJavaType(field.type).toLowerCase();
  const fieldName = field.name.toLowerCase();
  const qualifierName = field.qualifier?.toLowerCase() || '';
  return typeName.startsWith('trs') || fieldName.startsWith('trs') || qualifierName.startsWith('trs');
};

const resolveInternalServiceType = (field: JavaFieldMeta): 'local-service' | 'rpc-service' | null => {
  if (!isInternalService(field)) return null;

  const typeName = normalizeJavaType(field.type).toLowerCase();
  const fieldName = field.name.toLowerCase();
  const hasServiceSuffix = typeName.endsWith('service') || fieldName.endsWith('service');
  const hasApiPrefix = typeName.startsWith('api') || fieldName.startsWith('api');

  if (hasServiceSuffix && hasApiPrefix) {
    return 'rpc-service';
  }

  return 'local-service';
};

const parseSpringApplicationHints = (files: FileEntry[]): Record<string, string[]> => {
  const hints: Record<string, string[]> = {};

  files.forEach(file => {
    const lowerName = file.name.toLowerCase();
    const normalizedPath = normalizePath(file.path).toLowerCase();
    if (!normalizedPath.includes('bootstart')) return;

    const names: string[] = [];

    if (lowerName.endsWith('.yml') || lowerName.endsWith('.yaml')) {
      const yamlNames = Array.from(file.content.matchAll(/^\s*name\s*:\s*([A-Za-z0-9_-]+)/gm)).map(m => m[1]);
      names.push(...yamlNames);
    }

    if (lowerName.endsWith('.properties')) {
      const propertyNames = Array.from(
        file.content.matchAll(/^\s*spring\.application\.name\s*=\s*([A-Za-z0-9_-]+)/gm)
      ).map(m => m[1]);
      names.push(...propertyNames);
    }

    if (names.length === 0) return;

    const pathParts = normalizePath(file.path).split('/');
    const bootstartIndex = pathParts.findIndex(item => item.toLowerCase().includes('bootstart'));
    const modulePath = bootstartIndex > 0 ? pathParts.slice(0, bootstartIndex).join('/') : normalizePath(file.path);

    uniqueStrings(names).forEach(name => {
      const key = name.toLowerCase();
      if (!hints[key]) hints[key] = [];
      hints[key].push(modulePath);
    });
  });

  Object.keys(hints).forEach(key => {
    hints[key] = uniqueStrings(hints[key]);
  });

  return hints;
};

const scoreClassCandidate = (
  candidate: JavaClassMeta,
  serviceName: string,
  serviceHints: string[]
): number => {
  const lowerPath = candidate.path.toLowerCase();
  const lowerServiceName = serviceName.toLowerCase();

  let score = 0;

  if (candidate.className.endsWith('Impl')) score += 1;
  if (lowerPath.includes('/api/impl/')) score += 2;
  if (lowerPath.includes(`/` + lowerServiceName + `/`) || lowerPath.includes(`-` + lowerServiceName)) score += 2;
  if (serviceHints.some(prefix => candidate.path.startsWith(prefix))) score += 6;

  if (isFrameworkTemplateClass(candidate)) score -= 40;

  return score;
};

const selectBestClassCandidate = (
  candidates: JavaClassMeta[],
  serviceName: string,
  serviceHints: string[]
): JavaClassMeta | null => {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const sorted = [...candidates].sort((left, right) => {
    const scoreDiff = scoreClassCandidate(right, serviceName, serviceHints) - scoreClassCandidate(left, serviceName, serviceHints);
    if (scoreDiff !== 0) return scoreDiff;
    return left.path.length - right.path.length;
  });

  return sorted[0];
};

const dedupeClasses = (items: JavaClassMeta[]): JavaClassMeta[] => {
  return Array.from(new Map(items.map(item => [`${item.className}::${item.path}`, item])).values());
};

const isFrameworkTemplateClass = (candidate: JavaClassMeta): boolean => {
  const lowerPath = candidate.path.toLowerCase();
  const lowerClassName = candidate.className.toLowerCase();
  return (
    lowerPath.includes('/pisces-infrastructure/') ||
    lowerClassName === 'domaintwophaseserviceimpl' ||
    lowerClassName === 'domainqueryserviceimpl' ||
    lowerClassName === 'domaintwophaseservice' ||
    lowerClassName === 'domainqueryservice'
  );
};

const filterFrameworkTemplateCandidates = (candidates: JavaClassMeta[]): JavaClassMeta[] => {
  const nonTemplateCandidates = candidates.filter(candidate => !isFrameworkTemplateClass(candidate));
  return nonTemplateCandidates.length > 0 ? nonTemplateCandidates : candidates;
};

const dedupeTransactionCalls = (items: TransactionChainCall[]): TransactionChainCall[] => {
  const map = new Map<string, TransactionChainCall>();
  items.forEach(item => {
    const key = `${item.type}|${item.call}|${item.pathKey || ''}|${item.nestLevel || 0}|${item.tableName || ''}|${
      item.downstreamInterfaceCode || ''
    }`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      return;
    }
    const preferred =
      (!existing.description && item.description) ||
      (!existing.expandToken && item.expandToken);
    if (preferred) {
      map.set(key, {
        ...existing,
        ...item
      });
    }
  });
  return Array.from(map.values());
};

const isMapperField = (field: JavaFieldMeta): boolean => {
  const normalizedType = normalizeJavaType(field.type);
  const typeName = normalizedType.toLowerCase();
  const fieldName = field.name.toLowerCase();
  if (['objectmapper', 'modelmapper', 'xmlmapper', 'beanmapper'].includes(typeName)) return false;
  return typeName.endsWith('mapper') || fieldName.endsWith('mapper');
};

const deriveTableNameFromMapper = (field: JavaFieldMeta): string | undefined => {
  if (!isMapperField(field)) return undefined;

  const rawName = normalizeJavaType(field.type).replace(/Mapper$/i, '').replace(/Extend/gi, '');
  if (!rawName) return undefined;
  return rawName;
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const parseAnnotationStringValue = (raw: string): string | undefined => {
  const fields = ['value', 'description', 'desc', 'name', 'title', 'remark', 'remarks', 'label'];
  for (const field of fields) {
    const doubleQuoted = raw.match(new RegExp(`${field}\\s*=\\s*"([^"]+)"`));
    if (doubleQuoted?.[1]?.trim()) return doubleQuoted[1].trim();

    const singleQuoted = raw.match(new RegExp(`${field}\\s*=\\s*'([^']+)'`));
    if (singleQuoted?.[1]?.trim()) return singleQuoted[1].trim();
  }

  const firstDouble = raw.match(/"([^"]+)"/);
  if (firstDouble?.[1]?.trim()) return firstDouble[1].trim();

  const firstSingle = raw.match(/'([^']+)'/);
  if (firstSingle?.[1]?.trim()) return firstSingle[1].trim();

  return undefined;
};

const parseDescriptionFromJavaDoc = (rawBlock: string): string | undefined => {
  const lines = rawBlock
    .split('\n')
    .map(line => line.replace(/^\s*\*?\s?/, '').trim())
    .filter(Boolean);
  if (lines.length === 0) return undefined;

  const tagged = lines.find(line => /^@(description|descipition|desc)\b/i.test(line));
  if (tagged) {
    const normalized = tagged.replace(/^@(description|descipition|desc)\b\s*[:：]?\s*/i, '').trim();
    if (normalized) return normalized;
  }

  const firstPlain = lines.find(
    line => !line.startsWith('@') && !/^(author|date|version)\b/i.test(line)
  );
  return firstPlain || undefined;
};

const findNearestBlockCommentRange = (
  content: string
): { start: number; end: number } | null => {
  const end = content.lastIndexOf('*/');
  if (end < 0) return null;

  const docStart = content.lastIndexOf('/**', end);
  const blockStart = content.lastIndexOf('/*', end);
  const start = Math.max(docStart, blockStart);
  if (start < 0 || start > end) return null;

  return { start, end };
};

const getMethodJavaDocDescription = (content: string, methodName: string): string | undefined => {
  const escapedMethod = escapeRegExp(methodName);
  const methodRegex = new RegExp(`\\b${escapedMethod}\\s*\\(`, 'gm');
  let methodMatch: RegExpExecArray | null;

  while ((methodMatch = methodRegex.exec(content)) !== null) {
    const lookbackStart = Math.max(0, methodMatch.index - 3500);
    const prefix = content.slice(lookbackStart, methodMatch.index);
    const commentRange = findNearestBlockCommentRange(prefix);
    if (!commentRange) continue;
    const block = prefix.slice(commentRange.start + 2, commentRange.end);
    const parsed = parseDescriptionFromJavaDoc(block);
    if (parsed) return parsed;
  }

  return undefined;
};

const getMethodAnnotationDescription = (
  content: string,
  methodName: string,
  annotationName: string
): string | undefined => {
  const escapedMethod = escapeRegExp(methodName);
  const escapedAnnotation = escapeRegExp(annotationName);
  const methodRegex = new RegExp(`\\b${escapedMethod}\\s*\\(`, 'gm');
  let methodMatch: RegExpExecArray | null;

  while ((methodMatch = methodRegex.exec(content)) !== null) {
    const lookbackStart = Math.max(0, methodMatch.index - 3000);
    const prefix = content.slice(lookbackStart, methodMatch.index);
    const annotationRegex = new RegExp(`@${escapedAnnotation}(?:\\s*\\(([^)]*)\\))?`, 'gm');
    let annotationMatch: RegExpExecArray | null;
    let lastAnnotationArgs: string | undefined;

    while ((annotationMatch = annotationRegex.exec(prefix)) !== null) {
      lastAnnotationArgs = annotationMatch[1] || '';
    }

    if (lastAnnotationArgs !== undefined) {
      const parsed = parseAnnotationStringValue(lastAnnotationArgs);
      if (parsed) return parsed;
    }
  }

  return undefined;
};

const getClassLevelDescription = (content: string): string | undefined => {
  const classIndex = content.search(/\b(class|interface)\s+[A-Za-z0-9_]+/);
  if (classIndex < 0) return undefined;

  const header = content.slice(Math.max(0, classIndex - 2000), classIndex);
  const annotations = ['Description', 'Descipition', 'ApiOperation', 'ApiOpeation'];
  for (const annotation of annotations) {
    const escapedAnnotation = escapeRegExp(annotation);
    const regex = new RegExp(`@${escapedAnnotation}\\s*\\(([^)]*)\\)`, 'gm');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(header)) !== null) {
      const parsed = parseAnnotationStringValue(match[1] || '');
      if (parsed) return parsed;
    }
  }

  const commentRange = findNearestBlockCommentRange(header);
  if (commentRange) {
    const block = header.slice(commentRange.start + 2, commentRange.end);
    const parsed = parseDescriptionFromJavaDoc(block);
    if (parsed) return parsed;
  }

  return undefined;
};

const getMethodDescription = (content: string, methodName: string): string | undefined => {
  const annotationNames = ['ApiOperation', 'ApiOpeation', 'Description', 'Descipition', 'Desc'];
  for (const annotationName of annotationNames) {
    const description = getMethodAnnotationDescription(content, methodName, annotationName);
    if (description) return description;
  }

  const javaDocDesc = getMethodJavaDocDescription(content, methodName);
  if (javaDocDesc) return javaDocDesc;

  return undefined;
};

const resolveDescriptionFromCandidates = (
  candidates: JavaClassMeta[],
  methodName: string
): string | undefined => {
  for (const candidate of candidates) {
    const methodDescription = getMethodDescription(candidate.sourceContent || candidate.content, methodName);
    if (methodDescription) return methodDescription;
  }

  for (const candidate of candidates) {
    const classDescription = getClassLevelDescription(candidate.sourceContent || candidate.content);
    if (classDescription) return classDescription;
  }

  return undefined;
};

const parseResolverParamMap = (files: FileEntry[]): Record<string, string[]> => {
  const map: Record<string, string[]> = {};

  files.forEach(file => {
    if (!file.name.toLowerCase().endsWith('.xml')) return;
    const regex = /<param\s+name\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/param>/gim;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(file.content)) !== null) {
      const name = match[1]?.trim();
      const value = match[2]?.replace(/<[^>]+>/g, '').trim();
      if (!name || !value) continue;
      if (!map[name]) map[name] = [];
      map[name].push(value);
    }
  });

  Object.keys(map).forEach(key => {
    map[key] = uniqueStrings(map[key]);
  });

  return map;
};

const normalizeResolverDescriptionComment = (
  rawComment: string,
  mappedValue?: string
): string | undefined => {
  let normalized = rawComment.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;

  if (mappedValue && normalized.startsWith(mappedValue)) {
    normalized = normalized.slice(mappedValue.length).trim();
  }

  normalized = normalized.replace(/^[-:：;,，.\s]+/, '').trim();
  return normalized || undefined;
};

const parseResolverDescriptionMap = (files: FileEntry[]): Record<string, string[]> => {
  const map: Record<string, string[]> = {};

  files.forEach(file => {
    if (!file.name.toLowerCase().endsWith('.xml')) return;
    const regex = /<param\s+name\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/param>(?:\s*<!--([\s\S]*?)-->)?/gim;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(file.content)) !== null) {
      const name = match[1]?.trim();
      const value = match[2]?.replace(/<[^>]+>/g, '').trim();
      const comment = match[3]?.trim();
      if (!name || !comment) continue;

      const description = normalizeResolverDescriptionComment(comment, value);
      if (!description) continue;

      if (!map[name]) map[name] = [];
      map[name].push(description);
    }
  });

  Object.keys(map).forEach(key => {
    map[key] = uniqueStrings(map[key]);
  });

  return map;
};

const extractConstantValue = (content: string, constantName: string): string | undefined => {
  const escaped = escapeRegExp(constantName);
  const regex = new RegExp(`\\b${escaped}\\b\\s*=\\s*"([^"]+)"`);
  const match = content.match(regex);
  return match?.[1];
};

interface ResolveContext {
  classMap: Record<string, JavaClassMeta[]>;
  serviceBeanMap: Record<string, JavaClassMeta[]>;
  allClasses: JavaClassMeta[];
  serviceName: string;
  serviceHints: string[];
  resolverParamMap: Record<string, string[]>;
  resolverDescriptionMap: Record<string, string[]>;
}

interface TransactionTraversalState {
  remainingCalls: number;
  truncated: boolean;
  deadlineAt: number;
}

interface ResolveDownstreamChainOptions {
  maxDepth?: number;
}

export interface MiddleProjectChainResolver {
  resolveOne: (downstreamCall: string, options?: ResolveDownstreamChainOptions) => DownstreamCallChain;
  resolveMany: (
    downstreamCalls: string[],
    options?: ResolveDownstreamChainOptions
  ) => Record<string, DownstreamCallChain>;
  resolveCallLayer: (token: TransactionCallExpandToken) => TransactionChainCall[];
}

const resolveClassCandidatesForField = (
  field: JavaFieldMeta,
  context: ResolveContext
): JavaClassMeta[] => {
  const byType = resolveClassCandidatesByType(field.type, context);
  const byQualifier = field.qualifier && context.serviceBeanMap[field.qualifier]
    ? dedupeClasses(context.serviceBeanMap[field.qualifier])
    : [];
  const guessNames = uniqueStrings([
    toClassName(field.qualifier || ''),
    toClassName(field.name),
    `${toClassName(field.qualifier || '')}Impl`,
    `${toClassName(field.name)}Impl`
  ]);
  const byBeanLikeName = dedupeClasses(
    guessNames.flatMap(name => (name ? context.classMap[name] || [] : []))
  );

  return dedupeClasses([...byQualifier, ...byBeanLikeName, ...byType]);
};

const scoreClassCandidateForField = (
  candidate: JavaClassMeta,
  field: JavaFieldMeta,
  context: ResolveContext
): number => {
  let score = scoreClassCandidate(candidate, context.serviceName, context.serviceHints);
  const normalizedType = normalizeJavaType(field.type);
  if (!normalizedType) return score;

  const qualifier = field.qualifier || '';
  if (qualifier && candidate.serviceBeanNames.some(name => name === qualifier)) {
    score += 20;
  }
  const beanLikeClass = toClassName(qualifier || field.name);
  if (beanLikeClass && candidate.className === beanLikeClass) score += 18;
  if (beanLikeClass && candidate.className === `${beanLikeClass}Impl`) score += 18;

  // Interface-only candidates break deep tracing because method bodies are absent.
  if (candidate.isInterface) score -= 10;

  if (candidate.className === normalizedType && !candidate.isInterface) score += 6;
  if (candidate.className === `${normalizedType}Impl`) score += 6;
  if (candidate.implementsNames.includes(normalizedType)) score += 5;

  return score;
};

const selectBestClassCandidateForField = (
  candidates: JavaClassMeta[],
  field: JavaFieldMeta,
  context: ResolveContext
): JavaClassMeta | null => {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const sorted = [...candidates].sort((left, right) => {
    const scoreDiff =
      scoreClassCandidateForField(right, field, context) -
      scoreClassCandidateForField(left, field, context);
    if (scoreDiff !== 0) return scoreDiff;
    return left.path.length - right.path.length;
  });

  return sorted[0];
};

const selectExecutableClassCandidateForField = (
  candidates: JavaClassMeta[],
  field: JavaFieldMeta,
  context: ResolveContext,
  methodName: string
): JavaClassMeta | null => {
  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((left, right) => {
    const scoreDiff =
      scoreClassCandidateForField(right, field, context) -
      scoreClassCandidateForField(left, field, context);
    if (scoreDiff !== 0) return scoreDiff;
    return left.path.length - right.path.length;
  });

  const executable = sorted.find(candidate => Boolean(resolveMethodBodyFromClass(candidate, methodName)));
  return executable || sorted[0] || null;
};

const isDomainTwoPhaseTemplateClass = (classMeta: JavaClassMeta): boolean => {
  const extendsName = normalizeJavaType(classMeta.extendsName || '').toLowerCase();
  return extendsName === 'domaintwophaseserviceimpl';
};

const isDomainQueryTemplateClass = (classMeta: JavaClassMeta): boolean => {
  const extendsName = normalizeJavaType(classMeta.extendsName || '').toLowerCase();
  return extendsName === 'domainqueryserviceimpl';
};

const isEffectivelyEmptyMethodBody = (methodBody: string | null): boolean => {
  if (!methodBody) return true;
  const normalized = methodBody.replace(/[{}\s;]/g, '').trim();
  return normalized.length === 0;
};

const resolveHiddenDispatchMethodNames = (classMeta: JavaClassMeta): string[] => {
  if (isDomainQueryTemplateClass(classMeta)) {
    return ['query'];
  }

  if (isDomainTwoPhaseTemplateClass(classMeta)) {
    return ['preCheck', 'cfmSubCheck', 'submit'];
  }

  return [];
};

const resolveInternalCallType = (
  field: JavaFieldMeta,
  context: ResolveContext
): 'local-service' | 'rpc-service' | null => {
  const serviceType = resolveInternalServiceType(field);
  if (serviceType) return serviceType;

  // Non-*Service beans (e.g. trs* executors) are still executable local links
  // when we can resolve a concrete class from uploaded code.
  const candidates = resolveClassCandidatesForField(field, context);
  if (candidates.length > 0) return 'local-service';

  return null;
};

const resolveClassCandidatesByType = (
  typeName: string,
  context: ResolveContext
): JavaClassMeta[] => {
  const normalizedType = normalizeJavaType(typeName);
  if (!normalizedType) return [];

  const direct = context.classMap[normalizedType] || [];
  const impl = context.classMap[`${normalizedType}Impl`] || [];
  const implemented = context.allClasses.filter(meta => meta.implementsNames.includes(normalizedType));
  return filterFrameworkTemplateCandidates(dedupeClasses([...direct, ...impl, ...implemented]));
};

const resolveApiDescriptionForServiceCall = (
  field: JavaFieldMeta,
  methodName: string,
  context: ResolveContext
): string | undefined => {
  const candidates = resolveClassCandidatesForField(field, context);
  const sorted = [...candidates].sort((left, right) => {
    const diff = scoreClassCandidateForField(right, field, context) - scoreClassCandidateForField(left, field, context);
    if (diff !== 0) return diff;
    return left.path.length - right.path.length;
  });

  const sourceDescription = resolveDescriptionFromCandidates(sorted, methodName);
  if (sourceDescription) return sourceDescription;

  if (isRouterService(field)) {
    return resolveRouterMetadata(field, methodName, context, context.resolverDescriptionMap);
  }

  return undefined;
};

const resolveRouterMetadata = (
  field: JavaFieldMeta,
  methodName: string,
  context: ResolveContext,
  resolverMap: Record<string, string[]>
): string | undefined => {
  const findMappedValueByServiceCode = (serviceCode: string): string | undefined => {
    const exact = resolverMap[serviceCode];
    if (exact && exact.length > 0) return exact[0];

    const normalized = serviceCode.trim().toLowerCase();
    const matchedKey = Object.keys(resolverMap).find(
      key => key.trim().toLowerCase() === normalized
    );
    if (!matchedKey) return undefined;
    const mapped = resolverMap[matchedKey];
    return mapped && mapped.length > 0 ? mapped[0] : undefined;
  };

  const resolveByRtTypeName = (): string | undefined => {
    const normalizedType = normalizeJavaType(field.type);
    const candidatesByType = uniqueStrings(
      [normalizedType, toClassName(field.name)].filter(Boolean)
    );
    if (candidatesByType.length === 0) return undefined;

    const mapKeys = Object.keys(resolverMap);
    for (const typeName of candidatesByType) {
      const lowerType = typeName.toLowerCase();
      const matchedKey = mapKeys.find(key => {
        const lowerKey = key.trim().toLowerCase();
        return lowerKey === lowerType || lowerKey.endsWith(`.${lowerType}`);
      });
      if (!matchedKey) continue;
      const mapped = resolverMap[matchedKey];
      if (mapped && mapped.length > 0) return mapped[0];
    }
    return undefined;
  };

  const candidates = resolveClassCandidatesForField(field, context);
  if (candidates.length === 0) {
    return resolveByRtTypeName();
  }

  const selected = selectBestClassCandidateForField(candidates, field, context);
  const targetCandidates = selected ? [selected, ...candidates.filter(item => item !== selected)] : candidates;

  for (const candidate of targetCandidates) {
    let serviceCode: string | undefined;
    const methodBody = resolveMethodBodyFromClass(candidate, methodName);
    if (methodBody) {
      const codeLiteralMatch = methodBody.match(/"RouterTrsCode"\s*,\s*["']([^"']+)["']/i);
      if (codeLiteralMatch?.[1]) {
        serviceCode = codeLiteralMatch[1].trim();
      }
      const codeVarMatch = methodBody.match(/"RouterTrsCode"\s*,\s*([A-Za-z0-9_$.]+)/);
      if (codeVarMatch) {
        const constantName = codeVarMatch[1].split('.').pop() || codeVarMatch[1];
        const extracted = extractConstantValue(candidate.content, constantName);
        if (extracted) serviceCode = extracted;
      }
    }

    if (!serviceCode) {
      serviceCode = extractConstantValue(candidate.content, 'SERVICE_CODE');
    }
    if (!serviceCode) continue;

    const mapped = findMappedValueByServiceCode(serviceCode);
    if (mapped) return mapped;
  }

  return resolveByRtTypeName();
};

const resolveRouterDownstreamCode = (
  field: JavaFieldMeta,
  methodName: string,
  context: ResolveContext
): string | undefined => {
  return resolveRouterMetadata(field, methodName, context, context.resolverParamMap);
};

const extractStaticTraceableClassMethodCalls = (
  methodBody: string,
  context: ResolveContext
): JavaFieldMethodCall[] => {
  const calls: JavaFieldMethodCall[] = [];
  const seen = new Set<string>();
  const callRegex = /\b([A-Z][A-Za-z0-9_]*)\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = callRegex.exec(methodBody)) !== null) {
    const className = match[1];
    const methodName = match[2];
    if (!className || !methodName) continue;
    if (!isTraceableTypeName(className)) continue;
    if (!context.classMap[className] || context.classMap[className].length === 0) continue;

    const key = `${className}.${methodName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    calls.push({
      fieldName: className,
      methodName
    });
  }

  return calls;
};

const buildTransactionCallDetails = (
  ownerClass: JavaClassMeta,
  methodBody: string,
  context: ResolveContext,
  depth: number,
  visitedMethods: Set<string>,
  traversalState: TransactionTraversalState,
  maxDepth: number,
  pathStack: string[] = [],
  currentMethodName?: string
): TransactionChainCall[] => {
  const isTraversalBudgetExceeded = (): boolean => {
    if (Date.now() > traversalState.deadlineAt) {
      traversalState.truncated = true;
      return true;
    }
    return false;
  };

  if (isTraversalBudgetExceeded() || traversalState.remainingCalls <= 0) {
    traversalState.truncated = true;
    return [];
  }

  const details: TransactionChainCall[] = [];
  const pushDetail = (detail: TransactionChainCall): boolean => {
    if (isTraversalBudgetExceeded() || traversalState.remainingCalls <= 0) {
      traversalState.truncated = true;
      return false;
    }
    details.push(detail);
    traversalState.remainingCalls -= 1;
    return true;
  };

  const localFields = extractLocalTraceableFields(methodBody);
  const availableFields: Record<string, JavaFieldMeta> = {
    ...ownerClass.fields,
    ...localFields
  };
  const staticClassCalls = extractStaticTraceableClassMethodCalls(methodBody, context);
  staticClassCalls.forEach(call => {
    if (availableFields[call.fieldName]) return;
    availableFields[call.fieldName] = {
      name: call.fieldName,
      type: call.fieldName
    };
  });

  const fieldCalls = dedupeFieldMethodCalls([
    ...extractFieldMethodCalls(methodBody, availableFields),
    ...staticClassCalls
  ]).slice(0, MAX_TRANSACTION_CHAIN_BREADTH);

  fieldCalls.forEach(fieldCall => {
    if (isTraversalBudgetExceeded()) return;
    const field = availableFields[fieldCall.fieldName];
    if (!field) return;

    const callId = `${fieldCall.fieldName}.${fieldCall.methodName}`;

    if (isMapperField(field)) {
      pushDetail({
        type: 'database',
        call: callId,
        tableName: deriveTableNameFromMapper(field),
        nestLevel: depth,
        pathKey: pathStack.join('>')
      });
      return;
    }

    if (isRouterService(field)) {
      const description = resolveApiDescriptionForServiceCall(field, fieldCall.methodName, context);
      pushDetail({
        type: 'downstream',
        call: callId,
        description,
        downstreamInterfaceCode: resolveRouterDownstreamCode(field, fieldCall.methodName, context),
        nestLevel: depth,
        pathKey: pathStack.join('>')
      });
      return;
    }

    const internalServiceType = resolveInternalCallType(field, context);
    if (!internalServiceType) return;

    const description = resolveApiDescriptionForServiceCall(field, fieldCall.methodName, context);
    const hideDispatchNode = isDispatchMethod(fieldCall.methodName) && isTrsLikeBean(field);
    const nextDepth = hideDispatchNode ? depth : depth + 1;
    const nextPathStack = [...pathStack, callId];
    const localCandidates = resolveClassCandidatesForField(field, context);
    const selectedLocal = hideDispatchNode
      ? (selectBestClassCandidateForField(filterFrameworkTemplateCandidates(localCandidates), field, context) ||
          selectBestClassCandidateForField(localCandidates, field, context))
      : selectExecutableClassCandidateForField(localCandidates, field, context, fieldCall.methodName);
    let nestedMethodName = fieldCall.methodName;
    let nestedBody = selectedLocal ? resolveMethodBodyFromClass(selectedLocal, nestedMethodName) : null;
    if (selectedLocal && hideDispatchNode && !nestedBody) {
      const hiddenDispatchMethods = resolveHiddenDispatchMethodNames(selectedLocal)
        .filter(methodName => !isEffectivelyEmptyMethodBody(resolveMethodBodyFromClass(selectedLocal, methodName)));

      if (hiddenDispatchMethods.length > 0) {
        hiddenDispatchMethods.forEach(methodName => {
          if (isTraversalBudgetExceeded()) return;
          const lifecycleBody = resolveMethodBodyFromClass(selectedLocal, methodName);
          if (!lifecycleBody) return;
          const lifecycleMethodKey = `${selectedLocal.path}#${methodName}`;
          if (visitedMethods.has(lifecycleMethodKey)) return;

          const nextVisitedMethods = new Set(visitedMethods);
          nextVisitedMethods.add(lifecycleMethodKey);

          const nested = buildTransactionCallDetails(
            selectedLocal,
            lifecycleBody,
            context,
            nextDepth,
            nextVisitedMethods,
            traversalState,
            maxDepth,
            pathStack,
            methodName
          );
          details.push(...nested);
        });
        return;
      }

      const dispatchEntryMethod = uniqueStrings([fieldCall.methodName, 'query', 'execute', 'doExecute', 'doexecute']).find(
        methodName => Boolean(resolveMethodBodyFromClass(selectedLocal, methodName))
      );
      if (dispatchEntryMethod) {
        nestedMethodName = dispatchEntryMethod;
        nestedBody = resolveMethodBodyFromClass(selectedLocal, nestedMethodName);
      }
    }
    const methodKey = selectedLocal ? `${selectedLocal.path}#${nestedMethodName}` : '';
    const expandToken =
      selectedLocal && nestedBody
        ? {
            ownerClassPath: selectedLocal.path,
            ownerMethod: nestedMethodName,
            depth: nextDepth,
            pathStack: nextPathStack,
            visitedMethodKeys: uniqueStrings([...Array.from(visitedMethods), methodKey].filter(Boolean)),
            serviceName: context.serviceName
          }
        : undefined;
    if (!hideDispatchNode) {
      const pushed = pushDetail({
        type: internalServiceType,
        call: callId,
        description,
        nestLevel: depth,
        pathKey: pathStack.join('>'),
        expandToken
      });
      if (!pushed) return;
    }

    // Hidden dispatch nodes (e.g. trs*.execute) should still unwrap one layer
    // even when current visible depth reached maxDepth.
    if (!hideDispatchNode && depth >= maxDepth) return;
    if (!selectedLocal || !nestedBody) return;

    if (visitedMethods.has(methodKey)) return;

    const nextVisitedMethods = new Set(visitedMethods);
    nextVisitedMethods.add(methodKey);

    const nested = buildTransactionCallDetails(
      selectedLocal,
      nestedBody,
      context,
      nextDepth,
      nextVisitedMethods,
      traversalState,
      maxDepth,
      nextPathStack,
      nestedMethodName
    );
    details.push(...nested);
  });

  const directMethodCalls = extractDirectLocalMethodCalls(methodBody, ownerClass, currentMethodName).slice(
    0,
    MAX_TRANSACTION_CHAIN_BREADTH
  );
  directMethodCalls.forEach(methodName => {
    if (isTraversalBudgetExceeded()) return;
    const methodKey = `${ownerClass.path}#${methodName}`;
    if (visitedMethods.has(methodKey)) return;

    const nestedBody = resolveMethodBodyFromClass(ownerClass, methodName);
    if (!nestedBody) return;

    const localCallId = `${toBeanLikeName(ownerClass.className)}.${methodName}`;
    const pushed = pushDetail({
      type: 'local-service',
      call: localCallId,
      description: resolveDescriptionFromCandidates([ownerClass], methodName),
      nestLevel: depth,
      pathKey: pathStack.join('>'),
      expandToken: {
        ownerClassPath: ownerClass.path,
        ownerMethod: methodName,
        depth: depth + 1,
        pathStack: [...pathStack, `local:${methodName}`],
        visitedMethodKeys: uniqueStrings([...Array.from(visitedMethods), methodKey]),
        serviceName: context.serviceName
      }
    });
    if (!pushed) return;

    if (depth >= maxDepth) return;

    const nextVisitedMethods = new Set(visitedMethods);
    nextVisitedMethods.add(methodKey);

    const nested = buildTransactionCallDetails(
      ownerClass,
      nestedBody,
      context,
      depth + 1,
      nextVisitedMethods,
      traversalState,
      maxDepth,
      [...pathStack, `local:${methodName}`],
      methodName
    );
    details.push(...nested);
  });

  return dedupeTransactionCalls(details);
};

const resolveSingleDownstreamChain = (
  downstreamCall: string,
  classMap: Record<string, JavaClassMeta[]>,
  serviceBeanMap: Record<string, JavaClassMeta[]>,
  allClasses: JavaClassMeta[],
  springHints: Record<string, string[]>,
  resolverParamMap: Record<string, string[]>,
  resolverDescriptionMap: Record<string, string[]>,
  options?: ResolveDownstreamChainOptions
): DownstreamCallChain => {
  const maxDepth = Math.max(0, options?.maxDepth ?? MAX_TRANSACTION_CHAIN_DEPTH);
  const segments = downstreamCall
    .split('.')
    .map(item => item.trim())
    .filter(Boolean);

  if (segments.length < 3) {
    return {
      downstreamCall,
      serviceName: segments[0] || '',
      apiServiceBean: segments[1] || '',
      apiMethod: segments.slice(2).join('.'),
      domainServices: [],
      unresolvedReason: 'Downstream 格式不符合 service.apiService.method'
    };
  }

  const serviceName = segments[0];
  const apiServiceBean = segments[1];
  const apiMethod = segments.slice(2).join('.');
  const apiInterfaceClass = toClassName(apiServiceBean);
  const apiImplClassName = `${apiInterfaceClass}Impl`;
  const serviceHints = springHints[serviceName.toLowerCase()] || [];
  const context: ResolveContext = {
    classMap,
    serviceBeanMap,
    allClasses,
    serviceName,
    serviceHints,
    resolverParamMap,
    resolverDescriptionMap
  };

  const rawCandidates = [
    ...(classMap[apiImplClassName] || []),
    ...allClasses.filter(meta => meta.implementsNames.includes(apiInterfaceClass))
  ];

  const dedupCandidates = dedupeClasses(rawCandidates);

  const selectedApiImpl = selectBestClassCandidate(dedupCandidates, serviceName, serviceHints);

  if (!selectedApiImpl) {
    return {
      downstreamCall,
      serviceName,
      apiServiceBean,
      apiMethod,
      apiInterfaceClass,
      domainServices: [],
      unresolvedReason: `未找到 ${apiInterfaceClass} 的实现类`
    };
  }

  const chain: DownstreamCallChain = {
    downstreamCall,
    serviceName,
    apiServiceBean,
    apiMethod,
    apiDescription: resolveDescriptionFromCandidates(
      [selectedApiImpl, ...dedupCandidates.filter(item => item !== selectedApiImpl)],
      apiMethod
    ),
    apiInterfaceClass,
    apiImplClass: selectedApiImpl.className,
    apiImplPath: selectedApiImpl.path,
    domainServices: []
  };
  const traversalState: TransactionTraversalState = {
    remainingCalls: MAX_TRANSACTION_CHAIN_TOTAL_CALLS,
    truncated: false,
    deadlineAt: Date.now() + MAX_TRANSACTION_CHAIN_PARSE_TIME_MS
  };

  const apiMethodBody = resolveMethodBodyFromClass(selectedApiImpl, apiMethod);
  if (!apiMethodBody) {
    chain.unresolvedReason = `在 ${selectedApiImpl.className} 中未找到方法 ${apiMethod}`;
    return chain;
  }

  const apiLocalFields = extractLocalTraceableFields(apiMethodBody);
  const apiAvailableFields: Record<string, JavaFieldMeta> = {
    ...selectedApiImpl.fields,
    ...apiLocalFields
  };
  const apiMethodCalls = extractFieldMethodCalls(apiMethodBody, apiAvailableFields);
  const domainDispatchCalls = apiMethodCalls.filter(call => isDispatchMethod(call.methodName));
  let directApiDetails: TransactionChainCall[] = [];
  if (domainDispatchCalls.length === 0) {
    directApiDetails = buildTransactionCallDetails(
      selectedApiImpl,
      apiMethodBody,
      context,
      0,
      new Set([`${selectedApiImpl.path}#${apiMethod}`]),
      traversalState,
      maxDepth,
      [],
      apiMethod
    );
  }

  domainDispatchCalls.forEach(call => {
    const field = apiAvailableFields[call.fieldName];
    if (!field) return;

    const beanName = field.qualifier || call.fieldName;
    const domainCandidates = dedupeClasses([
      ...(serviceBeanMap[beanName] || []),
      ...resolveClassCandidatesForField(field, context)
    ]);
    const selectedDomain = selectBestClassCandidate(domainCandidates, serviceName, serviceHints);

    const domainChain: DomainServiceCallChain = {
      beanName,
      className: selectedDomain?.className,
      classPath: selectedDomain?.path,
      transactionCalls: []
    };

    if (!selectedDomain) {
      chain.domainServices.push(domainChain);
      return;
    }

    const domainEntryMethod = uniqueStrings([call.methodName, 'query', 'execute', 'doexecute', 'doExecute']).find(
      method => Boolean(resolveMethodBodyFromClass(selectedDomain, method))
    );
    if (!domainEntryMethod) {
      const skipMethodRegex = /^(get|set|is|toString|hashCode|equals|clone|wait|notify|notifyAll)$/i;
      const scoreFallbackMethod = (methodName: string): number => {
        const lower = methodName.toLowerCase();
        let score = 0;
        if (lower === call.methodName.toLowerCase()) score += 40;
        if (lower.includes('query') || lower.includes('qry')) score += 8;
        if (lower.includes('transfer') || lower.includes('trans')) score += 8;
        if (lower.includes('submit') || lower.includes('check') || lower.includes('cancel')) score += 7;
        if (lower.includes('process') || lower.includes('execute') || lower.includes('do')) score += 6;
        if (skipMethodRegex.test(methodName)) score -= 20;
        return score;
      };

      const fallbackMethods = [...resolveDeclaredMethodNames(selectedDomain)]
        .filter(methodName => !skipMethodRegex.test(methodName))
        .sort((left, right) => scoreFallbackMethod(right) - scoreFallbackMethod(left))
        .slice(0, MAX_DOMAIN_FALLBACK_METHODS);

      // Keep root expansion fast: expose most likely entry methods as lazy-expand nodes
      // instead of parsing all fallback methods eagerly.
      if (fallbackMethods.length > 0) {
        domainChain.transactionCalls = fallbackMethods.map((fallbackMethod, index) => ({
          type: 'local-service',
          call: `${toBeanLikeName(selectedDomain.className)}.${fallbackMethod}`,
          description: resolveDescriptionFromCandidates([selectedDomain], fallbackMethod),
          nestLevel: 0,
          pathKey: `fallback:${index}`,
          expandToken: {
            ownerClassPath: selectedDomain.path,
            ownerMethod: fallbackMethod,
            depth: 1,
            pathStack: [`fallback:${fallbackMethod}`],
            visitedMethodKeys: uniqueStrings([`${selectedDomain.path}#${fallbackMethod}`]),
            serviceName: context.serviceName
          }
        }));
      }
      chain.domainServices.push(domainChain);
      return;
    }
    const domainBody = resolveMethodBodyFromClass(selectedDomain, domainEntryMethod);
    if (!domainBody) {
      chain.domainServices.push(domainChain);
      return;
    }
    const domainVisited = new Set<string>([
      `${selectedDomain.path}#${domainEntryMethod || call.methodName}`
    ]);

    domainChain.transactionCalls = buildTransactionCallDetails(
      selectedDomain,
      domainBody,
      context,
      0,
      domainVisited,
      traversalState,
      maxDepth,
      [],
      domainEntryMethod
    );
    chain.domainServices.push(domainChain);
  });

  if (directApiDetails.length > 0) {
    chain.domainServices.push({
      beanName: apiMethod,
      className: selectedApiImpl.className,
      classPath: selectedApiImpl.path,
      transactionCalls: directApiDetails
    });
  }

  if (chain.domainServices.length === 0) {
    directApiDetails = buildTransactionCallDetails(
      selectedApiImpl,
      apiMethodBody,
      context,
      0,
      new Set([`${selectedApiImpl.path}#${apiMethod}`]),
      traversalState,
      maxDepth,
      [],
      apiMethod
    );
    if (directApiDetails.length > 0) {
      chain.domainServices.push({
        beanName: apiMethod,
        className: selectedApiImpl.className,
        classPath: selectedApiImpl.path,
        transactionCalls: directApiDetails
      });
    }
  }

  if (chain.domainServices.length === 0) {
    chain.unresolvedReason = '未在接口实现方法中解析到可跟踪的下游链路';
  }

  if (traversalState.truncated) {
    const truncateMessage = `链路规模过大，已按性能阈值截断（最多 ${MAX_TRANSACTION_CHAIN_TOTAL_CALLS} 个调用节点）`;
    chain.unresolvedReason = chain.unresolvedReason
      ? `${chain.unresolvedReason}; ${truncateMessage}`
      : truncateMessage;
  }

  return chain;
};

export const clearMiddleProjectChainParserCache = () => {
  javaClassMetaCache.clear();
  javaMethodBodyCache.clear();
  javaDeclaredMethodNamesCache.clear();
};

export const resolveDownstreamChainsFromMiddleProject = (
  middleFiles: FileEntry[],
  downstreamCalls: string[]
): Record<string, DownstreamCallChain> => {
  const resolver = createMiddleProjectChainResolver(middleFiles);
  return resolver.resolveMany(downstreamCalls);
};

export const createMiddleProjectChainResolver = (
  middleFiles: FileEntry[]
): MiddleProjectChainResolver => {
  const classMap: Record<string, JavaClassMeta[]> = {};
  const serviceBeanMap: Record<string, JavaClassMeta[]> = {};
  const allClasses: JavaClassMeta[] = [];

  middleFiles.forEach(file => {
    if (!file.name.toLowerCase().endsWith('.java')) return;

    const classMeta = resolveJavaClassMeta(file);
    if (!classMeta) return;

    if (!classMap[classMeta.className]) classMap[classMeta.className] = [];
    classMap[classMeta.className].push(classMeta);

    classMeta.serviceBeanNames.forEach(beanName => {
      if (!serviceBeanMap[beanName]) serviceBeanMap[beanName] = [];
      serviceBeanMap[beanName].push(classMeta);
    });

    allClasses.push(classMeta);
  });

  const springHints = parseSpringApplicationHints(middleFiles);
  const resolverParamMap = parseResolverParamMap(middleFiles);
  const resolverDescriptionMap = parseResolverDescriptionMap(middleFiles);
  const classByPath = new Map<string, JavaClassMeta>();
  allClasses.forEach(meta => {
    classByPath.set(meta.path, meta);
  });

  const resolveOne = (
    downstreamCall: string,
    options?: ResolveDownstreamChainOptions
  ): DownstreamCallChain => {
    const normalizedCall = downstreamCall.trim();
    return resolveSingleDownstreamChain(
      normalizedCall,
      classMap,
      serviceBeanMap,
      allClasses,
      springHints,
      resolverParamMap,
      resolverDescriptionMap,
      options
    );
  };

  const resolveMany = (
    downstreamCalls: string[],
    options?: ResolveDownstreamChainOptions
  ): Record<string, DownstreamCallChain> => {
    const chainMap: Record<string, DownstreamCallChain> = {};
    const uniqueCalls = uniqueStrings(downstreamCalls.map(item => item.trim()));
    uniqueCalls.forEach(call => {
      chainMap[call] = resolveOne(call, options);
    });
    return chainMap;
  };

  const resolveCallLayer = (token: TransactionCallExpandToken): TransactionChainCall[] => {
    const ownerClass = classByPath.get(normalizePath(token.ownerClassPath));
    if (!ownerClass) return [];
    const methodBody = resolveMethodBodyFromClass(ownerClass, token.ownerMethod);
    if (!methodBody) return [];

    const serviceName = token.serviceName || '';
    const serviceHints = springHints[serviceName.toLowerCase()] || [];
    const context: ResolveContext = {
      classMap,
      serviceBeanMap,
      allClasses,
      serviceName,
      serviceHints,
      resolverParamMap,
      resolverDescriptionMap
    };
    const traversalState: TransactionTraversalState = {
      remainingCalls: MAX_TRANSACTION_CHAIN_TOTAL_CALLS,
      truncated: false,
      deadlineAt: Date.now() + MAX_TRANSACTION_CHAIN_PARSE_TIME_MS
    };
    const depth = Math.max(0, token.depth);
    const visited = new Set(token.visitedMethodKeys || []);
    return buildTransactionCallDetails(
      ownerClass,
      methodBody,
      context,
      depth,
      visited,
      traversalState,
      depth,
      token.pathStack || [],
      token.ownerMethod
    );
  };

  return {
    resolveOne,
    resolveMany,
    resolveCallLayer
  };
};

// Helper for case-insensitive tag search
const getElementsByTagNameCI = (parent: Document | Element, tagName: string): Element[] => {
    const result: Element[] = [];
    const lowerTagName = tagName.toLowerCase();
    const all = parent.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        if (all[i].tagName.toLowerCase() === lowerTagName) {
            result.push(all[i]);
        }
    }
    return result;
};

// --- Main Parser Function ---
export const parseProjectFiles = (files: FileEntry[]): XmlTransaction[] => {
  const transactions: XmlTransaction[] = [];
  const javaMap: Record<string, string[]> = {}; 
  const javaAuthorMap: Record<string, string> = {}; // 新增：存储类名到作者的映射
  const propertiesMap: Record<string, string> = {}; 
  
  files.forEach(file => {
    const lowerName = file.name.toLowerCase();
    
    if (lowerName.endsWith('.java')) {
      // Improved regex to capture class name even if not public or abstract
      const classMatch = file.content.match(/(?:public|protected|private|abstract|static|\s)*class\s+(\w+)/);
      if (classMatch) {
        const className = classMatch[1];
        const calls = extractJavaDownstreamCalls(file.content);
        javaMap[className] = calls;
        
        // 提取 @author 注解
        const authorMatch = file.content.match(/@author\s+([^\n\r]+)/);
        if (authorMatch) {
          javaAuthorMap[className] = authorMatch[1].trim();
        }
      }
    } else if (lowerName.endsWith('.properties')) {
      const lines = file.content.split('\n');
      lines.forEach(line => {
        if (line.trim().startsWith('#')) return;
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim(); 
            if (val.includes('.') && !val.includes(':') && !val.includes('\\u')) {
                propertiesMap[key] = val;
            }
        }
      });
    }
  });

  const parser = new DOMParser();
  
  files.forEach(file => {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.xml')) return;

    try {
        let xmlDoc = parser.parseFromString(file.content, "text/xml");
        
        // Check for parsing errors
        if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
            // Retry strategy: Wrap in a dummy root element
            // This handles files that are lists of transactions without a single root
            // Also strip XML declaration if present to avoid "xml declaration not at start" error
            const contentWithoutDecl = file.content.replace(/<\?xml[^>]*\?>/gi, '');
            const wrappedContent = `<root>${contentWithoutDecl}</root>`;
            
            const retryDoc = parser.parseFromString(wrappedContent, "text/xml");
            
            if (retryDoc.getElementsByTagName("parsererror").length === 0) {
                xmlDoc = retryDoc;
            } else {
                console.warn(`Skipping invalid XML file: ${file.name}`);
                return;
            }
        }
        
        const localActionMap: Record<string, string> = {}; 
        const actionNodes = getElementsByTagNameCI(xmlDoc, "action");
        for (let i = 0; i < actionNodes.length; i++) {
          const name = actionNodes[i].getAttribute("name");
          const clazz = actionNodes[i].getAttribute("class");
          if (name && clazz) {
            localActionMap[name] = clazz;
          }
        }

        const transNodes = getElementsByTagNameCI(xmlDoc, "transaction");

        for (let i = 0; i < transNodes.length; i++) {
          const node = transNodes[i];
          const id = node.getAttribute("id") || "";
          
          // Skip if no ID
          if (!id) continue;

          const template = node.getAttribute("template") || "";
          const trsName = node.getAttribute("description") || "";
          
          const actionsNodes = getElementsByTagNameCI(node, "actions");
          const actionRefs = actionsNodes.length > 0 ? getElementsByTagNameCI(actionsNodes[0], "ref") : [];
          const actionRef = actionRefs.length > 0 ? actionRefs[0].textContent || "" : "";
          
          let fullClassPath = localActionMap[actionRef] || "";
          if (!fullClassPath) {
            fullClassPath = actionRef;
          }
          
          const simpleClassName = fullClassPath.split('.').pop() || "";
          
          const inputNodes = getElementsByTagNameCI(node, "input");
          const inputNode = inputNodes[0];
          const inputs = inputNode ? parseChildren(inputNode) : [];

          const outputNodes = getElementsByTagNameCI(node, "output");
          const outputNode = outputNodes[0];
          const outputs = outputNode ? parseChildren(outputNode) : [];

          // Use the file path (relative path) to determine module
          const moduleName = getModuleName(file.path);

          const downstreamCalls: Set<string> = new Set();
          if (propertiesMap[id]) downstreamCalls.add(propertiesMap[id]);
          if (propertiesMap[actionRef]) downstreamCalls.add(propertiesMap[actionRef]);
          
          if (simpleClassName && javaMap[simpleClassName]) {
            javaMap[simpleClassName].forEach(call => downstreamCalls.add(call));
          }

          // 从 Java 文件中获取作者信息
          const author = simpleClassName ? javaAuthorMap[simpleClassName] : undefined;

          transactions.push({
            id,
            module: moduleName,
            filePath: normalizePath(file.path), // Ensure path is normalized for display
            template,
            trsName,
            actionRef,
            actionClass: fullClassPath,
            author,
            inputs,
            outputs,
            downstreamCalls: Array.from(downstreamCalls)
          });
        }
    } catch (err) {
        console.error(`Error parsing XML file ${file.name}:`, err);
    }
  });

  // Sort transactions for consistency: Module first, then ID
  transactions.sort((a, b) => {
    if (a.module !== b.module) {
      return a.module.localeCompare(b.module);
    }
    return a.id.localeCompare(b.id);
  });

  return transactions;
};

// --- XML Generator Helpers ---

const buildInputFields = (fields: XmlField[], indent: number): string => {
  const spaces = ' '.repeat(indent);
  return fields.map(field => {
    // Treat 'array' or 'object' types as field-list in Input context
    const isContainer = field.type === 'array' || field.type === 'object' || field.type === 'field-list';
    
    if (isContainer) {
      return `${spaces}<field-list name="${field.name}" description="${field.description || ''}">\n` +
             `${spaces}    <fields>\n` +
             buildInputFields(field.children || [], indent + 8) +
             `${spaces}    </fields>\n` +
             `${spaces}</field-list>\n`;
    } else {
      // Standard field
      const style = field.style ? field.style : '';
      return `${spaces}<field name="${field.name}" description="${field.description || ''}">${style}</field>\n`;
    }
  }).join('');
};

const buildOutputFields = (fields: XmlField[], indent: number): string => {
  const spaces = ' '.repeat(indent);
  return fields.map(field => {
    // Treat 'array' as array->object->[fields] in Output context
    const isArray = field.type === 'array';
    
    if (isArray) {
      return `${spaces}<array name="${field.name}" description="${field.description || ''}" skipNull="true">\n` +
             `${spaces}    <object>\n` +
             buildOutputFields(field.children || [], indent + 8) +
             `${spaces}    </object>\n` +
             `${spaces}</array>\n`;
    } else {
      // Leaf nodes in output usually represented as <string> or similar primitive tags
      return `${spaces}<string name="${field.name}" description="${field.description || ''}"/>\n`;
    }
  }).join('');
};

// --- Main Generation Functions ---

export const generateXml = (t: XmlTransaction): string => {
  return `<transaction id="${t.id}" template="${t.template || 'trsConfirmTemplate'}" description="${t.trsName}">\n` +
         `    <actions>\n` +
         `        <ref>${t.actionRef || ''}</ref>\n` +
         `    </actions>\n` +
         `    <input>\n` +
         buildInputFields(t.inputs, 8) +
         `    </input>\n` +
         `    <output>\n` +
         buildOutputFields(t.outputs, 8) +
         `    </output>\n` +
         `    <view>jsonExtView</view>\n` +
         `</transaction>`;
};

export const generateJava = (t: XmlTransaction, author: string = 'admin'): string => {
  // Extract class name from ID (capitalize first letter, keep rest)
  // e.g., "userQuery" -> "UserQuery", then add "Action" -> "UserQueryAction"
  const baseClassName = t.id 
    ? t.id.charAt(0).toUpperCase() + t.id.slice(1).replace(/([A-Z])/g, (match) => match)
    : 'EntAPQuotaQry';
  const className = `${baseClassName}Action`;
  const description = t.trsName || t.id || '交易描述';
  
  // Extract Request/Response class names based on baseClassName
  const requestClass = `${baseClassName}Request`;
  const responseClass = `${baseClassName}Response`;
  
  return `/**\n` +
         `\n` +
         ` * ${description}\n` +
         ` *\n` +
         ` * @author ${author}\n` +
         ` */\n` +
         `@Slf4j\n` +
         `@Service\n` +
         `@Description("${className}")\n` +
         `public class ${className} extends AbstractExecutableAction {\n` +
         `\n` +
         `    @Autowired\n` +
         `    private EcssSendService ecssSendService;\n` +
         `\n` +
         `    @Override\n` +
         `    public void doexecute(Context context) throws PsException {\n` +
         `        EntUser entUser = (EntUser) context.getUser();\n` +
         `        context.setData("cifNo", entUser.getCifNo());\n` +
         `        context.setDataMap(BeanMapUtils.beanToMap(ecssSendService.send(context, context.getDataMap(),\n` +
         `                ${requestClass}.class, ${responseClass}.class)));\n` +
         `    }\n` +
         `\n` +
         `}`;
};
