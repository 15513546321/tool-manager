package com.toolmanager.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
@RequiredArgsConstructor
public class DatabaseBackupService {

    @Value("${spring.datasource.url:jdbc:h2:file:./data/toolmanager}")
    private String datasourceUrl;

    @Value("${spring.datasource.username:sa}")
    private String username;

    @Value("${spring.datasource.password:}")
    private String password;

    /**
     * Scheduled task to backup H2 database every week (Monday 2:00 AM)
     */
    @Scheduled(cron = "0 0 2 ? * MON")
    public void weeklyBackupH2Database() {
        log.info("========================================");
        log.info("开始周期性数据库备份任务 (每周一 02:00)");
        log.info("========================================");
        try {
            backupH2Database();
        } catch (Exception e) {
            log.error("❌ 数据库备份失败", e);
        }
    }

    /**
     * Manual backup method (can also be called via REST API)
     */
    public void backupH2Database() throws SQLException, IOException {
        // Extract file path from JDBC URL
        // Format: jdbc:h2:file:./data/toolmanager
        String fileDbPath = extractH2FilePath(datasourceUrl);
        
        if (fileDbPath == null) {
            log.warn("⚠️ H2 数据库不在文件模式，跳过备份");
            return;
        }

        // Create backup directory path
        Path dbPath = Paths.get(fileDbPath);
        Path dbDir = dbPath.getParent();
        Path backupDir = dbDir.resolve("backups");

        // Ensure backup directory exists
        if (!Files.exists(backupDir)) {
            Files.createDirectories(backupDir);
            log.info("✓ 创建备份目录: {}", backupDir);
        }

        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HHmmss"));
        Path backupFile = backupDir.resolve("toolmanager_backup_" + timestamp + ".sql");

        try (Connection conn = DriverManager.getConnection(datasourceUrl, username, password);
             Statement stmt = conn.createStatement();
             FileOutputStream fos = new FileOutputStream(backupFile.toFile());
             OutputStreamWriter writer = new OutputStreamWriter(fos, "UTF-8")) {

            // Execute H2 SCRIPT command to export database
            String scriptCommand = "SCRIPT TO '" + backupFile.toAbsolutePath() + "' CHARSET 'UTF-8'";
            log.info("执行备份命令: {}", scriptCommand);
            
            stmt.execute(scriptCommand);

            // Verify backup file was created
            if (Files.exists(backupFile)) {
                long fileSize = Files.size(backupFile);
                log.info("✓ 备份成功！");
                log.info("  文件: {}", backupFile.getFileName());
                log.info("  大小: {} KB", fileSize / 1024);
                log.info("  路径: {}", backupFile.toAbsolutePath());
                
                // Clean old backups (keep last 4 weeks = 4 backups)
                cleanOldBackups(backupDir, 4);
            } else {
                log.error("❌ 备份文件创建失败");
            }
        } catch (SQLException e) {
            log.error("❌ 数据库执行备份命令失败", e);
            throw e;
        } catch (IOException e) {
            log.error("❌ 文件I/O错误", e);
            throw e;
        }
    }

    /**
     * Clean old backup files, keeping only the specified number of recent backups
     */
    private void cleanOldBackups(Path backupDir, int keepCount) {
        try {
            File[] backupFiles = backupDir.toFile().listFiles((dir, name) -> 
                name.startsWith("toolmanager_backup_") && name.endsWith(".sql")
            );

            if (backupFiles != null && backupFiles.length > keepCount) {
                // Sort by modification time
                java.util.Arrays.sort(backupFiles, (f1, f2) -> 
                    Long.compare(f2.lastModified(), f1.lastModified())
                );

                // Delete oldest files
                for (int i = keepCount; i < backupFiles.length; i++) {
                    File oldFile = backupFiles[i];
                    if (oldFile.delete()) {
                        log.info("🗑️ 删除旧备份: {}", oldFile.getName());
                    } else {
                        log.warn("⚠️ 无法删除旧备份: {}", oldFile.getName());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("清理旧备份失败", e);
        }
    }

    /**
     * Extract H2 database file path from JDBC URL
     * Supports formats like:
     *   - jdbc:h2:file:./data/toolmanager
     *   - jdbc:h2:file:/opt/tool-manager/data/toolmanager
     */
    private String extractH2FilePath(String jdbcUrl) {
        if (jdbcUrl == null || !jdbcUrl.contains("h2:file:")) {
            return null;
        }

        try {
            // Remove 'jdbc:h2:file:' prefix and any options after semicolon
            String path = jdbcUrl.substring("jdbc:h2:file:".length());
            
            // Remove options (everything after the first semicolon)
            if (path.contains(";")) {
                path = path.substring(0, path.indexOf(";"));
            }

            return path.trim();
        } catch (Exception e) {
            log.error("提取H2数据库路径失败: {}", jdbcUrl, e);
            return null;
        }
    }

    /**
     * Get backup directory info
     */
    public String getBackupInfo() {
        try {
            String fileDbPath = extractH2FilePath(datasourceUrl);
            if (fileDbPath == null) {
                return "H2 数据库不在文件模式";
            }

            Path backupDir = Paths.get(fileDbPath).getParent().resolve("backups");
            if (!Files.exists(backupDir)) {
                return "备份目录: " + backupDir.toAbsolutePath() + " (尚未创建)";
            }

            File[] backupFiles = backupDir.toFile().listFiles((dir, name) -> 
                name.startsWith("toolmanager_backup_") && name.endsWith(".sql")
            );

            int count = backupFiles != null ? backupFiles.length : 0;
            return String.format("备份目录: %s (%d 个备份)", backupDir.toAbsolutePath(), count);
        } catch (Exception e) {
            return "获取备份信息失败: " + e.getMessage();
        }
    }
}
