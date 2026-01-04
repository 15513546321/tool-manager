package com.toolmanager.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Autowired;
import com.toolmanager.entity.NacosConfig;
import com.toolmanager.repository.NacosConfigRepository;
import com.toolmanager.dto.DetailedDiffResultDTO;
import com.toolmanager.util.NacosDiffTool;
import java.util.*;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Comparator;
import java.util.Optional;

/**
 * Nacos 配置同步控制器
 * 处理 Nacos 配置的连接、验证、同步和差异比较等操作
 * 支持 Nacos 1.4.0 和 2.x 多个版本
 */
@Slf4j
@RestController
@RequestMapping("/api/nacos-sync")
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"}, 
             allowCredentials = "true", maxAge = 3600)
public class NacosSyncController {

    @Autowired
    private NacosConfigRepository nacosConfigRepository;

    /**
     * 测试 Nacos 连接 - 支持多版本(1.4.0, 2.x)
     */
    @PostMapping("/test-connection")
    public ResponseEntity<ApiResponse<Map<String, Object>>> testConnection(@RequestBody NacosConnectionRequest request) {
        try {
            Map<String, Object> result = new HashMap<>();
            
            // 验证基本信息
            if (request.getUrl() == null || request.getUrl().trim().isEmpty()) {
                return ResponseEntity.ok(new ApiResponse<>(false, "URL 不能为空", result));
            }
            
            if (!request.getUrl().startsWith("http://") && !request.getUrl().startsWith("https://")) {
                return ResponseEntity.ok(new ApiResponse<>(false, "URL 必须以 http:// 或 https:// 开头", result));
            }
            
            if (request.getUsername() == null || request.getUsername().trim().isEmpty()) {
                return ResponseEntity.ok(new ApiResponse<>(false, "用户名不能为空", result));
            }
            
            if (request.getPassword() == null || request.getPassword().trim().isEmpty()) {
                return ResponseEntity.ok(new ApiResponse<>(false, "密码不能为空", result));
            }
            
            // 尝试多种版本的健康检查和认证方式
            String baseUrl = request.getUrl().replaceAll("/$", "");
            String nacosVersion = detectNacosVersion(baseUrl);
            
            log.info("Detected Nacos version: : {}", nacosVersion);
            log.info("Testing Nacos connection to: : {}", baseUrl);
            
            // 尝试认证
            boolean authenticated = false;
            String token = null;
            String authError = null;
            
            // 优先尝试 Nacos 2.x 的认证方式
            if (nacosVersion == null || nacosVersion.contains("2.") || nacosVersion.isEmpty()) {
                log.info("{}",  "Attempting Nacos 2.x authentication...");
                Map<String, Object> auth2Result = tryNacos2Authentication(baseUrl, request.getUsername(), request.getPassword());
                if ((boolean) auth2Result.getOrDefault("success", false)) {
                    authenticated = true;
                    token = (String) auth2Result.get("token");
                } else {
                    authError = (String) auth2Result.get("error");
                }
            }
            
            // 如果 2.x 失败，尝试 Nacos 1.4.0 的认证方式
            if (!authenticated) {
                log.info("{}",  "Attempting Nacos 1.4.0 authentication...");
                Map<String, Object> auth1Result = tryNacos1Authentication(baseUrl, request.getUsername(), request.getPassword());
                if ((boolean) auth1Result.getOrDefault("success", false)) {
                    authenticated = true;
                    token = (String) auth1Result.get("token");
                } else {
                    authError = (String) auth1Result.get("error");
                }
            }
            
            if (authenticated) {
                result.put("connected", true);
                result.put("message", "连接成功");
                result.put("token", token);
                result.put("version", nacosVersion != null ? nacosVersion : "unknown");
                return ResponseEntity.ok(new ApiResponse<>(true, "Connection successful", result));
            } else {
                result.put("connected", false);
                result.put("message", "认证失败: " + (authError != null ? authError : "用户名或密码错误"));
                result.put("version", nacosVersion);
                return ResponseEntity.ok(new ApiResponse<>(false, "Authentication failed", result));
            }
            
        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            String message = e.getMessage() != null ? e.getMessage() : "未知错误";
            System.err.println("Connection error: " + e.getClass().getSimpleName() + " - " + message);
            
            // 根据异常类型提供更具体的错误信息
            if (e instanceof java.net.ConnectException) {
                result.put("connected", false);
                result.put("message", "连接被拒绝 - 无法连接到 Nacos 服务器。请检查:\n" +
                    "1. Nacos 服务器是否正在运行\n" +
                    "2. URL 和端口号是否正确（例如：http://127.0.0.1:8848）\n" +
                    "3. 防火墙是否阻止了连接\n" +
                    "错误详情: " + message);
                result.put("errorType", "ConnectException");
            } else if (e instanceof java.net.UnknownHostException) {
                result.put("connected", false);
                result.put("message", "无法解析主机名。请检查:\n" +
                    "1. URL 中的主机名是否正确\n" +
                    "2. DNS 服务器是否可用\n" +
                    "3. 网络连接是否正常\n" +
                    "错误详情: " + message);
                result.put("errorType", "UnknownHostException");
            } else if (e instanceof java.net.SocketTimeoutException) {
                result.put("connected", false);
                result.put("message", "连接超时。Nacos 服务器响应缓慢或网络延迟高。请检查:\n" +
                    "1. Nacos 服务器是否正在正常运行\n" +
                    "2. 网络连接是否稳定\n" +
                    "3. 尝试增加超时时间\n" +
                    "错误详情: " + message);
                result.put("errorType", "SocketTimeoutException");
            } else {
                result.put("connected", false);
                result.put("message", "连接异常: " + e.getClass().getSimpleName() + "\n" + message);
                result.put("errorType", e.getClass().getSimpleName());
                e.printStackTrace();
            }
            
            return ResponseEntity.ok(new ApiResponse<>(false, "Connection error", result));
        }
    }
    
    /**
     * URL 编码辅助方法
     */
    private String urlEncode(String value) {
        try {
            return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return value;
        }
    }

    /**
     * 从 Nacos 查询配置列表
     */
    @PostMapping("/query-configs")
    public ResponseEntity<ApiResponse<List<NacosConfig>>> queryConfigs(@RequestBody NacosConnectionRequest request) {
        try {
            List<NacosConfig> configs = new ArrayList<>();
            
            // 这里应该调用实际的 Nacos API
            // 通常需要：
            // 1. 获取登录 token
            // 2. 使用 token 查询 /nacos/v1/cs/search/config 获取配置列表
            // 3. 对每个配置调用 /nacos/v1/cs/configs 获取内容
            
            // TODO: 实现真实的 Nacos API 调用
            // 下面是示例结构
            String baseUrl = request.getUrl().replaceAll("/$", "");
            String queryUrl = baseUrl + 
                "/nacos/v1/cs/search/config?search=blur&pageNo=1&pageSize=10";
            
            // 需要先进行身份验证，获取 accessToken
            String token = null;
            Map<String, Object> auth2Result = tryNacos2Authentication(baseUrl, request.getUsername(), request.getPassword());
            if ((boolean) auth2Result.getOrDefault("success", false)) {
                token = (String) auth2Result.get("token");
            } else {
                Map<String, Object> auth1Result = tryNacos1Authentication(baseUrl, request.getUsername(), request.getPassword());
                if ((boolean) auth1Result.getOrDefault("success", false)) {
                    token = (String) auth1Result.get("token");
                }
            }
            
            if (token == null || token.isEmpty()) {
                return ResponseEntity.ok(new ApiResponse<>(false, "身份验证失败", new ArrayList<>()));
            }
            
            // 带 token 查询配置
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(new URI(queryUrl + "&accessToken=" + token + "&tenant=" + request.getNamespace()))
                .GET()
                .build();
            
            HttpResponse<String> response = client.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                // 解析 JSON 响应（这里简化处理，实际需要用 JSON 库）
                // 由于没有引入 JSON 库，返回空列表作为示例
                return ResponseEntity.ok(new ApiResponse<>(true, "查询成功", configs));
            } else {
                return ResponseEntity.ok(new ApiResponse<>(false, "查询失败: HTTP " + response.statusCode(), new ArrayList<>()));
            }
        } catch (Exception e) {
            return ResponseEntity.ok(new ApiResponse<>(false, "查询异常: " + e.getMessage(), new ArrayList<>()));
        }
    }

    /**
     * 获取单个配置内容
     */
    @PostMapping("/get-config")
    public ResponseEntity<ApiResponse<String>> getConfig(@RequestBody NacosConfigRequest request) {
        try {
            // TODO: 实现真实的 Nacos API 调用获取单个配置
            String baseUrl = request.getUrl().replaceAll("/$", "");
            String token = null;
            Map<String, Object> auth2Result = tryNacos2Authentication(baseUrl, request.getUsername(), request.getPassword());
            if ((boolean) auth2Result.getOrDefault("success", false)) {
                token = (String) auth2Result.get("token");
            } else {
                Map<String, Object> auth1Result = tryNacos1Authentication(baseUrl, request.getUsername(), request.getPassword());
                if ((boolean) auth1Result.getOrDefault("success", false)) {
                    token = (String) auth1Result.get("token");
                }
            }
            
            if (token == null || token.isEmpty()) {
                return ResponseEntity.ok(new ApiResponse<>(false, "身份验证失败", ""));
            }
            
            String configUrl = request.getUrl().replaceAll("/$", "") + 
                String.format("/nacos/v1/cs/configs?dataId=%s&group=%s&tenant=%s&accessToken=%s",
                    request.getDataId(), request.getGroup(), request.getNamespace(), token);
            
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(new URI(configUrl))
                .GET()
                .build();
            
            HttpResponse<String> response = client.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                return ResponseEntity.ok(new ApiResponse<>(true, "获取成功", response.body()));
            } else {
                return ResponseEntity.ok(new ApiResponse<>(false, "获取失败: HTTP " + response.statusCode(), ""));
            }
        } catch (Exception e) {
            return ResponseEntity.ok(new ApiResponse<>(false, "获取异常: " + e.getMessage(), ""));
        }
    }

    /**
     * 保存 Nacos 配置
     */
    @PostMapping("/configs")
    public ResponseEntity<ApiResponse<Map<String, Object>>> saveConfig(@RequestBody NacosConfigSaveRequest request) {
        try {
            Map<String, Object> result = new HashMap<>();
            
            // 验证基本信息
            if (request.getName() == null || request.getName().trim().isEmpty()) {
                return ResponseEntity.ok(new ApiResponse<>(false, "配置名称不能为空", result));
            }
            
            if (request.getSourceUrl() == null || request.getSourceUrl().trim().isEmpty()) {
                return ResponseEntity.ok(new ApiResponse<>(false, "源环境 URL 不能为空", result));
            }
            
            if (request.getTargetUrl() == null || request.getTargetUrl().trim().isEmpty()) {
                return ResponseEntity.ok(new ApiResponse<>(false, "目标环境 URL 不能为空", result));
            }
            
            // 创建新配置
            NacosConfig config = new NacosConfig();
            config.setName(request.getName());
            config.setSourceUrl(request.getSourceUrl());
            config.setSourceNamespace(request.getSourceNamespace());
            config.setSourceUsername(request.getSourceUsername());
            config.setSourcePassword(request.getSourcePassword());
            config.setSourceRemark(request.getSourceRemark()); // ⭐ 保存源备注
            config.setTargetUrl(request.getTargetUrl());
            config.setTargetNamespace(request.getTargetNamespace());
            config.setTargetUsername(request.getTargetUsername());
            config.setTargetPassword(request.getTargetPassword());
            config.setTargetRemark(request.getTargetRemark()); // ⭐ 保存目标备注
            config.setDescription(request.getDescription());
            // 根据 enabled 字段设置 status（默认为 ACTIVE）
            config.setStatus((request.getEnabled() == null || request.getEnabled()) ? "ACTIVE" : "INACTIVE");
            
            // 保存到数据库
            NacosConfig savedConfig = nacosConfigRepository.save(config);
            // ✅ 立即刷新到数据库，确保数据持久化
            nacosConfigRepository.flush();
            
            result.put("success", true);
            result.put("message", "配置保存成功");
            result.put("id", savedConfig.getId());
            result.put("name", savedConfig.getName());
            
            return ResponseEntity.ok(new ApiResponse<>(true, "保存成功", result));
        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("message", "保存异常: " + e.getMessage());
            System.err.println("保存 Nacos 配置异常: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.ok(new ApiResponse<>(false, "保存异常: " + e.getMessage(), result));
        }
    }

    /**
     * 查询保存的 Nacos 配置列表
     */
    @GetMapping("/configs")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> queryConfigs() {
        try {
            // 查询所有状态的配置（不仅仅是 ACTIVE）
            List<NacosConfig> configs = nacosConfigRepository.findAll();
            List<Map<String, Object>> result = new ArrayList<>();
            
            for (NacosConfig config : configs) {
                Map<String, Object> map = new HashMap<>();
                map.put("id", config.getId());
                map.put("name", config.getName());
                map.put("sourceUrl", config.getSourceUrl());
                map.put("sourceNamespace", config.getSourceNamespace());
                map.put("sourceUsername", config.getSourceUsername());
                map.put("sourcePassword", config.getSourcePassword());
                map.put("sourceRemark", config.getSourceRemark()); // ⭐ 返回源备注
                map.put("targetUrl", config.getTargetUrl());
                map.put("targetNamespace", config.getTargetNamespace());
                map.put("targetUsername", config.getTargetUsername());
                map.put("targetPassword", config.getTargetPassword());
                map.put("targetRemark", config.getTargetRemark()); // ⭐ 返回目标备注
                map.put("description", config.getDescription());
                map.put("status", config.getStatus());
                // 前端期望 enabled 字段，基于 status 进行映射
                map.put("enabled", "ACTIVE".equals(config.getStatus()));
                map.put("createdAt", config.getCreatedAt());
                map.put("updatedAt", config.getUpdatedAt());
                result.add(map);
            }
            
            return ResponseEntity.ok(new ApiResponse<>(true, "查询成功", result));
        } catch (Exception e) {
            return ResponseEntity.ok(new ApiResponse<>(false, "查询异常: " + e.getMessage(), new ArrayList<>()));
        }
    }

    /**
     * 更新 Nacos 配置
     */
    @PutMapping("/configs/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateConfig(
            @PathVariable String id,
            @RequestBody NacosConfigSaveRequest request) {
        try {
            Map<String, Object> result = new HashMap<>();
            
            // 查询配置是否存在
            Long configId = Long.parseLong(id);
            Optional<NacosConfig> existingConfig = nacosConfigRepository.findById(configId);
            
            if (!existingConfig.isPresent()) {
                return ResponseEntity.ok(new ApiResponse<>(false, "配置不存在", result));
            }
            
            // 验证基本信息
            if (request.getName() == null || request.getName().trim().isEmpty()) {
                return ResponseEntity.ok(new ApiResponse<>(false, "配置名称不能为空", result));
            }
            
            if (request.getSourceUrl() == null || request.getSourceUrl().trim().isEmpty()) {
                return ResponseEntity.ok(new ApiResponse<>(false, "源环境 URL 不能为空", result));
            }
            
            if (request.getTargetUrl() == null || request.getTargetUrl().trim().isEmpty()) {
                return ResponseEntity.ok(new ApiResponse<>(false, "目标环境 URL 不能为空", result));
            }
            
            // 更新配置
            NacosConfig config = existingConfig.get();
            config.setName(request.getName());
            config.setSourceUrl(request.getSourceUrl());
            config.setSourceNamespace(request.getSourceNamespace());
            config.setSourceUsername(request.getSourceUsername());
            config.setSourcePassword(request.getSourcePassword());
            config.setSourceRemark(request.getSourceRemark()); // ⭐ 更新源备注
            config.setTargetUrl(request.getTargetUrl());
            config.setTargetNamespace(request.getTargetNamespace());
            config.setTargetUsername(request.getTargetUsername());
            config.setTargetPassword(request.getTargetPassword());
            config.setTargetRemark(request.getTargetRemark()); // ⭐ 更新目标备注
            config.setDescription(request.getDescription());
            // 根据 enabled 字段更新 status
            if (request.getEnabled() != null) {
                config.setStatus(request.getEnabled() ? "ACTIVE" : "INACTIVE");
            }
            
            // 保存到数据库
            NacosConfig updatedConfig = nacosConfigRepository.save(config);
            // ✅ 立即刷新到数据库，确保数据持久化
            nacosConfigRepository.flush();
            
            result.put("success", true);
            result.put("message", "配置更新成功");
            result.put("id", updatedConfig.getId());
            result.put("name", updatedConfig.getName());
            
            return ResponseEntity.ok(new ApiResponse<>(true, "更新成功", result));
        } catch (NumberFormatException e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            return ResponseEntity.ok(new ApiResponse<>(false, "配置 ID 格式无效", result));
        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            System.err.println("更新 Nacos 配置异常: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.ok(new ApiResponse<>(false, "更新异常: " + e.getMessage(), result));
        }
    }

    /**
     * 删除 Nacos 配置
     */
    @DeleteMapping("/configs/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteConfig(
            @PathVariable String id) {
        try {
            Map<String, Object> result = new HashMap<>();
            
            // 查询配置是否存在
            Long configId = Long.parseLong(id);
            Optional<NacosConfig> existingConfig = nacosConfigRepository.findById(configId);
            
            if (!existingConfig.isPresent()) {
                return ResponseEntity.ok(new ApiResponse<>(false, "配置不存在", result));
            }
            
            // 直接从数据库删除配置
            NacosConfig config = existingConfig.get();
            nacosConfigRepository.deleteById(configId);
            
            result.put("success", true);
            result.put("message", "配置已删除");
            
            return ResponseEntity.ok(new ApiResponse<>(true, "删除成功", result));
        } catch (NumberFormatException e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            return ResponseEntity.ok(new ApiResponse<>(false, "配置 ID 格式无效", result));
        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            System.err.println("删除 Nacos 配置异常: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.ok(new ApiResponse<>(false, "删除异常: " + e.getMessage(), result));
        }
    }

    /**
     * 比对源和目标环境的配置
     */
    @PostMapping("/compare-detailed")
    public ResponseEntity<ApiResponse<DetailedDiffResultDTO>> compareDetailed(@RequestBody DetailedCompareRequest request) {
        try {
            String dataId = request.getDataId();
            String group = request.getGroup();
            String sourceContent = request.getSourceContent() != null ? request.getSourceContent() : "";
            String targetContent = request.getTargetContent() != null ? request.getTargetContent() : "";

            // 使用 NacosDiffTool 进行详细对比
            DetailedDiffResultDTO result = NacosDiffTool.compareConfigs(dataId, group, sourceContent, targetContent);

            return ResponseEntity.ok(new ApiResponse<>(true, "对比成功", result));
        } catch (Exception e) {
            System.err.println("详细对比异常: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.ok(new ApiResponse<>(false, "对比异常: " + e.getMessage(), null));
        }
    }

    /**
     * 比对源和目标环境的配置
     */
    @PostMapping("/compare")
    public ResponseEntity<ApiResponse<Map<String, Object>>> compareConfigs(@RequestBody CompareRequest request) {
        try {
            Map<String, Object> result = new HashMap<>();
            
            log.info("{}",  "=== 开始配置比对 ===");
            
            // 获取源环境配置列表
            log.info("{}",  "\n获取源环境配置...");
            List<Map<String, String>> sourceConfigs = fetchNacosConfigs(
                request.getSourceUrl(),
                request.getSourceNamespace(),
                request.getSourceUsername(),
                request.getSourcePassword()
            );
            System.out.println("源环境配置数: " + sourceConfigs.size());
            
            // 获取目标环境配置列表
            log.info("{}",  "\n获取目标环境配置...");
            List<Map<String, String>> targetConfigs = fetchNacosConfigs(
                request.getTargetUrl(),
                request.getTargetNamespace(),
                request.getTargetUsername(),
                request.getTargetPassword()
            );
            System.out.println("目标环境配置数: " + targetConfigs.size());
            
            // 如果两个列表都为空，说明可能是连接问题
            if (sourceConfigs.isEmpty() && targetConfigs.isEmpty()) {
                result.put("namespace", request.getSourceNamespace());
                result.put("totalFiles", 0);
                result.put("sameCount", 0);
                result.put("differentCount", 0);
                result.put("sourceOnlyCount", 0);
                result.put("targetOnlyCount", 0);
                result.put("results", new ArrayList<>());
                result.put("comparisonTime", new Date().toString());
                result.put("warning", "未获取到任何配置，请检查 Nacos 连接和认证信息");
                return ResponseEntity.ok(new ApiResponse<>(true, "比对完成（无配置）", result));
            }
            
            // 进行比对
            List<Map<String, Object>> comparisonResults = new ArrayList<>();
            Set<String> processedKeys = new HashSet<>();
            
            int sameCount = 0, differentCount = 0, sourceOnlyCount = 0, targetOnlyCount = 0;
            
            // 比对源配置中的所有项目
            for (Map<String, String> sourceConfig : sourceConfigs) {
                String dataId = sourceConfig.get("dataId");
                String group = sourceConfig.get("group");
                String key = dataId + "|" + group;
                processedKeys.add(key);
                
                // 查找对应的目标配置 - 支持智能命名空间匹配
                Map<String, String> targetConfig = targetConfigs.stream()
                    .filter(c -> {
                        String targetDataId = c.get("dataId");
                        String targetGroup = c.get("group");
                        // group 必须完全匹配
                        if (!group.equals(targetGroup)) {
                            return false;
                        }
                        // dataId 支持智能命名空间匹配
                        return matchConfigWithNamespace(
                            dataId, 
                            request.getSourceNamespace(),
                            targetDataId,
                            request.getTargetNamespace()
                        );
                    })
                    .findFirst()
                    .orElse(null);
                
                Map<String, Object> comparison = new HashMap<>();
                comparison.put("dataId", dataId);
                comparison.put("group", group);
                comparison.put("sourceFileName", dataId);  // 添加源文件名
                
                if (targetConfig == null) {
                    // 源独有
                    comparison.put("status", "source-only");
                    comparison.put("suggestion", "目标环境缺少此配置，建议将其从源环境同步到目标环境");
                    String sourceContent = sourceConfig.getOrDefault("content", "");
                    comparison.put("sourceContent", sourceContent);
                    comparison.put("targetContent", "");
                    comparison.put("targetFileName", "");  // 目标文件名为空
                    sourceOnlyCount++;
                    log.info("源独有: : {}", dataId + " | " + group);
                } else {
                    String sourceContent = sourceConfig.getOrDefault("content", "");
                    String targetContent = targetConfig.getOrDefault("content", "");
                    String matchedTargetDataId = targetConfig.get("dataId");  // 获取匹配到的目标文件名
                    
                    // 处理 null 值
                    sourceContent = sourceContent == null ? "" : sourceContent;
                    targetContent = targetContent == null ? "" : targetContent;
                    
                    // 添加源文件名和目标文件名
                    comparison.put("sourceFileName", dataId);
                    comparison.put("targetFileName", matchedTargetDataId);
                    
                    // 打印调试信息
                    log.info("\n对比配置: : {}", dataId + " | " + group);
                    System.out.println("  源内容长度: " + sourceContent.length());
                    System.out.println("  目标内容长度: " + targetContent.length());
                    
                    // 比较内容（智能比较，处理换行符和编码差异）
                    boolean contentEqual = compareNacosConfigs(sourceContent, targetContent);
                    
                    if (contentEqual) {
                        // 相同
                        comparison.put("status", "same");
                        comparison.put("suggestion", "两个环境的配置内容相同，无需同步");
                        comparison.put("sourceContent", sourceContent);
                        comparison.put("targetContent", targetContent);
                        sameCount++;
                        log.info("{}",  "  状态: 相同");
                    } else {
                        // 不同
                        comparison.put("status", "different");
                        comparison.put("suggestion", "两个环境的配置内容不同，需要决定使用源环境的配置还是保持目标环境的配置");
                        comparison.put("sourceContent", sourceContent);
                        comparison.put("targetContent", targetContent);
                        differentCount++;
                        log.info("{}",  "  状态: 不同");
                        System.out.println("  源内容预览: " + sourceContent.substring(0, Math.min(100, sourceContent.length())));
                        System.out.println("  目标内容预览: " + targetContent.substring(0, Math.min(100, targetContent.length())));
                    }
                }
                
                comparisonResults.add(comparison);
            }
            
            // 比对目标配置中的独有项目 - 需要考虑智能匹配
            for (Map<String, String> targetConfig : targetConfigs) {
                String targetDataId = targetConfig.get("dataId");
                String targetGroup = targetConfig.get("group");
                
                // 检查是否已经匹配过（通过智能匹配）
                boolean alreadyMatched = false;
                for (Map<String, String> sourceConfig : sourceConfigs) {
                    String sourceDataId = sourceConfig.get("dataId");
                    String sourceGroup = sourceConfig.get("group");
                    
                    if (targetGroup.equals(sourceGroup) && 
                        matchConfigWithNamespace(
                            sourceDataId,
                            request.getSourceNamespace(),
                            targetDataId,
                            request.getTargetNamespace()
                        )) {
                        alreadyMatched = true;
                        break;
                    }
                }
                
                if (!alreadyMatched) {
                    Map<String, Object> comparison = new HashMap<>();
                    comparison.put("dataId", targetDataId);
                    comparison.put("group", targetGroup);
                    comparison.put("status", "target-only");
                    comparison.put("suggestion", "源环境缺少此配置，可以从目标环境中删除或保留");
                    comparison.put("sourceContent", "");
                    String targetContent = targetConfig.getOrDefault("content", "");
                    comparison.put("targetContent", targetContent);
                    comparison.put("sourceFileName", "");  // 源文件名为空
                    comparison.put("targetFileName", targetDataId);  // 添加目标文件名
                    comparisonResults.add(comparison);
                    targetOnlyCount++;
                }
            }
            
            // 构建返回结果
            result.put("namespace", request.getSourceNamespace());
            result.put("totalFiles", comparisonResults.size());
            result.put("sameCount", sameCount);
            result.put("differentCount", differentCount);
            result.put("sourceOnlyCount", sourceOnlyCount);
            result.put("targetOnlyCount", targetOnlyCount);
            result.put("results", comparisonResults);
            result.put("comparisonTime", new Date().toString());
            
            log.info("{}",  "\n=== 比对完成 ===");
            System.out.println("总文件数: " + comparisonResults.size());
            log.info("相同: : {}", sameCount);
            log.info("差异: : {}", differentCount);
            log.info("源独有: : {}", sourceOnlyCount);
            log.info("目标独有: : {}", targetOnlyCount);
            
            return ResponseEntity.ok(new ApiResponse<>(true, "比对成功", result));
        } catch (Exception e) {
            System.err.println("比对异常: " + e.getMessage());
            e.printStackTrace();
            Map<String, Object> result = new HashMap<>();
            result.put("error", e.getMessage());
            return ResponseEntity.ok(new ApiResponse<>(false, "比对失败: " + e.getMessage(), result));
        }
    }

    /**
     * 根据命名空间名称解析为其 ID
     * 首先尝试按名称匹配，如果匹配不到则原样返回（假设是 ID）
     */
    private String resolveNamespaceId(String baseUrl, String namespace, String username, String password) {
        if (namespace == null || namespace.isEmpty() || "public".equals(namespace)) {
            return namespace;
        }
        
        try {
            baseUrl = baseUrl.replaceAll("/$", "");
            log.info("尝试解析命名空间: : {}", namespace);
            
            // 获取认证 token
            String token = "";
            try {
                Map<String, Object> auth2Result = tryNacos2Authentication(baseUrl, username, password);
                if ((boolean) auth2Result.getOrDefault("success", false)) {
                    token = (String) auth2Result.get("token");
                } else {
                    Map<String, Object> auth1Result = tryNacos1Authentication(baseUrl, username, password);
                    if ((boolean) auth1Result.getOrDefault("success", false)) {
                        token = (String) auth1Result.get("token");
                    }
                }
            } catch (Exception e) {
                System.out.println("获取认证 token 失败: " + e.getMessage());
            }
            
            // 调用 Nacos API 获取所有命名空间
            String namespaceUrl = baseUrl + "/nacos/v1/console/namespaces";
            if (token != null && !token.isEmpty()) {
                namespaceUrl += "?accessToken=" + java.net.URLEncoder.encode(token, "UTF-8");
            }
            
            System.out.println("请求命名空间列表 URL: " + namespaceUrl.replaceAll("accessToken=[^&]+", "accessToken=***"));
            
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(new URI(namespaceUrl))
                .GET()
                .timeout(java.time.Duration.ofSeconds(10));
            
            // 添加基本认证头
            if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                String auth = username + ":" + password;
                String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
                requestBuilder.header("Authorization", "Basic " + encodedAuth);
            }
            
            HttpClient client = HttpClient.newHttpClient();
            HttpResponse<String> response = client.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                String body = response.body();
                System.out.println("命名空间列表响应: " + body.substring(0, Math.min(500, body.length())));
                
                // 使用正则表达式解析命名空间列表
                // 寻找 "namespaceShowName":"xxx" 和 "namespace":"yyy" 的模式
                java.util.regex.Pattern namePattern = java.util.regex.Pattern.compile("\"namespaceShowName\"\\s*:\\s*\"([^\"]*)\"");
                java.util.regex.Pattern idPattern = java.util.regex.Pattern.compile("\"namespace\"\\s*:\\s*\"([^\"]*)\"");
                
                java.util.regex.Matcher nameMatcher = namePattern.matcher(body);
                java.util.regex.Matcher idMatcher = idPattern.matcher(body);
                
                // 提取所有的 namespace 名称和 ID
                List<String> names = new ArrayList<>();
                List<String> ids = new ArrayList<>();
                
                while (nameMatcher.find()) {
                    names.add(nameMatcher.group(1));
                }
                
                idMatcher.reset();
                while (idMatcher.find()) {
                    ids.add(idMatcher.group(1));
                }
                
                System.out.println("解析到的命名空间数: " + names.size());
                for (int i = 0; i < Math.min(names.size(), ids.size()); i++) {
                    System.out.println("  - " + names.get(i) + " -> " + ids.get(i));
                }
                
                // 按顺序匹配
                for (int i = 0; i < Math.min(names.size(), ids.size()); i++) {
                    if (namespace.equals(names.get(i))) {
                        System.out.println("✓ 找到匹配的命名空间: " + names.get(i) + " -> " + ids.get(i));
                        return ids.get(i);
                    }
                }
                
                log.info("✗ 在命名空间列表中未找到名称为 ': {}", namespace + "' 的命名空间，将使用原值作为 namespaceId");
            } else {
                System.out.println("获取命名空间列表失败 (HTTP " + response.statusCode() + ")");
            }
        } catch (Exception e) {
            System.out.println("解析命名空间时发生异常: " + e.getMessage());
            e.printStackTrace();
        }
        
        // 如果解析失败，原样返回（假设用户输入的是 namespace ID）
        return namespace;
    }


    private List<Map<String, String>> fetchNacosConfigs(String baseUrl, String namespace, String username, String password) throws Exception {
        // 首先尝试根据命名空间名称获取其 ID
        String finalNamespace = namespace;
        log.info("{}",  "\n========== 开始解析命名空间 ==========");
        log.info("输入的命名空间: : {}", namespace);
        
        if (namespace != null && !namespace.isEmpty() && !"public".equals(namespace)) {
            // 检查是否已经是 UUID 格式，如果不是则尝试解析
            if (!namespace.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")) {
                log.info("{}",  "→ 命名空间不是UUID格式，调用resolveNamespaceId进行转换...");
                String namespaceId = resolveNamespaceId(baseUrl, namespace, username, password);
                log.info("← resolveNamespaceId返回结果: : {}", namespaceId);
                
                if (namespaceId != null && !namespaceId.isEmpty() && !namespaceId.equals(namespace)) {
                    log.info("✓ 命名空间名称 ': {}", namespace + "' 已解析为 ID: " + namespaceId);
                    finalNamespace = namespaceId;
                } else {
                    log.info("✗ 命名空间名称 ': {}", namespace + "' 无法解析为ID（返回值为空或相同），继续使用原值");
                    // 如果解析失败但不是空字符串，说明 namespace 本身可能就是 ID
                    if (namespaceId != null && !namespaceId.isEmpty()) {
                        finalNamespace = namespaceId;
                    }
                }
            } else {
                log.info("{}",  "→ 命名空间已是 UUID 格式，无需解析");
            }
        } else {
            log.info("{}",  "→ 命名空间为public或为空，不需要解析");
        }
        
        log.info("最终使用的命名空间 ID: : {}", finalNamespace);
        log.info("{}",  "========== 命名空间解析完成 ==========\n");
        
        List<Map<String, String>> configs = new ArrayList<>();
        baseUrl = baseUrl.replaceAll("/$", "");
        
        log.info("{}",  "=== 获取 Nacos 配置列表 ===");
        log.info("URL: : {}", baseUrl);
        System.out.println("Namespace: " + (finalNamespace != null && !finalNamespace.isEmpty() ? finalNamespace : "public"));
        log.info("Username: : {}", username);
        
        // 获取认证 token
        String token = null;
        log.info("{}",  "尝试获取认证 token...");
        System.out.println("提供的用户名: [" + (username != null && !username.isEmpty() ? username : "空") + "]");
        System.out.println("提供的密码: [" + (password != null && !password.isEmpty() ? "有" : "空") + "]");
        
        // 如果用户名和密码都为空，尝试无认证方式
        if ((username == null || username.isEmpty()) && (password == null || password.isEmpty())) {
            log.info("{}",  "未提供认证信息，将直接使用无认证方式");
            token = "";
            // 确保这种情况下不会添加任何认证头
            username = null;
            password = null;
        } else {
            // 尝试使用提供的凭证进行认证
            log.info("{}",  "尝试使用提供的凭证进行认证...");
            
            // 首先尝试 2.x 认证
            log.info("{}",  "Step 1: 尝试 Nacos 2.x 认证");
            Map<String, Object> auth2Result = tryNacos2Authentication(baseUrl, username, password);
            if ((boolean) auth2Result.getOrDefault("success", false)) {
                token = (String) auth2Result.get("token");
                log.info("{}",  "✓ Nacos 2.x 认证成功");
            } else {
                System.out.println("✗ Nacos 2.x 认证失败: " + auth2Result.getOrDefault("error", "unknown error"));
                
                // 尝试 1.4.0 认证
                log.info("{}",  "Step 2: 尝试 Nacos 1.4.0 认证");
                Map<String, Object> auth1Result = tryNacos1Authentication(baseUrl, username, password);
                if ((boolean) auth1Result.getOrDefault("success", false)) {
                    token = (String) auth1Result.get("token");
                    log.info("{}",  "✓ Nacos 1.4.0 认证成功");
                } else {
                    System.out.println("✗ Nacos 1.4.0 认证失败: " + auth1Result.getOrDefault("error", "unknown error"));
                    log.info("{}",  "Step 3: 认证完全失败，将改用完全无认证模式");
                    // 认证失败 - 改用完全无认证方式
                    token = "";
                    username = null;  // 清除用户名以避免添加 Basic Auth
                    password = null;  // 清除密码以避免添加 Basic Auth
                }
            }
        }
        
        // 获取配置列表（分页）
        int pageNo = 1;
        int pageSize = 200; // 增加每页数量
        boolean hasMore = true;
        
        try {
            HttpClient client = HttpClient.newHttpClient();
            
            // ========== 新的思路：获取所有命名空间，然后逐个扫描配置 ==========
            // 由于 Nacos API 的复杂性，我们采用新策略：
            // 1. 先获取所有命名空间列表
            // 2. 针对指定的命名空间，尝试扫描其中的所有配置
            // 3. 通过逐个尝试获取配置内容来判断配置是否存在
            
            log.info("{}",  "═══ 新策略：先获取所有命名空间，再逐个扫描配置 ═══");
            
            // 步骤1：获取所有命名空间
            log.info("{}",  "步骤1：获取所有命名空间列表");
            String namespacesUrl = baseUrl + "/nacos/v1/console/namespaces";
            
            HttpRequest.Builder nsBuilder = HttpRequest.newBuilder()
                .uri(new URI(namespacesUrl))
                .GET()
                .timeout(java.time.Duration.ofSeconds(10));
            
            if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                String auth = username + ":" + password;
                String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
                nsBuilder.header("Authorization", "Basic " + encodedAuth);
            }
            
            HttpResponse<String> nsResponse = client.send(nsBuilder.build(), HttpResponse.BodyHandlers.ofString());
            System.out.println("命名空间列表 HTTP 状态码: " + nsResponse.statusCode());
            
            // 解析命名空间（暂时跳过，我们先尝试直接扫描指定命名空间中的配置）
            // 方法1：使用 /nacos/v1/cs/configs 端点 + search=blur 参数（UI使用的接口）
            log.info("{}",  "\n尝试方法1：GET /nacos/v1/cs/configs?search=blur（UI使用的标准接口）");
            
            while (hasMore) {
                // 构建 URL 参数
                StringBuilder queryParams = new StringBuilder();
                queryParams.append("pageNo=").append(pageNo);
                queryParams.append("&pageSize=").append(pageSize);
                queryParams.append("&search=blur"); // 关键参数：模糊搜索模式，告诉服务端这是列表查询
                queryParams.append("&dataId=");     // 留空代表所有
                queryParams.append("&group=");      // 留空代表所有
                
                // 使用 tenant 参数（这是 /nacos/v1/cs/configs 接口的参数名）
                if (finalNamespace != null && !finalNamespace.isEmpty()) {
                    queryParams.append("&tenant=").append(java.net.URLEncoder.encode(finalNamespace, "UTF-8"));
                    log.info("命名空间 (tenant): : {}", finalNamespace);
                } else {
                    log.info("使用默认命名空间(public)");
                }
                
                if (token != null && !token.isEmpty()) {
                    queryParams.append("&accessToken=").append(java.net.URLEncoder.encode(token, "UTF-8"));
                }
                
                String queryUrl = baseUrl + "/nacos/v1/cs/configs?" + queryParams.toString();
                System.out.println("请求 URL (Page " + pageNo + "): " + queryUrl.replaceAll("accessToken=[^&]+", "accessToken=***"));
                
                HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(new URI(queryUrl))
                    .GET()
                    .timeout(java.time.Duration.ofSeconds(10));
                
                if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                    String auth = username + ":" + password;
                    String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
                    requestBuilder.header("Authorization", "Basic " + encodedAuth);
                }
                
                HttpResponse<String> response = client.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
                System.out.println("HTTP 状态码: " + response.statusCode());
                
                if (response.statusCode() == 200) {
                    String body = response.body();
                    System.out.println("响应体长度: " + body.length() + " 字符");
                    // System.out.println("响应预览: " + body.substring(0, Math.min(500, body.length())));
                    
                    List<Map<String, String>> pageConfigs = parseNacosConfigResponse(body);
                    System.out.println("✓ Page " + pageNo + " 解析到 " + pageConfigs.size() + " 个配置");
                    
                    if (pageConfigs.isEmpty()) {
                        hasMore = false;
                        break;
                    }

                    for (Map<String, String> config : pageConfigs) {
                        String content = fetchNacosConfigContent(
                            baseUrl, 
                            config.get("dataId"), 
                            config.get("group"), 
                            finalNamespace,
                            username, 
                            password, 
                            token
                        );
                        // 即使内容为空，也要添加配置（可能是真的空配置）
                        config.put("content", content != null ? content : "");
                        configs.add(config);
                        System.out.println("  ✓ " + config.get("dataId") + " | " + config.get("group") + " (长度: " + (content != null ? content.length() : 0) + ")");
                    }
                    
                    // 检查是否还有更多页
                    if (pageConfigs.size() < pageSize) {
                        hasMore = false;
                    } else {
                        pageNo++;
                    }
                } else {
                    String errorBody = response.body();
                    System.out.println("✗ 失败 (HTTP " + response.statusCode() + "): " + 
                                     errorBody.substring(0, Math.min(300, errorBody.length())));
                    hasMore = false;
                }
            }
            
        } catch (Exception e) {
            System.err.println("获取配置列表异常: " + e.getMessage());
            e.printStackTrace();
        }
        
        System.out.println("总共获取到 " + configs.size() + " 个配置");
        
        // 输出所有获取到的配置
        for (Map<String, String> config : configs) {
            String contentPreview = config.getOrDefault("content", "");
            if (contentPreview.length() > 50) {
                contentPreview = contentPreview.substring(0, 50) + "...";
            }
            System.out.println("  - " + config.get("dataId") + " | " + config.get("group") + " (" + contentPreview + ")");
        }
        
        return configs;
    }

    /**
     * 从 Nacos 获取单个配置的实际内容
     */
    private String fetchNacosConfigContent(String baseUrl, String dataId, String group, String namespace, 
                                          String username, String password, String token) {
        try {
            HttpClient client = HttpClient.newHttpClient();
            
            // 确保 namespace 已经是 ID 而不是名称
            String finalNamespace = namespace;
            if (namespace != null && !namespace.isEmpty() && !"public".equals(namespace)) {
                // 检查是否需要解析（如果不是 UUID 格式）
                if (!namespace.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")) {
                    String resolvedId = resolveNamespaceId(baseUrl, namespace, username, password);
                    if (resolvedId != null && !resolvedId.isEmpty() && !resolvedId.equals(namespace)) {
                        log.info("在获取配置内容时，命名空间 ': {}", namespace + "' 已解析为 ID: " + resolvedId);
                        finalNamespace = resolvedId;
                    }
                }
            }
            
            // 构建获取配置内容的 URL
            // 关键：使用 /nacos/v1/cs/configs 端点和 tenant 参数
            String contentUrl = baseUrl + "/nacos/v1/cs/configs?dataId=" + java.net.URLEncoder.encode(dataId, "UTF-8") 
                + "&group=" + java.net.URLEncoder.encode(group, "UTF-8");
            
            if (finalNamespace != null && !finalNamespace.isEmpty() && !"public".equals(finalNamespace)) {
                contentUrl += "&tenant=" + java.net.URLEncoder.encode(finalNamespace, "UTF-8");
            }
            
            if (token != null && !token.isEmpty()) {
                contentUrl += "&accessToken=" + java.net.URLEncoder.encode(token, "UTF-8");
            }
            
            System.out.println("获取配置内容: " + dataId + " | " + group + " | ns: " + (finalNamespace != null && !finalNamespace.isEmpty() ? finalNamespace : "public") + " URL: " + contentUrl.replaceAll("accessToken=[^&]+", "accessToken=***"));
            
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(new URI(contentUrl))
                .GET()
                .timeout(java.time.Duration.ofSeconds(10));
            
            // 添加基本认证
            if (username != null && !username.isEmpty()) {
                String auth = username + ":" + password;
                String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
                requestBuilder.header("Authorization", "Basic " + encodedAuth);
            }
            
            HttpResponse<String> response = client.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
            
            System.out.println("  → HTTP状态码: " + response.statusCode() + " | 内容长度: " + response.body().length());
            
            if (response.statusCode() == 200) {
                String content = response.body();
                // 检查是否真的获取到了内容（而不是error页面）
                if (content != null && !content.isEmpty() && !content.contains("\"error\"")) {
                    System.out.println("  ✓ 成功获取配置内容，长度: " + content.length() + " 字符");
                    // 不要截断内容，保留完整的配置内容
                    return content;
                } else {
                    log.info("{}",  "  ✗ 获取到空内容或错误响应");
                    return "";
                }
            } else if (response.statusCode() == 404) {
                log.info("  ✗ 配置不存在 (404)，该配置可能不在指定的命名空间 [: {}", finalNamespace + "] 中");
                return "";
            } else {
                // 检查是否真的获取到了内容（而不是error页面）
                String content = response.body();
                if (content != null && !content.isEmpty() && !content.contains("\"error\"")) {
                    log.info("{}",  "  ✓ 通过非200状态码也获取到了内容");
                    return content;
                } else {
                    System.out.println("  ✗ 获取失败，错误响应: " + response.body().substring(0, Math.min(100, response.body().length())));
                }
            }
        } catch (Exception e) {
            System.err.println("获取配置内容异常 (" + dataId + " | " + group + "): " + e.getMessage());
            e.printStackTrace();
        }
        
        return "";
    }

    /**
     * 解析 Nacos 配置响应 (改进版本 - 处理 Nacos API 返回的 JSON)
     */
    private List<Map<String, String>> parseNacosConfigResponse(String jsonResponse) {
        List<Map<String, String>> configs = new ArrayList<>();
        try {
            // 打印响应体的前500个字符用于调试
            String preview = jsonResponse.substring(0, Math.min(500, jsonResponse.length()));
            log.info("响应体预览: : {}", preview);
            
            // Nacos API 返回格式:
            // {
            //   "pageNumber": 1,
            //   "pageItems": [ ... ],
            //   ...
            // }
            
            // 改进：不使用正则表达式匹配整个数组（因为内容中可能包含特殊字符导致正则失效）
            // 而是直接查找 "pageItems": [ 的位置，然后提取数组内容
            
            String searchKey = "\"pageItems\"";
            int keyIndex = jsonResponse.indexOf(searchKey);
            
            if (keyIndex != -1) {
                // 找到 [ 的位置
                int arrayStart = jsonResponse.indexOf("[", keyIndex);
                if (arrayStart != -1) {
                    // 提取数组内容（处理嵌套括号）
                    int braceCount = 0;
                    int arrayEnd = -1;
                    boolean inString = false;
                    boolean escapeNext = false;
                    
                    for (int i = arrayStart; i < jsonResponse.length(); i++) {
                        char c = jsonResponse.charAt(i);
                        
                        if (escapeNext) {
                            escapeNext = false;
                            continue;
                        }
                        if (c == '\\') {
                            escapeNext = true;
                            continue;
                        }
                        if (c == '"') {
                            inString = !inString;
                            continue;
                        }
                        if (inString) continue;
                        
                        if (c == '[') {
                            braceCount++;
                        } else if (c == ']') {
                            braceCount--;
                            if (braceCount == 0) {
                                arrayEnd = i;
                                break;
                            }
                        }
                    }
                    
                    if (arrayEnd != -1) {
                        String pageItemsStr = jsonResponse.substring(arrayStart + 1, arrayEnd);
                        System.out.println("找到 pageItems 数据，长度: " + pageItemsStr.length());
                        
                        if (!pageItemsStr.trim().isEmpty()) {
                            // 使用 extractJsonObjects 解析数组中的对象
                            java.util.List<String> jsonObjects = extractJsonObjects(pageItemsStr);
                            System.out.println("提取到 " + jsonObjects.size() + " 个 JSON 对象");
                            
                            for (String item : jsonObjects) {
                                String dataId = extractValue(item, "dataId");
                                String group = extractValue(item, "group");
                                
                                if (!dataId.isEmpty()) {
                                    Map<String, String> config = new HashMap<>();
                                    config.put("dataId", dataId);
                                    config.put("group", group.isEmpty() ? "DEFAULT_GROUP" : group);
                                    config.put("content", "");
                                    configs.add(config);
                                    System.out.println("解析配置: " + dataId + " | " + config.get("group"));
                                }
                            }
                            return configs; // 成功解析，直接返回
                        }
                    }
                }
            }
            
            log.info("{}",  "未找到 pageItems 数据或解析失败，尝试备用解析方法");
                
            // 备用方法：直接查找所有 dataId 和 group
            // 注意：这种方法在内容中包含 "dataId": "..." 字符串时可能会误判，但在 JSON 解析失败时作为最后手段
            java.util.regex.Pattern dataIdPattern = java.util.regex.Pattern.compile("\"dataId\"\\s*:\\s*\"([^\"]+)\"");
            java.util.regex.Pattern groupPattern = java.util.regex.Pattern.compile("\"group\"\\s*:\\s*\"([^\"]+)\"");
            
            java.util.regex.Matcher dataIdMatcher = dataIdPattern.matcher(jsonResponse);
            
            // 找到所有的 dataId
            int lastIndex = 0;
            while (dataIdMatcher.find(lastIndex)) {
                String dataId = dataIdMatcher.group(1);
                
                // 在当前位置之后查找对应的 group
                String group = "DEFAULT_GROUP";
                int endPos = Math.min(dataIdMatcher.end() + 200, jsonResponse.length());
                java.util.regex.Matcher gm = groupPattern.matcher(jsonResponse.substring(lastIndex, endPos));
                if (gm.find()) {
                    group = gm.group(1);
                }
                
                Map<String, String> config = new HashMap<>();
                config.put("dataId", dataId);
                config.put("group", group);
                config.put("content", "");
                
                // 检查是否已经添加过（避免重复）
                final String finalDataId = dataId;
                final String finalGroup = group;
                boolean isDuplicate = configs.stream()
                    .anyMatch(c -> finalDataId.equals(c.get("dataId")) && finalGroup.equals(c.get("group")));
                
                if (!isDuplicate) {
                    configs.add(config);
                    log.info("备用解析: : {}", dataId + " | " + group);
                }
                
                lastIndex = dataIdMatcher.end();
            }
        } catch (Exception e) {
            System.err.println("解析 Nacos 响应异常: " + e.getMessage());
            e.printStackTrace();
        }
        
        System.out.println("共解析到 " + configs.size() + " 个配置");
        return configs;
    }

    /**
     * 从字符串中提取键值对（支持多种格式）
     */
    private String extractValue(String text, String key) {
        try {
            // 模式1: "key":"value"
            String pattern1 = "\"" + key + "\"\\s*:\\s*\"([^\"]+)\"";
            java.util.regex.Pattern p1 = java.util.regex.Pattern.compile(pattern1);
            java.util.regex.Matcher m1 = p1.matcher(text);
            if (m1.find()) {
                return m1.group(1);
            }
            
            // 模式2: "key":"value" 跨越多行
            String pattern2 = "\"" + key + "\"\\s*:\\s*\"([^\"\\n]+)\"";
            java.util.regex.Pattern p2 = java.util.regex.Pattern.compile(pattern2, java.util.regex.Pattern.DOTALL);
            java.util.regex.Matcher m2 = p2.matcher(text);
            if (m2.find()) {
                return m2.group(1);
            }
        } catch (Exception e) {
            System.err.println("提取值异常 (" + key + "): " + e.getMessage());
        }
        return "";
    }

    /**
     * 从 JSON 数组字符串中提取单个 JSON 对象
     * 这个方法能够正确处理嵌套的 JSON 结构
     */
    private java.util.List<String> extractJsonObjects(String jsonArrayContent) {
        java.util.List<String> objects = new ArrayList<>();
        int braceCount = 0;
        int start = -1;
        boolean inString = false;
        boolean escapeNext = false;
        
        for (int i = 0; i < jsonArrayContent.length(); i++) {
            char c = jsonArrayContent.charAt(i);
            
            // 处理转义字符
            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            
            if (c == '\\') {
                escapeNext = true;
                continue;
            }
            
            // 处理字符串边界
            if (c == '"') {
                inString = !inString;
                continue;
            }
            
            if (inString) {
                continue;
            }
            
            // 处理 JSON 对象边界
            if (c == '{') {
                if (braceCount == 0) {
                    start = i;
                }
                braceCount++;
            } else if (c == '}') {
                braceCount--;
                if (braceCount == 0 && start != -1) {
                    String obj = jsonArrayContent.substring(start, i + 1);
                    objects.add(obj);
                    start = -1;
                }
            }
        }
        
        return objects;
    }

    // ==================== Helper Methods ====================

    /**
     * 检测 Nacos 版本
     */
    private String detectNacosVersion(String baseUrl) {
        try {
            HttpClient client = HttpClient.newHttpClient();
            
            // 尝试 Nacos 2.x 的健康检查端点
            try {
                HttpRequest request = HttpRequest.newBuilder()
                    .uri(new URI(baseUrl + "/nacos/v1/core/cluster/server"))
                    .GET()
                    .timeout(java.time.Duration.ofSeconds(5))
                    .build();
                HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200) {
                    log.info("{}",  "Detected Nacos 2.x or above");
                    return "2.x";
                }
            } catch (java.net.ConnectException e) {
                log.info("Nacos 2.x endpoint not found (connection refused)");
            } catch (java.net.UnknownHostException e) {
                log.info("Nacos 2.x endpoint not found (unknown host)");
            } catch (Exception e) {
                System.out.println("Nacos 2.x endpoint not found: " + e.getMessage());
            }
            
            // 尝试 Nacos 1.4.0 的健康检查端点
            try {
                HttpRequest request = HttpRequest.newBuilder()
                    .uri(new URI(baseUrl + "/nacos/v1/console/health"))
                    .GET()
                    .timeout(java.time.Duration.ofSeconds(5))
                    .build();
                HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200) {
                    log.info("{}",  "Detected Nacos 1.4.0");
                    return "1.4.0";
                }
            } catch (java.net.ConnectException e) {
                log.info("Nacos 1.4.0 endpoint not found (connection refused)");
            } catch (java.net.UnknownHostException e) {
                log.info("Nacos 1.4.0 endpoint not found (unknown host)");
            } catch (Exception e) {
                System.out.println("Nacos 1.4.0 endpoint not found: " + e.getMessage());
            }
            
            return null;
        } catch (Exception e) {
            System.err.println("Error detecting Nacos version: " + e.getMessage());
            return null;
        }
    }

    /**
     * Nacos 2.x 认证方式
     */
    private Map<String, Object> tryNacos2Authentication(String baseUrl, String username, String password) {
        Map<String, Object> result = new HashMap<>();
        try {
            // Nacos 2.3.2 认证端点
            String loginUrl = baseUrl + "/nacos/v1/auth/login";
            String requestBody = String.format("username=%s&password=%s", 
                urlEncode(username), urlEncode(password));
            
            log.info("尝试 Nacos 2.x 认证: : {}", loginUrl);
            
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(new URI(loginUrl))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .timeout(java.time.Duration.ofSeconds(10))
                .build();
            
            HttpResponse<String> response = client.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            
            System.out.println("Nacos 2.x auth response status: " + response.statusCode());
            String responseBody = response.body();
            System.out.println("Nacos 2.x auth response body: " + responseBody.substring(0, Math.min(200, responseBody.length())));
            
            if (response.statusCode() == 200) {
                String token = extractToken(responseBody, "accessToken");
                if (token != null && !token.isEmpty()) {
                    result.put("success", true);
                    result.put("token", token);
                    log.info("{}",  "✓ Nacos 2.x 认证成功");
                    return result;
                }
            }
            
            result.put("success", false);
            result.put("error", "Nacos 2.x 认证失败 (HTTP " + response.statusCode() + ")");
            return result;
        } catch (java.net.ConnectException e) {
            System.err.println("Nacos 2.x connection refused: " + e.getMessage());
            result.put("success", false);
            result.put("error", "连接被拒绝 - 无法连接到 Nacos 服务器，请检查 URL 和端口是否正确");
            return result;
        } catch (java.net.UnknownHostException e) {
            System.err.println("Nacos 2.x hostname resolution failed: " + e.getMessage());
            result.put("success", false);
            result.put("error", "无法解析主机名 - 请检查 Nacos URL 是否正确");
            return result;
        } catch (java.net.SocketTimeoutException e) {
            System.err.println("Nacos 2.x connection timeout: " + e.getMessage());
            result.put("success", false);
            result.put("error", "连接超时 - Nacos 服务器响应缓慢，请检查网络连接");
            return result;
        } catch (Exception e) {
            System.err.println("Nacos 2.x authentication error: " + e.getMessage());
            e.printStackTrace();
            result.put("success", false);
            result.put("error", "认证异常: " + e.getClass().getSimpleName() + " - " + e.getMessage());
            return result;
        }
    }

    /**
     * Nacos 1.4.0 认证方式
     */
    private Map<String, Object> tryNacos1Authentication(String baseUrl, String username, String password) {
        Map<String, Object> result = new HashMap<>();
        try {
            String loginUrl = baseUrl + "/nacos/v1/auth/login";
            String requestBody = String.format("username=%s&password=%s", 
                urlEncode(username), urlEncode(password));
            
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(new URI(loginUrl))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .timeout(java.time.Duration.ofSeconds(10))
                .build();
            
            HttpResponse<String> response = client.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            
            System.out.println("Nacos 1.4.0 auth response status: " + response.statusCode());
            System.out.println("Nacos 1.4.0 auth response body: " + response.body());
            
            if (response.statusCode() == 200) {
                String token = extractToken(response.body(), "accessToken");
                if (token != null && !token.isEmpty()) {
                    result.put("success", true);
                    result.put("token", token);
                    return result;
                }
            }
            
            result.put("success", false);
            result.put("error", "Nacos 1.4.0 认证失败 (HTTP " + response.statusCode() + ")");
            return result;
        } catch (java.net.ConnectException e) {
            System.err.println("Nacos 1.4.0 connection refused: " + e.getMessage());
            result.put("success", false);
            result.put("error", "连接被拒绝 - 无法连接到 Nacos 服务器，请检查 URL 和端口是否正确");
            return result;
        } catch (java.net.UnknownHostException e) {
            System.err.println("Nacos 1.4.0 hostname resolution failed: " + e.getMessage());
            result.put("success", false);
            result.put("error", "无法解析主机名 - 请检查 Nacos URL 是否正确");
            return result;
        } catch (java.net.SocketTimeoutException e) {
            System.err.println("Nacos 1.4.0 connection timeout: " + e.getMessage());
            result.put("success", false);
            result.put("error", "连接超时 - Nacos 服务器响应缓慢，请检查网络连接");
            return result;
        } catch (Exception e) {
            System.err.println("Nacos 1.4.0 authentication error: " + e.getMessage());
            e.printStackTrace();
            result.put("success", false);
            result.put("error", "认证异常: " + e.getClass().getSimpleName() + " - " + e.getMessage());
            return result;
        }
    }

    /**
     * 从 JSON 响应中提取 token
     */
    private String extractToken(String jsonResponse, String tokenField) {
        try {
            if (jsonResponse == null || jsonResponse.isEmpty()) {
                return null;
            }
            
            // 简单的字符串提取（生产环境应使用 JSON 库）
            String searchKey = "\"" + tokenField + "\":\"";
            int startIndex = jsonResponse.indexOf(searchKey);
            if (startIndex != -1) {
                startIndex += searchKey.length();
                int endIndex = jsonResponse.indexOf("\"", startIndex);
                if (endIndex != -1) {
                    return jsonResponse.substring(startIndex, endIndex);
                }
            }
            
            // 尝试另一种格式（无引号）
            searchKey = "\"" + tokenField + "\":";
            startIndex = jsonResponse.indexOf(searchKey);
            if (startIndex != -1) {
                startIndex += searchKey.length();
                StringBuilder token = new StringBuilder();
                for (int i = startIndex; i < jsonResponse.length(); i++) {
                    char c = jsonResponse.charAt(i);
                    if (c == '"' || c == ',' || c == '}' || Character.isWhitespace(c)) {
                        if (token.length() > 0) break;
                    } else if (Character.isLetterOrDigit(c) || c == '-' || c == '_' || c == '.') {
                        token.append(c);
                    }
                }
                return token.toString();
            }
            
            return null;
        } catch (Exception e) {
            System.err.println("Error extracting token: " + e.getMessage());
            return null;
        }
    }

    /**
     * 测试 Git 仓库连接并获取分支列表
     */
    @PostMapping("/test-git-connection")
    public ResponseEntity<ApiResponse<Map<String, Object>>> testGitConnection(@RequestBody GitConnectionRequest request) {
        try {
            Map<String, Object> result = new HashMap<>();
            
            if (request.getRepoUrl() == null || request.getRepoUrl().trim().isEmpty()) {
                return ResponseEntity.ok(new ApiResponse<>(false, "仓库URL不能为空", result));
            }
            
            if (!request.getRepoUrl().startsWith("http://") && !request.getRepoUrl().startsWith("https://")) {
                return ResponseEntity.ok(new ApiResponse<>(false, "URL必须以 http:// 或 https:// 开头", result));
            }
            
            System.out.println("Testing Git connection to: " + request.getRepoUrl());
            
            // 测试连接（调用 git ls-remote）
            List<String> branches = new ArrayList<>();
            try {
                // 构建 git ls-remote 命令
                ProcessBuilder pb = new ProcessBuilder("git", "ls-remote", "--heads", request.getRepoUrl());
                pb.redirectErrorStream(true);
                
                Process process = pb.start();
                java.util.Scanner scanner = new java.util.Scanner(process.getInputStream()).useDelimiter("\\A");
                String output = scanner.hasNext() ? scanner.next() : "";
                
                int exitCode = process.waitFor();
                
                if (exitCode == 0) {
                    // 解析分支列表
                    String[] lines = output.split("\\n");
                    for (String line : lines) {
                        if (line.contains("refs/heads/")) {
                            String branch = line.substring(line.indexOf("refs/heads/") + 11).trim();
                            if (!branch.isEmpty()) {
                                branches.add(branch);
                            }
                        }
                    }
                    
                    // 如果没有获取到分支，使用默认分支
                    if (branches.isEmpty()) {
                        branches.addAll(Arrays.asList("master", "main", "develop"));
                    }
                    
                    result.put("connected", true);
                    result.put("branches", branches);
                    result.put("message", "连接成功，已获取分支列表");
                    System.out.println("Git connection successful, branches: " + branches.size());
                    return ResponseEntity.ok(new ApiResponse<>(true, "Connection successful", result));
                } else {
                    result.put("connected", false);
                    result.put("message", "仓库不存在或无权限访问");
                    result.put("branches", Arrays.asList("master", "main", "develop"));
                    log.error("Git command failed with exit code: : {}", exitCode);
                    return ResponseEntity.ok(new ApiResponse<>(false, "Connection failed", result));
                }
            } catch (Exception e) {
                // 如果 git 命令不可用，返回默认分支
                result.put("connected", true);
                result.put("branches", Arrays.asList("master", "main", "develop"));
                result.put("message", "使用默认分支列表（Git命令不可用）");
                System.out.println("Git command unavailable, using default branches: " + e.getMessage());
                return ResponseEntity.ok(new ApiResponse<>(true, "Connection OK (defaults used)", result));
            }
        } catch (Exception e) {
            Map<String, Object> result = new HashMap<>();
            result.put("connected", false);
            result.put("message", "测试连接异常: " + e.getMessage());
            result.put("branches", Arrays.asList("master", "main", "develop"));
            System.err.println("Git connection error: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.ok(new ApiResponse<>(false, "Connection error", result));
        }
    }

    /**
     * 清理 Git 缓存目录
     */
    @PostMapping("/clear-git-cache")
    public ResponseEntity<ApiResponse<String>> clearGitCache() {
        try {
            String codeDir = System.getProperty("user.dir") + java.io.File.separator + "code";
            java.io.File dir = new java.io.File(codeDir);
            if (dir.exists()) {
                deleteDirectory(dir);
                log.info("Git cache directory cleared: {}", codeDir);
                return ResponseEntity.ok(new ApiResponse<>(true, "缓存清理成功", "Code directory deleted"));
            }
            return ResponseEntity.ok(new ApiResponse<>(true, "缓存为空，无需清理", "No code directory found"));
        } catch (Exception e) {
            log.error("Failed to clear git cache: {}", e.getMessage());
            return ResponseEntity.ok(new ApiResponse<>(false, "清理失败: " + e.getMessage(), null));
        }
    }

    /**
     * 从 Git 仓库获取并解析项目文件
     * 使用持久化目录 'code' 存储代码，支持增量更新
     */
    @PostMapping("/fetch-git-repository")
    public ResponseEntity<ApiResponse<List<Map<String, String>>>> fetchGitRepository(@RequestBody GitFetchRequest request) {
        try {
            List<Map<String, String>> files = new ArrayList<>();
            
            if (request.getRepoUrl() == null || request.getRepoUrl().trim().isEmpty()) {
                return ResponseEntity.ok(new ApiResponse<>(false, "仓库URL不能为空", files));
            }
            
            String branch = request.getBranch() != null ? request.getBranch() : "master";
            String repoUrl = request.getRepoUrl();
            
            log.info("Fetching from {} branch: {}", repoUrl, branch);
            
            // 提取仓库名作为子目录名
            String repoName = repoUrl.substring(repoUrl.lastIndexOf("/") + 1);
            if (repoName.endsWith(".git")) {
                repoName = repoName.substring(0, repoName.length() - 4);
            }
            // 简单的名称净化，防止路径遍历
            repoName = repoName.replaceAll("[^a-zA-Z0-9._-]", "_");
            
            // 确定 code 目录路径
            String codeDirPath = System.getProperty("user.dir") + java.io.File.separator + "code";
            String repoPath = codeDirPath + java.io.File.separator + repoName;
            java.io.File repoDir = new java.io.File(repoPath);
            
            log.info("Target repository path: {}", repoPath);
            
            try {
                boolean shouldFetch = !request.isSkipGitFetch();
                boolean dirExists = repoDir.exists();
                boolean isGitRepo = dirExists && new java.io.File(repoDir, ".git").exists();
                
                if (dirExists) {
                    if (isGitRepo) {
                        if (shouldFetch) {
                            // 仓库已存在且是Git仓库，执行更新
                            log.info("Repository exists, updating...");
                            try {
                                // 1. Fetch all
                                runGitCommand(repoDir, "git", "fetch", "--all");
                                // 2. Reset hard to match remote branch (safest for read-only view)
                                runGitCommand(repoDir, "git", "reset", "--hard", "origin/" + branch);
                                // 3. Checkout branch
                                runGitCommand(repoDir, "git", "checkout", branch);
                                // 4. Pull latest
                                runGitCommand(repoDir, "git", "pull", "origin", branch);
                                log.info("Repository updated successfully");
                            } catch (Exception e) {
                                // 降级策略：如果更新失败，记录错误但继续解析现有代码
                                log.error("Git update failed, proceeding with existing code: {}", e.getMessage());
                            }
                        } else {
                            log.info("Repository exists, skipping git fetch (using cached code)...");
                        }
                    } else {
                        // 目录存在但不是Git仓库
                        log.warn("Directory exists at {} but is not a git repository. Skipping git operations and using existing files.", repoPath);
                        // 不执行删除，保留用户可能手动上传的文件
                    }
                } else {
                    // 仓库不存在，执行 Clone
                    log.info("Repository does not exist, cloning...");
                    
                    // 确保父目录存在
                    new java.io.File(codeDirPath).mkdirs();
                    
                    // Clone 仓库 - 添加 --recursive 以支持子模块
                    log.info("Executing git clone for: {} (branch: {})", repoUrl, branch);
                    ProcessBuilder clonePb = new ProcessBuilder("git", "clone", "--recursive", "-b", branch, repoUrl, repoPath);
                    clonePb.redirectErrorStream(true);
                    
                    Process cloneProcess = clonePb.start();
                    
                    // 读取输出以防止缓冲区满
                    java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(cloneProcess.getInputStream()));
                    String line;
                    while ((line = reader.readLine()) != null) {
                        log.debug("git clone output: {}", line);
                    }
                    
                    int cloneExitCode = cloneProcess.waitFor();
                    
                    if (cloneExitCode != 0) {
                        log.error("Git clone failed with exit code: {}", cloneExitCode);
                        // 如果克隆失败，但目录可能被创建了（空的或部分的），我们仍然尝试扫描吗？
                        // 通常克隆失败意味着没有代码，但为了保险起见，如果目录存在，我们还是尝试扫描一下
                        if (!new java.io.File(repoPath).exists()) {
                             return ResponseEntity.ok(new ApiResponse<>(false, "仓库克隆失败 (Exit Code: " + cloneExitCode + ")", files));
                        }
                    }
                }
                
                // 扫描项目文件（XML, Java, Properties）
                // 使用 Files.walkFileTree 替代 Files.walk 以获得更好的控制和容错性，确保逐个文件读取
                java.nio.file.Path tempPath = java.nio.file.Paths.get(repoPath);
                List<java.nio.file.Path> filePaths = new ArrayList<>();
                final int[] totalScanned = {0};
                
                log.info("Starting deep scan of directory: {}", repoPath);
                
                // 开启 FOLLOW_LINKS 以支持软链接
                java.util.Set<java.nio.file.FileVisitOption> options = java.util.EnumSet.of(java.nio.file.FileVisitOption.FOLLOW_LINKS);
                
                java.nio.file.Files.walkFileTree(tempPath, options, Integer.MAX_VALUE, new java.nio.file.SimpleFileVisitor<java.nio.file.Path>() {
                    @Override
                    public java.nio.file.FileVisitResult preVisitDirectory(java.nio.file.Path dir, java.nio.file.attribute.BasicFileAttributes attrs) {
                        // 显式跳过 .git 目录
                        if (dir.getFileName().toString().equals(".git")) {
                            return java.nio.file.FileVisitResult.SKIP_SUBTREE;
                        }
                        return java.nio.file.FileVisitResult.CONTINUE;
                    }

                    @Override
                    public java.nio.file.FileVisitResult visitFile(java.nio.file.Path file, java.nio.file.attribute.BasicFileAttributes attrs) {
                        totalScanned[0]++;
                        String name = file.getFileName().toString();
                        String lowerName = name.toLowerCase();
                        
                        // 忽略大小写检查后缀
                        if (lowerName.endsWith(".xml") || lowerName.endsWith(".java") || lowerName.endsWith(".properties")) {
                            filePaths.add(file);
                            // 记录每100个找到的文件，避免日志过多
                            if (filePaths.size() % 100 == 0) {
                                log.info("Found {} matching files so far...", filePaths.size());
                            }
                        }
                        return java.nio.file.FileVisitResult.CONTINUE;
                    }

                    @Override
                    public java.nio.file.FileVisitResult visitFileFailed(java.nio.file.Path file, java.io.IOException exc) {
                        System.err.println("Failed to visit file: " + file + " (" + exc.getMessage() + ")");
                        return java.nio.file.FileVisitResult.CONTINUE; // 即使出错也继续处理其他文件
                    }
                });
                
                log.info("Scan complete. Scanned {} files/dirs, found {} matching files.", totalScanned[0], filePaths.size());
                
                // 顺序处理每个文件，避免并发问题
                int successCount = 0;
                int failCount = 0;
                for (java.nio.file.Path path : filePaths) {
                    try {
                        byte[] fileBytes = java.nio.file.Files.readAllBytes(path);
                        String content;
                        
                        // 尝试检测编码：先试 UTF-8，如果包含乱码字符（替换字符），尝试 GBK
                        try {
                            java.nio.charset.CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder();
                            decoder.onMalformedInput(java.nio.charset.CodingErrorAction.REPORT);
                            decoder.onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT);
                            content = decoder.decode(java.nio.ByteBuffer.wrap(fileBytes)).toString();
                        } catch (java.nio.charset.CharacterCodingException e) {
                            // UTF-8 解析失败，尝试 GBK
                            // log.warn("File {} is not valid UTF-8, trying GBK...", path.getFileName());
                            content = new String(fileBytes, java.nio.charset.Charset.forName("GBK"));
                        }
                        
                        Map<String, String> fileMap = new HashMap<>();
                        fileMap.put("name", path.getFileName().toString());
                        // 使用 toString() 避免路径解析问题，并统一分隔符
                        String relativePath = tempPath.relativize(path).toString().replace("\\", "/");
                        fileMap.put("path", relativePath);
                        fileMap.put("content", content);
                        files.add(fileMap);
                        successCount++;
                    } catch (Exception e) {
                        failCount++;
                        System.err.println("Error reading file: " + path + " - " + e.getMessage());
                        e.printStackTrace();
                    }
                }
                
                String msg = String.format("成功获取 %d 个文件 (扫描: %d, 匹配: %d, 失败: %d)", 
                    successCount, totalScanned[0], filePaths.size(), failCount);
                System.out.println(msg);
                return ResponseEntity.ok(new ApiResponse<>(true, msg, files));
                
            } catch (Exception e) {
                log.error("Git operation failed: {}", e.getMessage());
                e.printStackTrace();
                return ResponseEntity.ok(new ApiResponse<>(false, "Git操作失败: " + e.getMessage(), files));
            }
        } catch (Exception e) {
            System.err.println("Fetch repository error: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.ok(new ApiResponse<>(false, "获取仓库异常: " + e.getMessage(), new ArrayList<>()));
        }
    }

    /**
     * 递归删除目录
     */
    private void deleteDirectory(java.io.File file) {
        if (file.isDirectory()) {
            java.io.File[] entries = file.listFiles();
            if (entries != null) {
                for (java.io.File entry : entries) {
                    deleteDirectory(entry);
                }
            }
        }
        if (!file.delete()) {
            System.err.println("Failed to delete file: " + file.getAbsolutePath());
        }
    }

    /**
     * 执行 Git 命令
     */
    private void runGitCommand(java.io.File workingDir, String... command) throws Exception {
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(workingDir);
        pb.redirectErrorStream(true);
        Process p = pb.start();
        
        java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(p.getInputStream()));
        String line;
        while ((line = reader.readLine()) != null) {
            log.debug("git output: {}", line);
        }
        
        int exitCode = p.waitFor();
        if (exitCode != 0) {
            throw new RuntimeException("Command failed with exit code " + exitCode + ": " + String.join(" ", command));
        }
    }

    // ==================== Inner Classes ====================

    public static class NacosConnectionRequest {
        private String url;
        private String namespace;
        private String username;
        private String password;

        public String getUrl() { return url; }
        public void setUrl(String url) { this.url = url; }

        public String getNamespace() { return namespace; }
        public void setNamespace(String namespace) { this.namespace = namespace; }

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }

        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }

    public static class NacosConfigRequest extends NacosConnectionRequest {
        private String dataId;
        private String group;

        public String getDataId() { return dataId; }
        public void setDataId(String dataId) { this.dataId = dataId; }

        public String getGroup() { return group; }
        public void setGroup(String group) { this.group = group; }
    }

    public static class NacosConfigSaveRequest {
        private String name; // 配置名称
        private String sourceUrl; // 源环境 URL
        private String sourceNamespace;
        private String sourceUsername;
        private String sourcePassword;
        private String sourceRemark; // ⭐ 源环境备注
        private String targetUrl; // 目标环境 URL
        private String targetNamespace;
        private String targetUsername;
        private String targetPassword;
        private String targetRemark; // ⭐ 目标环境备注
        private String description;
        private Boolean enabled; // 是否启用（前端发送）

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getSourceUrl() { return sourceUrl; }
        public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }

        public String getSourceNamespace() { return sourceNamespace; }
        public void setSourceNamespace(String sourceNamespace) { this.sourceNamespace = sourceNamespace; }

        public String getSourceUsername() { return sourceUsername; }
        public void setSourceUsername(String sourceUsername) { this.sourceUsername = sourceUsername; }

        public String getSourcePassword() { return sourcePassword; }
        public void setSourcePassword(String sourcePassword) { this.sourcePassword = sourcePassword; }

        public String getSourceRemark() { return sourceRemark; }
        public void setSourceRemark(String sourceRemark) { this.sourceRemark = sourceRemark; }

        public String getTargetUrl() { return targetUrl; }
        public void setTargetUrl(String targetUrl) { this.targetUrl = targetUrl; }

        public String getTargetNamespace() { return targetNamespace; }
        public void setTargetNamespace(String targetNamespace) { this.targetNamespace = targetNamespace; }

        public String getTargetUsername() { return targetUsername; }
        public void setTargetUsername(String targetUsername) { this.targetUsername = targetUsername; }

        public String getTargetPassword() { return targetPassword; }
        public void setTargetPassword(String targetPassword) { this.targetPassword = targetPassword; }

        public String getTargetRemark() { return targetRemark; }
        public void setTargetRemark(String targetRemark) { this.targetRemark = targetRemark; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public Boolean getEnabled() { return enabled; }
        public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    }

    public static class NacosConfigDeleteRequest extends NacosConnectionRequest {
        private String dataId;
        private String group;

        public String getDataId() { return dataId; }
        public void setDataId(String dataId) { this.dataId = dataId; }

        public String getGroup() { return group; }
        public void setGroup(String group) { this.group = group; }
    }

    public static class GitConnectionRequest {
        private String repoUrl;
        private String authType;
        private String authUsername;
        private String authPassword;
        private String authToken;
        private String sshKeyContent;
        private String sshPassphrase;

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
    }

    public static class GitFetchRequest extends GitConnectionRequest {
        private String branch;
        private boolean skipGitFetch;

        public String getBranch() { return branch; }
        public void setBranch(String branch) { this.branch = branch; }

        public boolean isSkipGitFetch() { return skipGitFetch; }
        public void setSkipGitFetch(boolean skipGitFetch) { this.skipGitFetch = skipGitFetch; }
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

    public static class DetailedCompareRequest {
        private String dataId;
        private String group;
        private String sourceContent;
        private String targetContent;

        public String getDataId() { return dataId; }
        public void setDataId(String dataId) { this.dataId = dataId; }

        public String getGroup() { return group; }
        public void setGroup(String group) { this.group = group; }

        public String getSourceContent() { return sourceContent; }
        public void setSourceContent(String sourceContent) { this.sourceContent = sourceContent; }

        public String getTargetContent() { return targetContent; }
        public void setTargetContent(String targetContent) { this.targetContent = targetContent; }
    }

    public static class CompareRequest {
        private Long configId;
        private String sourceUrl;
        private String sourceNamespace;
        private String sourceUsername;
        private String sourcePassword;
        private String targetUrl;
        private String targetNamespace;
        private String targetUsername;
        private String targetPassword;

        public Long getConfigId() { return configId; }
        public void setConfigId(Long configId) { this.configId = configId; }

        public String getSourceUrl() { return sourceUrl; }
        public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }

        public String getSourceNamespace() { return sourceNamespace; }
        public void setSourceNamespace(String sourceNamespace) { this.sourceNamespace = sourceNamespace; }

        public String getSourceUsername() { return sourceUsername; }
        public void setSourceUsername(String sourceUsername) { this.sourceUsername = sourceUsername; }

        public String getSourcePassword() { return sourcePassword; }
        public void setSourcePassword(String sourcePassword) { this.sourcePassword = sourcePassword; }

        public String getTargetUrl() { return targetUrl; }
        public void setTargetUrl(String targetUrl) { this.targetUrl = targetUrl; }

        public String getTargetNamespace() { return targetNamespace; }
        public void setTargetNamespace(String targetNamespace) { this.targetNamespace = targetNamespace; }

        public String getTargetUsername() { return targetUsername; }
        public void setTargetUsername(String targetUsername) { this.targetUsername = targetUsername; }

        public String getTargetPassword() { return targetPassword; }
        public void setTargetPassword(String targetPassword) { this.targetPassword = targetPassword; }
    }

    /**
     * 智能匹配配置文件名
     * 支持命名空间替换匹配，例如：
     * - application-sit.yaml 匹配 application-local.yaml
     * - application-sit.properties 匹配 application-local.properties
     * 
     * @param sourceDataId 源环境的 dataId
     * @param sourceNamespace 源环境的命名空间
     * @param targetDataId 目标环境的 dataId
     * @param targetNamespace 目标环境的命名空间
     * @return 是否匹配
     */
    private boolean matchConfigWithNamespace(String sourceDataId, String sourceNamespace, 
                                             String targetDataId, String targetNamespace) {
        // 完全匹配
        if (sourceDataId.equals(targetDataId)) {
            return true;
        }
        
        // 如果命名空间相同，则不进行智能匹配
        if (sourceNamespace != null && sourceNamespace.equals(targetNamespace)) {
            return sourceDataId.equals(targetDataId);
        }
        
        // 智能匹配：替换命名空间部分
        // 提取文件扩展名
        String sourceExt = "";
        String targetExt = "";
        int sourceDotIdx = sourceDataId.lastIndexOf('.');
        int targetDotIdx = targetDataId.lastIndexOf('.');
        
        if (sourceDotIdx > 0) {
            sourceExt = sourceDataId.substring(sourceDotIdx);
        }
        if (targetDotIdx > 0) {
            targetExt = targetDataId.substring(targetDotIdx);
        }
        
        // 扩展名必须相同
        if (!sourceExt.equals(targetExt)) {
            return false;
        }
        
        // 提取不含扩展名的文件名
        String sourceBase = sourceDotIdx > 0 ? sourceDataId.substring(0, sourceDotIdx) : sourceDataId;
        String targetBase = targetDotIdx > 0 ? targetDataId.substring(0, targetDotIdx) : targetDataId;
        
        // 尝试替换源命名空间为目标命名空间
        if (sourceNamespace != null && !sourceNamespace.isEmpty() && 
            targetNamespace != null && !targetNamespace.isEmpty()) {
            
            // 模式1: 直接替换命名空间字符串
            String expectedTarget1 = sourceBase.replace(sourceNamespace, targetNamespace);
            if (expectedTarget1.equals(targetBase)) {
                System.out.println("✓ 智能匹配成功 (模式1): " + sourceDataId + " -> " + targetDataId);
                return true;
            }
            
            // 模式2: 处理大小写差异
            String expectedTarget2 = sourceBase.replace(sourceNamespace.toLowerCase(), targetNamespace.toLowerCase());
            if (expectedTarget2.equals(targetBase)) {
                System.out.println("✓ 智能匹配成功 (模式2): " + sourceDataId + " -> " + targetDataId);
                return true;
            }
            
            String expectedTarget3 = sourceBase.replace(sourceNamespace.toUpperCase(), targetNamespace.toUpperCase());
            if (expectedTarget3.equals(targetBase)) {
                System.out.println("✓ 智能匹配成功 (模式3): " + sourceDataId + " -> " + targetDataId);
                return true;
            }
        }
        
        return false;
    }

    /**
     * 智能比较两个 Nacos 配置是否相同
     * 处理常见的编码和空白字符差异：
     * - 换行符差异 (CRLF vs LF)
     * - BOM 标记
     * - 不同行尾的空白字符
     */
    private boolean compareNacosConfigs(String original, String revised) {
        // 第一步：直接比较（最快）
        if (original.equals(revised)) {
            return true;
        }

        // 第二步：规范化并比较
        String normalizedOrig = normalizeNacosContent(original);
        String normalizedRev = normalizeNacosContent(revised);
        
        if (normalizedOrig.equals(normalizedRev)) {
            return true;
        }

        // 第三步：按行比较（更细致地处理行级差异）
        String[] origLines = original.split("\n", -1);
        String[] revLines = revised.split("\n", -1);

        if (origLines.length != revLines.length) {
            return false;
        }

        for (int i = 0; i < origLines.length; i++) {
            String origLine = normalizeLineContent(origLines[i]);
            String revLine = normalizeLineContent(revLines[i]);
            if (!origLine.equals(revLine)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 规范化 Nacos 配置内容：处理整个文本的空白和编码问题
     */
    private String normalizeNacosContent(String content) {
        if (content == null) {
            return "";
        }
        
        // 移除 BOM 标记
        if (content.startsWith("\uFEFF")) {
            content = content.substring(1);
        }
        
        // 统一换行符为 \n（处理 CRLF 和其他差异）
        content = content.replace("\r\n", "\n").replace("\r", "\n");
        
        // 移除尾部空白（包括空格、制表符和换行）
        content = content.replaceAll("\\s+$", "");
        
        return content;
    }

    /**
     * 规范化单行内容
     */
    private String normalizeLineContent(String line) {
        if (line == null) {
            return "";
        }
        // 移除行尾 \r，然后替换特殊空白字符，最后 trim
        return line.replace("\r", "").replace("\u00A0", " ").trim();
    }
}




