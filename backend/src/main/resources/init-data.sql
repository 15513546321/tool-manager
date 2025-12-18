-- Wait for tables to be created by Hibernate first
-- Initialize Menu Items (only if not exists)
INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '1', '首页', '/dashboard', 'dashboard', true, NULL, 1, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '1');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '6', '公告通知', '/announcement', 'docs', true, NULL, 2, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '6');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '10', '优化建议', '/suggestions', 'suggestions', true, NULL, 3, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '10');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '2', '接口管理', '/interface', 'interface', true, NULL, 4, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '2');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '2-1', '文档管理', '/interface/docs', 'docs', true, '2', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '2-1');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '2-2', '代码生成', '/interface/code', 'code', true, '2', 2, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '2-2');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '11', '数据同步', '/sync', 'sync', true, NULL, 5, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '11');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '11-1', 'Nacos配置同步', '/sync/nacos', 'nacos', true, '11', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '11-1');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '11-2', 'Oracle DDL同步', '/sync/oracle', 'oracle', true, '11', 2, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '11-2');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '9', 'GitLab 报表', '/gitlab-reports', 'gitlab', true, NULL, 6, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '9');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '12', 'Gitee管理', '/gitee', 'gitee', true, NULL, 7, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '12');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '8', '格式化工具', '/format', 'format', true, NULL, 8, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '8');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '3', '参数配置', '/params', 'params', true, NULL, 9, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '3');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '4', '知识库', '/repo', 'repo', true, NULL, 10, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '4');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '7', '审计日志', '/audit', 'settings', true, NULL, 11, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '7');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '5', '系统设置', '/admin', 'settings', true, NULL, 12, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '5');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '5-1', '菜单管理', '/admin/menus', 'settings', true, '5', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '5-1');

INSERT INTO menu_items (menu_id, name, path, icon, visible, parent_id, sort_order, created_at, updated_at)
SELECT '5-2', 'IP映射配置', '/admin/ip-config', 'ip', true, '5', 2, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_id = '5-2');

-- Initialize System Parameters
INSERT INTO system_parameters (param_key, param_value, param_type, description, category, created_at, updated_at)
SELECT 'SESSION_TIMEOUT', '3000', 'NUMBER', 'Session timeout in seconds', 'System', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_parameters WHERE param_key = 'SESSION_TIMEOUT');

INSERT INTO system_parameters (param_key, param_value, param_type, description, category, created_at, updated_at)
SELECT 'MAX_RETRY', '3', 'NUMBER', 'Max login retries', 'System', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_parameters WHERE param_key = 'MAX_RETRY');

INSERT INTO system_parameters (param_key, param_value, param_type, description, category, created_at, updated_at)
SELECT 'TRANSFER_FEE', '1.50', 'NUMBER', 'Default fee', 'Business', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_parameters WHERE param_key = 'TRANSFER_FEE');

-- Initialize Sample Announcement
INSERT INTO announcements (title, description, content, version, status, created_at, updated_at, created_by, updated_by)
SELECT '欢迎使用系统', '系统已成功部署，欢迎使用！', '这是一条欢迎公告，系统已正式上线。', '20251212', 'PUBLISHED', NOW(), NOW(), 'admin', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE version = '20251212');
-- Initialize Gitee Connections Table
CREATE TABLE IF NOT EXISTS gitee_connections (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  repo_url VARCHAR(500) NOT NULL,
  auth_type VARCHAR(50) NOT NULL,
  access_token VARCHAR(2000),
  private_key LONGTEXT,
  public_key LONGTEXT,
  is_default BOOLEAN DEFAULT FALSE,
  connection_status VARCHAR(50) DEFAULT 'unknown',
  last_test_time DATETIME,
  last_test_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(255),
  notes TEXT,
  UNIQUE KEY uk_name_auth_type (name, auth_type),
  INDEX idx_auth_type (auth_type),
  INDEX idx_is_default (is_default)
);