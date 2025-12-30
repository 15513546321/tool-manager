package com.toolmanager.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.sql.*;
import java.util.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
@RequiredArgsConstructor
public class OracleSynchronizer {

    /**
     * Generate DDL script by comparing source and target schemas
     * @param sourceConnStr Source database connection string
     * @param sourceUser Source database username
     * @param sourcePassword Source database password
     * @param targetConnStr Target database connection string
     * @param targetUser Target database username
     * @param targetPassword Target database password
     * @return DDL script
     */
    public String generateDDL(String sourceConnStr, String sourceUser, String sourcePassword,
                             String targetConnStr, String targetUser, String targetPassword) {
        try {
            // Load Oracle driver
            Class.forName("oracle.jdbc.driver.OracleDriver");

            // Get schema information from both databases
            Map<String, TableSchema> sourceSchema = getTableSchema(sourceConnStr, sourceUser, sourcePassword);
            Map<String, TableSchema> targetSchema = getTableSchema(targetConnStr, targetUser, targetPassword);

            // Get full table definitions from source
            Map<String, String> sourceTableDDLs = getTableDDLs(sourceConnStr, sourceUser, sourcePassword);
            
            // ✓ 性能优化：批量获取所有表的注释、索引、约束，避免N+1查询
            Map<String, String> sourceTableComments = getAllTableComments(sourceConnStr, sourceUser, sourcePassword);
            Map<String, String> targetTableComments = getAllTableComments(targetConnStr, targetUser, targetPassword);
            Map<String, Map<String, String>> sourceColumnComments = getAllColumnComments(sourceConnStr, sourceUser, sourcePassword);
            Map<String, Map<String, String>> targetColumnComments = getAllColumnComments(targetConnStr, targetUser, targetPassword);
            Map<String, List<String>> sourceIndexes = getAllIndexes(sourceConnStr, sourceUser, sourcePassword);
            Map<String, List<String>> targetIndexes = getAllIndexes(targetConnStr, targetUser, targetPassword);
            Map<String, List<String>> sourceConstraints = getAllConstraints(sourceConnStr, sourceUser, sourcePassword);
            Map<String, List<String>> targetConstraints = getAllConstraints(targetConnStr, targetUser, targetPassword);

            // Compare schemas and generate DDL
            StringBuilder ddlScript = new StringBuilder();
            
            // Add header
            ddlScript.append("-- ========================================================================\n");
            ddlScript.append("-- DDL Synchronization Script\n");
            ddlScript.append("-- Generated: ").append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))).append("\n");
            ddlScript.append("-- Source DB: ").append(sourceUser).append("\n");
            ddlScript.append("-- Target DB: ").append(targetUser).append("\n");
            ddlScript.append("-- ========================================================================\n\n");

            int statementCount = 0;

            // Find missing tables in target and create them
            for (String tableName : sourceSchema.keySet()) {
                if (!targetSchema.containsKey(tableName)) {
                    String createTableDDL = sourceTableDDLs.get(tableName);
                    if (createTableDDL != null && !createTableDDL.isEmpty()) {
                        ddlScript.append("\n-- =================================").append(tableName).append("表开始======================================\n");
                        ddlScript.append("-- Create table: ").append(tableName).append(" (MISSING in target)\n");
                        ddlScript.append(createTableDDL).append("\n/\n");
                        
                        // Add table comment if exists
                        String tableComment = sourceTableComments.get(tableName);
                        if (tableComment != null && !tableComment.isEmpty()) {
                            ddlScript.append("COMMENT ON TABLE ").append(tableName).append(" IS '").append(tableComment.replace("'", "''")).append("';\n/\n");
                        }
                        
                        ddlScript.append("-- =================================").append(tableName).append("表结束======================================\n\n");
                        statementCount++;
                    }
                }
            }

            // Compare columns for existing tables and generate ALTER statements
            for (Map.Entry<String, TableSchema> entry : sourceSchema.entrySet()) {
                String tableName = entry.getKey();
                TableSchema sourceTable = entry.getValue();

                if (targetSchema.containsKey(tableName)) {
                    TableSchema targetTable = targetSchema.get(tableName);
                    
                    // Check for column differences and generate ALTER statements
                    // ✓ 性能优化：传入预加载的注释、索引、约束数据
                    List<String> modifications = compareColumns(tableName, sourceTable, targetTable, 
                        sourceColumnComments.getOrDefault(tableName, new HashMap<>()),
                        targetColumnComments.getOrDefault(tableName, new HashMap<>()),
                        sourceIndexes.getOrDefault(tableName, new ArrayList<>()),
                        targetIndexes.getOrDefault(tableName, new ArrayList<>()),
                        sourceConstraints.getOrDefault(tableName, new ArrayList<>()),
                        targetConstraints.getOrDefault(tableName, new ArrayList<>()));
                    
                    // ✓ 比较表注释差异
                    String sourceTableComment = sourceTableComments.get(tableName);
                    String targetTableComment = targetTableComments.get(tableName);
                    
                    if ((sourceTableComment != null && !sourceTableComment.isEmpty()) && 
                        !sourceTableComment.equals(targetTableComment)) {
                        modifications.add(String.format("COMMENT ON TABLE %s IS '%s';",
                            tableName,
                            sourceTableComment.replace("'", "''")));
                    }
                    
                    if (!modifications.isEmpty()) {
                        ddlScript.append("\n-- =================================").append(tableName).append("表开始======================================\n");
                        for (String mod : modifications) {
                            ddlScript.append(mod).append("\n");
                            if (!mod.endsWith("/")) {
                                ddlScript.append("/\n");
                            }
                            ddlScript.append("\n");
                            statementCount++;
                        }
                        ddlScript.append("-- =================================").append(tableName).append("表结束======================================\n\n");
                    }
                }
            }

            ddlScript.append("-- ========================================================================\n");
            ddlScript.append("-- Summary: ").append(statementCount).append(" DDL statement(s) generated\n");
            ddlScript.append("-- ========================================================================\n");

            return ddlScript.toString();
        } catch (Exception e) {
            log.error("Failed to generate DDL", e);
            return "-- Error: " + e.getMessage();
        }
    }

    /**
     * Get full table DDL definitions from Oracle database
     */
    private Map<String, String> getTableDDLs(String connStr, String user, String password) throws SQLException {
        Map<String, String> tableDDLs = new HashMap<>();
        
        try (Connection conn = DriverManager.getConnection(connStr, user, password)) {
            DatabaseMetaData metaData = conn.getMetaData();
            
            // Get all tables for the current user
            try (ResultSet tables = metaData.getTables(null, user.toUpperCase(), "%", new String[]{"TABLE"})) {
                while (tables.next()) {
                    String tableName = tables.getString("TABLE_NAME");
                    String createTableDDL = generateCreateTableStatement(conn, user, tableName);
                    tableDDLs.put(tableName, createTableDDL);
                }
            }
        }
        
        return tableDDLs;
    }

    /**
     * Generate CREATE TABLE statement for a specific table
     */
    private String generateCreateTableStatement(Connection conn, String user, String tableName) throws SQLException {
        StringBuilder createStmt = new StringBuilder();
        createStmt.append("CREATE TABLE ").append(tableName).append(" (\n");

        DatabaseMetaData metaData = conn.getMetaData();
        List<String> columnDefinitions = new ArrayList<>();

        // Get columns
        try (ResultSet columns = metaData.getColumns(null, user.toUpperCase(), tableName, "%")) {
            while (columns.next()) {
                String colName = columns.getString("COLUMN_NAME");
                String typeName = columns.getString("TYPE_NAME");
                int columnSize = columns.getInt("COLUMN_SIZE");
                int decimalDigits = columns.getInt("DECIMAL_DIGITS");
                int nullable = columns.getInt("NULLABLE");
                
                StringBuilder colDef = new StringBuilder();
                colDef.append("  ").append(colName).append(" ").append(typeName);
                
                // Add size/precision for certain types
                if ("VARCHAR2".equalsIgnoreCase(typeName) || "VARCHAR".equalsIgnoreCase(typeName) || 
                    "CHAR".equalsIgnoreCase(typeName) || "NVARCHAR2".equalsIgnoreCase(typeName)) {
                    colDef.append("(").append(columnSize).append(")");
                } else if ("NUMBER".equalsIgnoreCase(typeName)) {
                    if (decimalDigits > 0) {
                        colDef.append("(").append(columnSize).append(",").append(decimalDigits).append(")");
                    } else if (columnSize > 0) {
                        colDef.append("(").append(columnSize).append(")");
                    }
                }
                
                if (nullable == DatabaseMetaData.columnNoNulls) {
                    colDef.append(" NOT NULL");
                }
                
                columnDefinitions.add(colDef.toString());
            }
        }

        // Add primary key
        try (ResultSet primaryKeys = metaData.getPrimaryKeys(null, user.toUpperCase(), tableName)) {
            List<String> pkColumns = new ArrayList<>();
            while (primaryKeys.next()) {
                pkColumns.add(primaryKeys.getString("COLUMN_NAME"));
            }
            if (!pkColumns.isEmpty()) {
                columnDefinitions.add("  PRIMARY KEY (" + String.join(", ", pkColumns) + ")");
            }
        }

        createStmt.append(String.join(",\n", columnDefinitions));
        createStmt.append("\n)");

        return createStmt.toString();
    }

    /**
     * Get table schema information from Oracle database
     */
    private Map<String, TableSchema> getTableSchema(String connStr, String user, String password) throws SQLException {
        Map<String, TableSchema> schema = new HashMap<>();
        
        try (Connection conn = DriverManager.getConnection(connStr, user, password)) {
            DatabaseMetaData metaData = conn.getMetaData();
            
            // Get all tables for the current user
            try (ResultSet tables = metaData.getTables(null, user.toUpperCase(), "%", new String[]{"TABLE"})) {
                while (tables.next()) {
                    String tableName = tables.getString("TABLE_NAME");
                    TableSchema tableSchema = new TableSchema(tableName);
                    
                    // Get columns for this table
                    try (ResultSet columns = metaData.getColumns(null, user.toUpperCase(), tableName, "%")) {
                        while (columns.next()) {
                            ColumnInfo col = new ColumnInfo(
                                columns.getString("COLUMN_NAME"),
                                columns.getString("TYPE_NAME"),
                                columns.getInt("COLUMN_SIZE"),
                                columns.getInt("NULLABLE") == DatabaseMetaData.columnNullable
                            );
                            tableSchema.addColumn(col);
                        }
                    }
                    
                    schema.put(tableName, tableSchema);
                }
            }
        }
        
        return schema;
    }

    /**
     * Compare columns between source and target tables with comments, indexes, and constraints
     * ✓ 性能优化：直接接收预加载的数据，避免重复查询数据库
     */
    private List<String> compareColumns(String tableName, TableSchema source, TableSchema target,
                                       Map<String, String> sourceComments, Map<String, String> targetComments,
                                       List<String> sourceIndexes, List<String> targetIndexes,
                                       List<String> sourceConstraints, List<String> targetConstraints) {
        List<String> modifications = new ArrayList<>();
        
        // Check for missing columns in target
        for (ColumnInfo sourceCol : source.getColumns()) {
            ColumnInfo targetCol = target.getColumn(sourceCol.getName());
            
            if (targetCol == null) {
                // Column is missing in target
                modifications.add(String.format("ALTER TABLE %s ADD (%s %s%s);",
                    tableName,
                    sourceCol.getName(),
                    sourceCol.getType(),
                    sourceCol.getSize() > 0 ? "(" + sourceCol.getSize() + ")" : ""));
                
                // Add column comment if exists
                String colComment = sourceComments.get(sourceCol.getName());
                if (colComment != null && !colComment.isEmpty()) {
                    modifications.add(String.format("COMMENT ON COLUMN %s.%s IS '%s';",
                        tableName,
                        sourceCol.getName(),
                        colComment.replace("'", "''")));
                }
            } else if (!sourceCol.getType().equals(targetCol.getType()) ||
                       sourceCol.getSize() != targetCol.getSize()) {
                // Column type or size differs
                modifications.add(String.format("ALTER TABLE %s MODIFY (%s %s%s);",
                    tableName,
                    sourceCol.getName(),
                    sourceCol.getType(),
                    sourceCol.getSize() > 0 ? "(" + sourceCol.getSize() + ")" : ""));
            }
            
            // Check if column comments differ
            String sourceComment = sourceComments.get(sourceCol.getName());
            String targetComment = targetComments.get(sourceCol.getName());
            if ((sourceComment != null && !sourceComment.isEmpty()) && 
                !sourceComment.equals(targetComment)) {
                modifications.add(String.format("COMMENT ON COLUMN %s.%s IS '%s';",
                    tableName,
                    sourceCol.getName(),
                    sourceComment.replace("'", "''")));
            }
        }
        
        // Compare indexes
        for (String sourceIndex : sourceIndexes) {
            if (!targetIndexes.contains(sourceIndex)) {
                modifications.add(sourceIndex);
            }
        }
        
        // Compare constraints (CHECK, UNIQUE)
        for (String sourceConstraint : sourceConstraints) {
            if (!targetConstraints.contains(sourceConstraint)) {
                modifications.add(sourceConstraint);
            }
        }
        
        return modifications;
    }
    
    /**
     * ✓ 性能优化：批量获取所有表的表注释
     */
    private Map<String, String> getAllTableComments(String connStr, String user, String password) {
        Map<String, String> comments = new HashMap<>();
        try (Connection conn = DriverManager.getConnection(connStr, user, password)) {
            String sql = "SELECT TABLE_NAME, COMMENTS FROM user_tab_comments WHERE TABLE_TYPE = 'TABLE'";
            try (PreparedStatement stmt = conn.prepareStatement(sql);
                 ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    String tableName = rs.getString("TABLE_NAME");
                    String comment = rs.getString("COMMENTS");
                    if (comment != null) {
                        comments.put(tableName, comment);
                    }
                }
            }
        } catch (SQLException e) {
            log.warn("Failed to get all table comments", e);
        }
        return comments;
    }
    
    /**
     * ✓ 性能优化：批量获取所有表的列注释
     */
    private Map<String, Map<String, String>> getAllColumnComments(String connStr, String user, String password) {
        Map<String, Map<String, String>> allComments = new HashMap<>();
        try (Connection conn = DriverManager.getConnection(connStr, user, password)) {
            String sql = "SELECT TABLE_NAME, COLUMN_NAME, COMMENTS FROM user_col_comments";
            try (PreparedStatement stmt = conn.prepareStatement(sql);
                 ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    String tableName = rs.getString("TABLE_NAME");
                    String columnName = rs.getString("COLUMN_NAME");
                    String comment = rs.getString("COMMENTS");
                    
                    allComments.computeIfAbsent(tableName, k -> new HashMap<>()).put(columnName, comment);
                }
            }
        } catch (SQLException e) {
            log.warn("Failed to get all column comments", e);
        }
        return allComments;
    }
    
    /**
     * ✓ 性能优化：批量获取所有表的索引
     */
    private Map<String, List<String>> getAllIndexes(String connStr, String user, String password) {
        Map<String, List<String>> allIndexes = new HashMap<>();
        try (Connection conn = DriverManager.getConnection(connStr, user, password)) {
            String sql = "SELECT ui.TABLE_NAME, ui.INDEX_NAME, ui.UNIQUENESS, " +
                        "(SELECT LISTAGG(uic.COLUMN_NAME, ',') WITHIN GROUP (ORDER BY uic.COLUMN_POSITION) " +
                        " FROM user_ind_columns uic WHERE uic.INDEX_NAME = ui.INDEX_NAME) AS COLUMNS " +
                        "FROM user_indexes ui " +
                        "WHERE ui.INDEX_NAME NOT LIKE 'SYS_%' " +
                        "AND ui.INDEX_NAME NOT IN (SELECT CONSTRAINT_NAME FROM user_constraints WHERE CONSTRAINT_TYPE = 'P')";
            
            try (PreparedStatement stmt = conn.prepareStatement(sql);
                 ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    String tableName = rs.getString("TABLE_NAME");
                    String indexName = rs.getString("INDEX_NAME");
                    String uniqueness = rs.getString("UNIQUENESS");
                    String columns = rs.getString("COLUMNS");
                    
                    if (columns != null && !columns.isEmpty()) {
                        String indexDDL;
                        if ("UNIQUE".equalsIgnoreCase(uniqueness)) {
                            indexDDL = String.format("CREATE UNIQUE INDEX %s ON %s (%s);", indexName, tableName, columns);
                        } else {
                            indexDDL = String.format("CREATE INDEX %s ON %s (%s);", indexName, tableName, columns);
                        }
                        allIndexes.computeIfAbsent(tableName, k -> new ArrayList<>()).add(indexDDL);
                    }
                }
            }
        } catch (SQLException e) {
            log.warn("Failed to get all indexes", e);
        }
        return allIndexes;
    }
    
    /**
     * ✓ 性能优化：批量获取所有表的约束
     */
    private Map<String, List<String>> getAllConstraints(String connStr, String user, String password) {
        Map<String, List<String>> allConstraints = new HashMap<>();
        try (Connection conn = DriverManager.getConnection(connStr, user, password)) {
            String sql = "SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE, SEARCH_CONDITION " +
                        "FROM user_constraints " +
                        "WHERE CONSTRAINT_TYPE IN ('U', 'C') " +
                        "ORDER BY TABLE_NAME, CONSTRAINT_TYPE";
            
            try (PreparedStatement stmt = conn.prepareStatement(sql);
                 ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    String tableName = rs.getString("TABLE_NAME");
                    String constraintName = rs.getString("CONSTRAINT_NAME");
                    String constraintType = rs.getString("CONSTRAINT_TYPE");
                    String searchCondition = rs.getString("SEARCH_CONDITION");
                    
                    if ("C".equals(constraintType) && searchCondition != null && !searchCondition.isEmpty()) {
                        String constraintDDL = String.format("ALTER TABLE %s ADD CONSTRAINT %s CHECK (%s);", 
                            tableName, constraintName, searchCondition);
                        allConstraints.computeIfAbsent(tableName, k -> new ArrayList<>()).add(constraintDDL);
                    }
                }
            }
        } catch (SQLException e) {
            log.warn("Failed to get all constraints", e);
        }
        return allConstraints;
    }
    
    /**
     * Table schema information holder
     */
    public static class TableSchema {
        private final String name;
        private final List<ColumnInfo> columns = new ArrayList<>();

        public TableSchema(String name) {
            this.name = name;
        }

        public void addColumn(ColumnInfo column) {
            columns.add(column);
        }

        public ColumnInfo getColumn(String name) {
            return columns.stream()
                .filter(c -> c.getName().equals(name))
                .findFirst()
                .orElse(null);
        }

        public List<ColumnInfo> getColumns() {
            return columns;
        }

        public String getName() {
            return name;
        }
    }

    /**
     * Column information holder
     */
    public static class ColumnInfo {
        private final String name;
        private final String type;
        private final int size;
        private final boolean nullable;

        public ColumnInfo(String name, String type, int size, boolean nullable) {
            this.name = name;
            this.type = type;
            this.size = size;
            this.nullable = nullable;
        }

        public String getName() {
            return name;
        }

        public String getType() {
            return type;
        }

        public int getSize() {
            return size;
        }

        public boolean isNullable() {
            return nullable;
        }
    }
}
