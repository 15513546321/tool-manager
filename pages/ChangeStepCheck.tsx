import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  Save,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react';
import { changeStepCheckApi } from '../services/apiService';
import {
  ChangeStepRiskItem,
  ChangeStepScannerConfig,
  ChangeStepScanResult,
  UpdateChangeStepScannerConfig,
} from '../types';

type ReviewStatus = 'PENDING' | 'CONFIRMED' | 'FALSE_POSITIVE';

const splitValues = (value: string, includeComma = true) =>
  value
    .split(includeComma ? /[\n,，]+/ : /\n+/)
    .map(item => item.trim())
    .filter(Boolean);

const HighlightedLine: React.FC<{ risk: ChangeStepRiskItem }> = ({ risk }) => {
  const start = Math.max(0, Math.min(risk.matchedStart, risk.contextLine.length));
  const end = Math.max(start, Math.min(risk.matchedEnd, risk.contextLine.length));
  return (
    <span>
      {risk.contextLine.slice(0, start)}
      <mark className="rounded bg-red-200 px-0.5 font-semibold text-red-950">
        {risk.contextLine.slice(start, end)}
      </mark>
      {risk.contextLine.slice(end)}
    </span>
  );
};

export const ChangeStepCheck: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ChangeStepScanResult | null>(null);
  const [reviews, setReviews] = useState<Record<string, ReviewStatus>>({});
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<ChangeStepScannerConfig | null>(null);
  const [keywordsText, setKeywordsText] = useState('');
  const [regexText, setRegexText] = useState('');
  const [newPasswordsText, setNewPasswordsText] = useState('');
  const [retainedPasswordIds, setRetainedPasswordIds] = useState<string[]>([]);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configError, setConfigError] = useState('');

  const loadConfig = async () => {
    try {
      setConfigError('');
      const data: ChangeStepScannerConfig = await changeStepCheckApi.getConfig();
      setConfig(data);
      setKeywordsText(data.fieldKeywords.join(', '));
      setRegexText(data.regexPatterns.join('\n'));
      setRetainedPasswordIds(data.knownPasswords.map(item => item.id));
    } catch (loadError) {
      setConfigError(loadError instanceof Error ? loadError.message : '读取扫描配置失败');
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const selectFile = (selected: File | undefined) => {
    if (!selected) return;
    const lowerName = selected.name.toLowerCase();
    if (!lowerName.endsWith('.doc') && !lowerName.endsWith('.docx')) {
      setError('仅支持 .doc 或 .docx 格式的 Word 文档');
      return;
    }
    if (selected.size > 200 * 1024 * 1024) {
      setError('文件不能超过 200 MB');
      return;
    }
    setFile(selected);
    setResult(null);
    setReviews({});
    setError('');
  };

  const scan = async () => {
    if (!file) {
      setError('请先选择 Word 文档');
      return;
    }
    setIsScanning(true);
    setError('');
    setResult(null);
    setReviews({});
    try {
      const data: ChangeStepScanResult = await changeStepCheckApi.scan(file);
      setResult(data);
      setReviews(Object.fromEntries(data.risks.map(item => [item.id, 'PENDING'])));
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : '扫描失败，请稍后重试');
    } finally {
      setIsScanning(false);
    }
  };

  const reviewCounts = useMemo(() => {
    const values = Object.values(reviews);
    return {
      confirmed: values.filter(item => item === 'CONFIRMED').length,
      falsePositive: values.filter(item => item === 'FALSE_POSITIVE').length,
      pending: values.filter(item => item === 'PENDING').length,
    };
  }, [reviews]);

  const saveConfig = async () => {
    const payload: UpdateChangeStepScannerConfig = {
      fieldKeywords: splitValues(keywordsText),
      regexPatterns: splitValues(regexText, false),
      retainedKnownPasswordIds: retainedPasswordIds,
      newKnownPasswords: splitValues(newPasswordsText, false),
    };
    setIsSavingConfig(true);
    setConfigError('');
    try {
      const saved: ChangeStepScannerConfig = await changeStepCheckApi.updateConfig(payload);
      setConfig(saved);
      setKeywordsText(saved.fieldKeywords.join(', '));
      setRegexText(saved.regexPatterns.join('\n'));
      setRetainedPasswordIds(saved.knownPasswords.map(item => item.id));
      setNewPasswordsText('');
      setShowConfig(false);
    } catch (saveError) {
      setConfigError(saveError instanceof Error ? saveError.message : '保存扫描配置失败');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const closeConfig = () => {
    setNewPasswordsText('');
    setConfigError('');
    setShowConfig(false);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <section className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-amber-50 px-6 py-5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <ShieldCheck size={18} /> 交付安全核查
            </div>
            <h1 className="text-2xl font-semibold text-blue-950">变更步骤检查</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              扫描 Word 变更步骤中的密码字段、疑似密码和已知密码，扫描完成后不保留上传原文件。
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setNewPasswordsText('');
              setShowConfig(true);
              loadConfig();
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
          >
            <Settings size={17} /> 扫描规则配置
          </button>
        </div>

        <div className="p-6">
          <div
            onDragEnter={event => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={event => event.preventDefault()}
            onDragLeave={event => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={event => {
              event.preventDefault();
              setIsDragging(false);
              selectFile(event.dataTransfer.files?.[0]);
            }}
            className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-blue-200 bg-slate-50/70'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={event => selectFile(event.target.files?.[0])}
            />
            {file ? (
              <div className="mx-auto flex max-w-lg items-center justify-between gap-4 rounded-lg border border-blue-100 bg-white p-4 text-left shadow-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-md bg-blue-50 p-2.5 text-blue-700"><FileText size={22} /></div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-blue-950">{file.name}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <span>{(file.size / 1024).toFixed(1)} KB</span>
                      <span>·</span>
                      <span className={isScanning ? 'text-blue-600' : result ? 'font-medium text-emerald-600' : ''}>
                        {isScanning
                          ? '正在扫描…'
                          : result
                            ? `扫描完成，发现 ${result.summary.total} 项风险`
                            : '等待扫描'}
                      </span>
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => inputRef.current?.click()} className="shrink-0 text-sm font-medium text-blue-700 hover:text-blue-900">
                  更换文件
                </button>
              </div>
            ) : (
              <>
                <UploadCloud size={34} className="mx-auto text-blue-600" />
                <div className="mt-3 text-base font-semibold text-blue-950">拖拽 Word 文档到这里，或点击选择</div>
                <div className="mt-2 text-sm text-slate-500">支持 .doc / .docx，最大 200 MB</div>
                <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 rounded-md bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                  选择文档
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              disabled={!file || isScanning}
              onClick={scan}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-blue-700 px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isScanning ? <Loader2 size={18} className="animate-spin" /> : <ShieldAlert size={18} />}
              {isScanning ? '正在扫描…' : result ? '重新检查' : '开始检查'}
            </button>
          </div>
        </div>
      </section>

      {result && (
        <section className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['风险总数', result.summary.total, 'text-red-700'],
              ['高风险', result.summary.high, 'text-red-700'],
              ['字段命中', result.summary.fieldMatches, 'text-amber-700'],
              ['确认风险', reviewCounts.confirmed, 'text-blue-700'],
              ['待核查', reviewCounts.pending, 'text-slate-700'],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
                <div className="text-xs font-medium text-slate-500">{label}</div>
                <div className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-lg border border-blue-100 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center">
            <div>
              <div className="text-sm font-semibold text-blue-950">{result.fileName}</div>
              <div className="mt-1 text-xs text-slate-500">已扫描 {result.scannedLineCount} 个文本段落，误报 {reviewCounts.falsePositive} 项</div>
            </div>
            {result.risks.length > 0 && reviewCounts.pending === 0 && (
              <div className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={17} /> 所有风险项已完成核查
              </div>
            )}
          </div>

          {result.risks.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
              <ShieldCheck size={38} className="mx-auto text-emerald-600" />
              <h2 className="mt-3 text-lg font-semibold text-emerald-900">未发现明文密码风险</h2>
              <p className="mt-2 text-sm text-emerald-700">当前文档未命中已配置的字段、正则或已知密码规则。</p>
            </div>
          ) : (
            <div className="space-y-4">
              {result.risks.map((risk, index) => {
                const status = reviews[risk.id] || 'PENDING';
                return (
                  <article key={risk.id} className={`overflow-hidden rounded-xl border bg-white shadow-sm ${status === 'PENDING' ? 'border-red-200' : 'border-blue-100'}`}>
                    <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-blue-950">风险 #{index + 1}</span>
                        <span className="rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">高风险</span>
                        <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">{risk.riskLabel}</span>
                        <span className="text-xs text-slate-500">{risk.location} · 文本段 {risk.lineNumber}</span>
                      </div>
                      <span className={`text-xs font-semibold ${status === 'CONFIRMED' ? 'text-red-700' : status === 'FALSE_POSITIVE' ? 'text-slate-500' : 'text-amber-700'}`}>
                        {status === 'CONFIRMED' ? '已确认风险' : status === 'FALSE_POSITIVE' ? '已标记误报' : '待核查'}
                      </span>
                    </div>
                    <div className="space-y-4 p-5">
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        <div><span className="text-slate-500">命中规则：</span><span className="font-medium text-slate-800">{risk.rule}</span></div>
                        <div><span className="text-slate-500">命中文本：</span><code className="rounded bg-red-50 px-2 py-1 text-red-800">{risk.matchedText}</code></div>
                      </div>
                      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 font-mono text-sm leading-6 text-slate-200">
                        {risk.contextBefore && <div className="border-b border-slate-800 px-4 py-2 text-slate-400">{risk.contextBefore}</div>}
                        <div className="bg-red-950/40 px-4 py-3 text-white"><HighlightedLine risk={risk} /></div>
                        {risk.contextAfter && <div className="border-t border-slate-800 px-4 py-2 text-slate-400">{risk.contextAfter}</div>}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReviews(current => ({ ...current, [risk.id]: 'FALSE_POSITIVE' }))}
                          className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold ${status === 'FALSE_POSITIVE' ? 'border-slate-400 bg-slate-100 text-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                          <XCircle size={16} /> 标记误报
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviews(current => ({ ...current, [risk.id]: 'CONFIRMED' }))}
                          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white ${status === 'CONFIRMED' ? 'bg-red-800' : 'bg-red-600 hover:bg-red-700'}`}
                        >
                          <CheckCircle2 size={16} /> 确认风险
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {showConfig && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-blue-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-blue-100 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-blue-950">扫描规则配置</h2>
                <p className="mt-1 text-xs text-slate-500">配置修改将影响后续所有文档扫描。</p>
              </div>
              <button type="button" onClick={closeConfig} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={19} /></button>
            </div>
            <div className="space-y-6 p-6">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">密码字段关键词</span>
                <span className="ml-2 text-xs text-slate-500">逗号或换行分隔</span>
                <textarea value={keywordsText} onChange={event => setKeywordsText(event.target.value)} rows={3} className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="password, pass, key, 密码" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">疑似密码正则规则</span>
                <span className="ml-2 text-xs text-slate-500">每行一条，使用 Java 正则语法</span>
                <textarea value={regexText} onChange={event => setRegexText(event.target.value)} rows={4} className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="(?i)\\bsrcb\\d{4,}\\b" />
              </label>
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Lock size={16} /> 已知密码</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">密码提交后只保存 SHA-256 指纹和掩码，无法查看原文。删除后保存即可停用。</p>
                <div className="mt-3 space-y-2">
                  {config?.knownPasswords.length ? config.knownPasswords.map(item => {
                    const retained = retainedPasswordIds.includes(item.id);
                    return (
                      <div key={item.id} className={`flex items-center justify-between rounded-md border px-3 py-2 ${retained ? 'border-slate-200 bg-slate-50' : 'border-red-100 bg-red-50 opacity-60'}`}>
                        <code className="text-sm text-slate-700">{item.maskedValue}</code>
                        <button type="button" onClick={() => setRetainedPasswordIds(current => retained ? current.filter(id => id !== item.id) : [...current, item.id])} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800">
                          <Trash2 size={14} /> {retained ? '删除' : '撤销删除'}
                        </button>
                      </div>
                    );
                  }) : <div className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">暂未配置已知密码</div>}
                </div>
                <textarea
                  value={newPasswordsText}
                  onChange={event => setNewPasswordsText(event.target.value)}
                  rows={3}
                  autoComplete="new-password"
                  className="mt-3 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder={'新增密码，每行一条\n保存后输入框会立即清空'}
                />
              </div>
              {configError && <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{configError}</div>}
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-blue-100 bg-slate-50 px-6 py-4">
              <button type="button" onClick={closeConfig} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">取消</button>
              <button type="button" onClick={saveConfig} disabled={isSavingConfig} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                {isSavingConfig ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 保存配置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
