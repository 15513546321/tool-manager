package com.toolmanager.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.*;
import java.util.*;

/**
 * Service for Git operations supporting both SSH and HTTP authentication
 * Uses git command line directly for maximum compatibility
 */
@Service
@RequiredArgsConstructor
public class GitOperationService {

    /**
     * Test connection to Git repository (SSH or HTTP)
     */
    public Map<String, Object> testConnection(String repoUrl, String authType, String accessToken, String privateKey) {
        Map<String, Object> result = new HashMap<>();
        try {
            System.out.println("=== Testing Git Connection ===");
            System.out.println("URL: " + repoUrl);
            System.out.println("Auth Type: " + authType);
            System.out.println("Has Token: " + (accessToken != null && !accessToken.trim().isEmpty()));
            System.out.println("Has Private Key: " + (privateKey != null && !privateKey.trim().isEmpty()));
            
            // Validate input
            if (repoUrl == null || repoUrl.trim().isEmpty()) {
                result.put("success", false);
                result.put("message", "Repository URL cannot be empty");
                return result;
            }
            
            // Test based on auth type
            if ("ssh".equals(authType)) {
                return testSSHConnection(repoUrl, privateKey);
            } else if ("token".equals(authType)) {
                return testHTTPConnection(repoUrl, accessToken);
            } else {
                result.put("success", false);
                result.put("message", "Unknown auth type: " + authType + ". Must be 'ssh' or 'token'");
                return result;
            }
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "Connection test failed: " + e.getMessage());
            System.err.println("Connection test exception: " + e.getMessage());
            e.printStackTrace();
        }
        return result;
    }

    /**
     * Test SSH connection using git command line
     */
    private Map<String, Object> testSSHConnection(String repoUrl, String privateKey) {
        Map<String, Object> result = new HashMap<>();
        try {
            System.out.println("Testing SSH connection to: " + repoUrl);
            
            if (privateKey == null || privateKey.trim().isEmpty()) {
                result.put("success", false);
                result.put("message", "Private key is required for SSH authentication");
                return result;
            }
            
            // Save private key to temp file
            File keyFile = File.createTempFile("jgit_key_", ".pem");
            keyFile.deleteOnExit();
            
            try (FileWriter fw = new FileWriter(keyFile)) {
                fw.write(privateKey);
                fw.flush();
            }
            
            // Set file permissions to 600
            keyFile.setReadable(true, true);
            keyFile.setReadable(false, false);
            keyFile.setWritable(true, true);
            keyFile.setWritable(false, false);
            keyFile.setExecutable(false, false);
            
            // Use git ls-remote with SSH key
            ProcessBuilder pb = new ProcessBuilder("git", "ls-remote", "--heads", repoUrl);
            
            // Configure environment for SSH
            Map<String, String> env = pb.environment();
            env.put("GIT_SSH_COMMAND", "ssh -i " + keyFile.getAbsolutePath() + " -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null");
            
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            // Read output
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            int lineCount = 0;
            String line;
            while ((line = reader.readLine()) != null && lineCount < 100) {
                lineCount++;
            }
            reader.close();
            
            int exitCode = process.waitFor();
            
            if (exitCode == 0 && lineCount > 0) {
                result.put("success", true);
                result.put("message", "✓ SSH connection successful!");
                result.put("branchCount", lineCount);
                System.out.println("SSH connection successful! Found " + lineCount + " refs");
                return result;
            } else {
                result.put("success", false);
                result.put("message", "SSH connection failed. Exit code: " + exitCode + ". Make sure your SSH key is correct and repository is accessible.");
                System.err.println("SSH command failed with exit code: " + exitCode);
                return result;
            }
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "SSH connection error: " + e.getMessage());
            System.err.println("SSH connection exception: " + e.getMessage());
            return result;
        }
    }

    /**
     * Test HTTP connection (Token auth) using git command line
     */
    private Map<String, Object> testHTTPConnection(String repoUrl, String accessToken) {
        Map<String, Object> result = new HashMap<>();
        try {
            if (accessToken == null || accessToken.trim().isEmpty()) {
                result.put("success", false);
                result.put("message", "Access Token is required for HTTP authentication");
                return result;
            }
            
            System.out.println("Testing HTTP connection to: " + repoUrl);
            
            // Prepare URL with token embedded
            String authUrl = repoUrl;
            if (repoUrl.startsWith("https://")) {
                authUrl = repoUrl.replace("https://", "https://" + accessToken + ":x-oauth-basic@");
            } else if (repoUrl.startsWith("http://")) {
                authUrl = repoUrl.replace("http://", "http://" + accessToken + ":x-oauth-basic@");
            }
            
            // Use git ls-remote
            ProcessBuilder pb = new ProcessBuilder("git", "ls-remote", "--heads", authUrl);
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            // Read output
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            int lineCount = 0;
            String line;
            while ((line = reader.readLine()) != null && lineCount < 100) {
                lineCount++;
            }
            reader.close();
            
            int exitCode = process.waitFor();
            
            if (exitCode == 0 && lineCount > 0) {
                result.put("success", true);
                result.put("message", "✓ HTTP connection successful!");
                result.put("branchCount", lineCount);
                System.out.println("HTTP connection successful! Found " + lineCount + " refs");
                return result;
            } else {
                result.put("success", false);
                result.put("message", "HTTP connection failed. Exit code: " + exitCode + ". Check your Token and repository URL.");
                System.err.println("HTTP git command failed with exit code: " + exitCode);
                return result;
            }
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "HTTP connection error: " + e.getMessage());
            System.err.println("HTTP connection exception: " + e.getMessage());
            return result;
        }
    }

    /**
     * Get branches from repository using SSH
     */
    public List<Map<String, Object>> getBranchesSSH(String repoUrl, String privateKey, String searchQuery) {
        List<Map<String, Object>> branches = new ArrayList<>();
        try {
            System.out.println("Fetching SSH branches from: " + repoUrl);
            
            if (privateKey == null || privateKey.trim().isEmpty()) {
                System.err.println("Private key is required for SSH authentication");
                return branches;
            }
            
            // Save private key to temp file
            File keyFile = File.createTempFile("jgit_key_", ".pem");
            keyFile.deleteOnExit();
            
            try (FileWriter fw = new FileWriter(keyFile)) {
                fw.write(privateKey);
                fw.flush();
            }
            
            keyFile.setReadable(true, true);
            keyFile.setWritable(true, true);
            
            // Use git ls-remote to get branches
            ProcessBuilder pb = new ProcessBuilder("git", "ls-remote", "--heads", repoUrl);
            
            Map<String, String> env = pb.environment();
            env.put("GIT_SSH_COMMAND", "ssh -i " + keyFile.getAbsolutePath() + " -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null");
            
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            String query = searchQuery != null ? searchQuery.toLowerCase() : "";
            
            while ((line = reader.readLine()) != null) {
                // Format: <hash>\t<ref>
                String[] parts = line.split("\t");
                if (parts.length >= 2) {
                    String ref = parts[1];
                    if (ref.startsWith("refs/heads/")) {
                        String branchName = ref.replace("refs/heads/", "");
                        if (query.isEmpty() || branchName.toLowerCase().contains(query)) {
                            Map<String, Object> branchInfo = new HashMap<>();
                            branchInfo.put("name", branchName);
                            branchInfo.put("lastCommitHash", parts[0]);
                            branchInfo.put("lastUpdated", "N/A");
                            branches.add(branchInfo);
                        }
                    }
                }
            }
            reader.close();
            
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                System.err.println("Git SSH command failed with exit code: " + exitCode);
            }
            
            System.out.println("Found " + branches.size() + " branches via SSH");
            return branches;
        } catch (Exception e) {
            System.err.println("Failed to fetch SSH branches: " + e.getMessage());
            e.printStackTrace();
            return branches;
        }
    }

    /**
     * Get branches from repository using HTTP (Token auth)
     */
    public List<Map<String, Object>> getBranchesHTTP(String repoUrl, String accessToken, String searchQuery) {
        List<Map<String, Object>> branches = new ArrayList<>();
        try {
            System.out.println("Fetching HTTP branches from: " + repoUrl);
            
            if (accessToken == null || accessToken.trim().isEmpty()) {
                System.err.println("Access Token is required for HTTP authentication");
                return branches;
            }
            
            // Prepare URL with token embedded
            String authUrl = repoUrl;
            if (repoUrl.startsWith("https://")) {
                authUrl = repoUrl.replace("https://", "https://" + accessToken + ":x-oauth-basic@");
            } else if (repoUrl.startsWith("http://")) {
                authUrl = repoUrl.replace("http://", "http://" + accessToken + ":x-oauth-basic@");
            }
            
            // Use git ls-remote to get branches
            ProcessBuilder pb = new ProcessBuilder("git", "ls-remote", "--heads", authUrl);
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            String query = searchQuery != null ? searchQuery.toLowerCase() : "";
            
            while ((line = reader.readLine()) != null) {
                // Format: <hash>\t<ref>
                String[] parts = line.split("\t");
                if (parts.length >= 2) {
                    String ref = parts[1];
                    if (ref.startsWith("refs/heads/")) {
                        String branchName = ref.replace("refs/heads/", "");
                        if (query.isEmpty() || branchName.toLowerCase().contains(query)) {
                            Map<String, Object> branchInfo = new HashMap<>();
                            branchInfo.put("name", branchName);
                            branchInfo.put("lastCommitHash", parts[0]);
                            branchInfo.put("lastUpdated", "N/A");
                            branches.add(branchInfo);
                        }
                    }
                }
            }
            reader.close();
            
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                System.err.println("Git HTTP command failed with exit code: " + exitCode);
            }
            
            System.out.println("Found " + branches.size() + " branches via HTTP");
            return branches;
        } catch (Exception e) {
            System.err.println("Failed to fetch HTTP branches: " + e.getMessage());
            e.printStackTrace();
            return branches;
        }
    }

    /**
     * Get commits from SSH repository
     */
    public List<Map<String, Object>> getCommitsSSH(String repoUrl, String privateKey, List<String> branches) {
        List<Map<String, Object>> commits = new ArrayList<>();
        try {
            System.out.println("Fetching SSH commits from: " + repoUrl + ", branches: " + branches);
            
            if (privateKey == null || privateKey.trim().isEmpty()) {
                System.err.println("Private key is required for SSH authentication");
                return commits;
            }
            
            if (branches == null || branches.isEmpty()) {
                System.err.println("No branches specified");
                return commits;
            }
            
            // Save private key to temp file
            File keyFile = File.createTempFile("jgit_key_", ".pem");
            keyFile.deleteOnExit();
            
            try (FileWriter fw = new FileWriter(keyFile)) {
                fw.write(privateKey);
                fw.flush();
            }
            
            keyFile.setReadable(true, true);
            keyFile.setWritable(true, true);
            
            // For each branch, fetch commits
            for (String branch : branches) {
                try {
                    // Create temp directory for bare clone
                    String tempDirName = "jgit_" + System.nanoTime();
                    File tempCloneDir = new File(System.getProperty("java.io.tmpdir"), tempDirName);
                    tempCloneDir.mkdirs();
                    
                    // Clone repository with SSH authentication
                    ProcessBuilder clonePb = new ProcessBuilder(
                        "git", "clone", "--bare", repoUrl, tempCloneDir.getAbsolutePath()
                    );
                    
                    Map<String, String> cloneEnv = clonePb.environment();
                    cloneEnv.put("GIT_SSH_COMMAND", "ssh -i " + keyFile.getAbsolutePath() + 
                        " -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null");
                    
                    clonePb.redirectErrorStream(true);
                    Process cloneProcess = clonePb.start();
                    BufferedReader cloneReader = new BufferedReader(new InputStreamReader(cloneProcess.getInputStream()));
                    String line;
                    while ((line = cloneReader.readLine()) != null) {
                        System.out.println("[Clone] " + line);
                    }
                    cloneReader.close();
                    
                    int cloneExitCode = cloneProcess.waitFor();
                    if (cloneExitCode != 0) {
                        System.err.println("Failed to clone repository for branch " + branch);
                        continue;
                    }
                    
                    // Get commit log from the cloned repo
                    ProcessBuilder logPb = new ProcessBuilder(
                        "git", "--git-dir=" + tempCloneDir.getAbsolutePath(),
                        "log", "--format=%H|%an|%ai|%s",
                        "--max-count=50",
                        "refs/heads/" + branch
                    );
                    
                    logPb.redirectErrorStream(true);
                    Process logProcess = logPb.start();
                    BufferedReader logReader = new BufferedReader(new InputStreamReader(logProcess.getInputStream()));
                    
                    while ((line = logReader.readLine()) != null) {
                        if (line.trim().isEmpty()) continue;
                        
                        String[] parts = line.split("\\|");
                        if (parts.length >= 4) {
                            Map<String, Object> commit = new HashMap<>();
                            commit.put("commitHash", parts[0]);
                            commit.put("author", parts[1]);
                            commit.put("date", parts[2]);
                            commit.put("message", parts[3]);
                            commit.put("branch", branch);
                            commit.put("filePath", "N/A");
                            commits.add(commit);
                        }
                    }
                    logReader.close();
                    
                    int logExitCode = logProcess.waitFor();
                    if (logExitCode != 0) {
                        System.err.println("Git log command failed for branch " + branch);
                    }
                    
                    // Clean up temp directory
                    deleteDir(tempCloneDir);
                    
                } catch (Exception e) {
                    System.err.println("Error fetching commits for branch " + branch + ": " + e.getMessage());
                    e.printStackTrace();
                }
            }
            
            System.out.println("Found " + commits.size() + " total commits via SSH");
            return commits;
        } catch (Exception e) {
            System.err.println("Failed to fetch SSH commits: " + e.getMessage());
            e.printStackTrace();
            return commits;
        }
    }

    private void deleteDir(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteDir(child);
                }
            }
        }
        file.delete();
    }
}

