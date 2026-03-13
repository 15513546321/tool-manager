import { clearMiddleProjectChainParserCache, createMiddleProjectChainResolver } from '../services/xmlParser';
import type { FileEntry } from '../services/xmlParser';
import type { DownstreamCallChain, TransactionCallExpandToken, TransactionChainCall } from '../types';

interface ResolveDownstreamRequestMessage {
  type: 'resolve-downstream';
  requestId: string;
  serviceKey: string;
  downstreamCall: string;
  maxDepth?: number;
  entries?: FileEntry[];
}

interface ResolveNodeLayerRequestMessage {
  type: 'resolve-node-layer';
  requestId: string;
  serviceKey: string;
  expandToken: TransactionCallExpandToken;
  entries?: FileEntry[];
}

interface ResetRequestMessage {
  type: 'reset-cache';
}

type WorkerRequest = ResolveDownstreamRequestMessage | ResolveNodeLayerRequestMessage | ResetRequestMessage;

interface ProgressResponseMessage {
  type: 'progress';
  requestId: string;
  progress: number;
}

interface DownstreamResultResponseMessage {
  type: 'result-downstream';
  requestId: string;
  chain: DownstreamCallChain;
}

interface NodeLayerResultResponseMessage {
  type: 'result-node-layer';
  requestId: string;
  children: TransactionChainCall[];
}

interface ErrorResponseMessage {
  type: 'error';
  requestId: string;
  message: string;
}

type WorkerResponse =
  | ProgressResponseMessage
  | DownstreamResultResponseMessage
  | NodeLayerResultResponseMessage
  | ErrorResponseMessage;

interface ResolverLike {
  resolveOne: (downstreamCall: string, options?: { maxDepth?: number }) => DownstreamCallChain;
  resolveCallLayer: (token: TransactionCallExpandToken) => TransactionChainCall[];
}

const resolverCache: Record<string, ResolverLike> = {};
const workerScope: any = self;

const postMessageToMain = (message: WorkerResponse) => {
  workerScope.postMessage(message);
};

const clearResolverCache = () => {
  Object.keys(resolverCache).forEach(key => {
    delete resolverCache[key];
  });
  clearMiddleProjectChainParserCache();
};

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (!message || !('type' in message)) return;

  if (message.type === 'reset-cache') {
    clearResolverCache();
    return;
  }

  const { requestId, serviceKey, entries } = message;
  const postProgress = (progress: number) => {
    postMessageToMain({
      type: 'progress',
      requestId,
      progress
    });
  };

  try {
    if (!resolverCache[serviceKey]) {
      if (!entries || entries.length === 0) {
        throw new Error(`service ${serviceKey} has no entries`);
      }
      postProgress(84);
      resolverCache[serviceKey] = createMiddleProjectChainResolver(entries);
      postProgress(92);
    }

    postProgress(96);
    if (message.type === 'resolve-downstream') {
      const chain = resolverCache[serviceKey].resolveOne(message.downstreamCall, {
        maxDepth: message.maxDepth
      });
      postMessageToMain({
        type: 'result-downstream',
        requestId,
        chain
      });
      return;
    }

    const children = resolverCache[serviceKey].resolveCallLayer(message.expandToken);
    postMessageToMain({
      type: 'result-node-layer',
      requestId,
      children
    });
  } catch (err) {
    postMessageToMain({
      type: 'error',
      requestId,
      message: err instanceof Error ? err.message : 'unknown worker error'
    });
  }
};

export {};
