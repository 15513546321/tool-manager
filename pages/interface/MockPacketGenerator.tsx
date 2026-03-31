import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  WifiOff,
  X,
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { recordAction } from '../../services/auditService';
import {
  MockPacketConfig,
  MockPacketGenerateResponse,
  MockPacketPayload,
  MockPacketTransactionType,
  MockPacketTransactionTypesResponse,
} from '../../types';

const CARD = 'rounded-[28px] border border-slate-200/80 bg-white/92 shadow-[0_22px_45px_-32px_rgba(15,23,42,0.28)] backdrop-blur';
const INPUT = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100';
const MODULE_AUDIT = '接口管理 - 模拟报文生成';

const LOCAL_FALLBACK_CONFIG: MockPacketConfig = {
  host: '10.20.75.40',
  port: '1521',
  serviceName: 'ecss',
  username: 'ICHANNEL',
  password: '',
};

const LOCAL_FALLBACK_TYPES: MockPacketTransactionType[] = [
  { transCode: 'apiTrdCapitalPoolTransService.manualCashOut', prdName: '手工清款' },
  { transCode: 'apiTrdCapitalPoolTransService.cashOutApply', prdName: '请款申请' },
  { transCode: 'apiTrdBankOuterPayService.rcbTransfer', prdName: '农信银转账' },
  { transCode: 'apiPrdDiscountService.secondStick', prdName: '盈利贴' },
  { transCode: 'apiPrdEndorseService.apply', prdName: '背书转让申请' },
  { transCode: 'apiPrdEndorseService.sign', prdName: '背书转让签收' },
  { transCode: 'apiTrdLargeDepositService.apply', prdName: '大额存单入池' },
  { transCode: 'apiPrdNoticeReceiveService.ticket', prdName: '提示收票申请' },
];

const findReadableError = (error: unknown) => (error instanceof Error ? error.message : '未知错误');

const fallbackCopyText = (text: string) => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const success = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!success) {
    throw new Error('当前浏览器不支持复制，请手动复制。');
  }
};

const userNameFromStorage = () => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return 'system';
    const parsed = JSON.parse(raw);
    return parsed?.username || 'system';
  } catch {
    return 'system';
  }
};

export const MockPacketGenerator: React.FC = () => {
  const [config, setConfig] = useState<MockPacketConfig>(LOCAL_FALLBACK_CONFIG);
  const [draftConfig, setDraftConfig] = useState<MockPacketConfig>(LOCAL_FALLBACK_CONFIG);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [transactionTypes, setTransactionTypes] = useState<MockPacketTransactionType[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [packets, setPackets] = useState<MockPacketPayload[]>([]);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [bootLoading, setBootLoading] = useState(true);
  const [typesLoading, setTypesLoading] = useState(false);
  const [packetLoading, setPacketLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingConfig, setTestingConfig] = useState(false);

  const [catalogMessage, setCatalogMessage] = useState('');
  const [packetMessage, setPacketMessage] = useState('');
  const [catalogFallback, setCatalogFallback] = useState(false);
  const [packetFallback, setPacketFallback] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const filteredTypes = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return transactionTypes;
    return transactionTypes.filter((item) =>
      item.prdName.toLowerCase().includes(keyword) || item.transCode.toLowerCase().includes(keyword),
    );
  }, [searchKeyword, transactionTypes]);

  const selectedType = useMemo(
    () => transactionTypes.find((item) => item.transCode === selectedCode) || null,
    [selectedCode, transactionTypes],
  );

  const activePacket = packets[0] || null;

  const syncSelection = (nextTypes: MockPacketTransactionType[]) => {
    setSelectedCode((prev) => (prev && nextTypes.some((item) => item.transCode === prev) ? prev : null));
  };

  const clearPacketArea = () => {
    setPackets([]);
    setPacketFallback(false);
    setPacketMessage('');
  };

  const loadTransactionTypes = async (configToUse: MockPacketConfig, silent = false) => {
    if (!silent) setTypesLoading(true);
    try {
      const response = (await apiService.mockPacketApi.getTransactionTypes(configToUse)) as MockPacketTransactionTypesResponse;
      const nextTypes = response.transactionTypes?.length ? response.transactionTypes : LOCAL_FALLBACK_TYPES;
      setTransactionTypes(nextTypes);
      setCatalogMessage(response.usingFallback ? '当前展示示例交易类型' : `已加载 ${nextTypes.length} 个交易类型`);
      setCatalogFallback(Boolean(response.usingFallback));
      if (response.resolvedConfig) {
        setConfig(response.resolvedConfig);
        setDraftConfig(response.resolvedConfig);
      }
      syncSelection(nextTypes);
    } catch (error) {
      setTransactionTypes(LOCAL_FALLBACK_TYPES);
      setCatalogFallback(true);
      setCatalogMessage('当前展示示例交易类型');
      syncSelection(LOCAL_FALLBACK_TYPES);
      recordAction(MODULE_AUDIT, `加载交易类型异常 - ${findReadableError(error)}`);
    } finally {
      if (!silent) setTypesLoading(false);
    }
  };

  const loadInitialData = async () => {
    setBootLoading(true);
    try {
      const savedConfig = (await apiService.mockPacketApi.getConfig()) as MockPacketConfig;
      setConfig(savedConfig);
      setDraftConfig(savedConfig);
      await loadTransactionTypes(savedConfig, true);
    } catch (error) {
      setConfig(LOCAL_FALLBACK_CONFIG);
      setDraftConfig(LOCAL_FALLBACK_CONFIG);
      setTransactionTypes(LOCAL_FALLBACK_TYPES);
      setCatalogFallback(true);
      setCatalogMessage('当前展示示例交易类型');
      syncSelection(LOCAL_FALLBACK_TYPES);
      recordAction(MODULE_AUDIT, `初始化异常 - ${findReadableError(error)}`);
    } finally {
      setBootLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedType) {
      clearPacketArea();
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPacketLoading(true);
      try {
        const response = (await apiService.mockPacketApi.generatePackets([selectedType], config)) as MockPacketGenerateResponse;
        if (cancelled) return;
        const nextPackets = response.packets?.length ? response.packets.slice(0, 1) : [];
        const failed = !response.success || nextPackets.length === 0;
        setPackets(nextPackets);
        setPacketFallback(failed || Boolean(response.usingFallback));
        setPacketMessage(failed ? response.message || '加载失败。' : response.message || '已加载最新报文');
      } catch (error) {
        if (cancelled) return;
        setPackets([]);
        setPacketFallback(true);
        setPacketMessage('加载失败。');
        recordAction(MODULE_AUDIT, `生成报文异常 - ${findReadableError(error)}`);
      } finally {
        if (!cancelled) setPacketLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [config, selectedType]);

  const handleSelectType = (type: MockPacketTransactionType) => {
    clearPacketArea();
    setSelectedCode((prev) => (prev === type.transCode ? null : type.transCode));
    recordAction(MODULE_AUDIT, `选择交易类型 - ${type.prdName}`);
  };

  const handleClearSelection = () => {
    setSelectedCode(null);
    clearPacketArea();
    recordAction(MODULE_AUDIT, '清空交易类型选择');
  };

  const handleRefreshTypes = async () => {
    clearPacketArea();
    await loadTransactionTypes(config);
    recordAction(MODULE_AUDIT, '刷新交易类型列表');
  };

  const handleTestConnection = async () => {
    setTestingConfig(true);
    setTestResult(null);
    try {
      const result = await apiService.mockPacketApi.testConnection(draftConfig);
      setTestResult({ success: Boolean(result.success), message: result.success ? '连接可用。' : '连接不可用。' });
      recordAction(MODULE_AUDIT, `测试 Oracle 连接 - ${result.success ? '成功' : '失败'}`);
    } catch (error) {
      setTestResult({ success: false, message: '连接不可用。' });
      recordAction(MODULE_AUDIT, `测试 Oracle 连接异常 - ${findReadableError(error)}`);
    } finally {
      setTestingConfig(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const saved = (await apiService.mockPacketApi.saveConfig(draftConfig, userNameFromStorage())) as MockPacketConfig;
      setConfig(saved);
      setDraftConfig(saved);
      setSettingsOpen(false);
      clearPacketArea();
      await loadTransactionTypes(saved);
      recordAction(MODULE_AUDIT, `保存 Oracle 配置 - ${saved.host}:${saved.port}/${saved.serviceName}`);
    } catch (error) {
      setTestResult({ success: false, message: '保存失败。' });
      recordAction(MODULE_AUDIT, `保存 Oracle 配置异常 - ${findReadableError(error)}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleReloadConfig = async () => {
    try {
      const latestConfig = (await apiService.mockPacketApi.getConfig()) as MockPacketConfig;
      setDraftConfig(latestConfig);
      setTestResult({ success: true, message: '已重新加载当前配置。' });
    } catch {
      setDraftConfig(LOCAL_FALLBACK_CONFIG);
      setTestResult({ success: true, message: '已加载默认配置。' });
    }
  };

  const handleCopyPacket = async (packet: MockPacketPayload) => {
    try {
      if (!packet) {
        throw new Error('当前没有可复制的报文。');
      }
      const content = packet.payloadPretty || packet.payloadRaw || '';
      if (!content.trim()) {
        throw new Error('当前没有可复制的报文。');
      }

      if (navigator?.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
      } else {
        fallbackCopyText(content);
      }

      recordAction(MODULE_AUDIT, `复制报文 - ${packet.transCode || 'unknown'}`);
    } catch (error) {
      alert(`复制失败：${findReadableError(error)}`);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.16),_transparent_24%),linear-gradient(180deg,#f7fafc_0%,#eef4fb_100%)] p-8">
      <div className="mx-auto max-w-[1520px] space-y-6 animate-in fade-in duration-500">
        <section className="relative overflow-hidden rounded-[32px] border border-[#e7eef8] bg-[linear-gradient(135deg,#fffdf6_0%,#f7fbff_48%,#edf6ff_100%)] px-8 py-8 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.22)]">
          <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-sky-200/30 blur-3xl" />
          <div className="absolute left-24 top-12 h-32 w-32 rounded-full bg-amber-200/30 blur-3xl" />
          <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-center">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">模拟报文生成</h1>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  <Settings2 size={16} /> 连接设置
                </button>
                <button
                  onClick={handleRefreshTypes}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                >
                  <RefreshCw size={16} className={typesLoading ? 'animate-spin' : ''} /> 刷新交易类型
                </button>
                {selectedType && (
                  <button
                    onClick={handleClearSelection}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <X size={16} /> 清空选择
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[26px] border border-white/70 bg-white/90 p-5 shadow-sm backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">交易类型</div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-2xl font-bold text-slate-900">{transactionTypes.length}</div>
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${catalogFallback ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {catalogFallback ? <WifiOff size={14} /> : <CheckCircle2 size={14} />}
                    {catalogMessage || '已准备'}
                  </span>
                </div>
              </div>
              <div className="rounded-[26px] border border-white/70 bg-white/90 p-5 shadow-sm backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">报文状态</div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-2xl font-bold text-slate-900">{activePacket ? 1 : 0}</div>
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${packetFallback ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                    {packetFallback ? <AlertTriangle size={14} /> : <Database size={14} />}
                    {packetMessage || '待生成'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1.02fr]">
          <div className={`${CARD} p-6`}>
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">交易类型选择</h2>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-3.5 text-slate-400" size={16} />
                <input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  className={`${INPUT} pl-11`}
                  placeholder="搜索交易名称或交易码"
                />
              </div>
              <button
                onClick={handleRefreshTypes}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
              >
                <RefreshCw size={16} className={typesLoading ? 'animate-spin' : ''} /> 刷新
              </button>
            </div>

            <div className="mt-5 rounded-[28px] bg-[linear-gradient(180deg,#fbfdff_0%,#f3f7fb_100%)] p-3">
              {bootLoading || typesLoading ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <div key={index} className="h-24 animate-pulse rounded-[22px] bg-white" />
                  ))}
                </div>
              ) : filteredTypes.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-sm text-slate-500">
                  当前没有匹配的交易类型。
                </div>
              ) : (
                <div className="grid max-h-[760px] gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredTypes.map((item) => {
                    const checked = selectedCode === item.transCode;
                    return (
                      <button
                        key={item.transCode}
                        onClick={() => handleSelectType(item)}
                        className={`rounded-[24px] border px-4 py-4 text-left transition ${
                          checked
                            ? 'border-sky-300 bg-[linear-gradient(135deg,#f0f9ff_0%,#ecfeff_100%)] shadow-[0_16px_30px_-24px_rgba(14,165,233,0.7)]'
                            : 'border-transparent bg-white hover:border-slate-200 hover:shadow-[0_12px_24px_-22px_rgba(15,23,42,0.35)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-sm font-semibold leading-6 text-slate-900">{item.prdName}</div>
                            <div className={`mt-3 rounded-2xl px-3 py-2 text-[11px] font-medium leading-5 ${checked ? 'bg-white text-slate-700 ring-1 ring-sky-100' : 'bg-slate-100 text-slate-500'}`}>
                              <span className="break-all font-mono">{item.transCode}</span>
                            </div>
                          </div>
                          <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border ${checked ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 text-transparent'}`}>
                            <CheckCircle2 size={14} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className={`${CARD} overflow-hidden p-6`}>
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">格式化报文预览</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                {activePacket && (
                  <span className={`rounded-full px-3 py-2 ${activePacket.fallback ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {activePacket.sourceLabel}
                  </span>
                )}
                {packetMessage && <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-600">{packetMessage}</span>}
              </div>
            </div>

            <div className="mt-5">
              {packetLoading ? (
                <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#fbfdff_0%,#f2f6fb_100%)] p-6">
                  <div className="mb-4 flex items-center gap-3 text-sm font-medium text-slate-500">
                    <Loader2 size={16} className="animate-spin" /> 正在生成最新报文...
                  </div>
                  <div className="h-[560px] animate-pulse rounded-[24px] bg-white" />
                </div>
              ) : !selectedType ? (
                <div className="rounded-[28px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,#fbfdff_0%,#f4f7fb_100%)] px-8 py-24 text-center text-sm text-slate-500">
                  请选择一项交易类型。
                </div>
              ) : !activePacket ? (
                <div className="rounded-[28px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,#fbfdff_0%,#f4f7fb_100%)] px-8 py-24 text-center text-sm text-slate-500">
                  {packetMessage || '加载失败。'}
                </div>
              ) : (
                <article className="overflow-hidden rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#fcfdff_0%,#f7faff_100%)] shadow-[0_18px_36px_-28px_rgba(15,23,42,0.28)]">
                  <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-slate-900 px-3 py-1.5 text-slate-100">{activePacket.transCode}</span>
                        <span className="rounded-full bg-white px-3 py-1.5 text-slate-600 ring-1 ring-slate-200">{activePacket.matchedRows > 0 ? `命中 ${activePacket.matchedRows} 条` : '结果'}</span>
                      </div>
                      <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{activePacket.prdName}</h3>
                    </div>
                    <button
                      onClick={() => handleCopyPacket(activePacket)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                    >
                      <Copy size={16} /> 复制 JSON
                    </button>
                  </div>
                  <div className="p-5">
                    <div className="rounded-[26px] border border-slate-200 bg-white p-1 shadow-inner shadow-slate-100">
                      <pre className="max-h-[720px] overflow-auto rounded-[22px] bg-[#f5f8fc] px-6 py-5 font-mono text-[13px] leading-6 text-slate-800">
                        {activePacket.payloadPretty}
                      </pre>
                    </div>
                  </div>
                </article>
              )}
            </div>
          </div>
        </section>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm">
          <div className="absolute inset-y-0 right-0 flex w-full justify-end">
            <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-[#f8fbff] shadow-2xl shadow-slate-950/30">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">Settings</div>
                  <h3 className="mt-1 text-2xl font-bold text-slate-900">连接设置</h3>
                </div>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <div className="mb-2 text-sm font-semibold text-slate-700">主机 IP</div>
                    <input className={INPUT} value={draftConfig.host} onChange={(e) => setDraftConfig({ ...draftConfig, host: e.target.value })} />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-sm font-semibold text-slate-700">端口</div>
                    <input className={INPUT} value={draftConfig.port} onChange={(e) => setDraftConfig({ ...draftConfig, port: e.target.value })} />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-sm font-semibold text-slate-700">Service Name</div>
                    <input className={INPUT} value={draftConfig.serviceName} onChange={(e) => setDraftConfig({ ...draftConfig, serviceName: e.target.value })} />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-sm font-semibold text-slate-700">用户名</div>
                    <input className={INPUT} value={draftConfig.username} onChange={(e) => setDraftConfig({ ...draftConfig, username: e.target.value })} />
                  </label>
                </div>

                <label className="mt-4 block">
                  <div className="mb-2 text-sm font-semibold text-slate-700">密码</div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className={`${INPUT} pr-12`}
                      value={draftConfig.password}
                      onChange={(e) => setDraftConfig({ ...draftConfig, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-3 rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                {testResult && (
                  <div className={`mt-5 rounded-[24px] border px-5 py-4 text-sm ${testResult.success ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                    <div className="flex items-start gap-3">
                      {testResult.success ? <CheckCircle2 size={18} className="mt-0.5" /> : <AlertTriangle size={18} className="mt-0.5" />}
                      <span className="leading-6">{testResult.message}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 bg-white px-6 py-5">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleTestConnection}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                  >
                    {testingConfig ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                    测试连接
                  </button>
                  <button
                    onClick={handleReloadConfig}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <RefreshCw size={16} /> 重新读取配置
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
                  >
                    {savingConfig ? <Loader2 size={16} className="animate-spin" /> : <Settings2 size={16} />}
                    保存并应用
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
