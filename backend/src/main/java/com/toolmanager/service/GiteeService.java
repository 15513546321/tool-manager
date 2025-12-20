package com.toolmanager.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;

@Service
@RequiredArgsConstructor
public class GiteeService {
    
    private static final String GITEE_API_BASE = "https://gitee.com/api/v5";
    private final ObjectMapper objectMapper;
    private final GitOperationService gitOperationService;

    /**
     * Test connection to Gitee repository
     * Supports both SSH and Token (HTTP) authentication
     */
    public Map<String, Object> testConnection(String repoUrl, String authType, String accessToken, String privateKey) {
        System.out.println("=== Testing Gitee Connection ===");
        System.out.println("URL: " + repoUrl);
        System.out.println("Auth Type: " + authType);
        
        if ("ssh".equals(authType)) {
            // Use Git SSH operations
            return gitOperationService.testConnection(repoUrl, authType, accessToken, privateKey);
        } else if ("token".equals(authType)) {
            // Use Gitee HTTP API
            return testConnectionHTTP(repoUrl, accessToken);
        } else {
            Map<String, Object> result = new HashMap<>();
            result.put("success", false);
            result.put("message", "Unknown auth type: " + authType + ". Must be 'ssh' or 'token'");
            return result;
        }
    }

    /**
     * Test HTTP connection using Gitee API
     */
    private Map<String, Object> testConnectionHTTP(String repoUrl, String accessToken) {
        Map<String, Object> result = new HashMap<>();
        try {
            // Validate auth type and credentials
            if (accessToken == null || accessToken.trim().isEmpty()) {
                result.put("success", false);
                result.put("message", "Auth Type: token - but Access Token is empty!");
                return result;
            }
            
            // Extract owner and repo from URL
            String[] urlParts = extractRepoInfo(repoUrl);
            if (urlParts == null) {
                result.put("success", false);
                result.put("message", "Invalid repository URL format. Expected: https://gitee.com/owner/repo");
                return result;
            }
            
            String owner = urlParts[0];
            String repo = urlParts[1];
            System.out.println("Testing connection to: " + owner + "/" + repo);
            
            // Test API call with token
            String apiUrl = String.format("%s/repos/%s/%s", GITEE_API_BASE, owner, repo);
            System.out.println("Calling API: " + apiUrl);
            Map<String, Object> response = callGiteeApi(apiUrl, accessToken);
            
            if (response != null && response.containsKey("id")) {
                result.put("success", true);
                result.put("message", "✓ Connection successful!");
                result.put("repository", response.get("name"));
                result.put("description", response.getOrDefault("description", ""));
                System.out.println("Connection test SUCCESS for: " + owner + "/" + repo);
                return result;
            }
            
            result.put("success", false);
            result.put("message", "Unable to access repository. Check Token and URL.");
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "❌ Connection test failed: " + e.getMessage());
            System.err.println("Connection test exception: " + e.getMessage());
            e.printStackTrace();
        }
        return result;
    }

    /**
     * Fetch branches from Gitee repository
     * Supports both SSH and Token (HTTP) authentication
     * @param author optional filter by last commit author (null means no filter)
     */
    public List<Map<String, Object>> getBranches(String repoUrl, String authType, String accessToken, String privateKey, String searchQuery, String author) {
        List<Map<String, Object>> branches = new ArrayList<>();
        try {
            if ("ssh".equals(authType)) {
                // Use Git SSH operations
                return gitOperationService.getBranchesSSH(repoUrl, privateKey, searchQuery);
            } else if ("token".equals(authType)) {
                // Use Gitee HTTP API or Git HTTPS
                branches = gitOperationService.getBranchesHTTP(repoUrl, accessToken, searchQuery);
                if (!branches.isEmpty()) {
                    return branches;
                }
                // Fallback to Gitee API
                return getBranchesHTTP(repoUrl, accessToken, searchQuery, author);
            } else {
                System.err.println("Unknown auth type: " + authType);
                return branches;
            }
        } catch (Exception e) {
            System.err.println("Failed to fetch branches: " + e.getMessage());
            e.printStackTrace();
        }
        return branches;
    }

    /**
     * Fetch branches from Gitee repository using HTTP API
     */
    private List<Map<String, Object>> getBranchesHTTP(String repoUrl, String accessToken, String searchQuery, String author) {
        List<Map<String, Object>> branches = new ArrayList<>();
        try {
            if (!"token".equals("token") || accessToken == null || accessToken.trim().isEmpty()) {
                System.err.println("Access Token is empty!");
                return branches;
            }
            
            String[] urlParts = extractRepoInfo(repoUrl);
            if (urlParts == null) {
                System.err.println("Failed to extract repo info from URL: " + repoUrl);
                return branches;
            }
            
            String owner = urlParts[0];
            String repo = urlParts[1];
            System.out.println("Fetching branches for: " + owner + "/" + repo + ", author filter: " + (author != null ? author : "None"));
            
            String apiUrl = String.format("%s/repos/%s/%s/branches?per_page=100", GITEE_API_BASE, owner, repo);
            System.out.println("Calling Gitee API: " + apiUrl);
            List<Map<String, Object>> response = callGiteeApiList(apiUrl, accessToken);
            
            if (response != null && !response.isEmpty()) {
                System.out.println("Received " + response.size() + " branches from Gitee");
                String query = searchQuery != null ? searchQuery.toLowerCase() : "";
                for (Map<String, Object> branch : response) {
                    String branchName = (String) branch.get("name");
                    if (query.isEmpty() || branchName.toLowerCase().contains(query)) {
                        Map<String, Object> branchInfo = new HashMap<>();
                        branchInfo.put("name", branchName);
                        
                        // Get commit info for this branch
                        Map<String, Object> commit = (Map<String, Object>) branch.get("commit");
                        String lastAuthor = "Unknown";
                        String lastUpdated = "Unknown";
                        String lastCommitHash = "N/A";
                        
                        if (commit != null) {
                            Object sha = commit.get("sha");
                            if (sha != null) {
                                lastCommitHash = sha.toString();
                            }
                            
                            Object createdAt = commit.get("created_at");
                            if (createdAt != null) {
                                lastUpdated = createdAt.toString();
                            } else {
                                // Try committed_date as fallback
                                Object committedDate = commit.get("committed_date");
                                if (committedDate != null) {
                                    lastUpdated = committedDate.toString();
                                }
                            }
                            
                            // Extract author from commit
                            Map<String, Object> commitAuthorMap = (Map<String, Object>) commit.get("author");
                            if (commitAuthorMap != null) {
                                Object authorName = commitAuthorMap.get("name");
                                if (authorName != null) {
                                    lastAuthor = authorName.toString();
                                }
                            }
                        }
                        
                        branchInfo.put("lastCommitHash", lastCommitHash);
                        branchInfo.put("lastUpdated", lastUpdated);
                        branchInfo.put("lastAuthor", lastAuthor);
                        
                        // Filter by author if specified
                        if (author != null && !author.trim().isEmpty()) {
                            String authorFilter = author.trim().toLowerCase();
                            if (!lastAuthor.toLowerCase().contains(authorFilter)) {
                                continue; // Skip this branch if author doesn't match
                            }
                        }
                        
                        branches.add(branchInfo);
                    }
                }
                System.out.println("Filtered to " + branches.size() + " branches after search and author filter");
            } else {
                System.err.println("Empty response from Gitee API");
            }
        } catch (Exception e) {
            System.err.println("Failed to fetch branches: " + e.getMessage());
            e.printStackTrace();
        }
        return branches;
    }

    /**
     * Fetch changesets (commits) from Gitee repository
     * @param author optional filter by commit author (null means no filter)
     */
    public List<Map<String, Object>> getChangesets(String repoUrl, String authType, String accessToken, String privateKey, List<String> branches, String author) {
        List<Map<String, Object>> changesets = new ArrayList<>();
        try {
            if ("ssh".equals(authType)) {
                // For SSH, use git command to fetch commits
                changesets = gitOperationService.getCommitsSSH(repoUrl, privateKey, branches);
                return changesets;
            } else if ("token".equals(authType)) {
                // Use Gitee HTTP API
                return getChangesetsHTTP(repoUrl, accessToken, branches, author);
            } else {
                System.err.println("Unknown auth type: " + authType);
                return changesets;
            }
        } catch (Exception e) {
            System.err.println("Failed to fetch changesets: " + e.getMessage());
            e.printStackTrace();
        }
        return changesets;
    }

    /**
     * Fetch changesets using HTTP API
     * @param author optional filter by commit author (null means no filter)
     */
    private List<Map<String, Object>> getChangesetsHTTP(String repoUrl, String accessToken, List<String> branches, String author) {
        List<Map<String, Object>> changesets = new ArrayList<>();
        try {
            String[] urlParts = extractRepoInfo(repoUrl);
            if (urlParts == null) {
                System.err.println("Failed to extract repo info from URL: " + repoUrl);
                return changesets;
            }
            
            String owner = urlParts[0];
            String repo = urlParts[1];
            System.out.println("Fetching changesets for: " + owner + "/" + repo + ", branches: " + branches + ", author filter: " + (author != null ? author : "None"));
            
            if ("token".equals("token") && accessToken != null && !accessToken.trim().isEmpty()) {
                for (String branch : branches) {
                    String apiUrl = String.format("%s/repos/%s/%s/commits?sha=%s&per_page=100", 
                        GITEE_API_BASE, owner, repo, branch);
                    System.out.println("Calling Gitee API for commits on branch: " + branch);
                    List<Map<String, Object>> commits = callGiteeApiList(apiUrl, accessToken);
                    
                    if (commits != null && !commits.isEmpty()) {
                        System.out.println("Received " + commits.size() + " commits for branch: " + branch);
                        for (Map<String, Object> commit : commits) {
                            try {
                                Map<String, Object> changeset = new HashMap<>();
                                changeset.put("branch", branch);
                                String commitHash = (String) commit.get("sha");
                                changeset.put("commitHash", commitHash);
                                
                                // Extract author info
                                String commitAuthor = "Unknown";
                                Map<String, Object> authorMap = (Map<String, Object>) commit.get("author");
                                if (authorMap != null) {
                                    commitAuthor = (String) authorMap.getOrDefault("name", "Unknown");
                                }
                                changeset.put("author", commitAuthor);
                                
                                // Filter by author if specified
                                if (author != null && !author.trim().isEmpty()) {
                                    String authorFilter = author.trim().toLowerCase();
                                    if (!commitAuthor.toLowerCase().contains(authorFilter)) {
                                        continue; // Skip this commit if author doesn't match
                                    }
                                }
                                
                                // Extract commit details
                                Map<String, Object> commitDetail = (Map<String, Object>) commit.get("commit");
                                if (commitDetail != null) {
                                    changeset.put("message", commitDetail.getOrDefault("message", ""));
                                    
                                    Map<String, Object> committer = (Map<String, Object>) commitDetail.get("committer");
                                    if (committer != null) {
                                        changeset.put("date", committer.getOrDefault("date", ""));
                                    }
                                } else {
                                    changeset.put("message", "");
                                    changeset.put("date", "");
                                }
                                
                                // Fetch file list for this commit (with error handling)
                                String filePath = "N/A";
                                try {
                                    filePath = getCommitFilesFromGiteeAPI(owner, repo, commitHash, accessToken);
                                } catch (Exception fileEx) {
                                    System.err.println("Failed to fetch files for commit " + commitHash + ": " + fileEx.getMessage());
                                    // Continue with N/A instead of failing the entire commit
                                }
                                changeset.put("filePath", filePath);
                                changesets.add(changeset);
                            } catch (Exception commitEx) {
                                System.err.println("Error processing commit: " + commitEx.getMessage());
                                // Skip this commit and continue with next one
                                continue;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to fetch changesets: " + e.getMessage());
            e.printStackTrace();
        }
        return changesets;
    }

    /**
     * Get file list for a specific commit from Gitee API
     * Performance optimized: limit file count and add caching consideration
     * Returns file list with format: "file1.txt\nfile2.java\n..." (limit 20 files, newline separated)
     */
    private String getCommitFilesFromGiteeAPI(String owner, String repo, String commitHash, String accessToken) {
        try {
            String apiUrl = String.format("%s/repos/%s/%s/commits/%s", GITEE_API_BASE, owner, repo, commitHash);
            Map<String, Object> commitInfo = callGiteeApi(apiUrl, accessToken);
            
            if (commitInfo != null && commitInfo.containsKey("files")) {
                List<Map<String, Object>> files = (List<Map<String, Object>>) commitInfo.get("files");
                if (files != null && !files.isEmpty()) {
                    StringBuilder filePaths = new StringBuilder();
                    int fileCount = 0;
                    int totalFiles = files.size();
                    
                    for (Map<String, Object> file : files) {
                        if (fileCount >= 20) break; // Limit to first 20 files for performance
                        
                        String filename = (String) file.get("filename");
                        if (filename != null && !filename.trim().isEmpty()) {
                            if (filePaths.length() > 0) {
                                filePaths.append("\n"); // Use newline instead of comma
                            }
                            filePaths.append(filename);
                            fileCount++;
                        }
                    }
                    
                    // Add indicator if more files exist
                    if (totalFiles > 20) {
                        filePaths.append("\n... (共 ").append(totalFiles).append(" 个文件)");
                    }
                    
                    if (filePaths.length() > 0) {
                        return filePaths.toString();
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Error fetching commit files from Gitee API: " + e.getMessage());
        }
        
        return "N/A";
    }

    /**
     * Call Gitee API and return Map response
     */
    private Map<String, Object> callGiteeApi(String urlString, String accessToken) throws Exception {
        URL url = new URL(urlString + "?access_token=" + accessToken);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Accept", "application/json");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);
        
        int responseCode = conn.getResponseCode();
        if (responseCode == 200) {
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            reader.close();
            
            @SuppressWarnings("unchecked")
            Map<String, Object> result = objectMapper.readValue(response.toString(), Map.class);
            return result;
        } else if (responseCode == 401 || responseCode == 403) {
            throw new Exception("Authentication failed: Invalid access token");
        } else {
            throw new Exception("API returned status code: " + responseCode);
        }
    }

    /**
     * Call Gitee API and return List response
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> callGiteeApiList(String urlString, String accessToken) throws Exception {
        URL url = new URL(urlString + "&access_token=" + accessToken);
        System.out.println("Making HTTP request to: " + urlString + "&access_token=***");
        
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Accept", "application/json");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);
        
        int responseCode = conn.getResponseCode();
        System.out.println("Gitee API response code: " + responseCode);
        
        if (responseCode == 200) {
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            reader.close();
            conn.disconnect();
            
            System.out.println("Gitee API response length: " + response.length());
            List<Map<String, Object>> result = objectMapper.readValue(response.toString(), List.class);
            return result;
        } else if (responseCode == 401 || responseCode == 403) {
            // Read error response
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getErrorStream(), "UTF-8"));
            StringBuilder errorMsg = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                errorMsg.append(line);
            }
            reader.close();
            System.err.println("Auth error response: " + errorMsg.toString());
            throw new Exception("Authentication failed: Invalid access token or insufficient permissions. Response: " + errorMsg.toString());
        } else {
            // Read error response
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getErrorStream(), "UTF-8"));
            StringBuilder errorMsg = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                errorMsg.append(line);
            }
            reader.close();
            System.err.println("API error response: " + errorMsg.toString());
            throw new Exception("API returned status code: " + responseCode + ". Response: " + errorMsg.toString());
        }
    }

    /**
     * Extract owner and repo from Gitee URL
     * Supports formats:
     * - https://gitee.com/owner/repo
     * - https://gitee.com/owner/repo.git
     * - git@gitee.com:owner/repo.git
     */
    private String[] extractRepoInfo(String repoUrl) {
        try {
            if (repoUrl == null || repoUrl.trim().isEmpty()) {
                return null;
            }
            
            String url = repoUrl.trim();
            
            // Remove .git suffix
            if (url.endsWith(".git")) {
                url = url.substring(0, url.length() - 4);
            }
            
            // Handle SSH format: git@gitee.com:owner/repo
            if (url.startsWith("git@gitee.com:")) {
                url = url.substring("git@gitee.com:".length());
            }
            
            // Handle HTTPS format: https://gitee.com/owner/repo
            if (url.startsWith("https://gitee.com/")) {
                url = url.substring("https://gitee.com/".length());
            } else if (url.startsWith("http://gitee.com/")) {
                url = url.substring("http://gitee.com/".length());
            }
            
            // Split owner and repo
            String[] parts = url.split("/");
            if (parts.length >= 2) {
                return new String[]{parts[0], parts[1]};
            }
        } catch (Exception e) {
            System.err.println("Error extracting repo info: " + e.getMessage());
        }
        
        return null;
    }

    /**
     * Get changed files for a branch compared to master
     */
    public List<String> getBranchChangedFiles(String repoUrl, String authType, String accessToken, String privateKey, String branchName) {
        Set<String> changedFiles = new LinkedHashSet<>(); // Use LinkedHashSet to maintain order and remove duplicates
        
        try {
            if ("ssh".equals(authType)) {
                // Use git command to get diff
                changedFiles.addAll(gitOperationService.getChangedFilesSSH(repoUrl, privateKey, branchName));
            } else {
                // Use HTTP/Token auth
                changedFiles.addAll(gitOperationService.getChangedFilesHTTP(repoUrl, accessToken, branchName));
            }
        } catch (Exception e) {
            System.err.println("Error fetching branch changed files: " + e.getMessage());
            e.printStackTrace();
        }
        
        return new ArrayList<>(changedFiles);
    }
}

