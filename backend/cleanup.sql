-- Delete all documents and versions to start fresh
DELETE FROM document_versions;
DELETE FROM documents;

-- Delete all Nacos configurations (清空所有Nacos配置)
DELETE FROM NACOS_CONFIGS;

-- Delete all database connections (清空所有数据库连接)
DELETE FROM DB_CONNECTIONS;
