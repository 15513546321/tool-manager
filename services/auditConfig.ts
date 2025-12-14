/**
 * 审计日志追踪配置
 * 控制哪些元素应该纳入审计日志
 */

export const AUDIT_CONFIG = {
  // 启用全局按钮追踪
  enableGlobalButtonTracking: true,

  // 应该排除的按钮选择器（使用 CSS 选择器或 class 名称）
  excludeSelectors: [
    '[data-audit-exclude="true"]', // 显式标记为排除
    '.mobile-menu-toggle', // 移动端菜单
    '.sidebar-toggle', // 侧边栏切换
    '.theme-toggle', // 主题切换
    '.language-toggle', // 语言切换
  ],

  // 应该排除的按钮标签（不区分大小写）
  excludeLabels: [
    '关闭', 'close', 'dismiss',
    '取消', 'cancel',
    '确定', 'ok',
    '是', 'yes',
    '否', 'no',
    '下一步', 'next',
    '上一步', 'prev',
    '...', // 省略号按钮
  ],

  // 应该排除的 class 关键字
  excludeClassPatterns: [
    'toggle',
    'dropdown',
    'menu',
    'pagination',
    'scroll',
    'expand',
    'collapse',
    'chevron',
    'arrow',
  ],

  // 需要特殊处理的按钮配置
  specialButtons: {
    // 示例：
    // '.save-button': { label: '保存配置', module: '通用' },
    // '.delete-button': { label: '删除', module: '通用', requiresConfirm: true },
  },

  // 是否记录按钮的鼠标坐标（用于检测点击位置）
  recordClickCoordinates: false,

  // 是否记录按钮的 DOM 路径
  recordDOMPath: false,

  // 批量操作时是否合并日志（防止日志过多）
  mergeBulkOperations: true,
  bulkOperationThreshold: 10, // 10 个相同操作时进行合并

  // 忽略的按钮数据属性值
  ignoreDataAuditValue: 'false',
};

/**
 * 判断按钮是否应该被追踪
 */
export function shouldTrackButton(button: HTMLButtonElement): boolean {
  // 检查显式排除标记
  if (button.getAttribute('data-audit-exclude') === AUDIT_CONFIG.ignoreDataAuditValue) {
    return false;
  }

  // 检查显式包含标记（高优先级）
  if (button.getAttribute('data-audit-include') === 'true') {
    return true;
  }

  // 检查排除选择器
  for (const selector of AUDIT_CONFIG.excludeSelectors) {
    if (button.matches(selector)) {
      return false;
    }
  }

  // 检查排除标签
  const label = (button.textContent?.trim() || '').toLowerCase();
  if (AUDIT_CONFIG.excludeLabels.some(excludeLabel => 
    label.includes(excludeLabel.toLowerCase())
  )) {
    return false;
  }

  // 检查排除 class 模式
  const className = button.className.toLowerCase();
  if (AUDIT_CONFIG.excludeClassPatterns.some(pattern => 
    className.includes(pattern)
  )) {
    return false;
  }

  return true;
}

/**
 * 获取按钮的审计标签
 */
export function getAuditLabel(button: HTMLButtonElement): string {
  // 1. 检查 data-audit-label 属性
  const dataLabel = button.getAttribute('data-audit-label');
  if (dataLabel) return dataLabel;

  // 2. 检查 title 属性
  const title = button.getAttribute('title');
  if (title) return title;

  // 3. 检查 aria-label 属性
  const ariaLabel = button.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // 4. 使用文本内容
  const text = button.textContent?.trim();
  if (text && text.length > 0 && text.length < 50) return text;

  // 5. 从特殊配置获取
  for (const [selector, config] of Object.entries(AUDIT_CONFIG.specialButtons)) {
    if (button.matches(selector)) {
      return (config as any).label || '未命名按钮';
    }
  }

  return '未命名按钮';
}

/**
 * 获取按钮所在的模块
 */
export function getAuditModule(button: HTMLButtonElement): string {
  // 检查 data-module 属性
  const dataModule = button.getAttribute('data-module');
  if (dataModule) return dataModule;

  // 从 URL 路径推断
  const path = window.location.hash;
  if (path.includes('/admin')) return '管理';
  if (path.includes('/interface')) return '接口管理';
  if (path.includes('/sync')) return '数据同步';
  if (path.includes('/repo')) return '文档库';
  if (path.includes('/audit')) return '审计';
  if (path.includes('/announcement')) return '公告';

  return '系统';
}
