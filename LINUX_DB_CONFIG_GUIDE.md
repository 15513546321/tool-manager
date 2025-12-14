# Linux 部署 - H2 数据库配置指南

## 快速决策

| 场景 | 推荐方案 | 配置路径 |
|------|--------|---------|
| 小型/个人部署 | 项目同级目录 | `/opt/tool-manager-data/tooldb` |
| 中等规模 | 标准系统路径 | `/var/data/tool-manager/tooldb` |
| 生产环境 | 独立分区 | `/data/tool-manager/tooldb` |
| Docker 容器 | 挂载卷 | `/var/data/tooldb` |

---

## 方案对比

### ❌ 不推荐：项目内部目录

```
目录结构:
/opt/tool-manager/
├── app.jar
├── data/
│   └── tooldb.mv.db        ❌ 应用更新时可能丢失
└── start.sh
```

**风险**:
- 应用更新/重新部署时，`data/` 目录可能被覆盖
- 备份和迁移困难
- 权限管理复杂

---

### ✅ 推荐方案 A：项目同级目录

```
目录结构:
/opt/
├── tool-manager/               (应用程序)
│   ├── app.jar
│   ├── start.sh
│   └── application-linux.properties
└── tool-manager-data/          (数据库) ⭐ 数据和程序分离
    ├── tooldb.mv.db
    └── tooldb.trace.db
```

**配置**:
```properties
spring.datasource.url=jdbc:h2:file:/opt/tool-manager-data/tooldb;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
```

**设置步骤**:
```bash
# 1. 创建数据目录
sudo mkdir -p /opt/tool-manager-data

# 2. 设置权限
sudo chown toolmanager:toolmanager /opt/tool-manager-data
sudo chmod 750 /opt/tool-manager-data

# 3. 验证
ls -ld /opt/tool-manager-data
# drwxr-x--- 2 toolmanager toolmanager ...
```

**优点**:
- ✅ 清晰的分离（数据 ≠ 应用）
- ✅ 应用更新不影响数据
- ✅ 备份只需备份 `tool-manager-data/` 目录
- ✅ 易于理解和维护

**缺点**:
- 两个目录需要同步管理

---

### ✅✅ 推荐方案 B：标准系统路径（最佳实践）

```
目录结构:
/opt/tool-manager/           (应用程序)
├── app.jar
└── start.sh

/var/data/tool-manager/      (数据库) ⭐ 标准 Linux 做法
├── tooldb.mv.db
└── tooldb.trace.db

/var/log/tool-manager/       (日志)
└── app.log
```

**配置**:
```properties
spring.datasource.url=jdbc:h2:file:/var/data/tool-manager/tooldb;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
logging.file.name=/var/log/tool-manager/app.log
```

**设置步骤**:
```bash
# 1. 创建数据和日志目录
sudo mkdir -p /var/data/tool-manager
sudo mkdir -p /var/log/tool-manager

# 2. 设置权限（关键！）
sudo chown toolmanager:toolmanager /var/data/tool-manager
sudo chown toolmanager:toolmanager /var/log/tool-manager
sudo chmod 750 /var/data/tool-manager
sudo chmod 750 /var/log/tool-manager

# 3. 验证
ls -ld /var/data/tool-manager /var/log/tool-manager
```

**优点**:
- ✅ 遵循 Linux FHS（文件系统分层标准）
- ✅ 企业级最佳实践
- ✅ 系统管理员熟悉此结构
- ✅ 数据、应用、日志完全分离
- ✅ 易于监控和维护

**缺点**:
- 相对复杂一点点

---

### ✅✅✅ 高级方案 C：独立分区（生产环境）

适用于：大数据量、高可用性要求的生产环境

```
目录结构:
/opt/tool-manager/           (应用程序)
/var/log/tool-manager/       (日志)
/data/tool-manager/          (数据库，独立分区) ⭐
├── tooldb.mv.db
└── tooldb.trace.db
```

**配置**:
```properties
spring.datasource.url=jdbc:h2:file:/data/tool-manager/tooldb;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
```

**优点**:
- ✅ 数据库故障不影响系统其他部分
- ✅ 可以针对数据分区进行性能优化
- ✅ 便于扩展（如迁移到 NAS、SAN 等）

---

## 完整部署示例

### 场景：采用方案 B（标准系统路径）

```bash
# ========== 第一次部署 ==========

# 1. 创建用户和目录
sudo useradd -m -d /home/toolmanager -s /bin/bash toolmanager
sudo mkdir -p /opt/tool-manager
sudo mkdir -p /var/data/tool-manager
sudo mkdir -p /var/log/tool-manager

# 2. 设置权限（关键！）
sudo chown -R toolmanager:toolmanager /opt/tool-manager
sudo chown -R toolmanager:toolmanager /var/data/tool-manager
sudo chown -R toolmanager:toolmanager /var/log/tool-manager

# 3. 上传或复制应用文件
sudo cp tool-manager-backend-1.0.0.jar /opt/tool-manager/app.jar
sudo cp start.sh /opt/tool-manager/
sudo cp application-linux.properties /opt/tool-manager/application.properties
sudo chown toolmanager:toolmanager /opt/tool-manager/app.jar
sudo chown toolmanager:toolmanager /opt/tool-manager/start.sh

# 4. 启动应用
/opt/tool-manager/start.sh start

# 5. 验证
/opt/tool-manager/start.sh status
curl http://localhost:8080

# ========== 日常维护 ==========

# 查看数据库文件
ls -lh /var/data/tool-manager/

# 查看日志
tail -f /var/log/tool-manager/app.log

# 备份数据库
sudo mkdir -p /backup/tool-manager
sudo cp /var/data/tool-manager/tooldb.mv.db /backup/tool-manager/tooldb.mv.db.$(date +%Y%m%d-%H%M%S)

# 恢复数据库（停止应用，然后）
sudo cp /backup/tool-manager/tooldb.mv.db.YYYYMMDD-HHMMSS /var/data/tool-manager/tooldb.mv.db
sudo chown toolmanager:toolmanager /var/data/tool-manager/tooldb.*
```

---

## 权限配置详解

### 为什么要设置权限？

H2 数据库会在运行时创建和修改数据文件，需要确保应用用户有写入权限：

```bash
# ❌ 错误示例（权限不足）
sudo chown root:root /var/data/tool-manager
# 结果：应用启动时会失败，提示"Permission denied"

# ✅ 正确示例（应用用户有权限）
sudo chown toolmanager:toolmanager /var/data/tool-manager
sudo chmod 750 /var/data/tool-manager
# 结果：应用用户 toolmanager 可以读写数据目录
```

### 权限含义

```bash
chmod 750 /var/data/tool-manager
# 7 = rwx (所有者可读、可写、可执行)
# 5 = r-x (所有组可读、可执行，不可写)
# 0 = --- (其他用户无权限)
```

---

## 常见问题解决

### Q1: Permission denied 错误

**症状**:
```
ERROR 202412 18:30:45.123 [main] org.h2.engine.Database - Error opening trace file ...
java.nio.file.AccessDeniedException: /var/data/tool-manager/tooldb.trace.db
```

**解决**:
```bash
# 检查目录权限
ls -ld /var/data/tool-manager

# 修复权限
sudo chown -R toolmanager:toolmanager /var/data/tool-manager
sudo chmod 750 /var/data/tool-manager

# 重启应用
/opt/tool-manager/start.sh restart
```

### Q2: 数据库文件不存在

**症状**:
```
H2 数据库初始化，创建新的 tooldb.mv.db
```

**正常现象**：首次启动时会自动创建数据库文件。如果要保留旧数据：

```bash
# 迁移旧数据库文件
sudo cp /opt/old-location/tooldb.mv.db /var/data/tool-manager/
sudo chown toolmanager:toolmanager /var/data/tool-manager/tooldb.*
```

### Q3: 磁盘空间不足

**检查磁盘**:
```bash
# 查看 /var/data 分区大小
df -h /var/data

# 查看数据库大小
du -sh /var/data/tool-manager
```

**扩容方案**:
```bash
# 1. 备份现有数据
sudo cp -r /var/data/tool-manager /backup/

# 2. 清理旧日志（如果空间紧张）
sudo find /var/log/tool-manager -name "*.log.*" -delete

# 3. 或迁移到更大的分区
sudo mkdir -p /data/tool-manager
sudo cp -r /var/data/tool-manager/* /data/tool-manager/
# 然后修改 application.properties 中的数据库路径
```

---

## 备份和恢复策略

### 自动备份脚本

创建 `/home/toolmanager/backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/backup/tool-manager"
DATA_DIR="/var/data/tool-manager"
RETENTION_DAYS=30

# 创建备份目录
mkdir -p $BACKUP_DIR

# 执行备份
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
tar czf $BACKUP_DIR/tooldb-backup-$TIMESTAMP.tar.gz -C $DATA_DIR .

# 删除超过 30 天的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "✅ 备份完成: $BACKUP_DIR/tooldb-backup-$TIMESTAMP.tar.gz"
```

### 添加到 crontab（每天午夜备份）

```bash
sudo su - toolmanager
crontab -e
```

添加以下行：
```
0 0 * * * /home/toolmanager/backup.sh
```

### 恢复数据库

```bash
# 1. 停止应用
/opt/tool-manager/start.sh stop

# 2. 恢复备份
sudo tar xzf /backup/tool-manager/tooldb-backup-20241214-000000.tar.gz -C /var/data/tool-manager/

# 3. 设置权限
sudo chown -R toolmanager:toolmanager /var/data/tool-manager

# 4. 启动应用
/opt/tool-manager/start.sh start
```

---

## 总结

**关键要点**:
1. ✅ 使用 `/var/data/` 或 `/opt/xxx-data/` 等标准位置
2. ✅ 确保应用用户有读写权限
3. ✅ 定期备份数据库文件
4. ✅ 监控磁盘空间
5. ✅ 记录变更日志

**推荐配置**:
```
应用程序: /opt/tool-manager/
数据库:   /var/data/tool-manager/
日志:     /var/log/tool-manager/
备份:     /backup/tool-manager/
```

这样的结构符合 Linux FHS 标准，易于管理和维护！
