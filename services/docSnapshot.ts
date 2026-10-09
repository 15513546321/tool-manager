/**
 * 接口文档快照（Snapshot）—— 把「网银接口清单 + 中台源码 + 已解析链路」打包成一个 JSON 文件，
 * 之后直接导入即可渲染，无需重新上传工程、无需重新解析。
 *
 * 两种形态：
 *  - full  ：包含中台源码全文，导入后可继续解析新的下游链路（体积大）
 *  - light ：只含接口清单与已解析链路，导入后可立即看图，但不能再展开未解析过的链路（体积小）
 */

import { XmlTransaction, DownstreamCallChain } from '../types';
import { FileEntry } from './xmlParser';

export const SNAPSHOT_FORMAT = 'tool-manager-doc-snapshot';
export const SNAPSHOT_VERSION = 1;

export type SnapshotKind = 'full' | 'light';

export interface SnapshotBankSection {
  projectName: string;
  sourceMode: 'local' | 'online';
  repoUrl: string;
  branch: string;
  transactionCount: number;
  /** 不含 downstreamChains（运行时由 chains 重新 enrich） */
  transactions: XmlTransaction[];
}

export interface SnapshotMiddleSection {
  projectName: string;
  entryCount: number;
  /** 中台源码文件路径清单，轻量包也保留，便于提示"源码未包含" */
  filePaths: string[];
  /** 仅完整包携带 */
  entries?: FileEntry[];
}

export interface DocSnapshot {
  format: string;
  version: number;
  kind: SnapshotKind;
  createdAt: number;
  bank: SnapshotBankSection;
  middle: SnapshotMiddleSection;
  chains: Record<string, DownstreamCallChain>;
}

export interface BuildSnapshotInput {
  kind: SnapshotKind;
  transactions: XmlTransaction[];
  chainMap: Record<string, DownstreamCallChain>;
  middleProjectName: string;
  middleEntries: FileEntry[];
  bankProjectName?: string;
  sourceMode: 'local' | 'online';
  repoUrl?: string;
  branch?: string;
  /** 默认 true。设为 false 会剔掉接口的 inputs/outputs 字段树，体积显著减小但导入后看不了字段详情 */
  includeFieldDetails?: boolean;
}

/** downstreamChains 是运行时推导结果，入库前剥掉，避免快照体积翻倍且与 chains 不一致 */
const stripRuntimeChains = (
  transaction: XmlTransaction,
  includeFieldDetails: boolean
): XmlTransaction => {
  const cloned: XmlTransaction = {
    id: transaction.id,
    module: transaction.module,
    filePath: transaction.filePath,
    template: transaction.template,
    trsName: transaction.trsName,
    actionRef: transaction.actionRef,
    actionClass: transaction.actionClass,
    author: transaction.author,
    inputs: includeFieldDetails ? transaction.inputs || [] : [],
    outputs: includeFieldDetails ? transaction.outputs || [] : [],
    downstreamCalls: transaction.downstreamCalls || []
  };
  return cloned;
};

export const buildSnapshot = (input: BuildSnapshotInput): DocSnapshot => {
  const includeFieldDetails = input.includeFieldDetails !== false;
  const transactions = (input.transactions || []).map(item =>
    stripRuntimeChains(item, includeFieldDetails)
  );
  const entries = input.middleEntries || [];

  return {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    kind: input.kind,
    createdAt: Date.now(),
    bank: {
      projectName: input.bankProjectName || '',
      sourceMode: input.sourceMode === 'online' ? 'online' : 'local',
      repoUrl: input.repoUrl || '',
      branch: input.branch || '',
      transactionCount: transactions.length,
      transactions
    },
    middle: {
      projectName: input.middleProjectName || '',
      entryCount: entries.length,
      filePaths: entries.map(entry => entry.path),
      entries: input.kind === 'full' ? entries : undefined
    },
    chains: input.chainMap || {}
  };
};

export class SnapshotParseError extends Error {}

export const parseSnapshot = (raw: string): DocSnapshot => {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new SnapshotParseError('文件不是合法的 JSON，可能已损坏');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new SnapshotParseError('快照内容为空或格式不正确');
  }
  if (parsed.format !== SNAPSHOT_FORMAT) {
    throw new SnapshotParseError(`不是接口文档快照文件（format=${parsed.format || '未知'}）`);
  }
  if (typeof parsed.version !== 'number' || parsed.version > SNAPSHOT_VERSION) {
    throw new SnapshotParseError(`快照版本不兼容（version=${parsed.version}，当前支持 ≤${SNAPSHOT_VERSION}）`);
  }
  if (!parsed.bank || !Array.isArray(parsed.bank.transactions)) {
    throw new SnapshotParseError('快照缺少网银接口清单（bank.transactions）');
  }

  const kind: SnapshotKind = parsed.kind === 'full' ? 'full' : 'light';
  const entries = kind === 'full' && Array.isArray(parsed.middle?.entries) ? parsed.middle.entries : [];

  return {
    format: SNAPSHOT_FORMAT,
    version: parsed.version,
    kind,
    createdAt: parsed.createdAt || 0,
    bank: {
      projectName: parsed.bank.projectName || '',
      sourceMode: parsed.bank.sourceMode === 'online' ? 'online' : 'local',
      repoUrl: parsed.bank.repoUrl || '',
      branch: parsed.bank.branch || '',
      transactionCount: parsed.bank.transactions.length,
      transactions: parsed.bank.transactions as XmlTransaction[]
    },
    middle: {
      projectName: parsed.middle?.projectName || '',
      entryCount: entries.length || parsed.middle?.entryCount || 0,
      filePaths: Array.isArray(parsed.middle?.filePaths) ? parsed.middle.filePaths : [],
      entries: kind === 'full' ? (entries as FileEntry[]) : undefined
    },
    chains: (parsed.chains && typeof parsed.chains === 'object' ? parsed.chains : {}) as Record<string, DownstreamCallChain>
  };
};

export const countUniqueDownstreamCalls = (transactions: XmlTransaction[]): number => {
  const unique = new Set<string>();
  transactions.forEach(item => {
    (item.downstreamCalls || []).forEach(call => {
      const normalized = (call || '').trim();
      if (normalized) unique.add(normalized);
    });
  });
  return unique.size;
};

export interface SnapshotSizeBreakdown {
  bankBytes: number;
  middleBytes: number;
  chainsBytes: number;
  totalBytes: number;
}

/** 分别序列化三段来统计体积构成，让用户知道"大在哪" */
export const measureSnapshotSize = (snapshot: DocSnapshot): SnapshotSizeBreakdown => {
  const byteLength = (value: unknown): number => {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch (err) {
      return 0;
    }
  };
  const bankBytes = byteLength(snapshot.bank);
  const middleBytes = byteLength(snapshot.middle);
  const chainsBytes = byteLength(snapshot.chains);
  return {
    bankBytes,
    middleBytes,
    chainsBytes,
    totalBytes: bankBytes + middleBytes + chainsBytes
  };
};

export const formatBytes = (bytes: number): string => {
  if (!bytes || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const pad = (value: number): string => String(value).padStart(2, '0');

export const buildSnapshotFileName = (projectName: string, kind: SnapshotKind): string => {
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const safeProject = (projectName || '接口文档').replace(/[\\/:*?"<>|]/g, '_').trim() || '接口文档';
  return `${safeProject}_${kind === 'full' ? '完整' : '轻量'}快照_${stamp}.json`;
};

export const downloadSnapshot = (snapshot: DocSnapshot, fileName: string, serialized?: string): void => {
  const payload = serialized ?? JSON.stringify(snapshot);
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const formatSnapshotTime = (timestamp: number): string => {
  if (!timestamp) return '未知';
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
