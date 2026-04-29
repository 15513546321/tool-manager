import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, FileSearch, Plus, Save, Upload } from 'lucide-react';
import { releaseChangeApi } from '../services/apiService';

const INPUT_STYLE = "w-full px-3 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400";
const LONG_TEXTAREA_STYLE = `${INPUT_STYLE} min-h-[132px] max-h-64 overflow-y-auto resize-y leading-6`;
const LABEL_STYLE = "block text-xs font-bold text-slate-500 mb-1";
const LONG_TEXT_LIMIT = 2000;

type ReleaseChangeMode = 'developer' | 'manager';

interface ReleaseChangesProps {
  mode?: ReleaseChangeMode;
}

interface VersionItem {
  id: number;
  versionName: string;
  description?: string;
  status?: string;
  changeSetCount?: number;
  declaredFileCount?: number;
  diffFileCount?: number;
}

interface ChangeSetItem {
  id: number;
  versionId: number;
  requirementCode: string;
  requirementName?: string;
  developer: string;
  reviewer?: string;
  reviewStatus?: string;
  reviewRemark?: string;
  files: string[];
  fileDetails?: ChangeFileItem[];
  fileCount?: number;
}

interface ChangeFileItem {
  id: number;
  filePath: string;
  fileName: string;
  requirementCode: string;
  requirementName?: string;
  developer: string;
  reviewStatus?: string;
}

interface PackageDiffItem {
  id: number;
  filePath: string;
  fileName?: string;
  serviceTag?: string;
  diffType?: string;
  confirmStatus?: string;
  confirmRemark?: string;
  owners?: ChangeFileItem[];
}

interface ReconcileResult {
  summary: {
    declaredFileCount: number;
    diffFileCount: number;
    matchedDiffCount: number;
    undeclaredDiffCount: number;
    declaredNotInPackageCount: number;
    pendingConfirmCount: number;
  };
  matchedDiffs: PackageDiffItem[];
  undeclaredDiffs: PackageDiffItem[];
  declaredNotInPackage: ChangeFileItem[];
}

interface RequirementGroup {
  code: string;
  description: string;
  reviewers: string;
  reviewStatus: string;
  reviewRemark: string;
  sets: ChangeSetItem[];
  rows: Array<{ id: string; fileName: string; filePath: string; developer: string }>;
  developerCount: number;
  fileCount: number;
}

interface ReviewDraft {
  requirementDescription: string;
  reviewer: string;
  reviewStatus: string;
  reviewRemark: string;
}

const reviewText: Record<string, string> = {
  PENDING: '待评审',
  REVIEWED: '已评审',
  REJECTED: '需补充'
};

const diffConfirmText: Record<string, string> = {
  PENDING: '待确认',
  CONFIRMED: '确认无误',
  WRONG: '确认有误'
};

const splitLines = (value: string) => value
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean);

const fileNameOnly = (value: string) => {
  const normalized = value.trim().replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(index + 1) : normalized;
};

const stripExtension = (value: string) => {
  const index = value.lastIndexOf('.');
  return index > 0 ? value.slice(0, index) : value;
};

const normalizeDeclaredPath = (value: string) => {
  let cleaned = value.trim().replace(/^['"]|['"]$/g, '');
  if (/^R\d{3}\s+.+\s+.+$/.test(cleaned)) {
    const parts = cleaned.split(/\s+/);
    cleaned = parts[parts.length - 1];
  } else {
    cleaned = cleaned.replace(/^[AMDRCU?]{1,2}\s+/, '');
  }
  return cleaned.replace(/\\/g, '/');
};

const displayFileName = (value: string) => stripExtension(fileNameOnly(value));

const normalizeDeclaredKey = (value: string) => normalizeDeclaredPath(value).toLowerCase();

const splitPeople = (value?: string) => (value || '')
  .split(/[，,;；\s]+/)
  .map(item => item.trim())
  .filter(Boolean);

const uniqueJoin = (items: string[]) => Array.from(new Set(items.filter(Boolean))).join('，');

const textCountLabel = (value: string) => `${value.length}/${LONG_TEXT_LIMIT}`;

const pillClass = (status?: string) => {
  if (status === 'REVIEWED' || status === 'CONFIRMED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'REJECTED' || status === 'WRONG') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
};

export const ReleaseChanges: React.FC<ReleaseChangesProps> = ({ mode = 'developer' }) => {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [changeSets, setChangeSets] = useState<ChangeSetItem[]>([]);
  const [diffs, setDiffs] = useState<PackageDiffItem[]>([]);
  const [reconcile, setReconcile] = useState<ReconcileResult | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<ChangeFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});

  const [versionForm, setVersionForm] = useState({ versionName: '', description: '' });
  const [changeForm, setChangeForm] = useState({
    developer: '',
    requirementCode: '',
    requirementDescription: '',
    fileText: ''
  });
  const [diffText, setDiffText] = useState('');
  const [diffServiceTag, setDiffServiceTag] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');

  const selectedVersion = useMemo(
    () => versions.find(version => version.id === selectedVersionId) || null,
    [versions, selectedVersionId]
  );

  const serviceOptions = useMemo(
    () => Array.from(new Set(diffs.map(diff => diff.serviceTag || '').filter(Boolean))).sort(),
    [diffs]
  );

  const filteredDiffs = useMemo(
    () => serviceFilter ? diffs.filter(diff => (diff.serviceTag || '') === serviceFilter) : diffs,
    [diffs, serviceFilter]
  );

  const requirementGroups = useMemo<RequirementGroup[]>(() => {
    const groups = new Map<string, RequirementGroup>();

    changeSets.forEach(set => {
      const code = set.requirementCode;
      if (!groups.has(code)) {
        groups.set(code, {
          code,
          description: '',
          reviewers: '',
          reviewStatus: 'PENDING',
          reviewRemark: '',
          sets: [],
          rows: [],
          developerCount: 0,
          fileCount: 0
        });
      }

      const group = groups.get(code)!;
      group.sets.push(set);
      if (!group.description && set.requirementName) group.description = set.requirementName;
      if (!group.reviewRemark && set.reviewRemark) group.reviewRemark = set.reviewRemark;
      group.reviewers = uniqueJoin([...splitPeople(group.reviewers), ...splitPeople(set.reviewer)]);
      const files = set.fileDetails?.length
        ? set.fileDetails
        : (set.files || []).map((filePath, index) => ({ id: index, filePath, fileName: displayFileName(filePath) } as ChangeFileItem));
      files.forEach((file, index) => {
        group.rows.push({
          id: `${set.id}-${file.id || index}-${file.filePath}`,
          fileName: file.fileName || displayFileName(file.filePath),
          filePath: file.filePath,
          developer: set.developer
        });
      });
    });

    groups.forEach(group => {
      const statuses = group.sets.map(set => set.reviewStatus || 'PENDING');
      group.reviewStatus = statuses.includes('REJECTED')
        ? 'REJECTED'
        : statuses.every(status => status === 'REVIEWED')
          ? 'REVIEWED'
          : 'PENDING';
      group.developerCount = new Set(group.sets.map(set => set.developer)).size;
      group.fileCount = group.rows.length;
    });

    return Array.from(groups.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [changeSets]);

  useEffect(() => {
    setReviewDrafts(current => {
      const next = { ...current };
      requirementGroups.forEach(group => {
        if (!next[group.code]) {
          next[group.code] = {
            requirementDescription: group.description,
            reviewer: group.reviewers,
            reviewStatus: group.reviewStatus,
            reviewRemark: group.reviewRemark
          };
        }
      });
      return next;
    });
  }, [requirementGroups]);

  const loadVersions = async () => {
    const data = await releaseChangeApi.getVersions();
    setVersions(data);
    setSelectedVersionId(current => current || data[0]?.id || null);
  };

  const loadCurrentVersionData = async (versionId: number) => {
    if (mode === 'developer') {
      const sets = await releaseChangeApi.getChangeSets(versionId);
      setChangeSets(sets);
      return;
    }

    const [packageDiffs, reconcileData] = await Promise.all([
      releaseChangeApi.getPackageDiffs(versionId),
      releaseChangeApi.reconcile(versionId)
    ]);
    setDiffs(packageDiffs);
    setReconcile(reconcileData);
  };

  const reload = async () => {
    if (!selectedVersionId) return;
    try {
      setLoading(true);
      setError(null);
      await loadCurrentVersionData(selectedVersionId);
    } catch (err) {
      console.error(err);
      setError('加载数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions().catch(err => {
      console.error(err);
      setError('加载版本失败');
    });
  }, []);

  useEffect(() => {
    if (selectedVersionId) {
      void reload();
    }
  }, [selectedVersionId, mode]);

  const createVersion = async () => {
    if (!versionForm.versionName.trim()) {
      alert('请输入版本号');
      return;
    }
    const created = await releaseChangeApi.saveVersion({
      versionName: versionForm.versionName,
      description: versionForm.description,
      status: 'OPEN'
    });
    setVersionForm({ versionName: '', description: '' });
    await loadVersions();
    setSelectedVersionId(created.id);
  };

  const submitChangeSet = async () => {
    if (!selectedVersionId) return;
    const files = splitLines(changeForm.fileText).map(normalizeDeclaredPath).filter(Boolean);
    if (!changeForm.developer.trim() || !changeForm.requirementCode.trim() || files.length === 0) {
      alert('请填写开发人员、需求编号，并粘贴文件清单');
      return;
    }

    const duplicateInInput = files.filter((file, index) =>
      files.findIndex(item => normalizeDeclaredKey(item) === normalizeDeclaredKey(file)) !== index
    );
    if (duplicateInInput.length > 0) {
      alert(`本次粘贴中有重复文件：${Array.from(new Set(duplicateInInput)).join('，')}`);
      return;
    }

    const duplicateExisting = files.filter(file => changeSets.some(set =>
      set.requirementCode.toLowerCase() === changeForm.requirementCode.trim().toLowerCase()
      && set.developer.toLowerCase() === changeForm.developer.trim().toLowerCase()
      && (set.files || []).some(existing => normalizeDeclaredKey(existing) === normalizeDeclaredKey(file))
    ));
    if (duplicateExisting.length > 0) {
      alert(`该开发在这个需求下已录入：${duplicateExisting.join('，')}`);
      return;
    }

    try {
      await releaseChangeApi.saveChangeSet({
        versionId: selectedVersionId,
        developer: changeForm.developer.trim(),
        requirementCode: changeForm.requirementCode.trim(),
        requirementName: changeForm.requirementDescription.trim(),
        reviewStatus: 'PENDING',
        files
      });
      setChangeForm({
        developer: changeForm.developer,
        requirementCode: changeForm.requirementCode,
        requirementDescription: changeForm.requirementDescription,
        fileText: ''
      });
      await reload();
      await loadVersions();
    } catch (err) {
      alert(err instanceof Error ? err.message : '提交失败');
    }
  };

  const saveRequirementReview = async (group: RequirementGroup) => {
    const draft = reviewDrafts[group.code];
    if (!draft) return;

    await Promise.all(group.sets.map(set => releaseChangeApi.saveChangeSet({
      ...set,
      requirementName: draft.requirementDescription,
      reviewer: draft.reviewer,
      reviewStatus: draft.reviewStatus,
      reviewRemark: draft.reviewRemark,
      files: set.files || []
    })));
    await reload();
  };

  const importDiffs = async () => {
    if (!selectedVersionId) return;
    if (!diffText.trim()) {
      alert('请粘贴比包差异文件清单');
      return;
    }
    await releaseChangeApi.importPackageDiffs(selectedVersionId, diffText, false, diffServiceTag.trim());
    setDiffText('');
    await reload();
    await loadVersions();
  };

  const searchFiles = async () => {
    if (!selectedVersionId || !searchKeyword.trim()) {
      setSearchResults([]);
      return;
    }
    const data = await releaseChangeApi.searchDeclaredFiles(selectedVersionId, searchKeyword);
    setSearchResults(data);
  };

  const patchPackageDiff = (diffId: number, patch: Partial<PackageDiffItem>) => {
    setDiffs(current => current.map(diff => diff.id === diffId ? { ...diff, ...patch } : diff));
    setReconcile(current => {
      if (!current) return current;
      const patchList = (items: PackageDiffItem[]) => items.map(diff => diff.id === diffId ? { ...diff, ...patch } : diff);
      return {
        ...current,
        matchedDiffs: patchList(current.matchedDiffs),
        undeclaredDiffs: patchList(current.undeclaredDiffs)
      };
    });
  };

  const updateDiffConfirmStatus = async (item: PackageDiffItem, confirmStatus: string) => {
    if (!selectedVersionId) return;
    const previousStatus = item.confirmStatus || 'PENDING';
    patchPackageDiff(item.id, { confirmStatus });

    try {
      const saved = await releaseChangeApi.confirmPackageDiff(item.id, {
        confirmStatus,
        confirmedBy: confirmStatus === 'PENDING' ? '' : localStorage.getItem('user') || '',
        confirmRemark: item.confirmRemark || ''
      });
      patchPackageDiff(item.id, saved);
    } catch (err) {
      patchPackageDiff(item.id, { confirmStatus: previousStatus });
      console.error(err);
      setError('确认状态保存失败，请重试');
    }
  };

  const renderVersionPicker = () => (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <label className="text-sm font-bold text-slate-500">上线版本</label>
        {selectedVersion?.description && (
          <span className="text-xs text-slate-500 truncate" title={selectedVersion.description}>
            （{selectedVersion.description}）
          </span>
        )}
      </div>
      <select
        className={INPUT_STYLE}
        value={selectedVersionId || ''}
        onChange={event => setSelectedVersionId(Number(event.target.value))}
      >
        {versions.map(version => (
          <option key={version.id} value={version.id}>{version.versionName}</option>
        ))}
      </select>
    </div>
  );

  const renderEmptyVersion = () => (
    <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
      {mode === 'manager' ? '暂无版本，请先创建一个上线版本。' : '暂无可录入的上线版本，请联系版本管理员创建。'}
    </div>
  );

  const updateDraft = (code: string, patch: Partial<ReviewDraft>) => {
    setReviewDrafts(current => {
      const base: ReviewDraft = current[code] || {
        requirementDescription: '',
        reviewer: '',
        reviewStatus: 'PENDING',
        reviewRemark: ''
      };
      return {
        ...current,
        [code]: { ...base, ...patch }
      };
    });
  };

  const renderDeveloperView = () => (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,520px)_1fr] gap-5">
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <h3 className="font-bold text-slate-800 mb-4">提交我的变更集</h3>
        <div className="space-y-4">
          <div>
            <label className={LABEL_STYLE}>开发人员</label>
            <input className={INPUT_STYLE} value={changeForm.developer} onChange={event => setChangeForm({ ...changeForm, developer: event.target.value })} placeholder="填写姓名" />
          </div>
          <div>
            <label className={LABEL_STYLE}>需求编号</label>
            <input className={INPUT_STYLE} value={changeForm.requirementCode} onChange={event => setChangeForm({ ...changeForm, requirementCode: event.target.value })} placeholder="例如 公金-2026-0001" />
          </div>
          <div>
            <label className={LABEL_STYLE}>改动文件</label>
            <textarea
              className={`${INPUT_STYLE} font-mono`}
              rows={12}
              value={changeForm.fileText}
              onChange={event => setChangeForm({ ...changeForm, fileText: event.target.value })}
              placeholder="每行一个 Git 相对路径，建议去 Gitee 管理复制。例如 src/main/java/demo/AccountService.java；系统会提取文件名 AccountService"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className={LABEL_STYLE}>需求备注</label>
              <span className="text-[11px] text-slate-400">{textCountLabel(changeForm.requirementDescription)}</span>
            </div>
            <textarea
              className={LONG_TEXTAREA_STYLE}
              rows={6}
              maxLength={LONG_TEXT_LIMIT}
              value={changeForm.requirementDescription}
              onChange={event => setChangeForm({ ...changeForm, requirementDescription: event.target.value })}
              placeholder="可填写需求内容、影响范围或注意事项。例如需要开通网络策略，需要灰度发布，需要重保时额外关注的一些验证事项等"
            />
          </div>
          <button onClick={submitChangeSet} disabled={!selectedVersionId} className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-slate-300 flex items-center justify-center gap-2">
            <Save size={16} /> 提交变更集
          </button>
        </div>
      </section>

      <section className="space-y-3">
        {requirementGroups.map(group => {
          const draft = reviewDrafts[group.code] || {
            requirementDescription: group.description,
            reviewer: group.reviewers,
            reviewStatus: group.reviewStatus,
            reviewRemark: group.reviewRemark
          };
          return (
            <details key={group.code} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden" open>
              <summary className="px-5 py-4 cursor-pointer hover:bg-slate-50">
                <div className="inline-flex flex-wrap items-center gap-3">
                  <span className="font-bold text-slate-800">{group.code}</span>
                  <span className={`inline-flex px-2 py-1 rounded-md border text-xs font-bold ${pillClass(group.reviewStatus)}`}>
                    {reviewText[group.reviewStatus] || group.reviewStatus}
                  </span>
                  <span className="text-xs text-slate-500">{group.fileCount} 个文件</span>
                  <span className="text-xs text-slate-500">{group.developerCount} 位开发</span>
                  {group.reviewers && <span className="text-xs text-slate-500">评审人：{group.reviewers}</span>}
                </div>
              </summary>

              <div className="border-t border-slate-100 p-5 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-[160px_minmax(0,1fr)_auto] gap-3 items-end">
                  <div>
                    <label className={LABEL_STYLE}>评审状态</label>
                    <select className={INPUT_STYLE} value={draft.reviewStatus} onChange={event => updateDraft(group.code, { reviewStatus: event.target.value })}>
                      <option value="PENDING">待评审</option>
                      <option value="REVIEWED">已评审</option>
                      <option value="REJECTED">需补充</option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_STYLE}>评审人</label>
                    <input className={INPUT_STYLE} value={draft.reviewer} onChange={event => updateDraft(group.code, { reviewer: event.target.value })} placeholder="多人用逗号分隔" />
                  </div>
                  <button onClick={() => saveRequirementReview(group)} className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900">保存评审</button>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className={LABEL_STYLE}>评审备注</label>
                    <span className="text-[11px] text-slate-400">{textCountLabel(draft.reviewRemark)}</span>
                  </div>
                  <textarea
                    className={LONG_TEXTAREA_STYLE}
                    rows={6}
                    maxLength={LONG_TEXT_LIMIT}
                    value={draft.reviewRemark}
                    onChange={event => updateDraft(group.code, { reviewRemark: event.target.value })}
                    placeholder="记录评审结论、风险点或待补充事项"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className={LABEL_STYLE}>需求备注</label>
                    <span className="text-[11px] text-slate-400">{textCountLabel(draft.requirementDescription)}</span>
                  </div>
                  <textarea
                    className={LONG_TEXTAREA_STYLE}
                    rows={6}
                    maxLength={LONG_TEXT_LIMIT}
                    value={draft.requirementDescription}
                    onChange={event => updateDraft(group.code, { requirementDescription: event.target.value })}
                    placeholder="可维护需求背景、上线范围、注意事项等"
                  />
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-slate-700 w-56">文件名</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">录入文件全名</th>
                        <th className="px-4 py-3 font-semibold text-slate-700 w-40">开发人员</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.rows.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono text-xs text-slate-800 break-all">{row.fileName}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600 break-all">{row.filePath}</td>
                          <td className="px-4 py-3 text-slate-700">{row.developer}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          );
        })}
        {requirementGroups.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-10 text-center text-slate-400">还没有人提交变更集</div>
        )}
      </section>
    </div>
  );

  const renderOwners = (owners?: ChangeFileItem[]) => {
    if (!owners || owners.length === 0) return <span className="text-amber-700">未声明</span>;
    return owners.map(owner => `${owner.developer} / ${owner.requirementCode}`).join('，');
  };

  const renderOwnerFilePaths = (owners?: ChangeFileItem[]) => {
    if (!owners || owners.length === 0) return <span className="text-slate-400">-</span>;
    return (
      <div className="space-y-1">
        {owners.map(owner => (
          <div key={owner.id} className="font-mono text-xs text-slate-600 break-all">{owner.filePath}</div>
        ))}
      </div>
    );
  };

  const renderManagerView = () => (
    <div className="space-y-5">
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="font-bold text-slate-800 mb-4">导入比包差异</h3>
          <div className="mb-3">
            <label className={LABEL_STYLE}>微服务标签</label>
            <input
              className={INPUT_STYLE}
              value={diffServiceTag}
              onChange={event => setDiffServiceTag(event.target.value.toUpperCase())}
              placeholder="例如 CUSTOMER、PAYMENT"
            />
          </div>
          <textarea
            className={`${INPUT_STYLE} font-mono`}
            rows={8}
            value={diffText}
            onChange={event => setDiffText(event.target.value)}
            placeholder="在 Beyond Compare 中右键选中差异文件，点击复制文件名；每行一个复制出的绝对路径，例如 C:\\build\\demo\\AccountService.class；系统会提取文件名 AccountService"
          />
          <button onClick={importDiffs} disabled={!selectedVersionId} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-slate-300 flex items-center gap-2">
            <Upload size={16} /> 增量导入
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="font-bold text-slate-800 mb-4">创建版本</h3>
          <div className="space-y-3">
            <input className={INPUT_STYLE} value={versionForm.versionName} onChange={event => setVersionForm({ ...versionForm, versionName: event.target.value })} placeholder="版本号，例如 2026.04.30" />
            <textarea className={INPUT_STYLE} rows={3} value={versionForm.description} onChange={event => setVersionForm({ ...versionForm, description: event.target.value })} placeholder="版本说明，可选" />
            <button onClick={createVersion} className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 flex items-center gap-2">
              <Plus size={16} /> 创建版本
            </button>
          </div>
        </div>
      </section>

      {reconcile && (
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ['声明文件', reconcile.summary.declaredFileCount],
            ['差异文件', reconcile.summary.diffFileCount],
            ['已匹配', reconcile.summary.matchedDiffCount],
            ['入包未声明', reconcile.summary.undeclaredDiffCount],
            ['声明未入包', reconcile.summary.declaredNotInPackageCount]
          ].map(([label, value]) => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-2xl font-bold text-slate-800">{value}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><FileSearch size={17} /> 查文件责任人</h3>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <input className={INPUT_STYLE} value={searchKeyword} onChange={event => setSearchKeyword(event.target.value)} onKeyDown={event => event.key === 'Enter' && searchFiles()} placeholder="可输入 AccountService、AccountService.class 或完整路径" />
          <button onClick={searchFiles} className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-bold">搜索</button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-4 divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
            {searchResults.map(item => (
              <div key={item.id} className="p-3">
                <div className="font-mono text-xs text-slate-700 break-all">{item.filePath}</div>
                <div className="text-sm text-slate-600 mt-1">{item.developer} / {item.requirementCode}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {reconcile && (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="bg-white border border-amber-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-amber-50 border-b border-amber-100 font-bold text-amber-800 flex items-center gap-2">
              <AlertTriangle size={16} /> 入包未声明
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-auto">
              {reconcile.undeclaredDiffs.map(item => (
                <div key={item.id} className="px-5 py-3 font-mono text-xs text-slate-700 break-all">{item.filePath}</div>
              ))}
              {reconcile.undeclaredDiffs.length === 0 && <div className="py-10 text-center text-slate-400 text-sm">无异常</div>}
            </div>
          </div>

          <div className="bg-white border border-blue-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 font-bold text-blue-800 flex items-center gap-2">
              <AlertTriangle size={16} /> 声明未入包
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-auto">
              {reconcile.declaredNotInPackage.map(item => (
                <div key={item.id} className="px-5 py-3">
                  <div className="font-mono text-xs text-slate-700 break-all">{item.filePath}</div>
                  <div className="text-xs text-slate-500 mt-1">{item.developer} / {item.requirementCode}</div>
                </div>
              ))}
              {reconcile.declaredNotInPackage.length === 0 && <div className="py-10 text-center text-slate-400 text-sm">无异常</div>}
            </div>
          </div>
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="font-bold text-slate-800">差异确认</div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">按服务筛选</span>
            <select className="px-3 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] text-sm text-slate-700" value={serviceFilter} onChange={event => setServiceFilter(event.target.value)}>
              <option value="">全部服务</option>
              {serviceOptions.map(service => (
                <option key={service} value={service}>{service}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700 w-32">服务</th>
                <th className="px-4 py-3 font-semibold text-slate-700">文件</th>
                <th className="px-4 py-3 font-semibold text-slate-700">关联人</th>
                <th className="px-4 py-3 font-semibold text-slate-700">录入文件全名</th>
                <th className="px-4 py-3 font-semibold text-slate-700 w-44">确认状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDiffs.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {item.serviceTag ? <span className="inline-flex px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">{item.serviceTag}</span> : <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700 break-all">{item.fileName || item.filePath}</td>
                  <td className="px-4 py-3 text-slate-600">{renderOwners(item.owners)}</td>
                  <td className="px-4 py-3">{renderOwnerFilePaths(item.owners)}</td>
                  <td className="px-4 py-3">
                    <select
                      className={`${INPUT_STYLE} h-9 py-1 font-bold ${pillClass(item.confirmStatus)}`}
                      value={item.confirmStatus || 'PENDING'}
                      onChange={event => updateDiffConfirmStatus(item, event.target.value)}
                    >
                      <option value="PENDING">{diffConfirmText.PENDING}</option>
                      <option value="CONFIRMED">{diffConfirmText.CONFIRMED}</option>
                      <option value="WRONG">{diffConfirmText.WRONG}</option>
                    </select>
                  </td>
                </tr>
              ))}
              {filteredDiffs.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-slate-400">暂无比包差异</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  return (
    <div className="p-6 h-full overflow-auto bg-slate-50">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ClipboardList className="text-blue-600" /> {mode === 'developer' ? '变更集录入' : '比包对账'}
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          {mode === 'developer' ? '按需求提交文件清单，并以需求维度完成评审' : '版本管理员增量导入制品差异，定位责任人并完成对账'}
        </p>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      {loading && <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm">加载中...</div>}

      <div className="mb-5">
        {versions.length > 0 ? renderVersionPicker() : renderEmptyVersion()}
      </div>

      {versions.length > 0 && (mode === 'developer' ? renderDeveloperView() : renderManagerView())}
      {versions.length === 0 && mode === 'manager' && (
        <div className="mt-5 bg-white border border-slate-200 rounded-xl shadow-sm p-5 max-w-lg">
          <h3 className="font-bold text-slate-800 mb-4">创建第一个版本</h3>
          <div className="space-y-3">
            <input className={INPUT_STYLE} value={versionForm.versionName} onChange={event => setVersionForm({ ...versionForm, versionName: event.target.value })} placeholder="版本号" />
            <textarea className={INPUT_STYLE} rows={3} value={versionForm.description} onChange={event => setVersionForm({ ...versionForm, description: event.target.value })} placeholder="版本说明，可选" />
            <button onClick={createVersion} className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 flex items-center gap-2">
              <Plus size={16} /> 创建版本
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
