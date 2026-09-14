import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
  Loader2,
  Lock,
  Save,
  Search,
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
  ChangeStepDocumentType,
  ChangeStepScanRecordPage,
  ChangeStepScannerConfig,
  ChangeStepScanResult,
  ChangeStepSystemCode,
  UpdateChangeStepScannerConfig,
} from '../types';

type ReviewStatus = 'PENDING' | 'CONFIRMED' | 'FALSE_POSITIVE';

const SYSTEM_OPTIONS: Array<{ code: ChangeStepSystemCode; name: string; description: string; enabled: boolean }> = [
  { code: 'MIDDLE_PLATFORM', name: '中台', description: '企业渠道支撑系统', enabled: true },
  { code: 'ONLINE_BANKING', name: '网银', description: '企业网上银行系统三代', enabled: true },
  { code: 'TREASURY', name: '财资', description: '多银行财资系统二代', enabled: true },
  { code: 'WECHAT', name: '微信', description: '企业微信银行系统', enabled: true },
];

const systemLabel = (code?: ChangeStepSystemCode) =>
  SYSTEM_OPTIONS.find(item => item.code === code)?.name || '中台';

const documentTypeLabel = (type?: ChangeStepDocumentType) =>
  type === 'AUTOMATIC' ? '自动变更单' : '手动变更单';

const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 19);
};

const splitValues = (value: string, includeComma = true) =>
  value
    .split(includeComma ? /[\n,，]+/ : /\n+/)
    .map(item => item.trim())
    .filter(Boolean);

const VALIDATION_ENGINE_VERSION = '2.1';
const COMMON_VALIDATION_CODES = [
  'FILE_NAME_FORMAT',
  'SECTION_NUMBER_CONTINUITY',
  'DANGEROUS_COMMAND_BACKUP',
];

const requiredValidationCodes = (
  system: ChangeStepSystemCode,
  type: ChangeStepDocumentType,
) => {
  if (system === 'MIDDLE_PLATFORM') {
    return type === 'MANUAL'
      ? [
          ...COMMON_VALIDATION_CODES,
          'IMPLEMENTATION_DATE_MATCH',
          'MANUAL_SERVER_REQUIRED',
          'MANUAL_SERVER_USER_PAIR',
          'MANUAL_SERVER_NAME_FORMAT',
          'MANUAL_SERVER_ASSET_MATCH',
        ]
      : [
          ...COMMON_VALIDATION_CODES,
          'IMPLEMENTATION_DATE_MATCH',
          'AUTO_MANUAL_FILE_REFERENCE',
          'AUTO_DATA_SECTION_NUMBER',
          'AUTO_PACKAGE_SECTION_NUMBER',
          'AUTO_DEVOPS_PIPELINE_REQUIRED',
          'AUTO_CHANGE_TICKET_REQUIRED',
          'AUTO_DEVOPS_ENVIRONMENT',
          'AUTO_DEVOPS_CHANGE_DATE',
          'AUTO_ARTIFACT_REPOSITORY_REQUIRED',
        ];
  }
  if (system === 'WECHAT') {
    return type === 'MANUAL'
      ? [
          ...COMMON_VALIDATION_CODES,
          'IMPLEMENTATION_DATE_MATCH',
          'SYSTEM_TITLE_FORMAT',
          'MANUAL_SERVER_REQUIRED',
          'MANUAL_SERVER_USER_PAIR',
          'MANUAL_SERVER_IP_FORMAT',
          'MANUAL_SERVER_NAME_FORMAT',
          'MANUAL_SERVER_ASSET_MATCH',
        ]
      : [
          ...COMMON_VALIDATION_CODES,
          'SYSTEM_TITLE_FORMAT',
          'AUTO_DEVOPS_PIPELINE_REQUIRED',
          'AUTO_CHANGE_TICKET_REQUIRED',
          'AUTO_DEVOPS_ENVIRONMENT',
          'AUTO_DEVOPS_CHANGE_DATE',
          'AUTO_ARTIFACT_REPOSITORY_REQUIRED',
        ];
  }
  if (system === 'ONLINE_BANKING') {
    return type === 'MANUAL'
      ? [
          ...COMMON_VALIDATION_CODES,
          'IMPLEMENTATION_DATE_MATCH',
          'SYSTEM_TITLE_FORMAT',
          'MANUAL_SERVER_REQUIRED',
          'MANUAL_SERVER_USER_PAIR',
          'MANUAL_SERVER_NAME_FORMAT',
          'MANUAL_SERVER_ASSET_MATCH',
        ]
      : [
          ...COMMON_VALIDATION_CODES,
          'IMPLEMENTATION_DATE_MATCH',
          'SYSTEM_TITLE_FORMAT',
          'AUTO_DEVOPS_PIPELINE_REQUIRED',
          'AUTO_DEVOPS_WORKSPACE',
          'AUTO_CHANGE_TICKET_REQUIRED',
          'AUTO_DEVOPS_ENVIRONMENT',
          'AUTO_DEVOPS_CHANGE_DATE',
        ];
  }
  if (system === 'TREASURY') {
    return type === 'MANUAL'
      ? [
          ...COMMON_VALIDATION_CODES,
          'SYSTEM_TITLE_FORMAT',
          'MANUAL_SERVER_REQUIRED',
          'MANUAL_SERVER_USER_PAIR',
          'MANUAL_SERVER_IP_FORMAT',
          'MANUAL_SERVER_NAME_FORMAT',
          'MANUAL_SERVER_ASSET_MATCH',
        ]
      : [
          ...COMMON_VALIDATION_CODES,
          'IMPLEMENTATION_DATE_MATCH',
          'SYSTEM_TITLE_FORMAT',
          'AUTO_TREASURY_SAAS_REFERENCE',
          'AUTO_TREASURY_NT_REFERENCE',
          'AUTO_DEVOPS_PIPELINE_REQUIRED',
          'AUTO_DEVOPS_WORKSPACE',
          'AUTO_CHANGE_TICKET_REQUIRED',
          'AUTO_DEVOPS_ENVIRONMENT',
          'AUTO_DEVOPS_CHANGE_DATE',
          'AUTO_ARTIFACT_REPOSITORY_REQUIRED',
          'AUTO_TREASURY_PIPELINE_ENV_MATCH',
          'AUTO_TREASURY_BRANCH_FIELDS',
        ];
  }
  return COMMON_VALIDATION_CODES;
};

const normalizeScanResult = (
  raw: ChangeStepScanResult,
  expectedSystem: ChangeStepSystemCode,
  expectedType: ChangeStepDocumentType,
): ChangeStepScanResult => {
  const data = raw as ChangeStepScanResult & Record<string, any>;
  if (!data || data.validationEngineVersion !== VALIDATION_ENGINE_VERSION) {
    throw new Error(
      `业务校验引擎版本不匹配（页面要求 ${VALIDATION_ENGINE_VERSION}，后端返回 ${data?.validationEngineVersion || '旧版本'}）。请重启后端服务并刷新页面后重试。`,
    );
  }
  if (data.systemCode !== expectedSystem || data.documentType !== expectedType) {
    throw new Error('后端返回的系统或变更单类型与本次选择不一致，本次结果已拒绝展示。');
  }
  if (!Array.isArray(data.validationChecks) || data.validationChecks.length === 0) {
    throw new Error('后端未返回业务校验结果。为避免误判为通过，本次结果已拒绝展示。');
  }
  const receivedCodes = new Set(data.validationChecks.map(item => item?.code).filter(Boolean));
  const missingCodes = requiredValidationCodes(expectedSystem, expectedType)
    .filter(code => !receivedCodes.has(code));
  if (missingCodes.length > 0) {
    throw new Error(`后端业务校验规则不完整，本次结果已拒绝展示。缺少规则：${missingCodes.join('、')}`);
  }
  const invalidStatus = data.validationChecks.some(
    item => !item || !['PASSED', 'FAILED', 'WARNING'].includes(item.status),
  );
  if (invalidStatus) {
    throw new Error('后端返回了无法识别的业务校验状态，本次结果已拒绝展示。');
  }
  const risks = Array.isArray(data.risks) ? data.risks : [];
  const validationChecks = data.validationChecks;
  const summary = data.summary || {};
  return {
    ...data,
    risks,
    validationChecks,
    summary: {
      total: Number(summary.total) || 0,
      high: Number(summary.high) || 0,
      medium: Number(summary.medium) || 0,
      fieldMatches: Number(summary.fieldMatches) || 0,
      passwordMatches: Number(summary.passwordMatches) || 0,
    },
    validationSummary: {
      total: validationChecks.length,
      passed: validationChecks.filter(item => item.status === 'PASSED').length,
      failed: validationChecks.filter(item => item.status === 'FAILED').length,
      warnings: validationChecks.filter(item => item.status === 'WARNING').length,
    },
  };
};

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
  const companionInputRef = useRef<HTMLInputElement>(null);
  const treasurySaasInputRef = useRef<HTMLInputElement>(null);
  const treasuryNtInputRef = useRef<HTMLInputElement>(null);
  const [systemCode, setSystemCode] = useState<ChangeStepSystemCode>('MIDDLE_PLATFORM');
  const [documentType, setDocumentType] = useState<ChangeStepDocumentType>('MANUAL');
  const [file, setFile] = useState<File | null>(null);
  const [companionManualFile, setCompanionManualFile] = useState<File | null>(null);
  const [treasurySaasManualFile, setTreasurySaasManualFile] = useState<File | null>(null);
  const [treasuryNtManualFile, setTreasuryNtManualFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ChangeStepScanResult | null>(null);
  const [reviews, setReviews] = useState<Record<string, ReviewStatus>>({});
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyKeyword, setHistoryKeyword] = useState('');
  const [historyPage, setHistoryPage] = useState(0);
  const [historyData, setHistoryData] = useState<ChangeStepScanRecordPage | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<ChangeStepScannerConfig | null>(null);
  const [keywordsText, setKeywordsText] = useState('');
  const [regexText, setRegexText] = useState('');
  const [newPasswordsText, setNewPasswordsText] = useState('');
  const [serverAssetsText, setServerAssetsText] = useState('');
  const [wechatServerAssetsText, setWechatServerAssetsText] = useState('');
  const [onlineBankingServerAssetsText, setOnlineBankingServerAssetsText] = useState('');
  const [treasurySaasServerAssetsText, setTreasurySaasServerAssetsText] = useState('');
  const [treasuryNtServerAssetsText, setTreasuryNtServerAssetsText] = useState('');
  const [retainedPasswordIds, setRetainedPasswordIds] = useState<string[]>([]);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configError, setConfigError] = useState('');

  const loadConfig = async () => {
    try {
      setConfigError('');
      const data: ChangeStepScannerConfig = await changeStepCheckApi.getConfig();
      const normalized = {
        ...data,
        fieldKeywords: data.fieldKeywords || [],
        regexPatterns: data.regexPatterns || [],
        knownPasswords: data.knownPasswords || [],
        serverAssetNames: data.serverAssetNames || [],
        serverAssetNamesBySystem: data.serverAssetNamesBySystem || {},
      };
      setConfig(normalized);
      setKeywordsText(normalized.fieldKeywords.join(', '));
      setRegexText(normalized.regexPatterns.join('\n'));
      setRetainedPasswordIds(normalized.knownPasswords.map(item => item.id));
      setServerAssetsText(normalized.serverAssetNames.join('\n'));
      setWechatServerAssetsText((normalized.serverAssetNamesBySystem.WECHAT || []).join('\n'));
      setOnlineBankingServerAssetsText((normalized.serverAssetNamesBySystem.ONLINE_BANKING || []).join('\n'));
      setTreasurySaasServerAssetsText((normalized.serverAssetNamesBySystem.TREASURY_SAAS || []).join('\n'));
      setTreasuryNtServerAssetsText((normalized.serverAssetNamesBySystem.TREASURY_NT || []).join('\n'));
    } catch (loadError) {
      setConfigError(loadError instanceof Error ? loadError.message : '读取扫描配置失败');
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const selectFile = (selected: File | undefined) => {
    if (!selected || isScanning) return;
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
    if (/devops2g|自动变更/i.test(selected.name)) {
      setDocumentType('AUTOMATIC');
    } else if (/手动/.test(selected.name)) {
      setDocumentType('MANUAL');
    }
    if (selected.name.includes('企业微信银行系统')) {
      setSystemCode('WECHAT');
      setCompanionManualFile(null);
      setTreasurySaasManualFile(null);
      setTreasuryNtManualFile(null);
    } else if (selected.name.includes('企业网上银行系统三代') || selected.name.includes('EIBS3G')) {
      setSystemCode('ONLINE_BANKING');
      setCompanionManualFile(null);
      setTreasurySaasManualFile(null);
      setTreasuryNtManualFile(null);
    } else if (selected.name.includes('多银行财资') || selected.name.includes('财资系统二代')) {
      setSystemCode('TREASURY');
      setDocumentType(/devops2g|自动变更/i.test(selected.name) ? 'AUTOMATIC' : 'MANUAL');
      setCompanionManualFile(null);
    } else if (selected.name.includes('企业渠道支撑系统')) {
      setSystemCode('MIDDLE_PLATFORM');
      setTreasurySaasManualFile(null);
      setTreasuryNtManualFile(null);
    }
    setResult(null);
    setReviews({});
    setReviewError('');
    setError('');
  };

  const selectCompanionManualFile = (selected: File | undefined) => {
    if (!selected || isScanning) return;
    const lowerName = selected.name.toLowerCase();
    if (!lowerName.endsWith('.doc') && !lowerName.endsWith('.docx')) {
      setError('配套文件仅支持 .doc 或 .docx 格式');
      return;
    }
    setCompanionManualFile(selected);
    setResult(null);
    setError('');
  };

  const selectTreasuryManualFile = (selected: File | undefined, variant: 'SAAS' | 'NT') => {
    if (!selected || isScanning) return;
    const lowerName = selected.name.toLowerCase();
    if (!lowerName.endsWith('.doc') && !lowerName.endsWith('.docx')) {
      setError('配套文件仅支持 .doc 或 .docx 格式');
      return;
    }
    if (variant === 'SAAS') setTreasurySaasManualFile(selected);
    else setTreasuryNtManualFile(selected);
    setResult(null);
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
    setReviewError('');
    try {
      const response: ChangeStepScanResult = await changeStepCheckApi.scan(file, {
        documentType,
        systemCode,
        companionManualFileName: companionManualFile?.name,
        treasurySaasManualFileName: treasurySaasManualFile?.name,
        treasuryNtManualFileName: treasuryNtManualFile?.name,
      });
      const data = normalizeScanResult(response, systemCode, documentType);
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

  const hasBusinessFailure = Boolean(result && result.validationSummary.failed > 0);
  const needsAttention = Boolean(result && (
    result.validationSummary.warnings > 0 || result.summary.total > 0
  ));

  const loadHistory = async (page: number, keyword = historyKeyword) => {
    setIsLoadingHistory(true);
    setHistoryError('');
    try {
      const data: ChangeStepScanRecordPage = await changeStepCheckApi.getRecords(keyword.trim(), page, 10);
      setHistoryData(data);
      setHistoryPage(page);
    } catch (loadError) {
      setHistoryError(loadError instanceof Error ? loadError.message : '读取公共检查记录失败');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleReview = async (riskId: string, status: ReviewStatus) => {
    if (isSavingReview) return;
    const previous = reviews;
    const next = { ...reviews, [riskId]: status };
    setReviews(next);
    setReviewError('');
    if (!result?.recordId) return;

    const values = Object.values(next);
    setIsSavingReview(true);
    try {
      await changeStepCheckApi.updateReview(result.recordId, {
        confirmedRisks: values.filter(item => item === 'CONFIRMED').length,
        falsePositiveRisks: values.filter(item => item === 'FALSE_POSITIVE').length,
        pendingRisks: values.filter(item => item === 'PENDING').length,
      });
    } catch (saveError) {
      setReviews(previous);
      setReviewError(saveError instanceof Error ? saveError.message : '同步核查进度失败');
    } finally {
      setIsSavingReview(false);
    }
  };

  const saveConfig = async () => {
    const payload: UpdateChangeStepScannerConfig = {
      fieldKeywords: splitValues(keywordsText),
      regexPatterns: splitValues(regexText, false),
      retainedKnownPasswordIds: retainedPasswordIds,
      newKnownPasswords: splitValues(newPasswordsText, false),
      serverAssetNames: splitValues(serverAssetsText),
      serverAssetNamesBySystem: {
        ...(config?.serverAssetNamesBySystem || {}),
        MIDDLE_PLATFORM: splitValues(serverAssetsText),
        WECHAT: splitValues(wechatServerAssetsText),
        ONLINE_BANKING: splitValues(onlineBankingServerAssetsText),
        TREASURY_SAAS: splitValues(treasurySaasServerAssetsText),
        TREASURY_NT: splitValues(treasuryNtServerAssetsText),
      },
    };
    setIsSavingConfig(true);
    setConfigError('');
    try {
      const saved: ChangeStepScannerConfig = await changeStepCheckApi.updateConfig(payload);
      const normalized = {
        ...saved,
        fieldKeywords: saved.fieldKeywords || [],
        regexPatterns: saved.regexPatterns || [],
        knownPasswords: saved.knownPasswords || [],
        serverAssetNames: saved.serverAssetNames || [],
        serverAssetNamesBySystem: saved.serverAssetNamesBySystem || {},
      };
      setConfig(normalized);
      setKeywordsText(normalized.fieldKeywords.join(', '));
      setRegexText(normalized.regexPatterns.join('\n'));
      setRetainedPasswordIds(normalized.knownPasswords.map(item => item.id));
      setServerAssetsText(normalized.serverAssetNames.join('\n'));
      setWechatServerAssetsText((normalized.serverAssetNamesBySystem.WECHAT || []).join('\n'));
      setOnlineBankingServerAssetsText((normalized.serverAssetNamesBySystem.ONLINE_BANKING || []).join('\n'));
      setTreasurySaasServerAssetsText((normalized.serverAssetNamesBySystem.TREASURY_SAAS || []).join('\n'));
      setTreasuryNtServerAssetsText((normalized.serverAssetNamesBySystem.TREASURY_NT || []).join('\n'));
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
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowHistory(true);
                loadHistory(0);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
            >
              <History size={17} /> 公共检查记录
            </button>
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
        </div>

        <div className="space-y-6 p-6">
          <div>
            <div className="mb-3 text-sm font-semibold text-slate-800">业务系统</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SYSTEM_OPTIONS.map(option => (
                <button
                  key={option.code}
                  type="button"
                  disabled={!option.enabled || isScanning}
                  onClick={() => {
                    setSystemCode(option.code);
                    if (option.code !== 'MIDDLE_PLATFORM') {
                      setCompanionManualFile(null);
                      if (companionInputRef.current) companionInputRef.current.value = '';
                    }
                    if (option.code !== 'TREASURY') {
                      setTreasurySaasManualFile(null);
                      setTreasuryNtManualFile(null);
                      if (treasurySaasInputRef.current) treasurySaasInputRef.current.value = '';
                      if (treasuryNtInputRef.current) treasuryNtInputRef.current.value = '';
                    }
                    setResult(null);
                    setReviews({});
                    setError('');
                  }}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    systemCode === option.code
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : option.enabled
                        ? 'border-slate-200 bg-white hover:border-blue-300'
                        : 'cursor-not-allowed border-dashed border-slate-200 bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-blue-950">{option.name}</span>
                    {!option.enabled && <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] text-slate-500">待接入</span>}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-800">变更单类型</div>
            <div className="flex flex-wrap gap-2">
              {([
                ['MANUAL', '手动变更单'],
                ['AUTOMATIC', '自动变更单'],
              ] as Array<[ChangeStepDocumentType, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={isScanning}
                  onClick={() => {
                    setDocumentType(value);
                    setResult(null);
                    setReviews({});
                    setError('');
                  }}
                  className={`rounded-md px-5 py-2 text-sm font-semibold transition-colors ${
                    documentType === value
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'border border-blue-200 bg-white text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

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
                            ? `校验完成，${result.validationSummary.failed + result.validationSummary.warnings + result.summary.total} 项需要关注`
                            : '等待扫描'}
                      </span>
                    </div>
                  </div>
                </div>
                <button type="button" disabled={isScanning} onClick={() => inputRef.current?.click()} className="shrink-0 text-sm font-medium text-blue-700 hover:text-blue-900 disabled:opacity-40">
                  更换文件
                </button>
              </div>
            ) : (
              <>
                <UploadCloud size={34} className="mx-auto text-blue-600" />
                <div className="mt-3 text-base font-semibold text-blue-950">选择需要校验的{documentType === 'MANUAL' ? '手动' : '自动'}变更单</div>
                <div className="mt-2 text-sm text-slate-500">支持 .doc / .docx，最大 200 MB</div>
                <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 rounded-md bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                  选择文档
                </button>
              </>
            )}
          </div>

          {documentType === 'AUTOMATIC' && systemCode === 'MIDDLE_PLATFORM' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
              <input
                ref={companionInputRef}
                type="file"
                className="hidden"
                accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={event => selectCompanionManualFile(event.target.files?.[0])}
              />
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-amber-950">配套手动变更步骤文件 <span className="font-normal text-amber-700">（可选）</span></div>
                  <div className="mt-1 text-xs text-amber-800">
                    {companionManualFile
                      ? companionManualFile.name
                      : '不选择也可检查；此时校验引用文件的命名格式和日期。选择后追加实际文件名精确比对。'}
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  {companionManualFile && (
                    <button
                      type="button"
                      disabled={isScanning}
                      onClick={() => {
                        setCompanionManualFile(null);
                        if (companionInputRef.current) companionInputRef.current.value = '';
                        setResult(null);
                      }}
                      className="mr-2 rounded-md px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                    >
                      清除
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isScanning}
                    onClick={() => companionInputRef.current?.click()}
                    className="shrink-0 rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                  >
                    {companionManualFile ? '更换手动文件' : '选择手动文件'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {documentType === 'AUTOMATIC' && systemCode === 'TREASURY' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
              <div className="text-sm font-semibold text-amber-950">
                配套手动变更步骤文件 <span className="font-normal text-amber-700">（均为可选）</span>
              </div>
              <div className="mt-1 text-xs leading-5 text-amber-800">
                未选择时校验正文引用格式和日期；选择后要求上传文件名与正文引用完全一致。
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {([
                  {
                    variant: 'SAAS' as const,
                    label: 'SaaS 手动变更单',
                    file: treasurySaasManualFile,
                    inputRef: treasurySaasInputRef,
                    clear: () => setTreasurySaasManualFile(null),
                  },
                  {
                    variant: 'NT' as const,
                    label: 'NT 手动变更单',
                    file: treasuryNtManualFile,
                    inputRef: treasuryNtInputRef,
                    clear: () => setTreasuryNtManualFile(null),
                  },
                ]).map(item => (
                  <div key={item.variant} className="rounded-lg border border-amber-200 bg-white p-4">
                    <input
                      ref={item.inputRef}
                      type="file"
                      className="hidden"
                      accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={event => selectTreasuryManualFile(event.target.files?.[0], item.variant)}
                    />
                    <div className="text-sm font-semibold text-slate-800">{item.label}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {item.file ? item.file.name : '未选择，将只校验正文引用'}
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      {item.file && (
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() => {
                            item.clear();
                            if (item.inputRef.current) item.inputRef.current.value = '';
                            setResult(null);
                          }}
                          className="rounded-md px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                        >
                          清除
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isScanning}
                        onClick={() => item.inputRef.current?.click()}
                        className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                      >
                        {item.file ? '更换文件' : '选择文件'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <div className="flex justify-end">
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
          <div className={`flex items-start gap-3 rounded-xl border px-5 py-4 shadow-sm ${
            hasBusinessFailure
              ? 'border-red-200 bg-red-50 text-red-900'
              : needsAttention
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}>
            {hasBusinessFailure
              ? <XCircle size={24} className="mt-0.5 shrink-0 text-red-600" />
              : needsAttention
                ? <AlertTriangle size={24} className="mt-0.5 shrink-0 text-amber-600" />
                : <ShieldCheck size={24} className="mt-0.5 shrink-0 text-emerald-600" />}
            <div>
              <h2 className="font-semibold">
                {hasBusinessFailure ? '变更单校验未通过' : needsAttention ? '变更单需要人工确认' : '变更单校验通过'}
              </h2>
              <p className="mt-1 text-sm opacity-80">
                {hasBusinessFailure
                  ? `有 ${result.validationSummary.failed} 项业务规则未通过，请根据下方明细修改。`
                  : needsAttention
                    ? '业务规则未发现失败项，但仍有警告或敏感信息需要确认。'
                    : '业务规则全部通过，且未发现敏感信息风险。'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              ['业务检查', result.validationSummary.total, 'text-blue-700'],
              ['检查通过', result.validationSummary.passed, 'text-emerald-700'],
              ['检查未通过', result.validationSummary.failed, 'text-red-700'],
              ['检查警告', result.validationSummary.warnings, 'text-amber-700'],
              ['敏感信息', result.summary.total, 'text-amber-700'],
              ['待人工核查', reviewCounts.pending, 'text-slate-700'],
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
              <div className="mt-1 text-xs text-slate-500">
                {result.systemName} · {result.documentTypeLabel} · {result.recordId ? `检查记录 #${result.recordId}` : '公共检查记录暂未保存'} · 已扫描 {result.scannedLineCount} 个文本段落
              </div>
            </div>
            {result.risks.length > 0 && reviewCounts.pending === 0 && (
              <div className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={17} /> 所有风险项已完成核查
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
            <div className="border-b border-blue-100 bg-blue-50 px-5 py-4">
              <h2 className="text-base font-semibold text-blue-950">变更单业务检查</h2>
              <p className="mt-1 text-xs text-slate-500">只检查变更实施步骤；变更验证方案及异常应急（含回退）方案不参与本次业务规则判断。</p>
            </div>
            <div className="divide-y divide-slate-100">
              {result.validationChecks.map(check => {
                const isPassed = check.status === 'PASSED';
                const isWarning = check.status === 'WARNING';
                return (
                <div key={check.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    {isPassed
                      ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                      : isWarning
                        ? <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
                        : <XCircle size={20} className="mt-0.5 shrink-0 text-red-600" />}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{check.label}</span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{check.category}</span>
                        {check.lineNumber && <span className="text-xs text-slate-400">{check.location} · 文本段 {check.lineNumber}</span>}
                      </div>
                      <div className={`mt-1 text-sm ${isPassed ? 'text-emerald-700' : isWarning ? 'text-amber-700' : 'text-red-700'}`}>{check.message}</div>
                      {!isPassed && (
                        <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2 sm:gap-4">
                          <div><span className="text-slate-400">期望：</span><span className="break-all">{check.expectedValue || '-'}</span></div>
                          <div><span className="text-slate-400">实际：</span><span className="break-all">{check.actualValue || '-'}</span></div>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded px-2.5 py-1 text-xs font-semibold ${
                    isPassed ? 'bg-emerald-50 text-emerald-700' : isWarning ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {isPassed ? '通过' : isWarning ? '警告' : '未通过'}
                  </span>
                </div>
                );
              })}
            </div>
          </div>

          {reviewError && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {reviewError}
            </div>
          )}

          {result.risks.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
              <ShieldCheck size={38} className="mx-auto text-emerald-600" />
              <h2 className="mt-3 text-lg font-semibold text-emerald-900">敏感信息检查：未命中</h2>
              <p className="mt-2 text-sm text-emerald-700">
                当前文档未命中已配置的密码字段、正则或已知密码规则；变更单最终结论以上方综合结果为准。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-blue-950">敏感信息人工核查</h2>
                <p className="mt-1 text-xs text-slate-500">业务规则结果与敏感信息分开展示，以下命中项需要逐项确认或标记误报。</p>
              </div>
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
                          disabled={isSavingReview}
                          onClick={() => handleReview(risk.id, 'FALSE_POSITIVE')}
                          className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold ${status === 'FALSE_POSITIVE' ? 'border-slate-400 bg-slate-100 text-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                          <XCircle size={16} /> 标记误报
                        </button>
                        <button
                          type="button"
                          disabled={isSavingReview}
                          onClick={() => handleReview(risk.id, 'CONFIRMED')}
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

      {showHistory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-blue-950/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-blue-100 px-6 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-blue-950"><History size={19} /> 公共检查记录</h2>
              </div>
              <button type="button" onClick={() => setShowHistory(false)} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={19} /></button>
            </div>

            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={historyKeyword}
                  onChange={event => setHistoryKeyword(event.target.value)}
                  onKeyDown={event => event.key === 'Enter' && loadHistory(0)}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="按文件名或检查人查询"
                />
              </div>
              <button type="button" onClick={() => loadHistory(0)} disabled={isLoadingHistory} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                {isLoadingHistory ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} 查询
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {historyError ? (
                <div className="m-6 flex gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle size={17} />{historyError}</div>
              ) : isLoadingHistory && !historyData ? (
                <div className="flex h-56 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />正在加载检查记录…</div>
              ) : historyData?.content.length ? (
                <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-blue-50 text-xs font-semibold text-blue-900">
                    <tr>
                      <th className="px-5 py-3">检查时间 / 检查人</th>
                      <th className="px-5 py-3">文件</th>
                      <th className="px-5 py-3">扫描结果</th>
                      <th className="px-5 py-3">风险摘要</th>
                      <th className="px-5 py-3">核查进度</th>
                      <th className="px-5 py-3">流程状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyData.content.map(record => (
                      <tr key={record.id} className="align-top hover:bg-blue-50/30">
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="font-medium text-slate-800">{formatDateTime(record.scannedAt)}</div>
                          <div className="mt-1 text-xs text-slate-500">{record.scannedBy || '未知用户'}</div>
                        </td>
                        <td className="max-w-[280px] px-5 py-4">
                          <div className="break-all font-semibold text-blue-950">{record.fileName}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {systemLabel(record.systemCode)} · {documentTypeLabel(record.documentType)} · {formatFileSize(record.fileSize)}
                          </div>
                          {record.errorMessage && <div className="mt-2 line-clamp-2 text-xs text-red-600" title={record.errorMessage}>{record.errorMessage}</div>}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${record.scanStatus === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {record.scanStatus === 'SUCCESS' ? '扫描成功' : '扫描失败'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs leading-6 text-slate-600">
                          {record.scanStatus === 'SUCCESS' ? (
                            <>
                              <div>风险 <strong className="text-red-700">{record.totalRisks}</strong> · 高风险 {record.highRisks}</div>
                              <div>业务检查失败 <strong className="text-red-700">{record.validationFailed || 0}</strong> · 通过 {record.validationPassed || 0}</div>
                            </>
                          ) : '-'}
                        </td>
                        <td className="px-5 py-4 text-xs leading-6 text-slate-600">
                          {record.scanStatus === 'SUCCESS' ? (
                            <>
                              <div>确认 <strong className="text-blue-700">{record.confirmedRisks}</strong> · 误报 {record.falsePositiveRisks}</div>
                              <div>待核查 <strong className="text-amber-700">{record.pendingRisks}</strong></div>
                            </>
                          ) : '-'}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${
                            record.reviewStatus === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : record.reviewStatus === 'PENDING'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-500'
                          }`}>
                            {record.reviewStatus === 'COMPLETED' ? '核查完成' : record.reviewStatus === 'PENDING' ? '待核查' : '不适用'}
                          </span>
                          {record.reviewedBy && <div className="mt-2 text-xs text-slate-500">{record.reviewedBy}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex h-56 flex-col items-center justify-center text-sm text-slate-500">
                  <History size={32} className="mb-3 text-slate-300" /> 暂无检查记录
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4 text-sm text-slate-500">
              <span>共 {historyData?.totalElements || 0} 条记录</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={historyPage <= 0 || isLoadingHistory} onClick={() => loadHistory(historyPage - 1)} className="rounded-md border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span>第 {historyData?.totalPages ? historyPage + 1 : 0} / {historyData?.totalPages || 0} 页</span>
                <button type="button" disabled={!historyData || historyPage >= historyData.totalPages - 1 || isLoadingHistory} onClick={() => loadHistory(historyPage + 1)} className="rounded-md border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfig && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-blue-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-blue-100 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-blue-950">扫描规则配置</h2>
                <p className="mt-1 text-xs text-slate-500">维护服务器资产清单，以及密码和敏感字段规则。</p>
              </div>
              <button type="button" onClick={closeConfig} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={19} /></button>
            </div>
            <div className="space-y-6 p-6">
              {systemCode === 'MIDDLE_PLATFORM' && <label className="block">
                <span className="text-sm font-semibold text-slate-800">中台服务器资产清单</span>
                <span className="ml-2 text-xs text-slate-500">逗号或换行分隔；留空时只检查命名格式并给出警告</span>
                <textarea
                  value={serverAssetsText}
                  onChange={event => setServerAssetsText(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder={'ECSS01RAC\nECSS01APP\nECSS02APP'}
                />
              </label>}
              {systemCode === 'WECHAT' && <label className="block">
                <span className="text-sm font-semibold text-slate-800">微信服务器资产清单</span>
                <span className="ml-2 text-xs text-slate-500">逗号或换行分隔；与中台资产清单相互独立</span>
                <textarea
                  value={wechatServerAssetsText}
                  onChange={event => setWechatServerAssetsText(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder={'EWBS01WEB\nEWBS01WEBJDT\nEWBS01APP'}
                />
              </label>}
              {systemCode === 'ONLINE_BANKING' && <label className="block">
                <span className="text-sm font-semibold text-slate-800">网银服务器资产清单</span>
                <span className="ml-2 text-xs text-slate-500">用于逐台核对手动变更单中的 EIBS3G 主机</span>
                <textarea
                  value={onlineBankingServerAssetsText}
                  onChange={event => setOnlineBankingServerAssetsText(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder={'EIBS3G01XCWEB\nEIBS3G01XCAPPJDT\neibs3g01db'}
                />
              </label>}
              {systemCode === 'TREASURY' && <>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">财资 SaaS 服务器资产清单</span>
                  <span className="ml-2 text-xs text-slate-500">仅核对 SaaS 手动变更单</span>
                  <textarea value={treasurySaasServerAssetsText} onChange={event => setTreasurySaasServerAssetsText(event.target.value)} rows={4} className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder={'CBMS2G03GW\nCBMS2G01GWDEMO'} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">财资 NT 服务器资产清单</span>
                  <span className="ml-2 text-xs text-slate-500">仅核对 NT 手动变更单</span>
                  <textarea value={treasuryNtServerAssetsText} onChange={event => setTreasuryNtServerAssetsText(event.target.value)} rows={4} className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder={'CBMS2G01IIDNT\nCBMS2G01FEBNT\nCBMS2G02FEBNTJDT'} />
                </label>
              </>}
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
