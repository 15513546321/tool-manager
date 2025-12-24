import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Download, ChevronDown, ChevronUp, GitCompare, ArrowRight, Play, CheckCircle } from 'lucide-react';
import { apiService } from '../../services/apiService';
import ExcelJS from 'exceljs';

// ============ Types ============
interface DiffRow {
  tag: 'EQUAL' | 'INSERT' | 'DELETE' | 'CHANGE';
  oldLine: string;
  newLine: string;
  oldLineNumber: number;
  newLineNumber: number;
}

interface DetailedDiffResult {
  dataId: string;
  group: string;
  diffRows: DiffRow[];
  totalLines: number;
  changedLines: number;
  insertedLines: number;
  deletedLines: number;
  status: 'same' | 'different' | 'source-only' | 'target-only';
}

interface NacosConfig {
  id?: string;
  name: string;
  sourceUrl: string;
  sourceNamespace: string;
  sourceUsername: string;
  sourcePassword: string;
  sourceRemark: string;
  targetUrl: string;
  targetNamespace: string;
  targetUsername: string;
  targetPassword: string;
  targetRemark: string;
  enabled?: boolean;
  createTime?: string;
  updateTime?: string;
}

interface ComparisonResult {
  dataId: string;
  group: string;
  sourceContent: string;
  targetContent: string;
  status: 'same' | 'different' | 'source-only' | 'target-only';
  suggestion?: string;
  expanded?: boolean;
}

interface ComparisonSummary {
  configName: string;
  namespace: string;
  sourceUrl?: string;
  targetUrl?: string;
  sourceNamespace?: string;
  targetNamespace?: string;
  sourceRemark?: string;
  targetRemark?: string;
  totalFiles: number;
  sameCount: number;
  differentCount: number;
  sourceOnlyCount: number;
  targetOnlyCount: number;
  results: ComparisonResult[];
  comparisonTime: string;
}

// ============ Component ============
export const NacosSync: React.FC = () => {
  const [configs, setConfigs] = useState<NacosConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<NacosConfig | null>(null);
  const [formData, setFormData] = useState<Partial<NacosConfig>>({});
  const [testResults, setTestResults] = useState<{
    source?: boolean;
    target?: boolean;
    sourceMessage?: string;
    targetMessage?: string;
  }>({});
  const [comparisonVisible, setComparisonVisible] = useState(false);
  const [currentComparison, setCurrentComparison] = useState<ComparisonSummary | null>(null);
  const [comparing, setComparing] = useState(false);
  const [expandedEnvType, setExpandedEnvType] = useState<'source' | 'target' | null>(null);
  const [detailedDiffVisible, setDetailedDiffVisible] = useState(false);
  const [currentDetailedResult, setCurrentDetailedResult] = useState<ComparisonResult | null>(null);
  const [detailedDiffData, setDetailedDiffData] = useState<DetailedDiffResult | null>(null);
  const [detailedDiffLoading, setDetailedDiffLoading] = useState(false);

  // ============ Lifecycle ============
  useEffect(() => {
    loadConfigs();
  }, []);

  // ============ API Calls ============
  const loadConfigs = async () => {
    try {
      setLoading(true);
      console.log('Loading Nacos configs...');
      const response = await apiService.nacosApi.queryConfigs();
      console.log('Response from queryConfigs:', response);
      // 后端返回 ApiResponse<List> 格式，需要获取 data 字段
      if (response && response.success && Array.isArray(response.data)) {
        console.log('Setting configs from response.data:', response.data);
        setConfigs(response.data);
      } else if (response && response.data && Array.isArray(response.data)) {
        console.log('Setting configs (data without success check):', response.data);
        setConfigs(response.data);
      } else if (Array.isArray(response)) {
        // 兼容直接返回数组的情况
        console.log('Setting configs (direct array):', response);
        setConfigs(response);
      } else {
        console.warn('Invalid response format', response);
        setConfigs([]);
      }
    } catch (error) {
      console.error('Failed to load configs', error);
      if (error instanceof Error && error.message.includes('404')) {
        console.warn('Nacos config API not implemented yet');
        setConfigs([]);
      } else {
        alert('Failed to load configs: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddConfig = () => {
    setEditingConfig(null);
    setFormData({});
    setTestResults({});
    setIsModalVisible(true);
  };

  const handleEditConfig = (config: NacosConfig) => {
    setEditingConfig(config);
    setFormData(config);
    setTestResults({});
    setIsModalVisible(true);
  };

  const handleDeleteConfig = async (id?: string) => {
    if (!id || !confirm('Are you sure you want to delete this config?')) return;

    try {
      await apiService.nacosApi.deleteConfig(id, {});
      alert('Deleted successfully');
      loadConfigs();
    } catch (error) {
      console.error('Failed to delete config', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      let displayMsg = errorMsg;
      if (errorMsg.includes('404')) {
        displayMsg = 'Nacos config API not implemented';
      } else if (errorMsg.includes('Failed to fetch')) {
        displayMsg = 'Unable to connect to server';
      }
      alert(`Delete failed: ${displayMsg}`);
    }
  };

  const handleSaveConfig = async () => {
    const requiredFields = ['name', 'sourceUrl', 'sourceNamespace', 'sourceUsername', 'sourcePassword', 'targetUrl', 'targetNamespace', 'targetUsername', 'targetPassword'];
    if (requiredFields.some(field => !formData[field as keyof Partial<NacosConfig>])) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      console.log('Saving config:', formData);
      if (editingConfig?.id) {
        await apiService.nacosApi.updateConfig(editingConfig.id, formData);
        alert('Updated successfully');
      } else {
        const saveResult = await apiService.nacosApi.saveConfig(formData);
        console.log('Save result:', saveResult);
        alert('Saved successfully');
      }
      setIsModalVisible(false);
      console.log('Reloading configs after save...');
      loadConfigs();
    } catch (error) {
      console.error('Failed to save config', error);
      alert('Save failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleTestConnection = async (type: 'source' | 'target') => {
    const url = type === 'source' ? formData.sourceUrl : formData.targetUrl;
    const namespace = type === 'source' ? formData.sourceNamespace : formData.targetNamespace;
    const username = type === 'source' ? formData.sourceUsername : formData.targetUsername;
    const password = type === 'source' ? formData.sourcePassword : formData.targetPassword;

    if (!url || !namespace || !username || !password) {
      alert('Please fill in all connection details');
      return;
    }

    try {
      const response = await apiService.nacosApi.testConnection({ url, namespace, username, password });
      if (response.success && response.data.connected) {
        setTestResults(prev => ({ ...prev, [type]: true, [`${type}Message`]: 'Connection successful' }));
        alert('Connection successful');
      } else {
        setTestResults(prev => ({ ...prev, [type]: false, [`${type}Message`]: response.data.message }));
        alert('Connection failed: ' + response.data.message);
      }
    } catch (error) {
      console.error('Connection test failed', error);
      setTestResults(prev => ({ ...prev, [type]: false, [`${type}Message`]: error instanceof Error ? error.message : 'Unknown error' }));
      alert('Connection test failed');
    }
  };

  const handleCompare = async (config: NacosConfig) => {
    setComparing(true);
    try {
      const response = await apiService.nacosApi.compare({
        configId: config.id,
        sourceUrl: config.sourceUrl,
        sourceNamespace: config.sourceNamespace,
        sourceUsername: config.sourceUsername,
        sourcePassword: config.sourcePassword,
        targetUrl: config.targetUrl,
        targetNamespace: config.targetNamespace,
        targetUsername: config.targetUsername,
        targetPassword: config.targetPassword,
      });

      if (response.success) {
        const summary: ComparisonSummary = {
          configName: config.name,
          namespace: response.data.namespace,
          sourceUrl: config.sourceUrl,
          targetUrl: config.targetUrl,
          sourceNamespace: config.sourceNamespace,
          targetNamespace: config.targetNamespace,
          sourceRemark: config.sourceRemark,
          targetRemark: config.targetRemark,
          totalFiles: response.data.totalFiles,
          sameCount: response.data.sameCount,
          differentCount: response.data.differentCount,
          sourceOnlyCount: response.data.sourceOnlyCount,
          targetOnlyCount: response.data.targetOnlyCount,
          results: response.data.results,
          comparisonTime: response.data.comparisonTime,
        };
        setCurrentComparison(summary);
        setComparisonVisible(true);
      } else {
        alert('Comparison failed: ' + response.message);
      }
    } catch (error) {
      console.error('Comparison failed', error);
      alert('Comparison failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setComparing(false);
    }
  };

  const handleViewDetail = async (result: ComparisonResult) => {
    setCurrentDetailedResult(result);
    setDetailedDiffLoading(true);
    try {
      const response = await apiService.nacosApi.compareDetailed({
        dataId: result.dataId,
        group: result.group,
        sourceContent: result.sourceContent,
        targetContent: result.targetContent,
      });

      if (response.success) {
        setDetailedDiffData(response.data);
        setDetailedDiffVisible(true);
      } else {
        alert('Failed to load detailed diff: ' + response.message);
      }
    } catch (error) {
      console.error('Failed to load detailed diff', error);
      alert('Failed to load detailed diff');
    } finally {
      setDetailedDiffLoading(false);
    }
  };

  // ============ Excel Export ============
  const createComparisonWorksheet = (workbook: ExcelJS.Workbook, result: ComparisonResult, sheetName: string = '详细对比') => {
    const worksheet = workbook.addWorksheet(sheetName);
    
    worksheet.columns = [
      { width: 12 },
      { width: 12 },
      { width: 50 },
      { width: 50 },
    ];

    const headerRow = worksheet.addRow(['行号', '变更类型', '源内容', '目标内容']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerRow.height = 25;

    const sourceLines = result.sourceContent.split('\n');
    const targetLines = result.targetContent.split('\n');
    const maxLines = Math.max(sourceLines.length, targetLines.length);

    for (let i = 0; i < maxLines; i++) {
      const sourceLine = sourceLines[i] || '';
      const targetLine = targetLines[i] || '';
      const isChanged = sourceLine !== targetLine && sourceLine && targetLine;
      const isSourceOnly = sourceLine && !targetLine;
      const isTargetOnly = !sourceLine && targetLine;

      const row = worksheet.addRow([
        i + 1,
        isSourceOnly ? '新增' : isTargetOnly ? '删除' : isChanged ? '修改' : '相同',
        sourceLine,
        targetLine,
      ]);

      row.alignment = { wrapText: true, vertical: 'top' };
      row.height = 30;

      if (isSourceOnly) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF51CF66' } };
      } else if (isTargetOnly) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
      } else if (isChanged) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB3B' } };
      } else if (i % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      }
    }

    return worksheet;
  };

  const createDescriptionSheet = (workbook: ExcelJS.Workbook, title: string, description: Record<string, string>) => {
    const sheet = workbook.addWorksheet('说明');
    sheet.columns = [
      { width: 25 },
      { width: 60 },
    ];

    const titleRow = sheet.addRow([title]);
    titleRow.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    titleRow.alignment = { horizontal: 'left', vertical: 'middle' };
    titleRow.height = 25;
    sheet.mergeCells(`A1:B1`);

    sheet.addRow([]);

    Object.entries(description).forEach(([key, value]) => {
      const row = sheet.addRow([key, value]);
      row.font = { size: 11 };
      row.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      row.height = 25;

      const keyCell = row.getCell(1);
      keyCell.font = { bold: true, size: 11, color: { argb: 'FF1F4E78' } };
      keyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0F7' } };
    });

    return sheet;
  };

  const downloadSingleFile = async (result: ComparisonResult) => {
    try {
      const workbook = new ExcelJS.Workbook();

      // Sheet 1: Detailed comparison
      const worksheet = workbook.addWorksheet('详细对比');
      worksheet.columns = [
        { width: 12 },
        { width: 12 },
        { width: 50 },
        { width: 50 },
      ];

      const headerRow = worksheet.addRow(['行号', '变更类型', '源内容', '目标内容']);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      headerRow.height = 25;

      // Handle different status types
      if (result.status === 'source-only') {
        // 源独有：标记为新增（需要添加到目标）
        const sourceLines = result.sourceContent.split('\n');
        sourceLines.forEach((line, idx) => {
          if (line.trim()) {
            const excelRow = worksheet.addRow([
              idx + 1,
              '新增',
              line,
              '',
            ]);
            excelRow.alignment = { wrapText: true, vertical: 'top' };
            excelRow.height = 30;
            excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF51CF66' } };
          }
        });
      } else if (result.status === 'target-only') {
        // 目标独有：标记为删除（需要从目标删除）
        const targetLines = result.targetContent.split('\n');
        targetLines.forEach((line, idx) => {
          if (line.trim()) {
            const excelRow = worksheet.addRow([
              idx + 1,
              '删除',
              '',
              line,
            ]);
            excelRow.alignment = { wrapText: true, vertical: 'top' };
            excelRow.height = 30;
            excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
          }
        });
      } else {
        // 其他情况（same/different）：获取详细差异
        let detailedData: DetailedDiffResult | null = null;
        try {
          const response = await apiService.nacosApi.compareDetailed({
            dataId: result.dataId,
            group: result.group,
            sourceContent: result.sourceContent,
            targetContent: result.targetContent,
          });
          if (response.success) {
            detailedData = response.data;
          }
        } catch (error) {
          console.warn('Could not fetch detailed diff', error);
        }

        if (detailedData) {
          detailedData.diffRows.forEach((row, idx) => {
            const typeText = row.tag === 'DELETE' ? '删除' : row.tag === 'INSERT' ? '新增' : row.tag === 'CHANGE' ? '修改' : '相同';
            const excelRow = worksheet.addRow([
              idx + 1,
              typeText,
              row.oldLine,
              row.newLine,
            ]);

            excelRow.alignment = { wrapText: true, vertical: 'top' };
            excelRow.height = 30;

            if (row.tag === 'DELETE') {
              excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
            } else if (row.tag === 'INSERT') {
              excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF51CF66' } };
            } else if (row.tag === 'CHANGE') {
              excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB3B' } };
            } else if (idx % 2 === 0) {
              excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
            }
          });
        } else {
          // Fallback: line-by-line comparison
          const sourceLines = result.sourceContent.split('\n');
          const targetLines = result.targetContent.split('\n');
          const maxLines = Math.max(sourceLines.length, targetLines.length);

          for (let i = 0; i < maxLines; i++) {
            const sourceLine = sourceLines[i] || '';
            const targetLine = targetLines[i] || '';
            const isChanged = sourceLine !== targetLine && sourceLine && targetLine;
            const isSourceOnly = sourceLine && !targetLine;
            const isTargetOnly = !sourceLine && targetLine;

            const row = worksheet.addRow([
              i + 1,
              isSourceOnly ? '新增' : isTargetOnly ? '删除' : isChanged ? '修改' : '相同',
              sourceLine,
              targetLine,
            ]);

            row.alignment = { wrapText: true, vertical: 'top' };
            row.height = 30;

            if (isSourceOnly) {
              row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF51CF66' } };
            } else if (isTargetOnly) {
              row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
            } else if (isChanged) {
              row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB3B' } };
            } else if (i % 2 === 0) {
              row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
            }
          }
        }
      }

      // Sheet 2: Description and suggestions
      const description: Record<string, string> = {
        'DataId': result.dataId,
        'Group': result.group,
        '状态': result.status === 'same' ? '一致' : result.status === 'different' ? '差异' : result.status === 'source-only' ? '源独有（需新增）' : '目标独有（需删除）',
        '同步建议': result.suggestion || '无特殊说明',
        '源内容行数': result.sourceContent.split('\n').length.toString(),
        '目标内容行数': result.targetContent.split('\n').length.toString(),
        '导出时间': new Date().toLocaleString('zh-CN'),
      };

      createDescriptionSheet(workbook, `配置对比说明: ${result.dataId}`, description);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${result.dataId}_comparison_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export', error);
      alert('Export failed');
    }
  };

  const downloadAllComparisons = async () => {
    if (!currentComparison) return;

    try {
      const workbook = new ExcelJS.Workbook();

      // Sheet 1: Summary Overview
      const summarySheet = workbook.addWorksheet('对比概览');
      summarySheet.columns = [
        { width: 30 },
        { width: 15 },
        { width: 60 },
      ];

      const headerRow = summarySheet.addRow(['DataId', 'Status', 'Group']);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'top' };
      headerRow.height = 25;

      currentComparison.results.forEach((result, idx) => {
        const statusText = 
          result.status === 'same' ? '✓ 一致' :
          result.status === 'different' ? '⚠ 差异' :
          result.status === 'source-only' ? '→ 源独有' :
          '← 目标独有';

        const row = summarySheet.addRow([result.dataId, statusText, result.group]);
        row.alignment = { wrapText: true, vertical: 'middle' };
        row.height = 20;

        if (result.status === 'same') {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
        } else if (result.status === 'different') {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
        } else if (result.status === 'source-only') {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
        } else {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
        }
      });

      // Sheet 2-N: Add detailed comparison worksheets for each result
      for (const result of currentComparison.results) {
        // Create sheet name (max 31 chars, Excel sheet limit)
        const sheetBaseName = `${result.dataId}_${result.group}`.replace(/[\/\?\*\[\]]/g, '_');
        const idx = currentComparison.results.indexOf(result);
        const sheetName = sheetBaseName.length > 31 ? sheetBaseName.substring(0, 27) + `_${idx}` : sheetBaseName;
        
        const worksheet = workbook.addWorksheet(sheetName);
        worksheet.columns = [
          { width: 12 },
          { width: 12 },
          { width: 50 },
          { width: 50 },
        ];

        const headerRow = worksheet.addRow(['行号', '变更类型', '源内容', '目标内容']);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        headerRow.height = 25;

        // Handle different status types
        if (result.status === 'source-only') {
          // 源独有：标记为新增（需要添加到目标）
          const sourceLines = result.sourceContent.split('\n');
          sourceLines.forEach((line, lineIdx) => {
            if (line.trim()) {
              const excelRow = worksheet.addRow([
                lineIdx + 1,
                '新增',
                line,
                '',
              ]);
              excelRow.alignment = { wrapText: true, vertical: 'top' };
              excelRow.height = 30;
              excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF51CF66' } };
            }
          });
        } else if (result.status === 'target-only') {
          // 目标独有：标记为删除（需要从目标删除）
          const targetLines = result.targetContent.split('\n');
          targetLines.forEach((line, lineIdx) => {
            if (line.trim()) {
              const excelRow = worksheet.addRow([
                lineIdx + 1,
                '删除',
                '',
                line,
              ]);
              excelRow.alignment = { wrapText: true, vertical: 'top' };
              excelRow.height = 30;
              excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
            }
          });
        } else if (result.status === 'same') {
          // 一致：显示为相同
          const sourceLines = result.sourceContent.split('\n');
          sourceLines.forEach((line, lineIdx) => {
            if (line.trim()) {
              const excelRow = worksheet.addRow([
                lineIdx + 1,
                '相同',
                line,
                line,
              ]);
              excelRow.alignment = { wrapText: true, vertical: 'top' };
              excelRow.height = 30;
              if (lineIdx % 2 === 0) {
                excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
              }
            }
          });
        } else {
          // 差异：获取详细的行级差异
          let detailedData: DetailedDiffResult | null = null;
          try {
            const response = await apiService.nacosApi.compareDetailed({
              dataId: result.dataId,
              group: result.group,
              sourceContent: result.sourceContent,
              targetContent: result.targetContent,
            });
            if (response.success) {
              detailedData = response.data;
            }
          } catch (error) {
            console.warn('Could not fetch detailed diff', error);
          }

          if (detailedData) {
            detailedData.diffRows.forEach((row, lineIdx) => {
              const typeText = row.tag === 'DELETE' ? '删除' : row.tag === 'INSERT' ? '新增' : row.tag === 'CHANGE' ? '修改' : '相同';
              const excelRow = worksheet.addRow([
                lineIdx + 1,
                typeText,
                row.oldLine,
                row.newLine,
              ]);

              excelRow.alignment = { wrapText: true, vertical: 'top' };
              excelRow.height = 30;

              if (row.tag === 'DELETE') {
                excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
              } else if (row.tag === 'INSERT') {
                excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF51CF66' } };
              } else if (row.tag === 'CHANGE') {
                excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB3B' } };
              } else if (lineIdx % 2 === 0) {
                excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
              }
            });
          } else {
            // Fallback: line-by-line comparison
            const sourceLines = result.sourceContent.split('\n');
            const targetLines = result.targetContent.split('\n');
            const maxLines = Math.max(sourceLines.length, targetLines.length);

            for (let i = 0; i < maxLines; i++) {
              const sourceLine = sourceLines[i] || '';
              const targetLine = targetLines[i] || '';
              const isChanged = sourceLine !== targetLine && sourceLine && targetLine;
              const isSourceOnly = sourceLine && !targetLine;
              const isTargetOnly = !sourceLine && targetLine;

              const row = worksheet.addRow([
                i + 1,
                isSourceOnly ? '新增' : isTargetOnly ? '删除' : isChanged ? '修改' : '相同',
                sourceLine,
                targetLine,
              ]);

              row.alignment = { wrapText: true, vertical: 'top' };
              row.height = 30;

              if (isSourceOnly) {
                row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF51CF66' } };
              } else if (isTargetOnly) {
                row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
              } else if (isChanged) {
                row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB3B' } };
              } else if (i % 2 === 0) {
                row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
              }
            }
          }
        }
      }

      // Last Sheet: Summary description
      const descData: Record<string, string> = {
        '配置名称': currentComparison.configName,
        '源环境 URL': currentComparison.sourceUrl || '-',
        '源命名空间': currentComparison.sourceNamespace || '-',
        '源环境备注': currentComparison.sourceRemark || '-',
        '目标环境 URL': currentComparison.targetUrl || '-',
        '目标命名空间': currentComparison.targetNamespace || '-',
        '目标环境备注': currentComparison.targetRemark || '-',
        '总配置数': currentComparison.totalFiles.toString(),
        '一致': `${currentComparison.sameCount} (${((currentComparison.sameCount / currentComparison.totalFiles) * 100).toFixed(1)}%)`,
        '差异': `${currentComparison.differentCount} (${((currentComparison.differentCount / currentComparison.totalFiles) * 100).toFixed(1)}%)`,
        '源独有': `${currentComparison.sourceOnlyCount} (${((currentComparison.sourceOnlyCount / currentComparison.totalFiles) * 100).toFixed(1)}%)`,
        '目标独有': `${currentComparison.targetOnlyCount} (${((currentComparison.targetOnlyCount / currentComparison.totalFiles) * 100).toFixed(1)}%)`,
        '比对时间': currentComparison.comparisonTime,
        '导出时间': new Date().toLocaleString('zh-CN'),
      };
      createDescriptionSheet(workbook, '比对结果说明', descData);

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentComparison.configName}_all_comparisons_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export all comparisons', error);
      alert('Export failed');
    }
  };

  // ============ Render ============
  return (
    <div className="p-6 h-full flex flex-col bg-slate-50">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <GitCompare className="text-blue-600" size={28} />
              Nacos 配置同步
            </h2>
            <p className="text-slate-500 text-sm mt-1">配置文件版本比对与增量同步</p>
          </div>
          <button
            onClick={handleAddConfig}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors text-sm font-medium shadow-sm"
          >
            <Plus size={16}/> 新增配置
          </button>
        </div>

        {/* Configs Selection Area */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-700">同步任务</h3>
            <span className="text-xs text-slate-500 font-mono">{configs.length} 个配置</span>
          </div>

          {configs.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500 text-sm">暂无保存的配置</p>
              <p className="text-slate-400 text-xs mt-1">点击顶部"新增配置"按钮开始创建</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="p-6 hover:bg-slate-50 transition-colors group border-b last:border-b-0"
                >
                  <div className="flex flex-col gap-4">
                    <h4 className="font-bold text-slate-800 text-lg">{config.name}</h4>
                    <div className="flex gap-6 items-start">
                      {/* Source Environment */}
                      <div className="flex-1 bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500"/>
                          <span className="text-base font-semibold text-slate-600">源环境</span>
                        </div>
                        <p className="text-base font-mono text-slate-800 truncate mb-1">{config.sourceUrl}</p>
                        <p className="text-base text-slate-600 truncate mb-1">{config.sourceNamespace}</p>
                        {config.sourceRemark && <p className="text-xs text-slate-500 italic">{config.sourceRemark}</p>}
                      </div>

                      {/* Arrow */}
                      <div className="flex justify-center items-center px-2 pt-4">
                        <ArrowRight size={20} className="text-slate-300"/>
                      </div>

                      {/* Target Environment with Buttons */}
                      <div className="flex-1 flex gap-2 items-start opacity-100 group-hover:opacity-100 transition-opacity">
                        {/* Target Environment Box */}
                        <div className="flex-1 bg-purple-50 p-4 rounded-lg border border-purple-100">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-purple-500"/>
                            <span className="text-base font-semibold text-slate-600">目标环境</span>
                          </div>
                          <p className="text-base font-mono text-slate-800 truncate mb-1">{config.targetUrl}</p>
                          <p className="text-base text-slate-600 truncate mb-1">{config.targetNamespace}</p>
                          {config.targetRemark && <p className="text-xs text-slate-500 italic">{config.targetRemark}</p>}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 flex-col justify-start">
                          <button
                            onClick={() => handleCompare(config)}
                            disabled={comparing}
                            title="比较配置"
                            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-sm font-bold transition-colors whitespace-nowrap"
                          >
                            <Play size={16}/> 比较
                          </button>
                          <button
                            onClick={() => handleEditConfig(config)}
                            title="编辑配置"
                            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold transition-colors whitespace-nowrap"
                          >
                            <Edit2 size={16}/> 编辑
                          </button>
                          <button
                            onClick={() => handleDeleteConfig(config.id)}
                            title="删除配置"
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-bold transition-colors whitespace-nowrap"
                          >
                            <Trash2 size={16}/> 删除
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Config Modal */}
      {isModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">{editingConfig ? '编辑配置' : '新增配置'}</h3>
              <button onClick={() => setIsModalVisible(false)} className="text-slate-500 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Config Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">配置名称 *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如：开发到生产环境同步"
                />
              </div>

              {/* Source Environment */}
              <div className="border-t pt-4">
                <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"/> 源环境 (Source)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">URL *</label>
                    <input
                      type="text"
                      value={formData.sourceUrl || ''}
                      onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="http://localhost:8848"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">命名空间 *</label>
                    <input
                      type="text"
                      value={formData.sourceNamespace || ''}
                      onChange={(e) => setFormData({ ...formData, sourceNamespace: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="public"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">用户名 *</label>
                    <input
                      type="text"
                      value={formData.sourceUsername || ''}
                      onChange={(e) => setFormData({ ...formData, sourceUsername: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="admin"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">密码 *</label>
                    <input
                      type="password"
                      value={formData.sourcePassword || ''}
                      onChange={(e) => setFormData({ ...formData, sourcePassword: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">备注</label>
                    <input
                      type="text"
                      value={formData.sourceRemark || ''}
                      onChange={(e) => setFormData({ ...formData, sourceRemark: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="如：开发环境服务器"
                    />
                  </div>
                  <button
                    onClick={() => handleTestConnection('source')}
                    className="col-span-2 px-4 py-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 font-semibold flex items-center justify-center gap-1"
                  >
                    <Play size={14} /> 测试连接
                  </button>
                  {testResults.source !== undefined && (
                    <div className={`col-span-2 p-3 rounded-lg ${testResults.source ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {testResults.sourceMessage || (testResults.source ? '连接成功' : '连接失败')}
                    </div>
                  )}
                </div>
              </div>

              {/* Target Environment */}
              <div className="border-t pt-4">
                <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500"/> 目标环境 (Target)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">URL *</label>
                    <input
                      type="text"
                      value={formData.targetUrl || ''}
                      onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="http://target:8848"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">命名空间 *</label>
                    <input
                      type="text"
                      value={formData.targetNamespace || ''}
                      onChange={(e) => setFormData({ ...formData, targetNamespace: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="public"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">用户名 *</label>
                    <input
                      type="text"
                      value={formData.targetUsername || ''}
                      onChange={(e) => setFormData({ ...formData, targetUsername: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="admin"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">密码 *</label>
                    <input
                      type="password"
                      value={formData.targetPassword || ''}
                      onChange={(e) => setFormData({ ...formData, targetPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">备注</label>
                    <input
                      type="text"
                      value={formData.targetRemark || ''}
                      onChange={(e) => setFormData({ ...formData, targetRemark: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="如：生产环境服务器"
                    />
                  </div>
                  <button
                    onClick={() => handleTestConnection('target')}
                    className="col-span-2 px-4 py-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 font-semibold flex items-center justify-center gap-1"
                  >
                    <Play size={14} /> 测试连接
                  </button>
                  {testResults.target !== undefined && (
                    <div className={`col-span-2 p-3 rounded-lg ${testResults.target ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {testResults.targetMessage || (testResults.target ? '连接成功' : '连接失败')}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setIsModalVisible(false)}
                  className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveConfig}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2"
                >
                  <Save size={18} /> 保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Results Modal */}
      {comparisonVisible && currentComparison && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-6 border-b border-slate-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    📊 {currentComparison.configName} - 比较结果
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">完成时间：{currentComparison.comparisonTime}</p>
                </div>
                <button onClick={() => setComparisonVisible(false)} className="text-slate-500 hover:text-slate-700">
                  <X size={24} />
                </button>
              </div>

              {/* Environment Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <p className="font-semibold text-slate-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"/> 源环境
                  </p>
                  <p className="text-slate-600">{currentComparison.sourceUrl}</p>
                  <p className="text-xs text-slate-500">{currentComparison.sourceNamespace}</p>
                  {currentComparison.sourceRemark && <p className="text-xs text-slate-500">{currentComparison.sourceRemark}</p>}
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <p className="font-semibold text-slate-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500"/> 目标环境
                  </p>
                  <p className="text-slate-600">{currentComparison.targetUrl}</p>
                  <p className="text-xs text-slate-500">{currentComparison.targetNamespace}</p>
                  {currentComparison.targetRemark && <p className="text-xs text-slate-500">{currentComparison.targetRemark}</p>}
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md">
                <p className="text-3xl font-bold text-slate-800">📋 {currentComparison.totalFiles}</p>
                <p className="text-sm text-slate-600">总配置数</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md">
                <p className="text-3xl font-bold text-green-600">✅ {currentComparison.sameCount}</p>
                <p className="text-sm text-slate-600">一致 ({((currentComparison.sameCount / currentComparison.totalFiles) * 100).toFixed(1)}%)</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md">
                <p className="text-3xl font-bold text-red-600">⚠️ {currentComparison.differentCount}</p>
                <p className="text-sm text-slate-600">差异 ({((currentComparison.differentCount / currentComparison.totalFiles) * 100).toFixed(1)}%)</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md">
                <p className="text-3xl font-bold text-orange-600">→ {currentComparison.sourceOnlyCount}</p>
                <p className="text-sm text-slate-600">源独有 ({((currentComparison.sourceOnlyCount / currentComparison.totalFiles) * 100).toFixed(1)}%)</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md">
                <p className="text-3xl font-bold text-blue-600">← {currentComparison.targetOnlyCount}</p>
                <p className="text-sm text-slate-600">目标独有 ({((currentComparison.targetOnlyCount / currentComparison.totalFiles) * 100).toFixed(1)}%)</p>
              </div>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-3">
                {currentComparison.results.map((result, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-4 rounded-lg border border-slate-200 hover:shadow-md transition-shadow group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">{result.dataId}</p>
                        <p className="text-xs text-slate-500">{result.group}</p>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded ${
                          result.status === 'same'
                            ? 'bg-green-100 text-green-700'
                            : result.status === 'different'
                            ? 'bg-red-100 text-red-700'
                            : result.status === 'source-only'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {result.status === 'same' ? '✓ 一致' : result.status === 'different' ? '⚠ 差异' : result.status === 'source-only' ? '→ 源独有' : '← 目标独有'}
                      </span>
                    </div>
                    {result.suggestion && <p className="text-sm text-slate-600 mb-3">建议：{result.suggestion}</p>}
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleViewDetail(result)}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200 font-semibold"
                      >
                        查看详情
                      </button>
                      <button
                        onClick={() => downloadSingleFile(result)}
                        className="px-3 py-1 text-xs bg-green-100 text-green-600 rounded hover:bg-green-200 font-semibold flex items-center gap-1"
                      >
                        <Download size={12} /> 导出 Excel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center">
              <p className="text-sm text-slate-600">
                {currentComparison.results.filter((r) => r.status !== 'same').length} 项需要处理
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setComparisonVisible(false)}
                  className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold"
                >
                  关闭
                </button>
                <button
                  onClick={downloadAllComparisons}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-semibold flex items-center gap-2"
                >
                  📊 导出全部 Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Diff Modal */}
      {detailedDiffVisible && currentDetailedResult && detailedDiffData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-slate-800 text-white px-6 py-4 border-b border-slate-700 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">详细差异对比</h3>
                <p className="text-xs text-slate-300 mt-1">
                  {currentDetailedResult.dataId} - {currentDetailedResult.group}
                </p>
              </div>
              <button onClick={() => setDetailedDiffVisible(false)} className="text-slate-300 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            {detailedDiffLoading ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <p className="text-slate-600">加载详细差异中...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-2 gap-1 h-full">
                  {/* Source Column */}
                  <div className="flex flex-col bg-blue-50 border-r border-slate-200">
                    <div className="sticky top-0 bg-blue-600 text-white px-4 py-2 font-bold text-sm">源内容</div>
                    <div className="flex-1 p-4 font-mono text-xs overflow-auto">
                      {detailedDiffData.diffRows.map((row, idx) => (
                        <div key={idx} className={row.tag === 'DELETE' ? 'bg-red-100 text-red-800' : row.tag === 'CHANGE' ? 'bg-yellow-100 text-yellow-800' : ''}>
                          <span className="text-slate-500">{row.oldLineNumber || '-'}</span> {row.oldLine}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Target Column */}
                  <div className="flex flex-col bg-green-50 border-l border-slate-200">
                    <div className="sticky top-0 bg-green-600 text-white px-4 py-2 font-bold text-sm">目标内容</div>
                    <div className="flex-1 p-4 font-mono text-xs overflow-auto">
                      {detailedDiffData.diffRows.map((row, idx) => (
                        <div key={idx} className={row.tag === 'INSERT' ? 'bg-green-100 text-green-800' : row.tag === 'CHANGE' ? 'bg-yellow-100 text-yellow-800' : ''}>
                          <span className="text-slate-500">{row.newLineNumber || '-'}</span> {row.newLine}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="sticky bottom-0 bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center">
              <div className="text-sm text-slate-600">
                <span>总行数：{detailedDiffData.totalLines}</span>
                <span className="mx-2">|</span>
                <span>修改：{detailedDiffData.changedLines}</span>
                <span className="mx-2">|</span>
                <span>新增：{detailedDiffData.insertedLines}</span>
                <span className="mx-2">|</span>
                <span>删除：{detailedDiffData.deletedLines}</span>
              </div>
              <button
                onClick={() => setDetailedDiffVisible(false)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
