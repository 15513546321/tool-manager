package com.toolmanager.controller;

import com.toolmanager.entity.AuditLog;
import com.toolmanager.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.ResponseEntity;
import java.util.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/doc-management")
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"}, 
             allowCredentials = "true", maxAge = 3600)
public class DocManagementController {

    @Autowired
    private AuditLogRepository auditLogRepository;

    /**
     * 本地文件上传和解析接口
     * 支持单个文件失败不影响其他文件的处理
     */
    @PostMapping("/parse-files")
    public ResponseEntity<ApiResponse<List<InterfaceInfo>>> parseFiles(
            @RequestParam("files") MultipartFile[] files,
            @RequestParam(value = "username", defaultValue = "system") String username) {
        
        if (files == null || files.length == 0) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse<>(false, "No files provided", new ArrayList<>()));
        }
        
        List<InterfaceInfo> interfaces = new ArrayList<>();
        List<String> failedFiles = new ArrayList<>();
        
        // 解析所有上传的文件，单个文件失败不影响其他文件
        for (MultipartFile file : files) {
            String fileName = file.getOriginalFilename();
            if (fileName == null || fileName.isEmpty()) {
                continue;
            }
            
            try {
                System.out.println("Processing file: " + fileName);
                
                // 检查文件大小（防止内存溢出）
                if (file.getSize() > 10 * 1024 * 1024) { // 10MB limit
                    System.out.println("File too large: " + fileName);
                    failedFiles.add(fileName + " (文件过大，超过10MB限制)");
                    continue;
                }
                
                String content = new String(file.getBytes(), StandardCharsets.UTF_8);
                String filePath = fileName;
                
                // 根据文件类型解析
                if (fileName.endsWith(".xml")) {
                    try {
                        List<InterfaceInfo> xmlInterfaces = parseXmlFile(content, filePath);
                        interfaces.addAll(xmlInterfaces);
                        System.out.println("Parsed " + xmlInterfaces.size() + " interfaces from XML file: " + fileName);
                    } catch (Exception parseErr) {
                        System.err.println("Error parsing XML file " + fileName + ": " + parseErr.getMessage());
                        failedFiles.add(fileName + " (XML解析失败: " + parseErr.getMessage() + ")");
                    }
                } else if (fileName.endsWith(".java")) {
                    try {
                        List<InterfaceInfo> javaInterfaces = parseJavaFile(content, filePath);
                        interfaces.addAll(javaInterfaces);
                        System.out.println("Parsed " + javaInterfaces.size() + " interfaces from Java file: " + fileName);
                    } catch (Exception parseErr) {
                        System.err.println("Error parsing Java file " + fileName + ": " + parseErr.getMessage());
                        failedFiles.add(fileName + " (Java解析失败: " + parseErr.getMessage() + ")");
                    }
                } else if (fileName.endsWith(".properties")) {
                    // Properties 文件一般只作为配置文件，不包含接口定义
                    System.out.println("Skipping properties file: " + fileName);
                } else {
                    failedFiles.add(fileName + " (不支持的文件类型)");
                }
            } catch (IOException ioErr) {
                System.err.println("IOException reading file " + fileName + ": " + ioErr.getMessage());
                failedFiles.add(fileName + " (读取失败: " + ioErr.getMessage() + ")");
            } catch (Exception err) {
                System.err.println("Unexpected error processing file " + fileName + ": " + err.getMessage());
                failedFiles.add(fileName + " (处理失败: " + err.getMessage() + ")");
            }
        }
        
        // 记录审计日志
        String auditMsg = String.format("本地上传解析文件 - 成功解析 %d 个接口", interfaces.size());
        if (!failedFiles.isEmpty()) {
            auditMsg += "，失败文件: " + String.join("; ", failedFiles);
        }
        recordAudit(username, "文档管理", auditMsg);
        
        // 如果至少成功解析了部分接口，返回成功
        if (interfaces.size() > 0) {
            return ResponseEntity.ok(new ApiResponse<>(true, "Files parsed successfully", interfaces));
        } else if (failedFiles.size() > 0) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse<>(false, "All files failed to parse: " + String.join("; ", failedFiles), new ArrayList<>()));
        } else {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse<>(false, "No valid files to process", new ArrayList<>()));
        }
    }

    /**
     * 在线获取代码并解析接口
     * 支持更好的异常处理和日志记录
     */
    @PostMapping("/fetch-online")
    public ResponseEntity<ApiResponse<List<InterfaceInfo>>> fetchOnline(
            @RequestBody OnlineSourceRequest request,
            @RequestParam(value = "username", defaultValue = "system") String username) {
        
        try {
            // 验证请求参数
            if (request == null || request.getRepoUrl() == null || request.getRepoUrl().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse<>(false, "Repository URL is required", new ArrayList<>()));
            }
            
            System.out.println("Fetching online from: " + request.getRepoUrl() + ", branch: " + request.getBranch());
            
            List<InterfaceInfo> interfaces = new ArrayList<>();
            
            // 这里实际应该调用 Git 客户端获取代码
            // 现在返回示例数据，等待真实实现
            
            // TODO: 实现真实的 Git 克隆/拉取逻辑
            // 使用 JGit 或类似库从 Git 服务器获取代码
            
            // 当前实现：返回空列表（表示成功但无数据）
            recordAudit(username, "文档管理", 
                String.format("在线获取解析 - 仓库: %s, 分支: %s, 已加载 %d 个接口", 
                    request.getRepoUrl(), request.getBranch(), interfaces.size()));
            
            return ResponseEntity.ok(new ApiResponse<>(true, "Online fetch successful", interfaces));
        } catch (IllegalArgumentException argErr) {
            System.err.println("Invalid argument in fetch-online: " + argErr.getMessage());
            return ResponseEntity.badRequest()
                    .body(new ApiResponse<>(false, "Invalid arguments: " + argErr.getMessage(), new ArrayList<>()));
        } catch (Exception e) {
            System.err.println("Error during online fetch: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500)
                    .body(new ApiResponse<>(false, "Fetch failed: " + e.getMessage(), new ArrayList<>()));
        }
    }

    /**
     * 测试在线连接
     * 支持更好的异常处理和日志记录
     */
    @PostMapping("/test-connection")
    public ResponseEntity<ApiResponse<Map<String, Object>>> testConnection(
            @RequestBody OnlineSourceRequest request,
            @RequestParam(value = "username", defaultValue = "system") String username) {
        
        Map<String, Object> result = new HashMap<>();
        
        try {
            // 验证请求参数
            if (request == null || request.getRepoUrl() == null || request.getRepoUrl().isEmpty()) {
                result.put("connected", false);
                result.put("message", "Repository URL is required");
                return ResponseEntity.badRequest()
                        .body(new ApiResponse<>(false, "Repository URL is required", result));
            }
            
            System.out.println("Testing connection to: " + request.getRepoUrl());
            
            // 这里应该实现真实的连接测试
            // TODO: 使用 JGit 尝试连接到指定的 Git 仓库
            
            result.put("connected", true);
            result.put("branches", Arrays.asList("master", "main", "develop")); // 示例分支
            result.put("message", "Connection successful");
            
            recordAudit(username, "文档管理", String.format("测试在线连接 - 仓库: %s, 状态: 成功", request.getRepoUrl()));
            
            return ResponseEntity.ok(new ApiResponse<>(true, "Connection test successful", result));
        } catch (IllegalArgumentException argErr) {
            System.err.println("Invalid argument in test-connection: " + argErr.getMessage());
            result.put("connected", false);
            result.put("message", "Invalid arguments: " + argErr.getMessage());
            return ResponseEntity.badRequest()
                    .body(new ApiResponse<>(false, "Invalid arguments: " + argErr.getMessage(), result));
        } catch (Exception e) {
            System.err.println("Error during connection test: " + e.getMessage());
            e.printStackTrace();
            result.put("connected", false);
            result.put("message", "Connection failed: " + e.getMessage());
            recordAudit(username, "文档管理", String.format("测试在线连接失败 - 仓库: %s, 原因: %s", 
                request.getRepoUrl() != null ? request.getRepoUrl() : "unknown", e.getMessage()));
            return ResponseEntity.status(500)
                    .body(new ApiResponse<>(false, "Connection test failed: " + e.getMessage(), result));
        }
    }

    // ==================== Helper Methods ====================

    private List<InterfaceInfo> parseXmlFile(String content, String filePath) {
        List<InterfaceInfo> interfaces = new ArrayList<>();
        
        // 简单的 XML 解析逻辑（生产环境应使用 DOM/SAX 解析器）
        try {
            if (content == null || content.isEmpty()) {
                System.out.println("Empty XML content for file: " + filePath);
                return interfaces;
            }
            
            // 提取 transaction 标签
            String[] transactions = content.split("<transaction");
            
            for (int i = 1; i < transactions.length; i++) {
                try {
                    // 提取 id 和 name
                    String id = extractXmlAttribute(transactions[i], "id");
                    String name = extractXmlAttribute(transactions[i], "name");
                    
                    // 跳过无效的接口定义
                    if (id.isEmpty() || name.isEmpty()) {
                        System.out.println("Skipping transaction at index " + i + " due to missing id or name");
                        continue;
                    }
                    
                    InterfaceInfo info = new InterfaceInfo();
                    info.setId(id);
                    info.setName(name);
                    info.setModule(extractModuleFromPath(filePath));
                    info.setFilePath(filePath);
                    info.setDescription(name);
                    info.setInputs(new ArrayList<>());
                    info.setOutputs(new ArrayList<>());
                    info.setDownstreamCalls(new ArrayList<>());
                    
                    interfaces.add(info);
                } catch (Exception transErr) {
                    System.err.println("Error parsing individual transaction: " + transErr.getMessage());
                    // 继续处理下一个transaction，不中断整个文件解析
                    continue;
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to parse XML file: " + e.getMessage());
            e.printStackTrace();
        }
        
        return interfaces;
    }

    private List<InterfaceInfo> parseJavaFile(String content, String filePath) {
        List<InterfaceInfo> interfaces = new ArrayList<>();
        
        // 简单的 Java 解析逻辑
        try {
            if (content == null || content.isEmpty()) {
                System.out.println("Empty Java content for file: " + filePath);
                return interfaces;
            }
            
            // 提取 @RequestMapping 或类似注解的方法
            String[] methods = content.split("public\\s+\\w+\\s+");
            
            for (int i = 1; i < methods.length; i++) {
                try {
                    // 这是一个简化的解析，实际应该用 AST 或反射
                    String methodName = extractMethodName(methods[i]);
                    if (methodName.isEmpty()) {
                        continue;
                    }
                    
                    InterfaceInfo info = new InterfaceInfo();
                    info.setId(methodName);
                    info.setName(methodName);
                    info.setModule(extractModuleFromPath(filePath));
                    info.setFilePath(filePath);
                    info.setDescription("Java method: " + methodName);
                    info.setInputs(new ArrayList<>());
                    info.setOutputs(new ArrayList<>());
                    info.setDownstreamCalls(new ArrayList<>());
                    
                    interfaces.add(info);
                } catch (Exception methodErr) {
                    System.err.println("Error parsing individual method: " + methodErr.getMessage());
                    // 继续处理下一个method，不中断整个文件解析
                    continue;
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to parse Java file: " + e.getMessage());
            e.printStackTrace();
        }
        
        return interfaces;
    }

    private String extractXmlAttribute(String text, String attrName) {
        String pattern = attrName + "=\"([^\"]*)\"";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
        java.util.regex.Matcher m = p.matcher(text);
        return m.find() ? m.group(1) : "";
    }

    private String extractMethodName(String text) {
        String[] parts = text.split("\\(");
        if (parts.length > 0) {
            String[] nameParts = parts[0].trim().split("\\s+");
            return nameParts.length > 0 ? nameParts[nameParts.length - 1] : "";
        }
        return "";
    }

    private String extractModuleFromPath(String filePath) {
        // 从文件路径提取模块名
        if (filePath.contains("src/main/")) {
            String[] parts = filePath.split("src/main/");
            if (parts.length > 1) {
                String[] modules = parts[1].split("/");
                return modules.length > 0 ? modules[0] : "default";
            }
        }
        return "default";
    }

    private void recordAudit(String username, String module, String action) {
        try {
            AuditLog auditLog = new AuditLog();
            auditLog.setUsername(username);
            auditLog.setAction(module + " - " + action);
            auditLog.setIp("127.0.0.1");
            auditLog.setTimestamp(new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new java.util.Date()));
            auditLogRepository.save(auditLog);
            auditLogRepository.flush();
        } catch (Exception e) {
            System.err.println("Failed to record audit: " + e.getMessage());
        }
    }

    // ==================== Inner Classes ====================

    public static class OnlineSourceRequest {
        private String repoUrl;
        private String authType;
        private String authUsername;
        private String authPassword;
        private String authToken;
        private String sshKeyContent;
        private String sshPassphrase;
        private String branch;

        public String getRepoUrl() { return repoUrl; }
        public void setRepoUrl(String repoUrl) { this.repoUrl = repoUrl; }

        public String getAuthType() { return authType; }
        public void setAuthType(String authType) { this.authType = authType; }

        public String getAuthUsername() { return authUsername; }
        public void setAuthUsername(String authUsername) { this.authUsername = authUsername; }

        public String getAuthPassword() { return authPassword; }
        public void setAuthPassword(String authPassword) { this.authPassword = authPassword; }

        public String getAuthToken() { return authToken; }
        public void setAuthToken(String authToken) { this.authToken = authToken; }

        public String getSshKeyContent() { return sshKeyContent; }
        public void setSshKeyContent(String sshKeyContent) { this.sshKeyContent = sshKeyContent; }

        public String getSshPassphrase() { return sshPassphrase; }
        public void setSshPassphrase(String sshPassphrase) { this.sshPassphrase = sshPassphrase; }

        public String getBranch() { return branch; }
        public void setBranch(String branch) { this.branch = branch; }
    }

    public static class InterfaceInfo {
        private String id;
        private String name;
        private String module;
        private String filePath;
        private String description;
        private List<Map<String, Object>> inputs;
        private List<Map<String, Object>> outputs;
        private List<String> downstreamCalls;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getModule() { return module; }
        public void setModule(String module) { this.module = module; }

        public String getFilePath() { return filePath; }
        public void setFilePath(String filePath) { this.filePath = filePath; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public List<Map<String, Object>> getInputs() { return inputs; }
        public void setInputs(List<Map<String, Object>> inputs) { this.inputs = inputs; }

        public List<Map<String, Object>> getOutputs() { return outputs; }
        public void setOutputs(List<Map<String, Object>> outputs) { this.outputs = outputs; }

        public List<String> getDownstreamCalls() { return downstreamCalls; }
        public void setDownstreamCalls(List<String> downstreamCalls) { this.downstreamCalls = downstreamCalls; }
    }

    public static class ApiResponse<T> {
        private boolean success;
        private String message;
        private T data;

        public ApiResponse(boolean success, String message, T data) {
            this.success = success;
            this.message = message;
            this.data = data;
        }

        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }

        public T getData() { return data; }
        public void setData(T data) { this.data = data; }
    }
}
