-- ==================================================
-- 数据库 Schema 初始化脚本 (H2 兼容版本)
-- 创建所有必要的表结构
-- 注意：使用 IF NOT EXISTS 保证幂等性，重启后数据不丢失
-- ==================================================

-- 1. Announcements (公告)
CREATE TABLE IF NOT EXISTS announcements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    content CLOB,
    version VARCHAR(50),
    status VARCHAR(50) DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

-- 2. Menu Items (菜单)
CREATE TABLE IF NOT EXISTS menu_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    menu_id VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(500),
    icon VARCHAR(100),
    visible BOOLEAN DEFAULT TRUE,
    parent_id VARCHAR(50),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. System Parameters (系统参数)
CREATE TABLE IF NOT EXISTS system_parameters (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    param_key VARCHAR(255) NOT NULL UNIQUE,
    param_value CLOB,
    param_type VARCHAR(50),
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Parameter Categories (参数分类)
CREATE TABLE IF NOT EXISTS parameter_categories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    big_class VARCHAR(100) NOT NULL,
    small_class VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (big_class, small_class)
);

-- 5. Config Settings (配置设置)
CREATE TABLE IF NOT EXISTS config_settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(255) NOT NULL UNIQUE,
    config_value CLOB,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. DB Connections (数据库连接)
-- Drop old table to ensure clean schema
DROP TABLE IF EXISTS db_connections;

CREATE TABLE db_connections (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    db_type VARCHAR(50) NOT NULL,
    host VARCHAR(500),
    port INT,
    database VARCHAR(255),
    username VARCHAR(255),
    password VARCHAR(2000),
    connection_string VARCHAR(5000),
    notes VARCHAR(5000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255)
);

-- 7. Documents (文档)
CREATE TABLE IF NOT EXISTS documents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    doc_type VARCHAR(50),
    category_id BIGINT,
    content CLOB,
    status VARCHAR(50) DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

-- 8. Document Categories (文档分类)
CREATE TABLE IF NOT EXISTS document_categories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Document Versions (文档版本)
CREATE TABLE IF NOT EXISTS document_versions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT NOT NULL,
    version_number VARCHAR(50),
    file_name VARCHAR(500),
    file_content CLOB,
    file_size VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- 10. Audit Logs (审计日志)
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    old_value CLOB,
    new_value CLOB,
    description TEXT,
    status VARCHAR(50),
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Suggestions (建议)
CREATE TABLE IF NOT EXISTS suggestions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    status VARCHAR(50) DEFAULT 'OPEN',
    priority VARCHAR(50) DEFAULT 'MEDIUM',
    submitted_by VARCHAR(255),
    assigned_to VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- 12. IP Mappings (IP映射)
-- Drop old table to ensure clean schema
DROP TABLE IF EXISTS ip_mappings;

CREATE TABLE ip_mappings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ip VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    last_announcement_version_seen VARCHAR(255)
);

-- 13. Code Templates (代码模板)
CREATE TABLE IF NOT EXISTS code_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    template_type VARCHAR(50),
    content CLOB NOT NULL,
    description TEXT,
    tags VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

-- 14. Nacos Configs (Nacos配置)
-- Drop the old nacos_configs table if it exists to ensure clean schema
DROP TABLE IF EXISTS nacos_configs;

CREATE TABLE IF NOT EXISTS nacos_configs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    source_url VARCHAR(500) NOT NULL,
    source_namespace VARCHAR(255),
    source_username VARCHAR(255),
    source_password VARCHAR(500),
    source_remark TEXT,
    target_url VARCHAR(500) NOT NULL,
    target_namespace VARCHAR(255),
    target_username VARCHAR(255),
    target_password VARCHAR(500),
    target_remark TEXT,
    sync_rules LONGTEXT,
    description TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Gitee Connections (Gitee连接)
CREATE TABLE IF NOT EXISTS gitee_connections (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    repo_url VARCHAR(500) NOT NULL,
    auth_type VARCHAR(50) NOT NULL,
    access_token VARCHAR(2000),
    private_key CLOB,
    public_key CLOB,
    is_default BOOLEAN DEFAULT FALSE,
    connection_status VARCHAR(50) DEFAULT 'unknown',
    last_test_time TIMESTAMP,
    last_test_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    notes TEXT,
    UNIQUE (name, auth_type)
);

-- 16. Analysis Items (分析项)
CREATE TABLE IF NOT EXISTS analysis_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    connection_id BIGINT NOT NULL,
    repo_name VARCHAR(255) NOT NULL,
    branch VARCHAR(100),
    analysis_status VARCHAR(50),
    last_analysis_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (connection_id, repo_name, branch),
    FOREIGN KEY (connection_id) REFERENCES gitee_connections(id) ON DELETE CASCADE
);

-- ==================================================
-- 创建索引以提高查询性能
-- ==================================================

CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at);

CREATE INDEX IF NOT EXISTS idx_menu_items_parent_id ON menu_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_visible ON menu_items(visible);

CREATE INDEX IF NOT EXISTS idx_system_parameters_category ON system_parameters(category);

CREATE INDEX IF NOT EXISTS idx_db_connections_db_type ON db_connections(db_type);

CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
CREATE INDEX IF NOT EXISTS idx_documents_category_id ON documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);

CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_version_number ON document_versions(version_number);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_priority ON suggestions(priority);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON suggestions(created_at);

CREATE INDEX IF NOT EXISTS idx_gitee_connections_auth_type ON gitee_connections(auth_type);
CREATE INDEX IF NOT EXISTS idx_gitee_connections_is_default ON gitee_connections(is_default);
