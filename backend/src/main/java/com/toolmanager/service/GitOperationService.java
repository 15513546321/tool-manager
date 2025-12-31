package com.toolmanager.service;

import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import com.toolmanager.util.SSHKeyConverter;
import java.io.*;
import java.util.*;

/**
 * Git 操作服务类
 * 支持 SSH 和 HTTP 两种认证方式的 Git 操作
 * 使用命令行直接调用 git 命令以获得最大兼容性
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GitOperationService {

    /**
     * Test connection to Git repository (SSH or HTTP)
     */
    public Map<String, Object> testConnection(String repoUrl, String authType, String accessToken, String privateKey) {
        Map<String, Object> result = new HashMap<>();
        try {
            log.info("{}",  "=== Testing Git Connection ===");
            log.info("URL: : {}", repoUrl);
            log.info("Auth Type: : {}", authType);
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
            log.info("Testing SSH connection to: : {}", repoUrl);
            
            // Try to use system SSH key first (~/.ssh/id_ed25519 or ~/.ssh/id_rsa)
            File sshKeyFile = null;
            String userHome = System.getProperty("user.home");
            
            // Try common SSH key locations in order of preference
            String[] keyLocations = {
                userHome + File.separator + ".ssh" + File.separator + "id_ed25519",
                userHome + File.separator + ".ssh" + File.separator + "id_rsa",
                userHome + File.separator + ".ssh" + File.separator + "id_ecdsa"
            };
            
            log.info("{}",  "🔍 Attempting to use system SSH keys from ~/.ssh/");
            for (String keyPath : keyLocations) {
                File testFile = new File(keyPath);
                if (testFile.exists() && testFile.isFile()) {
                    sshKeyFile = testFile;
                    log.info("✅ Found system SSH key: : {}", keyPath);
                    break;
                }
            }
            
            // If no system key found and privateKey provided, use uploaded key
            if (sshKeyFile == null && privateKey != null && !privateKey.trim().isEmpty()) {
                log.info("{}",  "⚠️ System SSH key not found, using uploaded private key");
                
                // Validate SSH key format
                log.info("{}",  "🔍 Validating SSH key format...");
                SSHKeyConverter.SSHKeyValidationResult keyValidation = SSHKeyConverter.validateKeyFormat(privateKey);
                System.out.println(keyValidation.getMessage());
                
                if (!keyValidation.isValid()) {
                    result.put("success", false);
                    result.put("message", keyValidation.getMessage());
                    System.out.println("❌ SSH key validation failed: " + keyValidation.getKeyType());
                    return result;
                }
                
                // Perform detailed diagnosis
                log.info("{}",  "\n🔎 Performing detailed SSH key diagnosis...");
                SSHKeyConverter.SSHKeyDiagnosticResult diagnostic = SSHKeyConverter.diagnoseKey(privateKey);
                if (diagnostic.hasIssues()) {
                    System.out.println(diagnostic.getFullReport());
                }
                
                // Clean SSH key - remove extra whitespace
                log.info("{}",  "🧹 Cleaning SSH key...");
                String cleanedKey = SSHKeyConverter.cleanSSHKey(privateKey);
                
                // Save private key to temp file
                File keyFile = File.createTempFile("jgit_key_", ".pem");
                keyFile.deleteOnExit();
                
                try (FileWriter fw = new FileWriter(keyFile)) {
                    fw.write(cleanedKey);
                    fw.flush();
                }
                
                // Set file permissions to 600
                keyFile.setReadable(true, true);
                keyFile.setReadable(false, false);
                keyFile.setWritable(true, true);
                keyFile.setWritable(false, false);
                keyFile.setExecutable(false, false);
                
                sshKeyFile = keyFile;
            } else if (sshKeyFile == null) {
                result.put("success", false);
                result.put("message", "❌ No SSH key found! System keys checked: " + String.join(", ", keyLocations) + ". Please provide a private key or place your SSH key in ~/.ssh/");
                System.err.println(result.get("message"));
                return result;
            }
            
            // Detect OS
            String os = System.getProperty("os.name").toLowerCase();
            boolean isWindows = os.contains("win");
            
            // Use git ls-remote with SSH key
            ProcessBuilder pb = new ProcessBuilder("git", "ls-remote", "--heads", repoUrl);
            
            // Configure environment for SSH
            Map<String, String> env = pb.environment();
            String keyPath = sshKeyFile.getAbsolutePath();
            String sshCommand;
            if (isWindows) {
                // Windows: use nul instead of /dev/null
                sshCommand = String.format("ssh -i \"%s\" -o StrictHostKeyChecking=no -o UserKnownHostsFile=nul", keyPath);
            } else {
                // Unix-like: use /dev/null
                sshCommand = String.format("ssh -i \"%s\" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null", keyPath);
            }
            env.put("GIT_SSH_COMMAND", sshCommand);
            env.put("SSH_ASKPASS", "false");
            env.put("DISPLAY", "");
            
            log.info("SSH Command: : {}", sshCommand);
            log.info("SSH Key: : {}", keyPath);
            
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            // Read output - MUST read all output to avoid pipe broken (exit code 141)
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), "UTF-8"));
            int lineCount = 0;
            String line;
            StringBuilder output = new StringBuilder();
            
            // Read ALL output without limit to prevent pipe broken
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
                lineCount++;
            }
            reader.close();
            
            // Wait for process with timeout (10 seconds)
            boolean finished = process.waitFor(10, java.util.concurrent.TimeUnit.SECONDS);
            if (!finished) {
                process.destroy();
                result.put("success", false);
                result.put("message", "SSH connection timeout (10s). Network may be slow or repository is unreachable.");
                return result;
            }
            
            int exitCode = process.exitValue();
            log.info("SSH test exit code: {}", exitCode);
            log.info("SSH test output lines: {}", lineCount);
            
            // Exit code 0 means success
            if (exitCode == 0) {
                result.put("success", true);
                result.put("message", "✓ SSH 连接成功! 找到 " + lineCount + " 个分支引用");
                result.put("branchCount", lineCount);
                log.info("SSH connection successful! Found {} refs", lineCount);
                return result;
            } else {
                // Show actual output for debugging
                String outputStr = output.toString().trim();
                String errorMsg = "SSH 连接失败 (退出码: " + exitCode + ")";
                
                if (exitCode == 128) {
                    errorMsg += "\n原因: 仓库不存在或无访问权限";
                } else if (exitCode == 141) {
                    errorMsg += "\n原因: SSH 连接中断 (可能是网络问题或 SSH 密钥配置错误)";
                } else if (exitCode == 255) {
                    errorMsg += "\n原因: SSH 认证失败 (检查密钥是否正确)";
                }
                
                if (!outputStr.isEmpty()) {
                    errorMsg += "\n详细信息: " + outputStr;
                }
                
                result.put("success", false);
                result.put("message", errorMsg);
                result.put("output", outputStr);
                log.error("SSH command failed with exit code: {}, output: {}", exitCode, outputStr);
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
            
            log.info("Testing HTTP connection to: : {}", repoUrl);
            
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
            
            // Read output - MUST read all output to avoid pipe broken (exit code 141)
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            int lineCount = 0;
            String line;
            StringBuilder output = new StringBuilder();
            
            // Read ALL output without limit to prevent pipe broken
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
                lineCount++;
            }
            reader.close();
            
            // Wait for process with timeout
            boolean finished = process.waitFor(10, java.util.concurrent.TimeUnit.SECONDS);
            if (!finished) {
                process.destroy();
                result.put("success", false);
                result.put("message", "HTTP connection timeout (10s). Network may be slow or repository is unreachable.");
                return result;
            }
            
            int exitCode = process.exitValue();
            
            if (exitCode == 0) {
                result.put("success", true);
                result.put("message", "✓ HTTP 连接成功! 找到 " + lineCount + " 个分支引用");
                result.put("branchCount", lineCount);
                log.info("HTTP connection successful! Found {} refs", lineCount);
                return result;
            } else {
                String outputStr = output.toString().trim();
                String errorMsg = "HTTP 连接失败 (退出码: " + exitCode + ")";
                
                if (exitCode == 128) {
                    errorMsg += "\n原因: 仓库不存在或无访问权限 (检查 Token 和 URL)";
                } else if (exitCode == 141) {
                    errorMsg += "\n原因: 连接中断 (可能是网络问题)";
                }
                
                if (!outputStr.isEmpty()) {
                    errorMsg += "\n详细信息: " + outputStr;
                }
                
                result.put("success", false);
                result.put("message", errorMsg);
                result.put("output", outputStr);
                log.error("HTTP git command failed with exit code: {}, output: {}", exitCode, outputStr);
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
            log.info("Fetching SSH branches from: : {}", repoUrl);
            
            // Get SSH key file (tries system keys first, then uses provided key)
            File sshKeyFile = getSSHKeyFile(privateKey);
            if (sshKeyFile == null) {
                log.error("❌ Error: No SSH key found! Please provide a private key or place your SSH key in ~/.ssh/");
                System.err.println("❌ SSH key not found");
                return branches;
            }
            
            String keyPath = sshKeyFile.getAbsolutePath();
            
            // Detect OS
            String os = System.getProperty("os.name").toLowerCase();
            boolean isWindows = os.contains("win");
            
            // Use git ls-remote to get branches
            ProcessBuilder pb = new ProcessBuilder("git", "ls-remote", "--heads", repoUrl);
            
            Map<String, String> env = pb.environment();
            
            // Set GIT_SSH_COMMAND with OS-specific paths
            String sshCommand;
            if (isWindows) {
                // Windows: use nul instead of /dev/null
                sshCommand = String.format("ssh -i \"%s\" -o StrictHostKeyChecking=no -o UserKnownHostsFile=nul", keyPath);
            } else {
                // Unix-like: use /dev/null
                sshCommand = String.format("ssh -i \"%s\" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null", keyPath);
            }
            
            env.put("GIT_SSH_COMMAND", sshCommand);
            // Disable SSH key passphrase prompt
            env.put("SSH_ASKPASS", "false");
            env.put("DISPLAY", "");
            
            log.info("SSH Command: : {}", sshCommand);
            log.info("Repository URL: : {}", repoUrl);
            
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), "UTF-8"));
            String line;
            String query = searchQuery != null ? searchQuery.toLowerCase() : "";
            int lineCount = 0;
            
            log.info("{}",  "Reading git ls-remote output...");
            while ((line = reader.readLine()) != null) {
                lineCount++;
                log.info("  Line : {}", lineCount + ": " + line);
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
                            log.info("  ✓ Added branch: : {}", branchName);
                        }
                    }
                }
            }
            reader.close();
            
            int exitCode = process.waitFor();
            log.info("Git process exit code: : {}", exitCode);
            if (exitCode != 0) {
                log.error("Git SSH command failed with exit code: : {}", exitCode);
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
            log.info("Fetching HTTP branches from: : {}", repoUrl);
            
            if (accessToken == null || accessToken.trim().isEmpty()) {
                log.error("Error: {}", "Access Token is required for HTTP authentication");
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
                log.error("Git HTTP command failed with exit code: : {}", exitCode);
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
    /**
     * Helper method to get SSH key file from system or provided key content
     * First tries system SSH keys (~/.ssh/id_ed25519, id_rsa, id_ecdsa)
     * If not found and privateKey content provided, uses that
     * Returns null if no key found
     */
    private File getSSHKeyFile(String privateKey) throws Exception {
        // Try to use system SSH key first (~/.ssh/id_ed25519 or ~/.ssh/id_rsa)
        File sshKeyFile = null;
        String userHome = System.getProperty("user.home");
        
        // Try common SSH key locations in order of preference
        String[] keyLocations = {
            userHome + File.separator + ".ssh" + File.separator + "id_ed25519",
            userHome + File.separator + ".ssh" + File.separator + "id_rsa",
            userHome + File.separator + ".ssh" + File.separator + "id_ecdsa"
        };
        
        log.info("🔍 Attempting to use system SSH keys from ~/.ssh/");
        for (String keyPath : keyLocations) {
            File testFile = new File(keyPath);
            if (testFile.exists() && testFile.isFile()) {
                sshKeyFile = testFile;
                log.info("✅ Found system SSH key: {}", keyPath);
                break;
            }
        }
        
        // If no system key found and privateKey provided, use uploaded key
        if (sshKeyFile == null && privateKey != null && !privateKey.trim().isEmpty()) {
            log.info("⚠️ System SSH key not found, using provided private key");
            
            // Save private key to temp file
            File keyFile = File.createTempFile("jgit_key_", ".pem");
            keyFile.deleteOnExit();
            
            try (FileWriter fw = new FileWriter(keyFile)) {
                fw.write(privateKey);
                fw.flush();
            }
            
            keyFile.setReadable(true, true);
            keyFile.setWritable(true, true);
            log.info("✓ Private key saved to: {}", keyFile.getAbsolutePath());
            sshKeyFile = keyFile;
        }
        
        if (sshKeyFile == null) {
            log.warn("⚠️ No SSH key found! System keys checked: {}. Please provide a private key or place your SSH key in ~/.ssh/", 
                String.join(", ", keyLocations));
        }
        
        return sshKeyFile;
    }

    public List<Map<String, Object>> getCommitsSSH(String repoUrl, String privateKey, List<String> branches) {
        List<Map<String, Object>> commits = new ArrayList<>();
        try {
            log.info("📥 Fetching SSH commits from: {}, branches: {}", repoUrl, branches);
            System.out.println("📥 Starting SSH commit fetch: " + repoUrl);
            
            if (branches == null || branches.isEmpty()) {
                log.error("❌ Error: No branches specified");
                return commits;
            }
            
            // Get SSH key file (tries system keys first, then uses provided key)
            File keyFile = getSSHKeyFile(privateKey);
            if (keyFile == null) {
                log.error("❌ Error: No SSH key found! Please provide a private key or place your SSH key in ~/.ssh/");
                System.err.println("❌ SSH key not found");
                return commits;
            }
            
            // For each branch, fetch commits
            for (String branch : branches) {
                try {
                    log.info("🔍 Processing branch: {}", branch);
                    // Create temp directory for bare clone
                    String tempDirName = "jgit_" + System.nanoTime();
                    File tempCloneDir = new File(System.getProperty("java.io.tmpdir"), tempDirName);
                    tempCloneDir.mkdirs();
                    log.debug("Created temp directory: {}", tempCloneDir.getAbsolutePath());
                    
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
                        log.debug("[Clone] {}", line);
                    }
                    cloneReader.close();
                    
                    // Wait for clone with timeout
                    boolean cloneCompleted = cloneProcess.waitFor(30, java.util.concurrent.TimeUnit.SECONDS);
                    if (!cloneCompleted) {
                        cloneProcess.destroyForcibly();
                        log.error("❌ Clone timeout for branch: {}", branch);
                        continue;
                    }
                    
                    int cloneExitCode = cloneProcess.exitValue();
                    if (cloneExitCode != 0) {
                        log.error("❌ Failed to clone repository for branch {}, exit code: {}", branch, cloneExitCode);
                        continue;
                    }
                    
                    log.info("✓ Clone successful for branch: {}", branch);
                    
                    // Get commit log from the cloned repo - filter by first-parent only (exclude merges from other branches)
                    ProcessBuilder logPb = new ProcessBuilder(
                        "git", "--git-dir=" + tempCloneDir.getAbsolutePath(),
                        "log", "--format=%H|%an|%ai|%s",
                        "--first-parent",
                        "--max-count=200",
                        "refs/heads/" + branch
                    );
                    
                    logPb.redirectErrorStream(true);
                    Process logProcess = logPb.start();
                    BufferedReader logReader = new BufferedReader(new InputStreamReader(logProcess.getInputStream()));
                    
                    int commitCount = 0;
                    while ((line = logReader.readLine()) != null) {
                        if (line.trim().isEmpty()) continue;
                        
                        String[] parts = line.split("\\|");
                        if (parts.length >= 4) {
                            String commitHash = parts[0];
                            
                            // Get file list for this commit
                            String filePaths = getCommitFilePaths(tempCloneDir, commitHash);
                            
                            Map<String, Object> commit = new HashMap<>();
                            commit.put("commitHash", commitHash);
                            commit.put("author", parts[1]);
                            commit.put("date", parts[2]);
                            commit.put("message", parts[3]);
                            commit.put("branch", branch);
                            commit.put("filePath", filePaths);
                            commits.add(commit);
                            commitCount++;
                        }
                    }
                    logReader.close();
                    
                    // Wait for log with timeout
                    boolean logCompleted = logProcess.waitFor(10, java.util.concurrent.TimeUnit.SECONDS);
                    if (!logCompleted) {
                        logProcess.destroyForcibly();
                        log.warn("⚠️ Git log timeout for branch: {}", branch);
                    } else {
                        int logExitCode = logProcess.exitValue();
                        if (logExitCode != 0) {
                            log.error("❌ Git log command failed for branch {}, exit code: {}", branch, logExitCode);
                        } else {
                            log.info("✓ Fetched {} commits from branch: {}", commitCount, branch);
                        }
                    }
                    
                    // Clean up temp directory
                    deleteDir(tempCloneDir);
                    
                } catch (Exception e) {
                    System.err.println("❌ Error fetching commits for branch " + branch + ": " + e.getMessage());
                    log.error("Error fetching commits for branch: {}", branch, e);
                }
            }
            
            System.out.println("✓ Found " + commits.size() + " total commits via SSH");
            log.info("✓ SSH commit fetch completed. Total commits: {}", commits.size());
            return commits;
        } catch (Exception e) {
            System.err.println("❌ Failed to fetch SSH commits: " + e.getMessage());
            log.error("Failed to fetch SSH commits: ", e);
            return commits;
        }
    }

    /**
     * Get file paths changed in a specific commit
     */
    private String getCommitFilePaths(File repoDir, String commitHash) {
        try {
            // Use 'git diff-tree' which is more efficient for getting file list
            ProcessBuilder pb = new ProcessBuilder(
                "git", "--git-dir=" + repoDir.getAbsolutePath(),
                "diff-tree", "--no-commit-id", "-r", "--name-only",
                commitHash
            );
            
            pb.redirectErrorStream(true);
            Process process = pb.start();
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), "UTF-8"));
            
            StringBuilder filePaths = new StringBuilder();
            String line;
            int fileCount = 0;
            int totalFiles = 0;
            
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty()) continue;
                
                totalFiles++;
                if (fileCount < 20) { // Limit to first 20 files for display
                    if (filePaths.length() > 0) {
                        filePaths.append("\n"); // Use newline for better readability
                    }
                    filePaths.append(trimmed);
                    fileCount++;
                }
            }
            reader.close();
            
            // Wait with timeout
            boolean completed = process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
            if (!completed) {
                process.destroyForcibly();
                log.warn("Git diff-tree command timeout for commit: {}", commitHash);
                return filePaths.length() > 0 ? filePaths.toString() : "N/A";
            }
            
            // Add indicator if more files exist
            if (totalFiles > 20) {
                filePaths.append("\n... (共 ").append(totalFiles).append(" 个文件)");
            }
            
            String result = filePaths.toString().trim();
            if (result.isEmpty()) {
                return "N/A";
            }
            return result;
        } catch (Exception e) {
            System.err.println("❌ Error getting commit files for " + commitHash + ": " + e.getMessage());
            log.error("Error getting commit files: ", e);
            return "N/A";
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

    /**
     * Get changed files for a branch using SSH
     */
    public List<String> getChangedFilesSSH(String repoUrl, String privateKey, String branchName) {
        Set<String> changedFiles = new LinkedHashSet<>();
        
        try {
            System.out.println("Fetching changed files for branch: " + branchName + " (SSH)");
            
            // Try to use system SSH key first
            File sshKeyFile = null;
            String userHome = System.getProperty("user.home");
            String[] keyLocations = {
                userHome + File.separator + ".ssh" + File.separator + "id_ed25519",
                userHome + File.separator + ".ssh" + File.separator + "id_rsa",
                userHome + File.separator + ".ssh" + File.separator + "id_ecdsa"
            };
            
            for (String keyPath : keyLocations) {
                File testFile = new File(keyPath);
                if (testFile.exists() && testFile.isFile()) {
                    sshKeyFile = testFile;
                    log.info("Using SSH key: : {}", keyPath);
                    break;
                }
            }
            
            if (sshKeyFile == null) {
                log.error("Error: {}", "No SSH key found");
                return new ArrayList<>(changedFiles);
            }
            
            // Clone the repository to a temporary directory
            File tempDir = new File(System.getProperty("java.io.tmpdir"), "git_" + System.currentTimeMillis());
            tempDir.mkdirs();
            
            ProcessBuilder clonePb = new ProcessBuilder("git", "clone", "--bare", repoUrl, tempDir.getAbsolutePath());
            Map<String, String> cloneEnv = clonePb.environment();
            cloneEnv.put("GIT_SSH_COMMAND", String.format("ssh -i \"%s\" -o StrictHostKeyChecking=no -o UserKnownHostsFile=nul", sshKeyFile.getAbsolutePath()));
            
            clonePb.redirectErrorStream(true);
            Process cloneProcess = clonePb.start();
            BufferedReader cloneReader = new BufferedReader(new InputStreamReader(cloneProcess.getInputStream()));
            String line;
            while ((line = cloneReader.readLine()) != null) {
                if (!line.trim().isEmpty()) {
                    log.info("Clone: : {}", line);
                }
            }
            cloneReader.close();
            int cloneExitCode = cloneProcess.waitFor();
            
            if (cloneExitCode != 0) {
                log.error("Failed to clone repository: exit code : {}", cloneExitCode);
                deleteDir(tempDir);
                return new ArrayList<>(changedFiles);
            }
            
            log.info("{}",  "Repository cloned successfully");
            
            // Get all files in this branch (from HEAD)
            ProcessBuilder logPb = new ProcessBuilder(
                "git", "--git-dir=" + tempDir.getAbsolutePath(),
                "ls-tree", "-r", "--name-only", branchName
            );
            
            logPb.redirectErrorStream(true);
            Process logProcess = logPb.start();
            BufferedReader logReader = new BufferedReader(new InputStreamReader(logProcess.getInputStream(), "UTF-8"));
            
            int fileCount = 0;
            while ((line = logReader.readLine()) != null) {
                if (!line.trim().isEmpty()) {
                    changedFiles.add(line.trim());
                    fileCount++;
                    if (fileCount % 100 == 0) {
                        log.info("  Processed : {}", fileCount + " files...");
                    }
                }
            }
            logReader.close();
            
            int logExitCode = logProcess.waitFor();
            if (logExitCode != 0) {
                log.error("Git ls-tree command failed with exit code: : {}", logExitCode);
            }
            
            // Clean up
            deleteDir(tempDir);
            System.out.println("✅ Found " + changedFiles.size() + " files in branch: " + branchName);
            
        } catch (Exception e) {
            System.err.println("Error fetching changed files via SSH: " + e.getMessage());
            e.printStackTrace();
        }
        
        return new ArrayList<>(changedFiles);
    }

    /**
     * Get changed files for a branch using HTTP
     */
    public List<String> getChangedFilesHTTP(String repoUrl, String accessToken, String branchName) {
        Set<String> changedFiles = new LinkedHashSet<>();
        
        try {
            System.out.println("Fetching changed files for branch: " + branchName + " (HTTP)");
            
            // Clone the repository using HTTPS
            File tempDir = new File(System.getProperty("java.io.tmpdir"), "git_" + System.currentTimeMillis());
            tempDir.mkdirs();
            
            // Convert SSH URL to HTTPS if needed
            String httpsUrl = repoUrl;
            if (repoUrl.startsWith("git@")) {
                // git@gitee.com:owner/repo -> https://gitee.com/owner/repo
                httpsUrl = repoUrl.replace("git@", "https://").replace(":", "/");
            }
            
            if (accessToken != null && !accessToken.trim().isEmpty()) {
                // Add token to HTTPS URL
                httpsUrl = httpsUrl.replace("https://", "https://oauth2:" + accessToken + "@");
            }
            
            ProcessBuilder clonePb = new ProcessBuilder("git", "clone", "--bare", httpsUrl, tempDir.getAbsolutePath());
            clonePb.redirectErrorStream(true);
            Process cloneProcess = clonePb.start();
            BufferedReader cloneReader = new BufferedReader(new InputStreamReader(cloneProcess.getInputStream()));
            String line;
            while ((line = cloneReader.readLine()) != null) {
                if (!line.trim().isEmpty()) {
                    log.info("Clone: : {}", line);
                }
            }
            cloneReader.close();
            int cloneExitCode = cloneProcess.waitFor();
            
            if (cloneExitCode != 0) {
                log.error("Failed to clone repository: exit code : {}", cloneExitCode);
                deleteDir(tempDir);
                return new ArrayList<>(changedFiles);
            }
            
            log.info("{}",  "Repository cloned successfully");
            
            // Get all files in this branch
            ProcessBuilder logPb = new ProcessBuilder(
                "git", "--git-dir=" + tempDir.getAbsolutePath(),
                "ls-tree", "-r", "--name-only", branchName
            );
            
            logPb.redirectErrorStream(true);
            Process logProcess = logPb.start();
            BufferedReader logReader = new BufferedReader(new InputStreamReader(logProcess.getInputStream(), "UTF-8"));
            
            int fileCount = 0;
            while ((line = logReader.readLine()) != null) {
                if (!line.trim().isEmpty()) {
                    changedFiles.add(line.trim());
                    fileCount++;
                    if (fileCount % 100 == 0) {
                        log.info("  Processed : {}", fileCount + " files...");
                    }
                }
            }
            logReader.close();
            
            int logExitCode = logProcess.waitFor();
            if (logExitCode != 0) {
                log.error("Git ls-tree command failed with exit code: : {}", logExitCode);
            }
            
            // Clean up
            deleteDir(tempDir);
            System.out.println("✅ Found " + changedFiles.size() + " files in branch: " + branchName);
            
        } catch (Exception e) {
            System.err.println("Error fetching changed files via HTTP: " + e.getMessage());
            e.printStackTrace();
        }
        
        return new ArrayList<>(changedFiles);
    }

    /**
     * Compare two commits using SSH and get changesets between them
     */
    public List<Map<String, Object>> compareCommitsSSH(String repoUrl, String privateKey, String branchName, 
                                                         String fromCommit, String toCommit) {
        List<Map<String, Object>> commits = new ArrayList<>();
        
        try {
            log.info("📥 Comparing commits via SSH: {} -> {}", fromCommit, toCommit);
            System.out.println("📥 Starting SSH commit comparison: " + fromCommit + " -> " + toCommit);
            
            // Get SSH key file
            File keyFile = getSSHKeyFile(privateKey);
            if (keyFile == null) {
                log.error("❌ Error: No SSH key found!");
                return commits;
            }
            
            // Create temp directory for bare clone
            String tempDirName = "jgit_compare_" + System.nanoTime();
            File tempCloneDir = new File(System.getProperty("java.io.tmpdir"), tempDirName);
            tempCloneDir.mkdirs();
            
            try {
                // Clone repository
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
                    log.debug("[Clone] {}", line);
                }
                cloneReader.close();
                
                boolean cloneCompleted = cloneProcess.waitFor(30, java.util.concurrent.TimeUnit.SECONDS);
                if (!cloneCompleted || cloneProcess.exitValue() != 0) {
                    log.error("❌ Failed to clone repository");
                    return commits;
                }
                
                log.info("✓ Clone successful");
                
                // First, try to get commits in both directions to handle order issues
                String logRange = fromCommit + ".." + toCommit;
                
                // Test if we need to reverse the order by checking which one is ancestor
                ProcessBuilder testPb = new ProcessBuilder(
                    "git", "--git-dir=" + tempCloneDir.getAbsolutePath(),
                    "merge-base", "--is-ancestor", fromCommit, toCommit
                );
                testPb.redirectErrorStream(true);
                Process testProcess = testPb.start();
                boolean testCompleted = testProcess.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
                
                // If fromCommit is NOT an ancestor of toCommit, reverse the order
                if (!testCompleted || testProcess.exitValue() != 0) {
                    log.info("Reversing commit order: {} is not ancestor of {}", fromCommit, toCommit);
                    logRange = toCommit + ".." + fromCommit;
                }
                
                // Get commits between fromCommit and toCommit
                ProcessBuilder logPb = new ProcessBuilder(
                    "git", "--git-dir=" + tempCloneDir.getAbsolutePath(),
                    "log", "--format=%H|%an|%ai|%s",
                    "--first-parent",
                    "--max-count=200",
                    logRange
                );
                
                logPb.redirectErrorStream(true);
                Process logProcess = logPb.start();
                BufferedReader logReader = new BufferedReader(new InputStreamReader(logProcess.getInputStream()));
                
                int commitCount = 0;
                while ((line = logReader.readLine()) != null) {
                    if (line.trim().isEmpty()) continue;
                    
                    String[] parts = line.split("\\|");
                    if (parts.length >= 4) {
                        String commitHash = parts[0];
                        
                        // Get file list for this commit
                        String filePaths = getCommitFilePaths(tempCloneDir, commitHash);
                        
                        Map<String, Object> commit = new HashMap<>();
                        commit.put("commitHash", commitHash);
                        commit.put("author", parts[1]);
                        commit.put("date", parts[2]);
                        commit.put("message", parts[3]);
                        commit.put("branch", branchName);
                        commit.put("filePath", filePaths);
                        commits.add(commit);
                        commitCount++;
                    }
                }
                logReader.close();
                
                boolean logCompleted = logProcess.waitFor(10, java.util.concurrent.TimeUnit.SECONDS);
                if (logCompleted && logProcess.exitValue() == 0) {
                    log.info("✓ Found {} commits between {} and {}", commitCount, fromCommit, toCommit);
                } else {
                    log.warn("Git log command exit code: {}", logProcess.exitValue());
                    
                    // If still no commits found, try to get diff directly between the two commits
                    if (commitCount == 0) {
                        log.info("No commits found via log, trying direct diff comparison");
                        
                        ProcessBuilder diffPb = new ProcessBuilder(
                            "git", "--git-dir=" + tempCloneDir.getAbsolutePath(),
                            "diff", "--name-only", fromCommit, toCommit
                        );
                        diffPb.redirectErrorStream(true);
                        Process diffProcess = diffPb.start();
                        BufferedReader diffReader = new BufferedReader(new InputStreamReader(diffProcess.getInputStream()));
                        
                        StringBuilder filePathsBuilder = new StringBuilder();
                        while ((line = diffReader.readLine()) != null) {
                            if (!line.trim().isEmpty()) {
                                if (filePathsBuilder.length() > 0) {
                                    filePathsBuilder.append("\n");
                                }
                                filePathsBuilder.append(line.trim());
                            }
                        }
                        diffReader.close();
                        
                        boolean diffCompleted = diffProcess.waitFor(10, java.util.concurrent.TimeUnit.SECONDS);
                        if (diffCompleted && diffProcess.exitValue() == 0 && filePathsBuilder.length() > 0) {
                            // Create a synthetic commit entry for the diff
                            Map<String, Object> commit = new HashMap<>();
                            commit.put("commitHash", toCommit);
                            commit.put("author", "Diff Comparison");
                            commit.put("date", new java.util.Date().toString());
                            commit.put("message", "Direct diff between " + fromCommit + " and " + toCommit);
                            commit.put("branch", branchName);
                            commit.put("filePath", filePathsBuilder.toString());
                            commits.add(commit);
                            log.info("✓ Found {} changed files via direct diff", filePathsBuilder.toString().split("\n").length);
                        }
                    }
                }
                
            } finally {
                // Clean up temp directory
                deleteDir(tempCloneDir);
            }
            
            System.out.println("✓ Found " + commits.size() + " commits via SSH comparison");
            log.info("✓ SSH commit comparison completed. Total commits: {}", commits.size());
            
        } catch (Exception e) {
            System.err.println("❌ Failed to compare commits via SSH: " + e.getMessage());
            log.error("Failed to compare commits via SSH: ", e);
        }
        
        return commits;
    }
}

