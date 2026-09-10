import type { IndexedProject } from './types';
import {
  getUploadRootName,
  normalizeSlashes,
  normalizeUploadedFilePath
} from './pathResolver';

const isIncludedSourceFile = (path: string): boolean => {
  if (/^api\/.+\.js$/i.test(path)) return true;
  if (/^router\/modules\/.+\.js$/i.test(path)) return true;
  return /^views\/.+\.vue$/i.test(path);
};

export const createFileIndex = (selectedFiles: File[]): IndexedProject => {
  if (selectedFiles.length === 0) {
    throw new Error('所选目录中没有可读取的文件。');
  }

  const firstRelativePath = normalizeSlashes(
    selectedFiles[0].webkitRelativePath || selectedFiles[0].name
  );
  const rootName = getUploadRootName(firstRelativePath);

  if (rootName.toLowerCase() !== 'src') {
    throw new Error(`请选择网银前端项目的 src 文件夹；当前选择的是“${rootName || '未知目录'}”。`);
  }

  const files = new Map<string, File>();
  let apiFiles = 0;
  let routeFiles = 0;
  let vueFiles = 0;

  for (const file of selectedFiles) {
    const relativePath = file.webkitRelativePath || file.name;
    const path = normalizeUploadedFilePath(relativePath);
    if (!path || !isIncludedSourceFile(path)) continue;

    files.set(path, file);
    if (/^api\/.+\.js$/i.test(path)) apiFiles += 1;
    else if (/^router\/modules\/.+\.js$/i.test(path)) routeFiles += 1;
    else if (/^views\/.+\.vue$/i.test(path)) vueFiles += 1;
  }

  return {
    rootName,
    files,
    stats: {
      totalSelected: selectedFiles.length,
      indexed: files.size,
      apiFiles,
      routeFiles,
      vueFiles,
      skipped: selectedFiles.length - files.size
    }
  };
};

export const pathsByPrefix = (
  project: IndexedProject,
  prefix: string,
  extension: string
): string[] => Array.from(project.files.keys())
  .filter(path => path.startsWith(prefix) && path.toLowerCase().endsWith(extension.toLowerCase()))
  .sort((left, right) => left.localeCompare(right));

export const validateFileIndex = (project: IndexedProject): void => {
  const missing: string[] = [];
  if (project.stats.apiFiles === 0) missing.push('api/**/*.js');
  if (project.stats.routeFiles === 0) missing.push('router/modules/**/*.js');
  if (project.stats.vueFiles === 0) missing.push('views/**/*.vue');

  if (missing.length > 0) {
    throw new Error(`src 目录结构不完整，未找到：${missing.join('、')}。`);
  }
};
