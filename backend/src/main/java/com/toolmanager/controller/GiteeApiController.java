package com.toolmanager.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.Data;
import com.toolmanager.service.GiteeService;
import java.util.*;

/**
 * Gitee API 控制器
 * 处理 Gitee 仓库操作、统计数据获取等功能
 */
@Slf4j
@RestController
@RequestMapping("/api/gitee")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class GiteeApiController {
    
    private final GiteeService giteeService;

    @Data
    public static class GiteeRequest {
        private String repoUrl;
        private String authType;
        private String accessToken;
        private String privateKey;
        private String publicKey;
        private String searchQuery;
        private String branchName; // Filter by branch name
        private List<String> branches;
        private String author; // Filter by commit author
        
        // Pagination
        private Integer pageNumber = 1;
        private Integer pageSize = 20;
    }

    @Data
    public static class BranchInfo {
        private String name;
        private String lastCommitHash;
        private String lastUpdated;

        public BranchInfo(String name, String hash, String updated) {
            this.name = name;
            this.lastCommitHash = hash;
            this.lastUpdated = updated;
        }
    }

    @Data
    public static class PaginatedResponse<T> {
        private List<T> items;
        private Integer pageNumber;
        private Integer pageSize;
        private Long totalCount;
        private Integer totalPages;

        public PaginatedResponse(List<T> items, Integer pageNumber, Integer pageSize, Long totalCount) {
            this.items = items;
            this.pageNumber = pageNumber;
            this.pageSize = pageSize;
            this.totalCount = totalCount;
            this.totalPages = Math.toIntExact((totalCount + pageSize - 1) / pageSize);
        }
    }

    @Data
    public static class ChangesetInfo {
        private String branch;
        private String commitHash;
        private String author;
        private String date;
        private String filePath;
        private String message;
        private String requirementGroup;
    }

    @Data
    public static class ApiResponse<T> {
        private boolean success;
        private String message;
        private T data;

        public ApiResponse(boolean success, String message, T data) {
            this.success = success;
            this.message = message;
            this.data = data;
        }

        public static <T> ApiResponse<T> success(T data) {
            return new ApiResponse<>(true, "Success", data);
        }

        public static <T> ApiResponse<T> error(String message) {
            return new ApiResponse<>(false, message, null);
        }
    }

    /**
     * Test connection to Gitee repository
     * POST /api/gitee/test-connection
     */
    @PostMapping("/test-connection")
    public ResponseEntity<ApiResponse<Map<String, Object>>> testConnection(@RequestBody GiteeRequest request) {
        try {
            log.info("{}",  "=== Testing Gitee Connection ===");
            System.out.println("URL: " + request.getRepoUrl());
            System.out.println("Auth Type: " + request.getAuthType());
            System.out.println("Has Token: " + (request.getAccessToken() != null && !request.getAccessToken().isEmpty()));
            System.out.println("Has Private Key: " + (request.getPrivateKey() != null && !request.getPrivateKey().isEmpty()));
            
            // Validate request
            if (request.getRepoUrl() == null || request.getRepoUrl().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("❌ Repository URL is required"));
            }

            // Call Gitee API to test connection
            Map<String, Object> result = giteeService.testConnection(
                request.getRepoUrl(),
                request.getAuthType(),
                request.getAccessToken(),
                request.getPrivateKey()
            );
            
            boolean success = (boolean) result.getOrDefault("success", false);
            System.out.println("Connection test result: " + (success ? "SUCCESS" : "FAILED"));
            System.out.println("Message: " + result.getOrDefault("message", ""));
            
            if (success) {
                Map<String, Object> response = new HashMap<>();
                response.put("status", "connected");
                response.put("message", (String) result.getOrDefault("message", "Successfully connected to Gitee repository"));
                response.put("repo", (String) result.getOrDefault("repository", ""));
                response.put("authType", request.getAuthType());
                // 包含分支列表
                response.put("branches", result.getOrDefault("branches", new java.util.ArrayList<>()));
                return ResponseEntity.ok(ApiResponse.success(response));
            } else {
                // Return 400 status for failed connection
                return ResponseEntity.status(400)
                    .body(ApiResponse.error((String) result.getOrDefault("message", "Connection test failed")));
            }
        } catch (Exception e) {
            System.err.println("Exception in testConnection: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(400)
                .body(ApiResponse.error("❌ Connection test failed: " + e.getMessage()));
        }
    }

    /**
     * Validate current configuration (for post-save verification)
     * POST /api/gitee/validate-config
     */
    @PostMapping("/validate-config")
    public ResponseEntity<ApiResponse<Map<String, Object>>> validateConfig(@RequestBody GiteeRequest request) {
        try {
            log.info("{}",  "=== Validating Gitee Configuration ===");
            System.out.println("URL: " + request.getRepoUrl());
            System.out.println("Auth Type: " + request.getAuthType());
            
            Map<String, Object> result = new HashMap<>();
            
            // Validate URL format
            if (request.getRepoUrl() == null || request.getRepoUrl().trim().isEmpty()) {
                result.put("valid", false);
                result.put("reason", "Repository URL is empty");
                return ResponseEntity.ok(ApiResponse.success(result));
            }
            
            // Validate auth credentials based on type
            if ("token".equals(request.getAuthType())) {
                if (request.getAccessToken() == null || request.getAccessToken().trim().isEmpty()) {
                    result.put("valid", false);
                    result.put("reason", "Access Token is empty");
                    return ResponseEntity.ok(ApiResponse.success(result));
                }
            } else if ("ssh".equals(request.getAuthType())) {
                if (request.getPrivateKey() == null || request.getPrivateKey().trim().isEmpty()) {
                    result.put("valid", false);
                    result.put("reason", "Private Key is empty");
                    return ResponseEntity.ok(ApiResponse.success(result));
                }
            }
            
            result.put("valid", true);
            result.put("reason", "Configuration is valid");
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            System.err.println("Exception in validateConfig: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(400)
                .body(ApiResponse.error("Failed to validate config: " + e.getMessage()));
        }
    }

    /**
     * Fetch branches from Gitee repository with pagination
     * POST /api/gitee/branches
     */
    @PostMapping("/branches")
    public ResponseEntity<ApiResponse<PaginatedResponse<Map<String, Object>>>> getBranches(@RequestBody GiteeRequest request) {
        try {
            if (request.getRepoUrl() == null || request.getRepoUrl().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Repository URL is required"));
            }

            // Set defaults for pagination
            Integer pageNumber = request.getPageNumber() != null ? request.getPageNumber() : 1;
            Integer pageSize = request.getPageSize() != null ? request.getPageSize() : 20;
            
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 20;

            log.info("{}",  "=== Fetching branches ===");
            System.out.println("Repository URL: " + request.getRepoUrl());
            System.out.println("Auth Type: " + request.getAuthType());
            log.info("Page: : {}", pageNumber + ", Size: " + pageSize);

            // Call Gitee API to fetch real branches (supports SSH and HTTP)
            List<Map<String, Object>> allBranches = giteeService.getBranches(
                request.getRepoUrl(),
                request.getAuthType(),
                request.getAccessToken(),
                request.getPrivateKey(),
                request.getSearchQuery(),
                request.getAuthor() // Pass author filter for branches
            );

            // Apply branchName filter if specified
            if (request.getBranchName() != null && !request.getBranchName().trim().isEmpty()) {
                String branchNameFilter = request.getBranchName().toLowerCase();
                allBranches = allBranches.stream()
                    .filter(branch -> ((String) branch.getOrDefault("name", "")).toLowerCase().contains(branchNameFilter))
                    .collect(java.util.stream.Collectors.toList());
            }

            System.out.println("Total branches found: " + allBranches.size());

            if (allBranches.isEmpty()) {
                String errorMsg = "No branches found. Please check:\n" +
                    "1. Repository URL format (must be: https://gitee.com/owner/repo)\n" +
                    "2. Access Token is valid and has repo access permission\n" +
                    "3. Repository exists and is accessible\n" +
                    "4. Check server logs for detailed error information";
                
                PaginatedResponse<Map<String, Object>> response = new PaginatedResponse<>(
                    new ArrayList<>(), pageNumber, pageSize, 0L
                );
                return ResponseEntity.ok(ApiResponse.success(response));
            }

            // Apply pagination
            int startIndex = (pageNumber - 1) * pageSize;
            int endIndex = Math.min(startIndex + pageSize, allBranches.size());
            
            List<Map<String, Object>> paginatedBranches = startIndex < allBranches.size() 
                ? new ArrayList<>(allBranches.subList(startIndex, endIndex))
                : new ArrayList<>();

            PaginatedResponse<Map<String, Object>> response = new PaginatedResponse<>(
                paginatedBranches, 
                pageNumber, 
                pageSize, 
                (long) allBranches.size()
            );

            return ResponseEntity.ok(ApiResponse.success(response));
        } catch (Exception e) {
            System.err.println("Exception in getBranches: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(400)
                .body(ApiResponse.error("Failed to fetch branches: " + e.getMessage()));
        }
    }

    /**
     * Fetch changesets from Gitee repository
     * POST /api/gitee/changesets
     */
    @PostMapping("/changesets")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getChangesets(@RequestBody GiteeRequest request) {
        try {
            if (request.getRepoUrl() == null || request.getRepoUrl().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Repository URL is required"));
            }

            if (request.getBranches() == null || request.getBranches().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("At least one branch must be specified"));
            }

            // Call Gitee API to fetch real commits/changesets (supports SSH and HTTP)
            List<Map<String, Object>> changesets = giteeService.getChangesets(
                request.getRepoUrl(),
                request.getAuthType(),
                request.getAccessToken(),
                request.getPrivateKey(),
                request.getBranches(),
                request.getAuthor() // Pass author filter
            );

            if (changesets.isEmpty()) {
                return ResponseEntity.ok(
                    ApiResponse.error("No changesets found or failed to fetch changesets. Please verify your branch names and access token.")
                );
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> result = (List<Map<String, Object>>) (List<?>) changesets;
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            return ResponseEntity.status(400)
                .body(ApiResponse.error("Failed to fetch changesets: " + e.getMessage()));
        }
    }

    /**
     * Get changed files list for a branch (compared to master)
     * POST /api/gitee/branch-files
     */
    @PostMapping("/branch-files")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getBranchFiles(@RequestBody GiteeRequest request) {
        try {
            if (request.getRepoUrl() == null || request.getRepoUrl().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Repository URL is required"));
            }

            if (request.getBranches() == null || request.getBranches().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("At least one branch must be specified"));
            }

            String branchName = request.getBranches().get(0); // Get first branch
            
            // Get file list for this branch
            List<String> files = giteeService.getBranchChangedFiles(
                request.getRepoUrl(),
                request.getAuthType(),
                request.getAccessToken(),
                request.getPrivateKey(),
                branchName
            );

            Map<String, Object> result = new HashMap<>();
            result.put("branch", branchName);
            result.put("totalFiles", files.size());
            result.put("files", files);

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            return ResponseEntity.status(400)
                .body(ApiResponse.error("Failed to fetch branch files: " + e.getMessage()));
        }
    }
}




