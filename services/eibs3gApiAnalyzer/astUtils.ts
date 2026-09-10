import type * as t from '@babel/types';

const SKIPPED_AST_KEYS = new Set([
  'loc',
  'start',
  'end',
  'extra',
  'leadingComments',
  'trailingComments',
  'innerComments'
]);

export const isNodeType = <T extends t.Node>(value: unknown, type: T['type']): value is T => (
  Boolean(value)
  && typeof value === 'object'
  && (value as { type?: unknown }).type === type
);

/**
 * Walk a Babel AST without pulling @babel/traverse and its Node-oriented runtime
 * dependencies into the browser worker. Return true from the visitor to stop.
 */
export const walkAst = (
  value: unknown,
  visitor: (node: t.Node) => boolean | void
): boolean => {
  if (!value || typeof value !== 'object') return false;

  if (Array.isArray(value)) {
    for (const item of value) {
      if (walkAst(item, visitor)) return true;
    }
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.type === 'string' && visitor(value as t.Node)) return true;

  for (const [key, child] of Object.entries(record)) {
    if (SKIPPED_AST_KEYS.has(key)) continue;
    if (walkAst(child, visitor)) return true;
  }

  return false;
};
