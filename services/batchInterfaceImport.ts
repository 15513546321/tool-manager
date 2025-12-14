import * as XLSX from 'xlsx';
import { XmlTransaction, XmlField } from '../types';

/**
 * 批量接口导入服务
 * 支持从 Excel 导入多个接口配置（批量维护）
 */

export interface BatchImportConfig {
  interfaceId?: string;
  template?: string;
  description?: string;
  module?: string;
}

export interface ImportedInterface {
  id: string;
  template: string;
  trsName: string;
  inputs: XmlField[];
  outputs: XmlField[];
  module?: string;
  actionRef?: string;
  actionClass?: string;
  filePath?: string;
  downstreamCalls?: string[];
}

/**
 * 下载批量导入模板（支持多个接口配置）
 * 包含三个 Sheet：
 * 1. 说明文档 - 使用说明和最佳实践
 * 2. 接口清单 - 接口基本信息（ID、模板、描述等）
 * 3. 接口参数 - 请求和响应字段（分接口）
 */
export const downloadBatchImportTemplate = (config?: BatchImportConfig) => {
  const wb = XLSX.utils.book_new();
  
  // ===== Sheet 1: 说明文档 =====
  const instructionData = [
    ['批量接口导入模板说明'],
    [''],
    ['版本号', '2.1'],
    ['更新日期', new Date().toLocaleDateString('zh-CN')],
    [''],
    ['📖 使用说明'],
    [''],
    ['第一步：在 "接口清单" Sheet 中定义接口基本信息'],
    ['  - 接口ID (Interface ID): 唯一标识，如 userQuery, orderCreate 等'],
    ['  - 模板 (Template): 选择以下之一'],
    ['    • ExecuteLogTemplate'],
    ['    • OtherTemplates...'],
    ['  - 描述 (Description): 接口中文描述'],
    ['  - 模块 (Module): 所属模块，如 User, Order, Product'],
    [''],
    ['第二步：在 "接口参数" Sheet 中定义请求和响应字段'],
    ['  - 接口ID: 对应 "接口清单" 中的 ID，用于关联'],
    ['  - 参数类型: Request（请求）或 Response（响应）'],
    ['  - 字段名: 英文名称，如 userId, userName'],
    ['  - 字段类型: field, string, date, array, object'],
    ['  - 描述: 中文描述'],
    ['  - 样式: 验证规则或展示样式'],
    [''],
    ['💡 高级特性'],
    [''],
    ['1. Array/Object 嵌套'],
    ['   - 如果字段是 array 或 object，后续行的 "接口ID" 可留空'],
    ['   - 这样的字段自动作为上一个容器的子项'],
    [''],
    ['2. 示例：定义一个 userList 数组'],
    ['   接口ID        | 参数类型 | 字段名    | 字段类型 | 描述'],
    ['   userQuery    | Request | userList | array  | 用户列表'],
    ['               | Request | userId   | string | 用户ID'],
    ['               | Request | userName | string | 用户名'],
    [''],
    ['3. 批量导入后'],
    ['   - 系统自动解析关联关系'],
    ['   - 多个接口会合并导入'],
    ['   - 可在 UI 中继续编辑调整'],
    [''],
    ['⚠️ 注意事项'],
    ['  - 接口ID 必须唯一'],
    ['  - 模板名称必须精确匹配'],
    ['  - 字段类型必须小写'],
    ['  - 换行符：使用 Ctrl+Enter (Excel) 或系统换行'],
  ];
  
  const ws1 = XLSX.utils.aoa_to_sheet(instructionData);
  ws1['!cols'] = [{ wch: 25 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, ws1, '说明文档');
  
  // ===== Sheet 2: 接口清单 =====
  const interfaceListData = [
    ['接口ID', '模板', '描述', '模块', '备注'],
    ['userQuery', 'ExecuteLogTemplate', '用户查询接口', 'User', '返回单个用户信息'],
    ['userList', 'ExecuteLogTemplate', '用户列表接口', 'User', '支持分页'],
    ['orderCreate', 'ExecuteLogTemplate', '创建订单接口', 'Order', ''],
    ['productSearch', 'ExecuteLogTemplate', '商品搜索接口', 'Product', '全文检索'],
  ];
  
  const ws2 = XLSX.utils.aoa_to_sheet(interfaceListData);
  ws2['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws2, '接口清单');
  
  // ===== Sheet 3: 接口参数 =====
  const interfaceParamsData = [
    ['接口ID', '参数类型', '字段名', '字段类型', '描述', '样式'],
    // userQuery 示例
    ['userQuery', 'Request', 'userId', 'string', '用户ID', 'NotNullStyle'],
    ['userQuery', 'Request', 'includeRoles', 'string', '是否包含角色', ''],
    ['userQuery', 'Response', 'id', 'string', '用户ID', ''],
    ['userQuery', 'Response', 'name', 'string', '用户名', ''],
    ['userQuery', 'Response', 'email', 'string', '邮箱', ''],
    ['userQuery', 'Response', 'roles', 'array', '用户角色', ''],
    ['', 'Response', 'id', 'string', '角色ID', ''],  // roles 的子项，接口ID 留空
    ['', 'Response', 'name', 'string', '角色名', ''],
    [''],
    // userList 示例
    ['userList', 'Request', 'pageNo', 'string', '页码', ''],
    ['userList', 'Request', 'pageSize', 'string', '每页数量', ''],
    ['userList', 'Response', 'total', 'string', '总数', ''],
    ['userList', 'Response', 'users', 'array', '用户列表', ''],
    ['', 'Response', 'id', 'string', '用户ID', ''],
    ['', 'Response', 'name', 'string', '用户名', ''],
    ['', 'Response', 'email', 'string', '邮箱', ''],
    [''],
    // orderCreate 示例
    ['orderCreate', 'Request', 'items', 'array', '订单项', ''],
    ['', 'Request', 'productId', 'string', '商品ID', 'NotNullStyle'],
    ['', 'Request', 'quantity', 'string', '数量', 'NotNullStyle'],
    ['', 'Request', 'price', 'string', '价格', ''],
    ['orderCreate', 'Request', 'shippingAddress', 'object', '收货地址', ''],
    ['', 'Request', 'province', 'string', '省份', ''],
    ['', 'Request', 'city', 'string', '城市', ''],
    ['', 'Request', 'detail', 'string', '详细地址', ''],
    ['orderCreate', 'Response', 'orderId', 'string', '订单ID', ''],
    ['orderCreate', 'Response', 'totalAmount', 'string', '总金额', ''],
    ['orderCreate', 'Response', 'status', 'string', '订单状态', ''],
  ];
  
  const ws3 = XLSX.utils.aoa_to_sheet(interfaceParamsData);
  ws3['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws3, '接口参数');
  
  // 下载
  XLSX.writeFile(wb, `batch_interface_import_template_${new Date().getTime()}.xlsx`);
};

/**
 * 从 Excel 批量导入多个接口配置
 * @param file 选中的 Excel 文件
 * @returns Promise<ImportedInterface[]> 导入的接口列表
 */
export const importInterfacesFromExcel = (file: File): Promise<ImportedInterface[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 读取必需的两个 Sheet
        if (!workbook.SheetNames.includes('接口清单')) {
          throw new Error('缺少 "接口清单" Sheet，请检查 Excel 文件格式');
        }
        if (!workbook.SheetNames.includes('接口参数')) {
          throw new Error('缺少 "接口参数" Sheet，请检查 Excel 文件格式');
        }
        
        // 解析接口清单
        const interfaceListSheet = workbook.Sheets['接口清单'];
        const interfaceListData = XLSX.utils.sheet_to_json(interfaceListSheet, { header: 0 }) as any[];
        
        // 解析接口参数
        const interfaceParamsSheet = workbook.Sheets['接口参数'];
        const interfaceParamsData = XLSX.utils.sheet_to_json(interfaceParamsSheet, { header: 0 }) as any[];
        
        // 构建接口映射
        const interfaces = parseInterfaceList(interfaceListData);
        const parseParams = parseInterfaceParams(interfaceParamsData);
        
        // 关联参数到接口
        interfaces.forEach(iface => {
          const params = parseParams[iface.id] || { requests: [], responses: [] };
          iface.inputs = params.requests;
          iface.outputs = params.responses;
        });
        
        resolve(interfaces);
      } catch (error) {
        reject(new Error(`Excel 导入失败: ${error instanceof Error ? error.message : '未知错误'}`));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * 解析接口清单行数据
 */
const parseInterfaceList = (rows: any[]): ImportedInterface[] => {
  return rows
    .filter(row => row['接口ID'] && row['接口ID'].toString().trim().length > 0)
    .map((row, idx) => ({
      id: (row['接口ID'] || '').toString().trim(),
      template: (row['模板'] || 'ExecuteLogTemplate').toString().trim(),
      trsName: (row['描述'] || '').toString().trim(),
      module: (row['模块'] || 'Manual').toString().trim(),
      inputs: [],
      outputs: [],
      actionRef: '',
      actionClass: '',
      filePath: '',
      downstreamCalls: []
    }));
};

/**
 * 解析接口参数行数据
 * 返回 { [interfaceId]: { requests: XmlField[], responses: XmlField[] } }
 */
const parseInterfaceParams = (rows: any[]): Record<string, { requests: XmlField[], responses: XmlField[] }> => {
  const result: Record<string, { requests: XmlField[], responses: XmlField[] }> = {};
  
  let currentInterfaceId = '';
  let currentParamType = '';
  let containerStack: Array<{ field: XmlField, type: string }> = [];
  
  rows.forEach((row, idx) => {
    const interfaceId = (row['接口ID'] || '').toString().trim();
    const paramType = (row['参数类型'] || '').toString().trim(); // Request | Response
    const fieldName = (row['字段名'] || '').toString().trim();
    
    // 如果没有字段名，跳过
    if (!fieldName) return;
    
    // 如果有接口ID，更新当前接口和参数类型
    if (interfaceId) {
      currentInterfaceId = interfaceId;
      currentParamType = paramType;
      containerStack = []; // 重置容器栈
      
      if (!result[interfaceId]) {
        result[interfaceId] = { requests: [], responses: [] };
      }
    }
    
    // 构建字段对象
    const fieldType = (row['字段类型'] || 'field').toString().trim().toLowerCase();
    const description = (row['描述'] || '').toString().trim();
    const style = (row['样式'] || '').toString().trim();
    
    const field: XmlField = {
      name: fieldName,
      type: fieldType,
      description,
      style,
      children: (fieldType === 'array' || fieldType === 'object') ? [] : undefined
    };
    
    // 确定目标数组（Request 或 Response）
    if (!currentInterfaceId) return; // 必须有接口ID
    
    const targetArray = currentParamType === 'Request' ? 'requests' : 'responses';
    const containerArray = result[currentInterfaceId][targetArray];
    
    // 简单的嵌套逻辑：如果前一行的接口ID为空，则当前字段是子项
    const prevRow = rows[idx - 1];
    const prevInterfaceId = (prevRow?.['接口ID'] || '').toString().trim();
    
    if (!prevInterfaceId && idx > 0 && containerArray.length > 0) {
      // 作为最后一个容器的子项
      const lastContainer = containerArray[containerArray.length - 1];
      if (lastContainer.children) {
        lastContainer.children.push(field);
      }
    } else {
      // 作为根级字段
      containerArray.push(field);
    }
  });
  
  return result;
};

/**
 * 将 ImportedInterface[] 转换为 XmlTransaction[]
 */
export const convertToTransactions = (interfaces: ImportedInterface[]): any[] => {
  return interfaces.map(iface => ({
    id: iface.id,
    template: iface.template,
    trsName: iface.trsName,
    module: iface.module || 'Manual',
    inputs: iface.inputs,
    outputs: iface.outputs,
    actionRef: iface.actionRef || '',
    actionClass: iface.actionClass || '',
    filePath: iface.filePath || '',
    downstreamCalls: iface.downstreamCalls || []
  }));
};
