package com.toolmanager.controller;

import com.toolmanager.dto.DbConnectionDto;
import com.toolmanager.service.DbConnectionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/db-connection")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class DbConnectionController {

    private final DbConnectionService dbConnectionService;

    /**
     * Get all database connections
     * GET /api/db-connection/all
     */
    @GetMapping("/all")
    public ResponseEntity<List<DbConnectionDto>> getAllConnections() {
        return ResponseEntity.ok(dbConnectionService.getAll());
    }

    /**
     * Get connections by type
     * GET /api/db-connection/type/{type}
     */
    @GetMapping("/type/{type}")
    public ResponseEntity<List<DbConnectionDto>> getByType(@PathVariable String type) {
        return ResponseEntity.ok(dbConnectionService.getByType(type));
    }

    /**
     * Get connection by ID
     * GET /api/db-connection/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<DbConnectionDto> getById(@PathVariable Long id) {
        DbConnectionDto connection = dbConnectionService.getById(id);
        if (connection == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(connection);
    }

    /**
     * Create or update a database connection
     * POST /api/db-connection
     * PUT /api/db-connection/{id}
     */
    @PostMapping
    public ResponseEntity<DbConnectionDto> createConnection(@RequestBody DbConnectionDto dto) {
        DbConnectionDto saved = dbConnectionService.save(dto);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<DbConnectionDto> updateConnection(@PathVariable Long id, @RequestBody DbConnectionDto dto) {
        dto.setId(id);
        DbConnectionDto updated = dbConnectionService.save(dto);
        return ResponseEntity.ok(updated);
    }

    /**
     * Delete a database connection
     * DELETE /api/db-connection/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteConnection(@PathVariable Long id) {
        Map<String, Object> response = new HashMap<>();
        try {
            dbConnectionService.delete(id);
            response.put("success", true);
            response.put("message", "连接删除成功");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.ok(response);
        }
    }

    /**
     * Test database connection with automatic driver detection
     * POST /api/db-connection/test-connection
     */
    @PostMapping("/test-connection")
    public ResponseEntity<Map<String, Object>> testConnection(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new HashMap<>();
        String connectionString = request.get("connectionString");
        String username = request.get("username");
        String password = request.get("password");

        Connection conn = null;
        try {
            // Load appropriate JDBC driver based on connection string
            String driverClass = detectAndLoadDriver(connectionString);
            if (driverClass == null) {
                response.put("success", false);
                response.put("error", "无法识别数据库类型，请检查连接字符串格式");
                return ResponseEntity.ok(response);
            }

            // 优化连接字符串 - 添加超时和网络参数
            String optimizedConnStr = optimizeConnectionString(connectionString);
            log.info("🔗 Testing connection: {}", sanitizeUrl(optimizedConnStr));
            
            // 设置连接超时 (10秒)
            DriverManager.setLoginTimeout(10);
            
            // Test connection with optimized settings
            long startTime = System.currentTimeMillis();
            conn = DriverManager.getConnection(optimizedConnStr, username, password);
            
            if (conn != null && !conn.isClosed()) {
                // 测试连接有效性 - 执行简单查询
                Statement stmt = conn.createStatement();
                stmt.setQueryTimeout(5); // 查询超时5秒
                
                String testQuery = "SELECT 1 FROM DUAL"; // Oracle test query
                if (connectionString.toLowerCase().contains("mysql")) {
                    testQuery = "SELECT 1";
                } else if (connectionString.toLowerCase().contains("postgresql")) {
                    testQuery = "SELECT 1";
                }
                
                ResultSet rs = stmt.executeQuery(testQuery);
                rs.close();
                stmt.close();
                
                long elapsed = System.currentTimeMillis() - startTime;
                
                response.put("success", true);
                response.put("data", Map.of(
                    "message", "✓ 数据库连接成功 (" + driverClass + ")",
                    "elapsed", elapsed + "ms",
                    "tip", "连接测试通过，响应时间 " + elapsed + "ms"
                ));
                log.info("✓ Connection test successful in {}ms", elapsed);
                return ResponseEntity.ok(response);
            }
        } catch (ClassNotFoundException e) {
            response.put("success", false);
            response.put("error", "数据库驱动未找到: " + e.getMessage() + "，请检查环境配置或添加相应驱动");
            log.error("Driver not found: {}", e.getMessage());
            return ResponseEntity.ok(response);
        } catch (SQLTimeoutException e) {
            response.put("success", false);
            response.put("error", "连接超时：数据库响应时间过长，请检查网络连接或数据库负载");
            log.error("Connection timeout: {}", e.getMessage());
            return ResponseEntity.ok(response);
        } catch (SQLException e) {
            response.put("success", false);
            String errorMsg = e.getMessage();
            String errorCode = "";
            
            if (e.getErrorCode() != 0) {
                errorCode = " (Error Code: " + e.getErrorCode() + ")";
            }
            
            // 增强的错误诊断
            if (errorMsg.contains("ORA-01017") || errorMsg.contains("invalid username/password")) {
                response.put("error", "❌ 用户名或密码错误" + errorCode);
            } else if (errorMsg.contains("ORA-12505") || errorMsg.contains("could not resolve")) {
                response.put("error", "❌ 无法解析 SID/Service Name，请检查连接字符串格式：\n" +
                    "• SID 方式: jdbc:oracle:thin:@host:port:SID\n" +
                    "• Service 方式: jdbc:oracle:thin:@host:port/SERVICE_NAME" + errorCode);
            } else if (errorMsg.contains("ORA-12514")) {
                response.put("error", "❌ TNS 监听程序无法识别服务，请确认 Service Name 正确" + errorCode);
            } else if (errorMsg.contains("ORA-12541") || errorMsg.contains("ORA-12170") || errorMsg.contains("Connection refused")) {
                response.put("error", "❌ 无法连接到数据库：\n" +
                    "• 请检查主机地址和端口是否正确\n" +
                    "• 确认数据库服务是否运行\n" +
                    "• 检查防火墙设置" + errorCode);
            } else if (errorMsg.contains("ORA-")) {
                response.put("error", "❌ Oracle 错误: " + errorMsg);
            } else if (errorMsg.contains("Io 异常") || errorMsg.contains("Network adapter")) {
                response.put("error", "❌ 网络错误：无法连接到数据库服务器，请检查网络连接" + errorCode);
            } else {
                response.put("error", "❌ 连接失败: " + errorMsg);
            }
            
            log.error("Connection failed: {} (Code: {})", errorMsg, e.getErrorCode());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", "❌ 未知错误: " + e.getMessage());
            log.error("Unexpected error: ", e);
            return ResponseEntity.ok(response);
        } finally {
            // 确保连接关闭
            if (conn != null) {
                try {
                    conn.close();
                    log.debug("Connection closed");
                } catch (SQLException e) {
                    log.warn("Failed to close connection: {}", e.getMessage());
                }
            }
        }

        response.put("success", false);
        response.put("error", "连接测试失败");
        return ResponseEntity.ok(response);
    }

    /**
     * Optimize Oracle connection string with timeout and network parameters
     */
    private String optimizeConnectionString(String connStr) {
        if (connStr == null || !connStr.toLowerCase().contains("oracle")) {
            return connStr;
        }
        
        // 如果已经包含参数，不再添加
        if (connStr.contains("oracle.net.CONNECT_TIMEOUT")) {
            return connStr;
        }
        
        // 添加连接超时和网络参数
        String separator = connStr.contains("?") ? "&" : "?";
        return connStr + separator +
            "oracle.net.CONNECT_TIMEOUT=10000" +  // 连接超时10秒
            "&oracle.jdbc.ReadTimeout=15000" +     // 读取超时15秒
            "&oracle.net.READ_TIMEOUT=15000";
    }
    
    /**
     * Sanitize connection URL for logging (hide password)
     */
    private String sanitizeUrl(String url) {
        if (url == null) return "null";
        return url.replaceAll("(password|passwd|pwd)=[^&]+", "$1=***");
    }
    
    /**
     * Detect database type and load appropriate JDBC driver
     * Supports: Oracle, MySQL, PostgreSQL, SQL Server, H2
     */
    private String detectAndLoadDriver(String connectionString) throws ClassNotFoundException {
        if (connectionString == null || connectionString.trim().isEmpty()) {
            return null;
        }

        String lowerCase = connectionString.toLowerCase();

        // Oracle JDBC drivers
        if (lowerCase.contains("oracle:thin")) {
            try {
                Class.forName("oracle.jdbc.OracleDriver");
                return "oracle.jdbc.OracleDriver";
            } catch (ClassNotFoundException e) {
                // Try alternative Oracle driver
                Class.forName("oracle.jdbc.driver.OracleDriver");
                return "oracle.jdbc.driver.OracleDriver";
            }
        }

        // MySQL JDBC driver
        if (lowerCase.contains("mysql")) {
            Class.forName("com.mysql.cj.jdbc.Driver");
            return "com.mysql.cj.jdbc.Driver";
        }

        // PostgreSQL JDBC driver
        if (lowerCase.contains("postgresql")) {
            Class.forName("org.postgresql.Driver");
            return "org.postgresql.Driver";
        }

        // SQL Server JDBC driver
        if (lowerCase.contains("sqlserver") || lowerCase.contains("mssql")) {
            try {
                Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
                return "com.microsoft.sqlserver.jdbc.SQLServerDriver";
            } catch (ClassNotFoundException e) {
                // Try alternative SQL Server driver
                Class.forName("net.sourceforge.jtds.jdbc.Driver");
                return "net.sourceforge.jtds.jdbc.Driver";
            }
        }

        // H2 Database
        if (lowerCase.contains("h2")) {
            Class.forName("org.h2.Driver");
            return "org.h2.Driver";
        }

        // MariaDB
        if (lowerCase.contains("mariadb")) {
            Class.forName("org.mariadb.jdbc.Driver");
            return "org.mariadb.jdbc.Driver";
        }

        // Derby
        if (lowerCase.contains("derby")) {
            Class.forName("org.apache.derby.jdbc.ClientDriver");
            return "org.apache.derby.jdbc.ClientDriver";
        }

        return null;
    }
}
