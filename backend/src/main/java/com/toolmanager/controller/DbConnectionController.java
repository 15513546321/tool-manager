package com.toolmanager.controller;

import com.toolmanager.dto.DbConnectionDto;
import com.toolmanager.service.DbConnectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
    public ResponseEntity<Void> deleteConnection(@PathVariable Long id) {
        dbConnectionService.delete(id);
        return ResponseEntity.ok().build();
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

        try {
            // Load appropriate JDBC driver based on connection string
            String driverClass = detectAndLoadDriver(connectionString);
            if (driverClass == null) {
                response.put("success", false);
                response.put("error", "无法识别数据库类型，请检查连接字符串格式");
                return ResponseEntity.ok(response);
            }

            // Test connection
            Connection conn = DriverManager.getConnection(connectionString, username, password);
            if (conn != null && !conn.isClosed()) {
                conn.close();
                response.put("success", true);
                response.put("data", Map.of("message", "✓ 数据库连接成功 (" + driverClass + ")"));
                return ResponseEntity.ok(response);
            }
        } catch (ClassNotFoundException e) {
            response.put("success", false);
            response.put("error", "数据库驱动未找到: " + e.getMessage() + "，请检查环境配置或添加相应驱动");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            String errorMsg = e.getMessage();
            if (errorMsg == null) {
                errorMsg = e.getClass().getSimpleName();
            }
            // Parse error messages for user-friendly feedback
            if (errorMsg.contains("ORA-")) {
                response.put("error", "Oracle 错误: " + errorMsg);
            } else if (errorMsg.contains("could not open new connection")) {
                response.put("error", "连接被拒绝，请检查主机、端口、用户名、密码");
            } else if (errorMsg.contains("Connection refused")) {
                response.put("error", "连接被拒绝，确认数据库服务是否运行");
            } else if (errorMsg.contains("Access denied")) {
                response.put("error", "访问被拒绝，请检查用户名和密码");
            } else {
                response.put("error", "连接失败: " + errorMsg);
            }
            return ResponseEntity.ok(response);
        }

        response.put("success", false);
        response.put("error", "连接测试失败");
        return ResponseEntity.ok(response);
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
