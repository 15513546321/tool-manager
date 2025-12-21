package com.toolmanager.controller;

import com.toolmanager.service.OracleSynchronizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/oracle-sync")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class OracleSyncController {

    private final OracleSynchronizer oracleSynchronizer;

    /**
     * Generate DDL script by comparing source and target database schemas
     * POST /api/oracle-sync/generate-ddl
     */
    @PostMapping("/generate-ddl")
    public ResponseEntity<Map<String, Object>> generateDDL(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            String sourceConnStr = request.get("sourceConnStr");
            String sourceUser = request.get("sourceUser");
            String sourcePassword = request.get("sourcePassword");
            String targetConnStr = request.get("targetConnStr");
            String targetUser = request.get("targetUser");
            String targetPassword = request.get("targetPassword");

            if (sourceConnStr == null || targetConnStr == null) {
                response.put("success", false);
                response.put("error", "缺少必要的连接信息");
                return ResponseEntity.ok(response);
            }

            String ddlScript = oracleSynchronizer.generateDDL(
                sourceConnStr, sourceUser, sourcePassword,
                targetConnStr, targetUser, targetPassword
            );

            response.put("success", true);
            response.put("data", Map.of("ddlScript", ddlScript));
            log.info("DDL script generated successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to generate DDL", e);
            response.put("success", false);
            response.put("error", "生成DDL失败: " + e.getMessage());
            return ResponseEntity.ok(response);
        }
    }

    /**
     * Execute DDL script on target database
     * POST /api/oracle-sync/execute-ddl
     */
    @PostMapping("/execute-ddl")
    public ResponseEntity<Map<String, Object>> executeDDL(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            String targetConnStr = request.get("targetConnStr");
            String targetUser = request.get("targetUser");
            String targetPassword = request.get("targetPassword");
            String ddlScript = request.get("ddlScript");

            if (targetConnStr == null || ddlScript == null) {
                response.put("success", false);
                response.put("error", "缺少必要的连接信息或DDL脚本");
                return ResponseEntity.ok(response);
            }

            // Execute DDL script
            Class.forName("oracle.jdbc.driver.OracleDriver");
            try (java.sql.Connection conn = java.sql.DriverManager.getConnection(targetConnStr, targetUser, targetPassword)) {
                java.sql.Statement stmt = conn.createStatement();
                
                // Parse and execute each statement
                List<String> statements = parseStatements(ddlScript);
                List<Map<String, Object>> executionResults = new ArrayList<>();
                int successCount = 0;
                int failureCount = 0;
                
                for (int i = 0; i < statements.size(); i++) {
                    String sql = statements.get(i);
                    String trimmed = sql.trim();
                    
                    if (!trimmed.isEmpty() && !trimmed.startsWith("--") && !trimmed.startsWith("/*")) {
                        Map<String, Object> result = new HashMap<>();
                        result.put("index", i + 1);
                        result.put("statement", truncateStatement(trimmed, 100));
                        
                        try {
                            stmt.execute(trimmed);
                            result.put("success", true);
                            result.put("message", "✓ 执行成功");
                            successCount++;
                        } catch (Exception e) {
                            result.put("success", false);
                            result.put("error", e.getMessage());
                            failureCount++;
                            log.warn("Failed to execute statement [{}]: {}", i + 1, trimmed, e);
                        }
                        
                        executionResults.add(result);
                    }
                }
                
                response.put("success", true);
                response.put("data", Map.of(
                    "totalStatements", statements.size(),
                    "executedStatements", successCount + failureCount,
                    "successCount", successCount,
                    "failureCount", failureCount,
                    "details", executionResults,
                    "message", String.format("✓ DDL脚本已完成执行。成功: %d, 失败: %d", successCount, failureCount)
                ));
                log.info("DDL script executed: {} success, {} failures", successCount, failureCount);
            }
            return ResponseEntity.ok(response);
        } catch (ClassNotFoundException e) {
            log.error("Oracle driver not found", e);
            response.put("success", false);
            response.put("error", "Oracle驱动未找到，请检查环境配置");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to execute DDL", e);
            response.put("success", false);
            response.put("error", "执行DDL失败: " + e.getMessage());
            return ResponseEntity.ok(response);
        }
    }

    /**
     * Parse DDL script into individual statements
     */
    private List<String> parseStatements(String ddlScript) {
        List<String> statements = new ArrayList<>();
        StringBuilder currentStatement = new StringBuilder();
        boolean inComment = false;
        String[] lines = ddlScript.split("\n");
        
        for (String line : lines) {
            String trimmed = line.trim();
            
            // Handle block comments
            if (trimmed.startsWith("/*")) {
                inComment = true;
            }
            if (inComment) {
                if (trimmed.endsWith("*/")) {
                    inComment = false;
                }
                continue;
            }
            
            // Skip line comments and empty lines
            if (trimmed.startsWith("--") || trimmed.isEmpty()) {
                continue;
            }
            
            // Accumulate statement
            currentStatement.append(line).append("\n");
            
            // Check if statement ends with / on its own line (Oracle convention)
            if (trimmed.equals("/")) {
                // Remove the trailing / and add statement
                String stmt = currentStatement.toString();
                stmt = stmt.substring(0, stmt.lastIndexOf("/")).trim();
                if (!stmt.isEmpty()) {
                    statements.add(stmt);
                }
                currentStatement = new StringBuilder();
            } else if (trimmed.endsWith(";")) {
                // Or ends with semicolon
                String stmt = currentStatement.toString().trim();
                if (stmt.endsWith(";")) {
                    stmt = stmt.substring(0, stmt.length() - 1);
                }
                if (!stmt.isEmpty()) {
                    statements.add(stmt);
                }
                currentStatement = new StringBuilder();
            }
        }
        
        // Add any remaining statement
        if (currentStatement.length() > 0) {
            String stmt = currentStatement.toString().trim();
            if (!stmt.isEmpty()) {
                statements.add(stmt);
            }
        }
        
        return statements;
    }

    /**
     * Truncate statement for display
     */
    private String truncateStatement(String statement, int maxLength) {
        if (statement.length() > maxLength) {
            return statement.substring(0, maxLength) + "...";
        }
        return statement;
    }
}
