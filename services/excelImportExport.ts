import * as XLSX from 'xlsx';
import { XmlField, XmlTransaction } from '../types';

/**
 * Excel 导入导出工具
 * 支持将 XmlField 结构导入/导出为 Excel
 */

export interface TemplateConfig {
  author?: string;
  version?: string;
  description?: string;
  examples?: string[];
}

/**
 * 扁平化 XmlField 树结构为行数组（用于 Excel 导出）
 */
export const flattenFieldsForExport = (fields: XmlField[], parentPath: string = ''): any[] => {
  let rows: any[] = [];
  fields.forEach((field, idx) => {
    const currentPath = parentPath ? `${parentPath}/${field.name}` : field.name;
    rows.push({
      '路径/Path': currentPath,
      '字段名/Name': field.name,
      '类型/Type': field.type,
      '描述/Description': field.description,
      '样式/Style': field.style || '',
      '子项数/Children': (field.children || []).length
    });
    
    // 递归展开子项
    if (field.children && field.children.length > 0) {
      rows = rows.concat(flattenFieldsForExport(field.children, currentPath));
    }
  });
  return rows;
};

/**
 * 下载导入模板（包含详细说明）
 */
export const downloadImportTemplate = (templateConfig?: TemplateConfig) => {
  const config = templateConfig || { author: 'admin', version: '1.0' };
  
  // 创建 workbook
  const wb = XLSX.utils.book_new();
  
  // 1. 说明文档页
  const instructionData = [
    ['Interface Designer - 导入模板说明文档'],
    [''],
    ['版本号', config.version || '1.0'],
    ['作者', config.author || 'admin'],
    ['创建日期', new Date().toLocaleDateString('zh-CN')],
    [''],
    ['使用说明'],
    ['1. 字段 (Name) 列：输入字段的英文名称，如 userId, userName, createTime 等'],
    ['2. 类型 (Type) 列：选择以下类型之一'],
    ['   - field: 普通字段'],
    ['   - string: 字符串'],
    ['   - date: 日期（格式 yyyy-MM-dd）'],
    ['   - array: 数组（支持嵌套子项）'],
    ['   - object: 对象（支持嵌套子项）'],
    ['3. 描述 (Description) 列：输入字段的中文描述'],
    ['4. 样式 (Style) 列：输入字段的验证规则或展示样式，如 NotNullStyle'],
    [''],
    ['Array/Object 使用方式'],
    ['- 创建 Array 类型的字段（如 users）'],
    ['- 在该字段下添加子项（如 userId, userName）'],
    ['- 导入时直接粘贴数据，系统自动识别并创建对应数量的子项'],
    [''],
    ['示例'],
    ['字段名', '类型', '描述', '样式'],
    ['userId', 'string', '用户ID', 'NotNullStyle'],
    ['userName', 'string', '用户名称', ''],
    ['users', 'array', '用户列表', ''],
    ['- userId', 'string', '用户ID', 'NotNullStyle'],
    ['- userName', 'string', '用户名称', ''],
    ['createTime', 'date', '创建时间', 'yyyy-MM-dd'],
  ];
  
  const ws1 = XLSX.utils.aoa_to_sheet(instructionData);
  ws1['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws1, '说明文档');
  
  // 2. 导入数据页（示例）
  const dataHeader = [
    ['字段名', '类型', '描述', '样式', '备注'],
    ['', 'field', '普通字段', '', '默认类型'],
    ['userId', 'string', '用户ID', 'NotNullStyle', ''],
    ['userName', 'string', '用户名称', '', ''],
    ['', 'array', '用户列表', '', '数组类型'],
    ['userId', 'string', '用户ID', '', '数组子项'],
    ['userName', 'string', '用户名称', '', '数组子项'],
    ['', 'object', '用户信息', '', '对象类型'],
    ['name', 'string', '姓名', '', '对象属性'],
    ['age', 'string', '年龄', '', '对象属性'],
  ];
  
  const ws2 = XLSX.utils.aoa_to_sheet(dataHeader);
  ws2['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws2, '导入数据');
  
  // 3. 字段类型参考页
  const typeReference = [
    ['字段类型参考'],
    [''],
    ['类型名', '说明', '示例', '备注'],
    ['field', '通用字段', 'generalField', '默认类型，对应字符串'],
    ['string', '字符串', 'userName', '文本数据'],
    ['date', '日期', 'createTime', '日期格式：yyyy-MM-dd'],
    ['array', '数组', 'userList', '有序列表，支持嵌套子项'],
    ['object', '对象', 'userInfo', '键值对结构，支持嵌套属性'],
    [''],
    ['高级特性'],
    [''],
    ['折叠展开', '数组和对象支持在 UI 中折叠/展开，便于查看复杂结构'],
    ['嵌套支持', '数组/对象可以包含其他数组/对象，实现多层嵌套'],
    ['批量粘贴', '支持从 Excel 或其他表格工具复制粘贴，自动识别格式'],
    ['导出导入', '支持将配置导出为 Excel，也支持从 Excel 导入配置'],
  ];
  
  const ws3 = XLSX.utils.aoa_to_sheet(typeReference);
  ws3['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws3, '字段类型参考');
  
  // 下载
  XLSX.writeFile(wb, `interface_import_template_${new Date().getTime()}.xlsx`);
};

/**
 * 从 Excel 文件读取数据并转换为 XmlField 数组
 * @param file 选中的 Excel 文件
 * @returns Promise<XmlField[]>
 */
export const importFieldsFromExcel = (file: File): Promise<XmlField[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 读取 "导入数据" 页，如果不存在则读取第一个 sheet
        let sheetName = '导入数据';
        if (!workbook.SheetNames.includes(sheetName)) {
          sheetName = workbook.SheetNames[0];
        }
        
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 0 }) as any[];
        
        // 转换 JSON 数据为 XmlField 结构
        const fields = convertJsonToFields(jsonData);
        resolve(fields);
      } catch (error) {
        reject(new Error(`Excel 导入失败: ${error instanceof Error ? error.message : '未知错误'}`));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * 将 JSON 行数据转换为 XmlField 树结构
 * 支持识别层级关系（通过行前缀或缩进）
 */
const convertJsonToFields = (rows: any[]): XmlField[] => {
  const fields: XmlField[] = [];
  const stack: Array<{ field: XmlField; depth: number }> = [];
  
  rows.forEach((row, idx) => {
    // 🔧 Bug Fix 3: 更严格的空行检查
    if (!row || typeof row !== 'object') return;
    
    const name = (row['字段名'] || row['Name'] || '').toString().trim();
    // 完全空的行直接跳过
    if (!name) return;
    
    const type = (row['类型'] || row['Type'] || 'field').toString().trim().toLowerCase();
    const description = (row['描述'] || row['Description'] || '').toString().trim();
    const style = (row['样式'] || row['Style'] || '').toString().trim();
    
    // 检测缩进层级（通过 "- " 前缀或其他标记）
    const isChild = name.startsWith('-') || name.startsWith('  ');
    const cleanName = name.replace(/^[\s\-]+/, '').trim();
    
    // 🔧 Bug Fix 3: 避免空名称字段被创建
    if (!cleanName) return;
    
    const newField: XmlField = {
      name: cleanName,
      type: type === 'array' || type === 'object' ? type : 'field',
      description,
      style,
      children: (type === 'array' || type === 'object') ? [] : undefined
    };
    
    if (isChild && stack.length > 0) {
      // 作为上一个容器的子项
      const parent = stack[stack.length - 1].field;
      if (parent.children) {
        parent.children.push(newField);
      }
      // 🔧 如果当前字段也是容器，推入栈
      if (newField.type === 'array' || newField.type === 'object') {
        stack.push({ field: newField, depth: 1 });
      }
    } else {
      // 作为根级字段
      fields.push(newField);
      
      // 清理栈：移除所有非根级容器
      // 🔧 Bug Fix 3: 当遇到非缩进行时，重置栈
      if (!isChild) {
        stack.length = 0;
        // 如果是容器，推入栈中用于后续子项
        if (newField.type === 'array' || newField.type === 'object') {
          stack.push({ field: newField, depth: 0 });
        }
      }
    }
  });
  
  return fields;
};

/**
 * 导出当前字段结构为 Excel
 */
export const exportFieldsToExcel = (fields: XmlField[], fileName: string = 'interface_fields') => {
  const rows = flattenFieldsForExport(fields);
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 30 }, // 路径
    { wch: 20 }, // 字段名
    { wch: 15 }, // 类型
    { wch: 25 }, // 描述
    { wch: 20 }, // 样式
    { wch: 12 }  // 子项数
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, '字段列表');
  XLSX.writeFile(wb, `${fileName}_${new Date().getTime()}.xlsx`);
};

/**
 * 从 Transaction 对象导出完整的请求和响应配置
 */
export const exportTransactionToExcel = (transaction: XmlTransaction) => {
  const wb = XLSX.utils.book_new();
  
  // 请求页
  const requestRows = flattenFieldsForExport(transaction.inputs);
  const wsRequest = XLSX.utils.json_to_sheet(requestRows);
  XLSX.utils.book_append_sheet(wb, wsRequest, '请求参数');
  
  // 响应页
  const responseRows = flattenFieldsForExport(transaction.outputs);
  const wsResponse = XLSX.utils.json_to_sheet(responseRows);
  XLSX.utils.book_append_sheet(wb, wsResponse, '响应参数');
  
  // 下载
  XLSX.writeFile(wb, `${transaction.id}_config_${new Date().getTime()}.xlsx`);
};
