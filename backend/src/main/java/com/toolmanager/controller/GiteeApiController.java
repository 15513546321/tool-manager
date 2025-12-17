package com.toolmanager.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.Data;

import java.util.*;

@RestController
@RequestMapping("/api/gitee")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class GiteeApiController {

    @Data
    public static class GiteeRequest {
        private String repoUrl;
        private String authType;
        private String accessToken;
        private String privateKey;
        private String publicKey;
        private String searchQuery;
        private List<String> branches;
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
    public ResponseEntity<ApiResponse<Map<String, String>>> testConnection(@RequestBody GiteeRequest request) {
        try {
            // Validate request
            if (request.getRepoUrl() == null || request.getRepoUrl().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Repository URL is required"));
            }

            // Validate auth credentials
            if ("token".equals(request.getAuthType())) {
                if (request.getAccessToken() == null || request.getAccessToken().trim().isEmpty()) {
                    return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Access Token is required for HTTPS/Token auth"));
                }
            } else if ("ssh".equals(request.getAuthType())) {
                if (request.getPrivateKey() == null || request.getPrivateKey().trim().isEmpty()) {
                    return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Private Key is required for SSH auth"));
                }
            }

            // Simulate connection test (replace with actual Gitee API call)
            Map<String, String> result = new HashMap<>();
            result.put("status", "connected");
            result.put("message", "Successfully connected to Gitee repository");
            result.put("repo", request.getRepoUrl());
            result.put("authType", request.getAuthType());

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            return ResponseEntity.status(400)
                .body(ApiResponse.error("Connection test failed: " + e.getMessage()));
        }
    }

    /**
     * Fetch branches from Gitee repository
     * POST /api/gitee/branches
     */
    @PostMapping("/branches")
    public ResponseEntity<ApiResponse<List<BranchInfo>>> getBranches(@RequestBody GiteeRequest request) {
        try {
            if (request.getRepoUrl() == null || request.getRepoUrl().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Repository URL is required"));
            }

            List<BranchInfo> branches = new ArrayList<>();
            
            // TODO: Replace with actual Gitee API integration
            // This should call the Gitee API to fetch real branches
            // For now, return example data structure
            
            String searchQuery = request.getSearchQuery() != null ? request.getSearchQuery().toLowerCase() : "";
            
            // Example branches (replace with actual API call)
            String[] exampleBranches = {
                "master", "develop", "feature/req-20231024-pay", 
                "feature/req-20231020-login", "bugfix/issue-2024-001"
            };

            for (String branchName : exampleBranches) {
                if (searchQuery.isEmpty() || branchName.toLowerCase().contains(searchQuery)) {
                    branches.add(new BranchInfo(
                        branchName,
                        "a1b2c3d" + (int)(Math.random() * 100),
                        "2023-10-" + (20 + (int)(Math.random() * 5)) + " " + 
                            (int)(Math.random() * 24) + ":" + String.format("%02d", (int)(Math.random() * 60))
                    ));
                }
            }

            return ResponseEntity.ok(ApiResponse.success(branches));
        } catch (Exception e) {
            return ResponseEntity.status(400)
                .body(ApiResponse.error("Failed to fetch branches: " + e.getMessage()));
        }
    }

    /**
     * Fetch changesets from Gitee repository
     * POST /api/gitee/changesets
     */
    @PostMapping("/changesets")
    public ResponseEntity<ApiResponse<List<ChangesetInfo>>> getChangesets(@RequestBody GiteeRequest request) {
        try {
            if (request.getRepoUrl() == null || request.getRepoUrl().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Repository URL is required"));
            }

            if (request.getBranches() == null || request.getBranches().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("At least one branch must be specified"));
            }

            List<ChangesetInfo> changesets = new ArrayList<>();

            // TODO: Replace with actual Gitee API integration
            // This should call the Gitee API to fetch real commits for specified branches
            
            String[] authors = {"DevUser", "Admin", "TestUser", "ReviewUser"};
            String[] messages = {
                "feat: add payment gateway integration",
                "fix: login timeout issue",
                "docs: update api spec",
                "refactor: optimize database queries"
            };
            String[] filePaths = {
                "src/main/java/com/bank/service/PaymentService.java",
                "src/main/java/com/bank/service/AuthService.java",
                "src/main/resources/application.properties",
                "src/test/java/com/bank/ServiceTest.java"
            };

            // Generate example changesets for each branch
            for (String branch : request.getBranches()) {
                int commitCount = 2 + (int)(Math.random() * 3);
                
                for (int i = 0; i < commitCount; i++) {
                    ChangesetInfo changeset = new ChangesetInfo();
                    changeset.setBranch(branch);
                    changeset.setCommitHash("a1b2c3d" + i + System.currentTimeMillis() % 1000);
                    changeset.setAuthor(authors[i % authors.length]);
                    changeset.setDate("2023-10-" + (20 + (int)(Math.random() * 5)) + " " + 
                        (int)(Math.random() * 24) + ":" + String.format("%02d", (int)(Math.random() * 60)));
                    changeset.setFilePath(filePaths[i % filePaths.length]);
                    changeset.setMessage(messages[i % messages.length]);
                    
                    changesets.add(changeset);
                }
            }

            return ResponseEntity.ok(ApiResponse.success(changesets));
        } catch (Exception e) {
            return ResponseEntity.status(400)
                .body(ApiResponse.error("Failed to fetch changesets: " + e.getMessage()));
        }
    }
}
