
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
