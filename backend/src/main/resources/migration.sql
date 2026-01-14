-- ============================================================
-- 简化数据库迁移脚本 - 添加documents表的新字段
-- ============================================================
-- 说明：只检查字段是否存在，如果不存在就添加
-- 适用于空表或新环境

-- 检查并添加category字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'DOCUMENTS' 
        AND column_name = 'CATEGORY'
        AND table_schema = 'PUBLIC'
    ) THEN
        ALTER TABLE documents ADD COLUMN category VARCHAR(255) NOT NULL;
    END IF;
END $$;

-- 检查并添加sub_category字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'DOCUMENTS' 
        AND column_name = 'SUB_CATEGORY'
        AND table_schema = 'PUBLIC'
    ) THEN
        ALTER TABLE documents ADD COLUMN sub_category VARCHAR(255);
    END IF;
END $$;

-- 验证表结构
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'DOCUMENTS' 
AND table_schema = 'PUBLIC'
ORDER BY ordinal_position;