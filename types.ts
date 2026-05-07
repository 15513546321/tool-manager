
export interface User {
  username: string;
  role: 'ADMIN' | 'USER';
  token: string;
}

export interface MenuItem {
  id: string;
  name: string;
  path: string;
  icon?: string;
  children?: MenuItem[];
  visible?: boolean; // Controls menu visibility (Online/Offline)
  sortOrder?: number; // Sort order for menu items
}

// XML Interface Models
export interface XmlField {
  name: string;
  type: string; // 'field' | 'string' | 'array' | 'object' | 'date' etc.
  description: string;
  style?: string; // e.g. "NotNullStyle", content of <field>
  pattern?: string; // e.g. for dates
  children?: XmlField[]; // For nested structures like arrays/objects
}

export interface XmlTransaction {
  id: string;
  module: string; // Filename / Business Module
  filePath: string; // Full relative path
  template: string;
  trsName: string; // Description attribute of transaction
  actionRef: string; // The bean name
  actionClass: string; // The fully qualified Java class
  author?: string; // Author of the interface (corresponds to Java class @author)
  inputs: XmlField[];
  outputs: XmlField[];
  downstreamCalls: string[]; // List of called interfaces found in Java or properties
  downstreamChains?: DownstreamCallChain[]; // Enriched chain details from middle-platform project
}

export interface DomainServiceCallChain {
  beanName: string; // e.g. trsAcctInfoBalanceQry
  className?: string; // e.g. TrsAcctInfoBalanceQry
  classPath?: string; // Source file path
  transactionCalls: TransactionChainCall[]; // Expanded transaction chain items
}

export interface TransactionCallExpandToken {
  ownerClassPath: string;
  ownerMethod: string;
  depth: number;
  pathStack: string[];
  visitedMethodKeys: string[];
  serviceName: string;
}

export interface TransactionChainCall {
  type: 'local-service' | 'rpc-service' | 'database' | 'downstream';
  call: string;
  description?: string; // @ApiOperation description
  tableName?: string; // Derived from *Mapper type
  downstreamInterfaceCode?: string; // Resolver interface code for router SERVICE_CODE
  nestLevel?: number; // 0: direct call, >0: nested call level
  pathKey?: string; // Internal path signature to avoid over-dedup across different branches
  expandToken?: TransactionCallExpandToken; // Lazy-load token for next layer expansion
}

export interface DownstreamCallChain {
  downstreamCall: string; // e.g. payment.apiTrdAcctInfoService.balanceQry
  serviceName: string; // e.g. payment
  apiServiceBean: string; // e.g. apiTrdAcctInfoService
  apiMethod: string; // e.g. balanceQry
  apiDescription?: string; // Chinese description from @ApiOperation
  apiInterfaceClass?: string; // e.g. ApiTrdAcctInfoService
  apiImplClass?: string; // e.g. ApiTrdAcctInfoServiceImpl
  apiImplPath?: string; // Source file path
  domainServices: DomainServiceCallChain[];
  unresolvedReason?: string; // Reason when call cannot be fully resolved
}

export interface ParameterConfig {
  id: string;
  category: string;
  subCategory: string;
  key: string;
  value: string;
  description: string;
}

export interface DocVersion {
  id: string;
  versionNumber: string;
  fileName: string;
  fileContent: string; // content or base64
  updatedBy: string;
  updatedAt: string;
  size: string;
}

export interface DocItem {
  id: string;
  title: string;
  category: string; // Big Class
  subCategory: string; // Small Class
  description?: string;
  versions: DocVersion[];
}

export interface SuggestionItem {
  id: string;
  title: string;
  description: string;
  ip: string;
  timestamp: string;
}

export interface MockPacketConfig {
  host: string;
  port: string;
  serviceName: string;
  username: string;
  password: string;
}

export interface MockPacketTransactionType {
  transCode: string;
  prdName: string;
}

export interface MockPacketPayload {
  transCode: string;
  prdName: string;
  payloadRaw: string;
  payloadPretty: string;
  fallback: boolean;
  sourceLabel: string;
  note: string;
  matchedRows: number;
}

export interface MockPacketTransactionTypesResponse {
  success: boolean;
  usingFallback: boolean;
  message: string;
  resolvedConfig: MockPacketConfig;
  transactionTypes: MockPacketTransactionType[];
}

export interface MockPacketGenerateResponse {
  success: boolean;
  usingFallback: boolean;
  message: string;
  packets: MockPacketPayload[];
}

// Gitee Types
export interface GiteeConfig {
  repoUrl: string;
  authType: 'ssh' | 'token'; // 'ssh' or 'token' (https)
  accessToken?: string;      // For HTTPS/Token
  username?: string;         // For HTTPS
  privateKey?: string;       // For SSH
  publicKey?: string;        // For SSH (Optional display/storage)
}

export interface GiteeBranch {
  name: string;
  lastCommitHash: string;
  lastUpdated: string;
}

export interface GiteeCommit {
  id: string;
  shortId: string;
  message: string;
  author: string;
  date: string;
  filesChanged: number;
}
