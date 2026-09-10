const normalizeSegments = (segments: string[]): string[] => {
  const normalized: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(segment);
  }

  return normalized;
};

export const normalizeSlashes = (value: string): string => value.replace(/\\/g, '/');

export const normalizeSourcePath = (value: string): string => {
  const clean = normalizeSlashes(value).replace(/^\.\//, '').replace(/^\/+/, '');
  return normalizeSegments(clean.split('/')).join('/');
};

export const getUploadRootName = (relativePath: string): string => {
  const clean = normalizeSlashes(relativePath).replace(/^\/+/, '');
  return clean.split('/').filter(Boolean)[0] || '';
};

export const normalizeUploadedFilePath = (relativePath: string): string | null => {
  const clean = normalizeSlashes(relativePath).replace(/^\/+/, '');
  const segments = clean.split('/').filter(Boolean);
  const srcIndex = segments.findIndex(segment => segment.toLowerCase() === 'src');
  if (srcIndex < 0 || srcIndex === segments.length - 1) return null;
  return normalizeSegments(segments.slice(srcIndex + 1)).join('/');
};

export const dirname = (filePath: string): string => {
  const normalized = normalizeSourcePath(filePath);
  const slashIndex = normalized.lastIndexOf('/');
  return slashIndex < 0 ? '' : normalized.slice(0, slashIndex);
};

export const fileNameFromPath = (filePath: string): string => {
  const normalized = normalizeSourcePath(filePath);
  return normalized.slice(normalized.lastIndexOf('/') + 1);
};

export const resolveRouteComponentPath = (importSource: string): string | null => {
  const normalized = normalizeSlashes(importSource.trim());
  if (!normalized.startsWith('@/views/') || !normalized.endsWith('.vue')) return null;
  return normalizeSourcePath(normalized.slice(2));
};

export const resolveVueImportPath = (
  importSource: string,
  importerPath: string
): string | null => {
  const normalized = normalizeSlashes(importSource.trim());
  if (!normalized.endsWith('.vue')) return null;

  if (normalized.startsWith('@/')) {
    const resolved = normalizeSourcePath(normalized.slice(2));
    return resolved.startsWith('views/') ? resolved : null;
  }

  if (normalized.startsWith('./') || normalized.startsWith('../')) {
    const resolved = normalizeSourcePath(`${dirname(importerPath)}/${normalized}`);
    return resolved.startsWith('views/') ? resolved : null;
  }

  return null;
};

export const resolveApiImportPath = (importSource: string): string | null => {
  const normalized = normalizeSlashes(importSource.trim());
  if (!normalized.startsWith('@/api/')) return null;

  const withoutAlias = normalizeSourcePath(normalized.slice(2));
  if (withoutAlias.endsWith('.js')) return withoutAlias;
  if (/\.[a-z0-9]+$/i.test(withoutAlias)) return null;
  return `${withoutAlias}.js`;
};
