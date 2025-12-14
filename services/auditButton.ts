/**
 * 按钮点击审计日志工具
 * 用于自动记录所有按钮点击事件到审计日志
 */

import { recordAction } from './auditService';
import { AUDIT_CONFIG, shouldTrackButton, getAuditLabel, getAuditModule } from './auditConfig';

/**
 * 获取当前页面名称
 */
export function getCurrentPageName(): string {
  const path = window.location.hash;
  if (path.includes('/dashboard')) return '仪表板';
  if (path.includes('/announcement')) return '公告管理';
  if (path.includes('/audit')) return '审计日志';
  if (path.includes('/repo')) return '文档库';
  if (path.includes('/interface/docs')) return '接口文档';
  if (path.includes('/interface/code')) return '代码生成';
  if (path.includes('/format')) return '格式化工具';
  if (path.includes('/gitee')) return 'Gitee管理';
  if (path.includes('/gitlab-reports')) return 'GitLab报告';
  if (path.includes('/sync/nacos')) return 'Nacos同步';
  if (path.includes('/sync/oracle')) return 'Oracle同步';
  if (path.includes('/params')) return '参数配置';
  if (path.includes('/suggestions')) return '优化建议';
  if (path.includes('/admin/ip')) return 'IP配置';
  if (path.includes('/admin/menus')) return '菜单管理';
  return '系统';
}

/**
 * 记录按钮点击事件
 * @param button 点击的按钮元素
 * @param additionalContext 额外的上下文信息
 */
export async function recordButtonClick(
  button: HTMLButtonElement,
  additionalContext?: string
): Promise<void> {
  try {
    // 检查是否应该追踪此按钮
    if (!shouldTrackButton(button)) return;

    const label = getAuditLabel(button);
    const module = getAuditModule(button);
    const page = getCurrentPageName();

    // 构建详情字符串
    let details = `点击按钮: ${label}`;
    if (module && module !== '系统') {
      details = `[${module}] ${details}`;
    }
    if (additionalContext) {
      details += ` | ${additionalContext}`;
    }

    // 记录到审计日志
    await recordAction(`用户交互 - 按钮点击`, details);
  } catch (error) {
    console.error('Failed to record button click:', error);
  }
}

/**
 * 初始化全局按钮点击监听
 * 在应用启动时调用
 */
export function initializeAuditButtonTracking(): void {
  if (!AUDIT_CONFIG.enableGlobalButtonTracking) {
    console.log('⚠️ Button tracking is disabled');
    return;
  }

  // 使用事件委托监听所有按钮点击
  document.addEventListener('click', async (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    // 查找最近的 button 元素
    const button = target.closest('button') as HTMLButtonElement;

    if (!button) return;

    // 检查是否应该追踪
    if (!shouldTrackButton(button)) return;

    // 异步记录，不阻塞用户交互
    setTimeout(() => {
      const context = button.getAttribute('data-audit-context');
      recordButtonClick(button, context || undefined);
    }, 0);
  }, true); // 使用捕获阶段

  console.log('✅ Audit button tracking initialized');
}

/**
 * 创建带审计的按钮点击处理器
 * 用于在现有的 onClick 处理器之外添加审计记录
 *
 * @example
 * const handleClick = withAudit((e) => doSomething(e), '删除');
 * <button onClick={handleClick}>删除</button>
 */
export function withAudit<T extends (...args: any[]) => any>(
  handler: T | undefined,
  context?: string
): T {
  return (async (event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    await recordButtonClick(button, context);
    if (handler) {
      return handler(event);
    }
  }) as T;
}
