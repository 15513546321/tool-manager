/**
 * Array 粘贴修复验证脚本
 * 直接测试粘贴逻辑，无需手动操作浏览器
 */

// 模拟的 XmlField 类型
interface XmlField {
  name: string;
  type: 'field' | 'string' | 'date' | 'array' | 'object';
  description: string;
  style?: string;
  children?: XmlField[];
}

// 模拟的扁平化函数
interface FlatField {
  path: number[];
  field: XmlField;
  depth: number;
  isLastChild: boolean;
}

const flattenFields = (fields: XmlField[], path: number[] = [], depth = 0): FlatField[] => {
  let result: FlatField[] = [];
  fields.forEach((field, index) => {
    const currentPath = [...path, index];
    result.push({ 
      path: currentPath, 
      field, 
      depth, 
      isLastChild: index === fields.length - 1 
    });
    
    if ((field.type === 'array' || field.type === 'object') && field.children) {
      result = result.concat(flattenFields(field.children, currentPath, depth + 1));
    }
  });
  return result;
};

// 模拟的树更新函数
const updateFieldInTree = (fields: XmlField[], path: number[], updates: Partial<XmlField>): XmlField[] => {
  if (path.length === 0) return fields;
  
  const [idx, ...rest] = path;
  const newList = [...fields];
  
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

/**
 * 改进的粘贴处理逻辑（修复后）
 */
const handlePasteFixed = (
  clipboardData: string,
  startPath: number[],
  startColKey: string,
  fields: XmlField[]
): XmlField[] => {
  const rows = clipboardData.split(/\r\n|\n|\r/).filter(row => row.trim().length > 0);
  if (rows.length === 0) return fields;

  const flatList = flattenFields(fields);
  const startIndex = flatList.findIndex(f => f.path.join('.') === startPath.join('.'));
  if (startIndex === -1) return fields;

  const startField = flatList[startIndex];
  const isContainerPaste = (startField.field.type === 'array' || startField.field.type === 'object') && startColKey === 'name';

  let newFields = [...fields];

  if (isContainerPaste) {
    // 一次性收集所有行的新子字段
    const newChildren: XmlField[] = [];
    
    rows.forEach((rowStr, i) => {
      const cells = rowStr.split('\t').map(c => c.trim());
      if (cells.every(c => c.length === 0)) return;
      
      const latestContainer = flattenFields(newFields).find(f => f.path.join('.') === startPath.join('.'))?.field;
      if (!latestContainer) return;
      
      let fieldType: string = 'field';
      const firstCell = (cells[0] || '').toLowerCase().trim();
      
      if (['array', 'object', 'string', 'date', 'field'].includes(firstCell)) {
        fieldType = firstCell as any;
      } else {
        if (firstCell.includes('list') || firstCell.includes('array') || firstCell.includes('items')) {
          fieldType = 'array';
        } else if (firstCell.includes('obj') || firstCell.includes('map') || firstCell.includes('info')) {
          fieldType = 'object';
        }
      }
      
      const newChild: XmlField = { 
        name: cells[0] || `field_${i}`, 
        type: fieldType as any,
        description: cells[1] || '',
        style: cells[2] || '',
        children: (fieldType === 'array' || fieldType === 'object') ? [] : undefined
      };
      
      newChildren.push(newChild);
    });
    
    // 一次性更新容器：追加所有新子项
    const latestContainer = flattenFields(newFields).find(f => f.path.join('.') === startPath.join('.'))?.field;
    if (latestContainer) {
      const existingChildren = latestContainer.children || [];
      newFields = updateFieldInTree(newFields, startPath, {
        children: [...existingChildren, ...newChildren]
      });
    }
  }

  return newFields;
};

/**
 * 测试用例
 */
console.log('=== Array 粘贴修复验证 ===\n');

// 测试1: 空容器粘贴 3 行
console.log('📋 测试1: 空 Array 容器粘贴 3 行');
const fields1: XmlField[] = [
  {
    name: 'tableHeadList',
    type: 'array',
    description: '表头列表',
    children: []
  }
];

const pasteData1 = 'clfSeq\t序列号\nUserSeq\t用户序列号\nacName\t账户名称';
const result1 = handlePasteFixed(pasteData1, [0], 'name', fields1);

console.log('粘贴前:', JSON.stringify(fields1, null, 2));
console.log('\n粘贴数据:');
console.log(pasteData1.split('\n').join('\n  '));
console.log('\n粘贴后:', JSON.stringify(result1, null, 2));

const tableHeadAfter = result1[0];
if (tableHeadAfter.children && tableHeadAfter.children.length === 3) {
  console.log('✅ PASS: Array 包含 3 个子项');
  console.log('   子项: ', tableHeadAfter.children.map(c => c.name).join(', '));
} else {
  console.log('❌ FAIL: Array 子项数不正确，预期 3，实际', tableHeadAfter.children?.length || 0);
}

console.log('\n' + '='.repeat(60) + '\n');

// 测试2: 已有子项的容器再追加
console.log('📋 测试2: 已有 2 个子项的 Array，再粘贴 2 行');
const fields2: XmlField[] = [
  {
    name: 'users',
    type: 'array',
    description: '用户列表',
    children: [
      { name: 'id', type: 'string', description: '用户ID' },
      { name: 'name', type: 'string', description: '用户名' }
    ]
  }
];

const pasteData2 = 'email\t邮箱\nphone\t电话';
const result2 = handlePasteFixed(pasteData2, [0], 'name', fields2);

const usersAfter = result2[0];
if (usersAfter.children && usersAfter.children.length === 4) {
  console.log('✅ PASS: Array 现在包含 4 个子项 (2 原有 + 2 新增)');
  console.log('   子项: ', usersAfter.children.map(c => c.name).join(', '));
} else {
  console.log('❌ FAIL: Array 子项数不正确，预期 4，实际', usersAfter.children?.length || 0);
}

console.log('\n' + '='.repeat(60) + '\n');

// 测试3: 字段类型自动检测
console.log('📋 测试3: 字段类型自动检测');
const fields3: XmlField[] = [
  {
    name: 'container',
    type: 'array',
    description: '测试容器',
    children: []
  }
];

const pasteData3 = 'userList\t用户列表\nOrderItems\t订单项\nAddressObj\t地址对象';
const result3 = handlePasteFixed(pasteData3, [0], 'name', fields3);

const containerAfter = result3[0];
if (containerAfter.children) {
  const detectionCorrect = 
    containerAfter.children[0].type === 'array' &&  // userList -> array
    containerAfter.children[1].type === 'array' &&  // OrderItems -> array
    containerAfter.children[2].type === 'object';   // AddressObj -> object
  
  if (detectionCorrect) {
    console.log('✅ PASS: 字段类型自动检测正确');
    containerAfter.children.forEach((child, idx) => {
      console.log(`   [${idx}] ${child.name} -> ${child.type}`);
    });
  } else {
    console.log('❌ FAIL: 字段类型检测不正确');
    containerAfter.children.forEach((child, idx) => {
      console.log(`   [${idx}] ${child.name} -> ${child.type}`);
    });
  }
}

console.log('\n' + '='.repeat(60) + '\n');

// 测试4: 嵌套容器粘贴
console.log('📋 测试4: 嵌套容器粘贴');
const fields4: XmlField[] = [
  {
    name: 'orders',
    type: 'array',
    description: '订单列表',
    children: [
      { name: 'orderId', type: 'string', description: '订单ID' },
      { 
        name: 'items',
        type: 'array',
        description: '订单项',
        children: []
      }
    ]
  }
];

const pasteData4 = 'productId\t商品ID\nquantity\t数量\nprice\t价格';
const itemsPath = [0, 1];  // orders[0].items[1]
const result4 = handlePasteFixed(pasteData4, itemsPath, 'name', fields4);

const ordersAfter = result4[0];
const itemsAfter = ordersAfter.children?.[1];
if (itemsAfter?.children && itemsAfter.children.length === 3) {
  console.log('✅ PASS: 嵌套 Array 包含 3 个子项');
  console.log('   层级:');
  console.log('   └─ orders');
  console.log('      ├─ orderId');
  console.log('      └─ items [3]');
  itemsAfter.children.forEach(child => {
    console.log(`         ├─ ${child.name}`);
  });
} else {
  console.log('❌ FAIL: 嵌套 Array 子项数不正确，预期 3，实际', itemsAfter?.children?.length || 0);
}

console.log('\n' + '='.repeat(60) + '\n');

console.log('🎉 测试完成！');
