import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Copy, Code, ArrowRightLeft, Database, Plus, Trash2, Download, Save, FileDown, Upload, ChevronRight, ChevronDown, FolderPlus, Layers, FileCode } from 'lucide-react';
import { generateXml, generateJava } from '../../services/xmlParser'; // 假设路径不变
import { XmlTransaction, XmlField } from '../../types';
import { recordAction } from '../../services/auditService';
import { apiService } from '../../services/apiService';
import { remoteCodeService, RemoteInterface } from '../../services/remoteCodeService';
import { downloadImportTemplate, importFieldsFromExcel, exportFieldsToExcel, exportTransactionToExcel } from '../../services/excelImportExport';
import { downloadBatchImportTemplate, importInterfacesFromExcel, convertToTransactions } from '../../services/batchInterfaceImport';

// --- 类型定义 ---
interface FlatField {
  path: number[];
  field: XmlField;
  depth: number;
  isLastChild: boolean;
}

// --- 样式常量 ---
const GRID_COLS = "grid-template-columns: 100px 1.5fr 2fr 140px 40px;"; // 定义列宽
const INPUT_BASE = "w-full h-full px-2 py-1.5 bg-transparent outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 text-sm transition-colors border-r border-transparent focus:border-blue-400 placeholder:text-slate-300";
const HEADER_STYLE = "px-2 py-2 text-xs font-bold text-slate-500 uppercase bg-slate-100 border-r border-slate-200 last:border-r-0";

// 折叠状态管理（使用 path 作为 key）
type ExpandedMap = Record<string, boolean>;

// --- 辅助函数：扁平化树结构，用于计算粘贴时的行索引 ---
const flattenFields = (fields: XmlField[], path: number[] = [], depth = 0): FlatField[] => {
  let result: FlatField[] = [];
  fields.forEach((field, index) => {
    const currentPath = [...path, index];
    result.push({ path: currentPath, field, depth, isLastChild: index === fields.length - 1 });
    if ((field.type === 'array' || field.type === 'object') && field.children) {
      result = result.concat(flattenFields(field.children, currentPath, depth + 1));
    }
  });
  return result;
};

// --- 组件：Excel 风格树形行 ---
interface GridRowProps {
  item: FlatField;
  index: number;
  onUpdate: (path: number[], updates: Partial<XmlField>) => void;
  onPaste: (e: React.ClipboardEvent, path: number[], colKey: string) => void;
  onAddSibling: (path: number[]) => void;
  onAddChild: (path: number[]) => void;
  onRemove: (path: number[]) => void;
  isExpanded?: boolean;
  onToggleExpanded?: (path: number[]) => void;
}

const GridRow: React.FC<GridRowProps> = ({ item, index, onUpdate, onPaste, onAddSibling, onAddChild, onRemove, isExpanded = true, onToggleExpanded }) => {
  const { field, path, depth } = item;
  const isContainer = field.type === 'array' || field.type === 'object';

  // 计算缩进样式
  const indentStyle = { paddingLeft: `${depth * 20 + 8}px` };

  return (
    <div className="group border-b border-slate-100 hover:bg-slate-50 transition-colors grid" style={{ gridTemplateColumns: '100px 1.5fr 2fr 140px 40px' }}>
      {/* 1. Type Column */}
      <div className="border-r border-slate-200 relative">
         <select
          value={field.type}
          onChange={(e) => {
            const newType = e.target.value;
            const updates: Partial<XmlField> = { type: newType };
            // 如果切换到容器类型（array/object），初始化 children
            if ((newType === 'array' || newType === 'object') && !field.children) {
              updates.children = [];
            }
            // 如果切换到非容器类型，清空 children
            if (newType !== 'array' && newType !== 'object') {
              updates.children = undefined;
            }
            onUpdate(path, updates);
            
            // ✅ 如果改为容器类型，自动展开该容器（便于粘贴）
            if ((newType === 'array' || newType === 'object') && !field.children) {
              const pathKey = path.join('.');
              onToggleExpanded?.(path);  // 自动展开
            }
          }}
          className="w-full h-full bg-transparent px-2 text-xs font-bold text-blue-600 outline-none cursor-pointer appearance-none hover:bg-blue-50"
        >
          <option value="field">Field</option>
          <option value="string">String</option>
          <option value="date">Date</option>
          <option value="array">Array</option>
          <option value="object">Object</option>
        </select>
        {/* 指示箭头 */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-blue-300">
           <ChevronDown size={10} />
        </div>
      </div>

      {/* 2. Name / Tag Column (带层级缩进) */}
      <div className="border-r border-slate-200 relative flex items-center bg-gradient-to-r from-transparent to-transparent hover:from-blue-50/30">
        <div style={{ width: `${depth * 16}px` }} className="flex-shrink-0 h-full border-r border-transparent"></div>
        
        {/* 容器折叠按钮 */}
        {isContainer && (
          <button
            onClick={() => onToggleExpanded?.(path)}
            className="flex-shrink-0 p-0.5 hover:bg-blue-100 rounded text-blue-600 transition-colors"
            title={isExpanded ? "收起容器" : "展开容器"}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        {!isContainer && depth > 0 && <div className="text-slate-300 mr-1"><ChevronRight size={12}/></div>}
        
        <input
          value={field.name}
          onChange={(e) => onUpdate(path, { name: e.target.value })}
          onPaste={(e) => onPaste(e, path, 'name')}
          placeholder={isContainer ? (field.type === 'array' ? 'arrayName (粘贴可添加子项)' : 'objectName (粘贴可添加子项)') : 'fieldName'}
          className={`${INPUT_BASE} font-mono text-slate-700 ${isContainer ? 'bg-blue-50 placeholder:text-blue-300 font-semibold' : ''}`}
        />
        {/* 容器标记 */}
        {isContainer && (
          <span className="ml-1 text-xs font-bold text-blue-500 whitespace-nowrap">
            {field.type === 'array' ? `[${field.children?.length || 0}]` : `{${field.children?.length || 0}}`}
          </span>
        )}
      </div>

      {/* 3. Description Column */}
      <div className="border-r border-slate-200">
        <input
          value={field.description}
          onChange={(e) => onUpdate(path, { description: e.target.value })}
          onPaste={(e) => onPaste(e, path, 'description')}
          placeholder="Description"
          className={INPUT_BASE}
        />
      </div>

      {/* 4. Style / Pattern Column */}
      <div className="border-r border-slate-200">
        {!isContainer && (
          <input
            value={field.type === 'date' ? (field.pattern || '') : (field.style || '')}
            onChange={(e) => onUpdate(path, field.type === 'date' ? { pattern: e.target.value } : { style: e.target.value })}
            onPaste={(e) => onPaste(e, path, 'style')}
            placeholder={field.type === 'date' ? 'yyyy-MM-dd' : 'Text'}
            className={`${INPUT_BASE} text-xs text-slate-500`}
          />
        )}
      </div>

      {/* 5. Actions Column */}
      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isContainer && (
          <>
            <button 
              onClick={() => onAddChild(path)} 
              className="text-green-500 hover:bg-green-100 p-1 rounded" 
              title={`添加 ${field.type === 'array' ? '数组元素' : '对象属性'}`}
            >
              <Plus size={14} />
            </button>
          </>
        )}
        <button 
          onClick={() => onRemove(path)} 
          className="text-red-400 hover:bg-red-100 p-1 rounded" 
          title="删除"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

// --- 组件：主网格容器 ---
interface ExcelFieldGridProps {
  fields: XmlField[];
  onChange: (newFields: XmlField[]) => void;
}

const ExcelFieldGrid: React.FC<ExcelFieldGridProps> = ({ fields, onChange }) => {
  const [expandedMap, setExpandedMap] = React.useState<ExpandedMap>({});
  
  // 扁平化字段时，应用折叠过滤
  const flattenFieldsWithCollapse = (fields: XmlField[], path: number[] = [], depth = 0): FlatField[] => {
    let result: FlatField[] = [];
    fields.forEach((field, index) => {
      const currentPath = [...path, index];
      const pathKey = currentPath.join('.');
      result.push({ path: currentPath, field, depth, isLastChild: index === fields.length - 1 });
      
      // 如果容器是展开状态，才显示其子项
      if ((field.type === 'array' || field.type === 'object') && field.children && expandedMap[pathKey] !== false) {
        result = result.concat(flattenFieldsWithCollapse(field.children, currentPath, depth + 1));
      }
    });
    return result;
  };
  
  // 深度更新辅助函数
  const updateFieldInTree = (list: XmlField[], path: number[], updates: Partial<XmlField>): XmlField[] => {
    const [idx, ...rest] = path;
    const newList = [...list];
    if (rest.length === 0) {
      newList[idx] = { ...newList[idx], ...updates };
    } else {
      newList[idx] = {
        ...newList[idx],
        children: updateFieldInTree(newList[idx].children || [], rest, updates)
      };
    }
    return newList;
  };

  // 添加同级节点
  const addSibling = (list: XmlField[], path: number[]): XmlField[] => {
     // 实际上这里的 path 是当前节点的 path，我们需要在这个 path 的父级数组中插入
     // 简化逻辑：我们通常在根或者容器下添加。
     // 这里简化为：由外部控制，或者我们需要父级 path。
     // 为了简单，我们只实现 "Add Child" 和 "Add Root"。
     // 如果要实现真正的 excel 回车换行新增，需要更复杂的 path 计算。
     return list; 
  };
  
  // 添加子节点
  const addChild = (list: XmlField[], path: number[]): XmlField[] => {
    const [idx, ...rest] = path;
    const newList = [...list];
    if (rest.length === 0) {
      const children = newList[idx].children || [];
      newList[idx] = {
        ...newList[idx],
        children: [...children, { name: '', type: 'field', description: '', style: '' }]
      };
    } else {
      newList[idx] = {
        ...newList[idx],
        children: addChild(newList[idx].children || [], rest)
      };
    }
    return newList;
  };

  // 删除节点
  const removeField = (list: XmlField[], path: number[]): XmlField[] => {
    const [idx, ...rest] = path;
    const newList = [...list];
    if (rest.length === 0) {
      newList.splice(idx, 1);
    } else {
      newList[idx] = {
        ...newList[idx],
        children: removeField(newList[idx].children || [], rest)
      };
    }
    return newList;
  };

  // --- 核心：批量粘贴逻辑（支持 Array/Object 容器内的多行自适应插入） ---
  const handlePaste = (e: React.ClipboardEvent, startPath: number[], startColKey: string) => {
    e.preventDefault();
    const clipboardData = e.clipboardData.getData('text/plain');
    if (!clipboardData) return;

    const rows = clipboardData.split(/\r\n|\n|\r/).filter(row => row.trim().length > 0);
    if (rows.length === 0) return;

    // 🔧 Bug Fix 4: 检查粘贴数据量，防止过大导致性能问题
    const MAX_ROWS = 500;
    if (rows.length > MAX_ROWS) {
      alert(`❌ 粘贴数据过多！最多支持 ${MAX_ROWS} 行，当前 ${rows.length} 行。\n\n建议：\n1. 分多次粘贴\n2. 使用批量导入功能导入 Excel 文件`);
      return;
    }

    // 1. 扁平化当前树，以便找到 "下一行"
    const flatList = flattenFields(fields);
    const startIndex = flatList.findIndex(f => f.path.join('.') === startPath.join('.'));
    if (startIndex === -1) return;

    // 获取起点字段，检查是否为 array/object 容器
    const startField = flatList[startIndex];
    
    // 🔧 新增逻辑：检查是否粘贴到容器的子项
    // 如果 startPath 的长度 > 1，说明这是一个子项，需要找到它的父容器
    let parentPath: number[] = [];
    let isChildOfContainer = false;
    
    if (startPath.length > 1) {
      // 从 path 中去掉最后一个索引，得到父容器的 path
      parentPath = startPath.slice(0, -1);
      const parentField = flattenFields(fields).find(f => f.path.join('.') === parentPath.join('.'))?.field;
      if (parentField && (parentField.type === 'array' || parentField.type === 'object')) {
        isChildOfContainer = true;
      }
    }
    
    // 🔧 修复：不仅检查 type，还要确保有 children 属性（新容器可能刚初始化）
    const isContainerPaste = (startField.field.type === 'array' || startField.field.type === 'object') 
                            && startColKey === 'name'
                            && startField.field.children !== undefined;

    // 2. 准备列映射顺序
    const targetKeysMap: Record<string, string[]> = {
      'name': ['name', 'description', 'style'],
      'description': ['description', 'style'],
      'style': ['style'],
      'type': ['type', 'name', 'description', 'style']
    };

    const targetKeys = targetKeysMap[startColKey] || ['name', 'description', 'style'];

    let newFields = [...fields];

    // 3. 处理容器粘贴：当粘贴到 Array/Object 的 Name 列，或粘贴到容器的子项时
    if (isContainerPaste || (isChildOfContainer && parentPath)) {
      // 确定实际的容器路径
      const containerPath = isContainerPaste ? startPath : parentPath!;
      
      // 一次性收集所有行的新子字段
      const newChildren: XmlField[] = [];
      
      rows.forEach((rowStr, i) => {
        const cells = rowStr.split('\t').map(c => c.trim());
        // 允许空列，但至少有一个非空单元格
        if (cells.every(c => c.length === 0)) return;
        
        // 自动检测字段类型：根据第一列内容识别
        let fieldType: string = 'field';
        const firstCell = (cells[0] || '').toLowerCase().trim();
        
        if (['array', 'object', 'string', 'date', 'field'].includes(firstCell)) {
          // 如果第一列直接是类型，使用它
          fieldType = firstCell as any;
        } else {
          // 根据名称推断
          if (firstCell.includes('list') || firstCell.includes('array') || firstCell.includes('items')) {
            fieldType = 'array';
          } else if (firstCell.includes('obj') || firstCell.includes('map') || firstCell.includes('info')) {
            fieldType = 'object';
          }
        }
        
        // 创建新子字段
        const newChild: XmlField = { 
          name: cells[0] || `field_${i}`, 
          type: fieldType,
          description: cells[1] || '',
          style: cells[2] || '',
          children: (fieldType === 'array' || fieldType === 'object') ? [] : undefined
        };
        
        newChildren.push(newChild);
      });
      
      // 一次性更新容器：追加所有新子项
      // 🔧 修复：从当前 fields 中获取容器（使用最新的状态）
      const latestContainer = flattenFields(fields).find(f => f.path.join('.') === containerPath.join('.'))?.field;
      if (latestContainer && (latestContainer.type === 'array' || latestContainer.type === 'object')) {
        // 如果粘贴到容器的子项（而非容器本身），需要移除该空子项
        let existingChildren = latestContainer.children || [];
        if (isChildOfContainer && parentPath.length > 0) {
          // 移除 startPath 指向的那个空子项
          const childIndex = startPath[startPath.length - 1];
          existingChildren = existingChildren.filter((_, idx) => idx !== childIndex);
        }
        
        newFields = updateFieldInTree(newFields, containerPath, {
          children: [...existingChildren, ...newChildren]
        });
      }
    } else if (!isChildOfContainer) {
      // 非容器粘贴，且不是粘贴到容器的子项：处理根级别的行
      rows.forEach((rowStr, i) => {
        const cells = rowStr.split('\t').map(c => c.trim());
        // 允许空列，但至少有一个非空单元格
        if (cells.every(c => c.length === 0)) return;
        // 覆盖或追加到根级别
        const targetIndex = startIndex + i;
        let targetPath: number[] | null = null;
        let isNewRow = false;

        if (targetIndex < flatList.length) {
          // 覆盖现有行
          targetPath = flatList[targetIndex].path;
        } else {
          // 追加新行
          const rootIndex = fields.length + (targetIndex - flatList.length);
          targetPath = [rootIndex];
          isNewRow = true;
        }

        if (isNewRow) {
          const newField: XmlField = { name: '', type: 'field', description: '', style: '' };
          cells.forEach((cellVal, colIdx) => {
            if (colIdx < targetKeys.length) {
              const key = targetKeys[colIdx];
              if (key === 'type') {
                newField.type = cellVal;
              } else {
                (newField as any)[key === 'pattern' ? 'style' : key] = cellVal;
              }
            }
          });
          newFields.push(newField);
        } else if (targetPath) {
          const updates: any = {};
          cells.forEach((cellVal, colIdx) => {
            if (colIdx < targetKeys.length) {
              const key = targetKeys[colIdx];
              const currentFieldType = flatList[targetIndex].field.type;
              if (key === 'style') {
                updates[currentFieldType === 'date' ? 'pattern' : 'style'] = cellVal;
              } else {
                updates[key] = cellVal;
              }
            }
          });
          
          if (Object.keys(updates).length > 0) {
            newFields = updateFieldInTree(newFields, targetPath, updates);
          }
        }
      });
    }

    onChange(newFields);
    recordAction('接口管理', `Grid批量粘贴 - 处理 ${rows.length} 行${isContainerPaste ? '(容器内自适应)' : ''}`);
  };

  const flattened = useMemo(() => flattenFieldsWithCollapse(fields), [fields, expandedMap]);

  const toggleExpanded = (path: number[]) => {
    const pathKey = path.join('.');
    setExpandedMap(prev => ({
      ...prev,
      [pathKey]: !(prev[pathKey] ?? true) // 默认展开，点击时切换
    }));
  };

  return (
    <div className="flex flex-col h-full border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div className="grid bg-slate-100 border-b border-slate-300" style={{ gridTemplateColumns: '100px 1.5fr 2fr 140px 40px' }}>
        <div className={HEADER_STYLE}>Type</div>
        <div className={HEADER_STYLE}>Name / Tag</div>
        <div className={HEADER_STYLE}>Description</div>
        <div className={HEADER_STYLE}>Style/Pattern</div>
        <div className={`${HEADER_STYLE} text-center`}>Op</div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {flattened.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-sm">
            暂无字段，请点击下方按钮添加，或直接粘贴 Excel 数据
          </div>
        )}
        {flattened.map((item, idx) => (
          <GridRow
            key={item.path.join('-')}
            index={idx}
            item={item}
            isExpanded={expandedMap[item.path.join('.')] !== false}
            onToggleExpanded={toggleExpanded}
            onUpdate={(path, updates) => onChange(updateFieldInTree(fields, path, updates))}
            onPaste={handlePaste}
            onAddChild={(path) => onChange(addChild(fields, path))}
            onRemove={(path) => onChange(removeField(fields, path))}
            onAddSibling={() => {}} 
          />
        ))}
        
        {/* Append Button Area */}
        <div 
          className="hover:bg-blue-50 cursor-pointer border-t border-dashed border-slate-200 p-2 flex justify-center items-center text-slate-400 hover:text-blue-600 transition-colors"
          onClick={() => onChange([...fields, { name: '', type: 'field', description: '', style: '' }])}
        >
          <Plus size={16} className="mr-2"/> Add Root Field
        </div>
      </div>
    </div>
  );
};

// --- 主页面组件 ---
export const CodeGenerator: React.FC = () => {
  // ... (保留之前的 State 定义: transactions, currentIndex, metaData, templates 等) ...
  const [transactions, setTransactions] = useState<XmlTransaction[]>([{
    id: 'newTransaction',
    template: 'ExecuteLogTemplate',
    trsName: '',
    actionRef: '',
    inputs: [],
    outputs: [],
    module: 'Manual',
    filePath: '',
    actionClass: '',
    downstreamCalls: []
  }]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const formData = transactions[currentIndex];

  const setFormData = (newData: XmlTransaction | ((prev: XmlTransaction) => XmlTransaction)) => {
      setTransactions(prev => {
          const list = [...prev];
          if (typeof newData === 'function') {
            list[currentIndex] = newData(list[currentIndex]);
          } else {
            list[currentIndex] = newData;
          }
          return list;
      });
  };

  const [metaData, setMetaData] = useState({ author: 'pmb', version: '1.0' });
  const [templates, setTemplates] = useState<string[]>(['ExecuteLogTemplate']);
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('request');
  const [outputTab, setOutputTab] = useState<'xml' | 'java'>('xml');
  const [generatedXml, setGeneratedXml] = useState('');
  const [generatedJava, setGeneratedJava] = useState('');
  const [remoteInterfaces, setRemoteInterfaces] = useState<RemoteInterface[]>([]);
  const [showRemoteImport, setShowRemoteImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templateInput, setTemplateInput] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);

  // ... (保留之前的 useEffect 加载逻辑, handleGenerate, handleGenerateAll 等) ...

  const handleGenerate = () => {
    // 🔧 Bug Fix 1: 验证Transaction ID不为空
    if (!formData.id || !formData.id.trim()) {
      alert('❌ Transaction ID 不能为空，请填写有效的ID');
      return;
    }
    
    // 验证ID格式（字母开头，支持驼峰式）
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(formData.id)) {
      alert('❌ Transaction ID 必须以字母开头，仅支持字母和数字');
      return;
    }
    
    const dataToProcess = { ...formData, actionRef: formData.actionRef || `${formData.id}Action` };
    setGeneratedXml(generateXml(dataToProcess));
    setGeneratedJava(generateJava(dataToProcess, metaData.author));
    recordAction('接口管理', '生成单接口代码');
  };

  // 导入模板下载
  const handleDownloadTemplate = () => {
    downloadImportTemplate({ author: metaData.author, version: metaData.version });
    recordAction('接口管理', '下载导入模板');
  };

  // Excel 文件选择处理
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const fields = await importFieldsFromExcel(file);
      handleFieldsChange(fields);
      recordAction('接口管理', `从 Excel 导入字段 - ${activeTab} - 共 ${fields.length} 个`);
      alert('✅ 导入成功！');
    } catch (error) {
      alert(`❌ 导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 导出当前字段到 Excel
  const handleExportFields = () => {
    const currentFields = activeTab === 'request' ? formData.inputs : formData.outputs;
    const fileName = `${formData.id}_${activeTab}`;
    exportFieldsToExcel(currentFields, fileName);
    recordAction('接口管理', `导出字段到 Excel - ${activeTab}`);
  };

  // 导出完整 Transaction 配置
  const handleExportTransaction = () => {
    exportTransactionToExcel(formData);
    recordAction('接口管理', `导出完整配置到 Excel`);
  };

  // 批量导入多个接口 - 下载模板
  const handleDownloadBatchTemplate = () => {
    downloadBatchImportTemplate({ interfaceId: formData.id });
    recordAction('接口管理', '下载批量导入模板');
  };

  // ========== Template 管理函数 ==========
  const handleAddTemplate = () => {
    const trimmed = templateInput.trim();
    if (!trimmed) {
      alert('模板名称不能为空');
      return;
    }
    if (templates.includes(trimmed)) {
      alert('该模板已存在');
      return;
    }
    setTemplates([...templates, trimmed]);
    setTemplateInput('');
    recordAction('接口管理', `新增 Template: ${trimmed}`);
  };

  const handleUpdateTemplate = () => {
    if (!editingTemplate) return;
    const trimmed = templateInput.trim();
    if (!trimmed) {
      alert('模板名称不能为空');
      return;
    }
    if (trimmed !== editingTemplate && templates.includes(trimmed)) {
      alert('该模板已存在');
      return;
    }
    const newTemplates = templates.map(t => t === editingTemplate ? trimmed : t);
    // 如果当前选中的是被修改的模板，也要更新
    if (formData.template === editingTemplate) {
      setFormData(p => ({...p, template: trimmed}));
    }
    setTemplates(newTemplates);
    setTemplateInput('');
    setEditingTemplate(null);
    recordAction('接口管理', `修改 Template: ${editingTemplate} -> ${trimmed}`);
  };

  const handleDeleteTemplate = (template: string) => {
    if (!confirm(`确定删除模板 "${template}" 吗？`)) return;
    if (templates.length === 1) {
      alert('至少保留一个模板');
      return;
    }
    const newTemplates = templates.filter(t => t !== template);
    // 如果删除的是当前选中的，切换到第一个
    if (formData.template === template) {
      setFormData(p => ({...p, template: newTemplates[0]}));
    }
    setTemplates(newTemplates);
    recordAction('接口管理', `删除 Template: ${template}`);
  };

  const handleStartEdit = (template: string) => {
    setEditingTemplate(template);
    setTemplateInput(template);
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setTemplateInput('');
  };

  // 批量导入多个接口 - 导入文件处理
  const handleBatchImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsBatchImporting(true);
    try {
      const importedInterfaces = await importInterfacesFromExcel(file);
      const newTransactions = convertToTransactions(importedInterfaces);
      
      // 替换当前 transactions 列表（或合并）
      setTransactions(prev => {
        // 选择：合并还是替换。这里采用合并策略，避免覆盖已有接口
        const existingIds = new Set(prev.map(t => t.id));
        const newOnes = newTransactions.filter(t => !existingIds.has(t.id));
        return [...prev, ...newOnes];
      });
      
      recordAction('接口管理', `批量导入 ${newTransactions.length} 个接口配置`);
      alert(`✅ 成功导入 ${newTransactions.length} 个接口！`);
    } catch (error) {
      alert(`❌ 批量导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
      console.error('Batch import error:', error);
    } finally {
      setIsBatchImporting(false);
      if (batchFileInputRef.current) batchFileInputRef.current.value = '';
    }
  };

  // 统一字段更新入口
  const handleFieldsChange = (newFields: XmlField[]) => {
    if (activeTab === 'request') {
      setFormData(prev => ({ ...prev, inputs: newFields }));
    } else {
      setFormData(prev => ({ ...prev, outputs: newFields }));
    }
  };

  return (
    <div className="p-4 h-full flex flex-col md:flex-row gap-4 bg-slate-50 font-sans text-slate-800">
      {/* Left: Configuration Form */}
      <div className="w-full md:w-3/5 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header Section */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
          <div className="flex items-center gap-3">
             <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Code size={20}/></div>
             <div>
               <h2 className="font-bold text-lg text-slate-800">Interface Designer</h2>
               <div className="text-xs text-slate-400 flex items-center gap-2">
                 <span>v{metaData.version}</span>
                 <span>•</span>
                 <span>{formData.id || 'Untitled'}</span>
               </div>
             </div>
          </div>
          <div className="flex gap-2">
             {/* Remote Import 已删除 */}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
           {/* Top Inputs Grid */}
           <div className="grid grid-cols-2 gap-5">
              <div className="col-span-1">
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Transaction ID</label>
                 <input 
                    value={formData.id} 
                    onChange={e => setFormData(p => ({...p, id: e.target.value}))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all font-mono text-sm"
                    placeholder="e.g. userQuery"
                 />
              </div>
              <div className="col-span-1">
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Template</label>
                 <div className="flex gap-2">
                   <select 
                      value={formData.template}
                      onChange={e => setFormData(p => ({...p, template: e.target.value}))}
                      className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm"
                   >
                      {templates.map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                   <button
                      onClick={() => {
                        setShowTemplateManager(!showTemplateManager);
                        setTemplateInput('');
                        setEditingTemplate(null);
                      }}
                      className="px-3 py-2.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-bold"
                      title="管理模板"
                   >
                      ⚙️
                   </button>
                 </div>
              </div>
              <div className="col-span-2">
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">Description</label>
                 <input 
                    value={formData.trsName} 
                    onChange={e => setFormData(p => ({...p, trsName: e.target.value}))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    placeholder="Interface description..."
                 />
              </div>
           </div>

           {/* Field Editor Section */}
           <div className="flex flex-col h-[500px]">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                 <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                       onClick={() => setActiveTab('request')}
                       className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'request' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                       <ArrowRightLeft size={14}/> Request
                    </button>
                    <button 
                       onClick={() => setActiveTab('response')}
                       className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'response' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                       <Database size={14}/> Response
                    </button>
                 </div>
                 
                 {/* 导入导出工具栏 */}
                 <div className="flex gap-2 items-center flex-wrap">
                    <button 
                       onClick={handleDownloadTemplate}
                       className="px-2.5 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1.5 font-semibold"
                       title="下载当前接口字段导入模板（包含详细说明）"
                    >
                       <FileDown size={13}/> 下载模板
                    </button>
                    
                    <button 
                       onClick={() => fileInputRef.current?.click()}
                       disabled={isImporting}
                       className="px-2.5 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                       title="从 Excel 文件导入字段配置到当前接口"
                    >
                       <Upload size={13}/> {isImporting ? '导入中...' : '导入'}
                    </button>
                    
                    <button 
                       onClick={handleExportFields}
                       className="px-2.5 py-1.5 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1.5 font-semibold"
                       title="导出当前标签页的字段到 Excel"
                    >
                       <Download size={13}/> 导出
                    </button>
                    
                    {/* 批量导入分隔符 */}
                    <div className="border-l border-slate-300 h-6 mx-1"></div>
                    
                    {/* 批量导入按钮 */}
                    <button 
                       onClick={handleDownloadBatchTemplate}
                       className="px-2.5 py-1.5 text-xs bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors flex items-center gap-1.5 font-semibold"
                       title="下载批量导入模板（支持一次导入多个接口）"
                    >
                       <FileDown size={13}/> 批量模板
                    </button>
                    
                    <button 
                       onClick={() => batchFileInputRef.current?.click()}
                       disabled={isBatchImporting}
                       className="px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1.5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                       title="从 Excel 批量导入多个接口配置"
                    >
                       <Upload size={13}/> {isBatchImporting ? '批量导入中...' : '批量导入'}
                    </button>
                    
                    <input
                       ref={fileInputRef}
                       type="file"
                       accept=".xlsx,.xls"
                       onChange={handleImportFile}
                       className="hidden"
                    />
                    
                    <input
                       ref={batchFileInputRef}
                       type="file"
                       accept=".xlsx,.xls"
                       onChange={handleBatchImportFile}
                       className="hidden"
                    />
                 </div>
                 
                 <div className="text-xs text-slate-400 italic w-full">
                    Excel 粘贴: Tab 分隔列, 换行分隔行 | 粘贴到 Array/Object 的 Name 列可添加其内部字段 | Array/Object 可折叠展开
                 </div>
              </div>

              {/* The New Elegant Grid Component */}
              <div className="flex-1 min-h-0">
                  <ExcelFieldGrid 
                     fields={activeTab === 'request' ? formData.inputs : formData.outputs}
                     onChange={handleFieldsChange}
                  />
              </div>
           </div>
           
           <button onClick={handleGenerate} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
             <Code size={18}/> Generate Code
           </button>
        </div>
      </div>

      {/* Right: Code Preview */}
      <div className="w-full md:w-2/5 flex flex-col gap-4">
         {/* Preview Tabs */}
         <div className="flex gap-2">
            <button onClick={() => setOutputTab('xml')} className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-colors ${outputTab === 'xml' ? 'bg-white border-slate-300 text-slate-800' : 'bg-transparent border-transparent text-slate-500'}`}>
               XML Config
            </button>
            <button onClick={() => setOutputTab('java')} className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-colors ${outputTab === 'java' ? 'bg-white border-slate-300 text-slate-800' : 'bg-transparent border-transparent text-slate-500'}`}>
               Java Class
            </button>
         </div>
         
         <div className="flex-1 bg-[#1e293b] rounded-xl shadow-inner border border-slate-700 overflow-hidden relative group">
            <pre className="p-4 text-sm font-mono text-blue-100 h-full overflow-auto leading-relaxed">
               {outputTab === 'xml' ? generatedXml : generatedJava}
            </pre>
            <button 
              onClick={() => navigator.clipboard.writeText(outputTab === 'xml' ? generatedXml : generatedJava)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
               <Copy size={16}/>
            </button>
         </div>
      </div>

      {/* Template 管理 Modal */}
      {showTemplateManager && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-96 max-h-96 flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">管理模板</h3>
              <button
                onClick={() => {
                  setShowTemplateManager(false);
                  setEditingTemplate(null);
                  setTemplateInput('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Add/Edit Section */}
              <div className="mb-6 pb-6 border-b border-slate-200">
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">
                  {editingTemplate ? '编辑模板' : '添加新模板'}
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={templateInput}
                    onChange={e => setTemplateInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        if (editingTemplate) {
                          handleUpdateTemplate();
                        } else {
                          handleAddTemplate();
                        }
                      }
                    }}
                    placeholder="输入模板名称..."
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  {editingTemplate ? (
                    <>
                      <button
                        onClick={handleUpdateTemplate}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-bold transition-colors"
                      >
                        更新
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex-1 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-xs font-bold transition-colors"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleAddTemplate}
                      className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-bold transition-colors"
                    >
                      + 添加
                    </button>
                  )}
                </div>
              </div>

              {/* Template List */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-3 uppercase">现有模板</label>
                {templates.length === 0 ? (
                  <div className="text-center text-slate-400 text-sm py-4">暂无模板</div>
                ) : (
                  <div className="space-y-2">
                    {templates.map(template => (
                      <div
                        key={template}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span
                            className={`px-2 py-1 text-xs font-mono rounded ${
                              formData.template === template
                                ? 'bg-blue-200 text-blue-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {template}
                          </span>
                          {formData.template === template && (
                            <span className="text-xs text-blue-600 font-bold">当前选中</span>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleStartEdit(template)}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-bold transition-colors"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 font-bold transition-colors"
                            disabled={templates.length === 1}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 text-right">
              <button
                onClick={() => {
                  setShowTemplateManager(false);
                  setEditingTemplate(null);
                  setTemplateInput('');
                }}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-xs font-bold transition-colors"
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