export type DiagnosticLevel = 'info' | 'warning' | 'error';

export interface AnalysisDiagnostic {
  id: string;
  level: DiagnosticLevel;
  code: string;
  message: string;
  filePath?: string;
  relatedPath?: string;
  sourceLine?: number;
}

export interface FileIndexStats {
  totalSelected: number;
  indexed: number;
  apiFiles: number;
  configFiles?: number;
  routeFiles: number;
  vueFiles: number;
  skipped: number;
}

export interface IndexedProject {
  rootName: string;
  sourceFingerprint: string;
  files: Map<string, File>;
  stats: FileIndexStats;
}

export interface ApiDefinition {
  modulePath: string;
  methodName: string;
  chineseName: string;
  httpMethod: string;
  endpoint: string;
  transportMethod?: string;
  endpoints?: ApiEndpointTarget[];
  sourceLine: number;
}

export interface ApiEndpointTarget {
  endpoint: string;
  httpMethod: string;
  transportMethod: string;
  chineseName: string;
  configPath?: string;
  configLine?: number;
}

export interface ConfigEndpointDefinition {
  endpoint: string;
  chineseName: string;
  sourcePath: string;
  sourceLine: number;
}

export interface ConfigEndpointCatalog {
  byEndpoint: Map<string, ConfigEndpointDefinition>;
  byMethodName: Map<string, ConfigEndpointDefinition[]>;
}

export interface ApiModuleDefinition {
  modulePath: string;
  methods: Map<string, ApiDefinition>;
}

export interface ApiReference extends ApiDefinition {
  importAlias: string;
  callLine: number;
}

export interface RouteRoot {
  id: string;
  routePath: string;
  routeName: string;
  title: string;
  componentPath: string;
  routerFile: string;
  sourceLine: number;
}

export interface VueImportDefinition {
  localName: string;
  source: string;
  componentPath: string;
  sourceLine: number;
}

export interface VueApiCall {
  alias: string;
  methodName: string;
  sourceLine: number;
}

export interface ParsedVue {
  componentPath: string;
  fileName: string;
  componentName: string;
  apiImports: Record<string, string>;
  vueImports: VueImportDefinition[];
  apiCalls: VueApiCall[];
  diagnostics: AnalysisDiagnostic[];
  parseFailed: boolean;
}

export type VueNodeStatus = 'ok' | 'empty' | 'parse-error' | 'cycle';

export interface VueTreeNode {
  id: string;
  componentPath: string;
  fileName: string;
  componentName: string;
  isRouteRoot: boolean;
  routeTitle?: string;
  routePath?: string;
  routerFile?: string;
  directApis: ApiReference[];
  apiImports: Array<{ alias: string; modulePath: string }>;
  vueImports: VueImportDefinition[];
  children: VueTreeNode[];
  diagnostics: AnalysisDiagnostic[];
  status: VueNodeStatus;
}

export interface AnalysisSummary {
  files: FileIndexStats;
  apiDefinitions: number;
  configEndpoints?: number;
  routeRoots: number;
  parsedVueFiles: number;
}

export interface AnalysisProgress {
  phase: 'index' | 'config' | 'api' | 'route' | 'tree' | 'snapshot';
  label: string;
  completed: number;
  total: number;
  percent: number;
}

export interface PersistedVueNode {
  componentPath: string;
  fileName: string;
  componentName: string;
  directApis: ApiReference[];
  apiImports: Array<{ alias: string; modulePath: string }>;
  vueImports: VueImportDefinition[];
  diagnostics: AnalysisDiagnostic[];
  status: Exclude<VueNodeStatus, 'cycle'>;
}

export interface Eibs3gAnalysisSnapshot {
  schemaVersion: 1;
  rootName: string;
  sourceFingerprint: string;
  analyzedAt: string;
  summary: AnalysisSummary;
  routeRoots: RouteRoot[];
  componentsByPath: Record<string, PersistedVueNode>;
  diagnostics: AnalysisDiagnostic[];
}

export interface Eibs3gAnalysisSnapshotRecord {
  id: number;
  savedBy: string;
  savedAt: string;
  snapshot: Eibs3gAnalysisSnapshot;
}

export interface InitializeAnalysisRequest {
  type: 'initialize';
  requestId: string;
  files: File[];
}

export interface BuildTreeRequest {
  type: 'build-tree';
  requestId: string;
  routeRootId: string;
}

export interface ResetAnalysisRequest {
  type: 'reset';
}

export type AnalysisWorkerRequest =
  | InitializeAnalysisRequest
  | BuildTreeRequest
  | ResetAnalysisRequest;

export interface ProgressWorkerResponse {
  type: 'progress';
  requestId: string;
  progress: AnalysisProgress;
}

export interface ReadyWorkerResponse {
  type: 'ready';
  requestId: string;
  rootName: string;
  routeRoots: RouteRoot[];
  summary: AnalysisSummary;
  diagnostics: AnalysisDiagnostic[];
  snapshot: Eibs3gAnalysisSnapshot;
}

export interface TreeWorkerResponse {
  type: 'tree';
  requestId: string;
  routeRootId: string;
  tree: VueTreeNode;
  summary: AnalysisSummary;
  diagnostics: AnalysisDiagnostic[];
}

export interface ErrorWorkerResponse {
  type: 'error';
  requestId: string;
  message: string;
  diagnostics: AnalysisDiagnostic[];
}

export type AnalysisWorkerResponse =
  | ProgressWorkerResponse
  | ReadyWorkerResponse
  | TreeWorkerResponse
  | ErrorWorkerResponse;
