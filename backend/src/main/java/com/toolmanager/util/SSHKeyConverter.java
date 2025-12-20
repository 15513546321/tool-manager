package com.toolmanager.util;

import java.util.regex.Pattern;
import java.util.regex.Matcher;
import java.util.List;
import java.util.ArrayList;

/**
 * SSH Key Format Converter and Validator
 * Handles conversion between different SSH key formats and validates key format
 */
public class SSHKeyConverter {
    
    private static final String OPENSSH_BEGIN = "-----BEGIN OPENSSH PRIVATE KEY-----";
    private static final String OPENSSH_END = "-----END OPENSSH PRIVATE KEY-----";
    
    private static final String RSA_BEGIN = "-----BEGIN RSA PRIVATE KEY-----";
    private static final String RSA_END = "-----END RSA PRIVATE KEY-----";
    
    private static final String EC_BEGIN = "-----BEGIN EC PRIVATE KEY-----";
    private static final String EC_END = "-----END EC PRIVATE KEY-----";
    
    private static final String PUTTYGEN_BEGIN = "---- BEGIN SSH2 PUBLIC KEY ----";
    
    /**
     * Validate SSH key format
     */
    public static SSHKeyValidationResult validateKeyFormat(String privateKey) {
        SSHKeyValidationResult result = new SSHKeyValidationResult();
        
        if (privateKey == null || privateKey.trim().isEmpty()) {
            result.setValid(false);
            result.setMessage("密钥为空");
            result.setKeyType("UNKNOWN");
            return result;
        }
        
        privateKey = privateKey.trim();
        
        // Check for PuTTY format
        if (privateKey.contains("PuTTY-User-Key-File") || privateKey.contains("Encryption:") && privateKey.contains("Comment:")) {
            result.setValid(false);
            result.setKeyType("PUTTY");
            result.setMessage("❌ 检测到 PuTTY 格式密钥 (.ppk)。\n" +
                    "请使用 PuTTY Key Generator (puttygen.exe) 转换为 OpenSSH 格式:\n" +
                    "1. 打开 puttygen.exe\n" +
                    "2. 选择 'Conversions' -> 'Export OpenSSH key'\n" +
                    "3. 保存文件并使用新密钥");
            return result;
        }
        
        // Check for OpenSSH format
        if (privateKey.contains(OPENSSH_BEGIN) && privateKey.contains(OPENSSH_END)) {
            result.setValid(true);
            result.setKeyType("OPENSSH");
            result.setMessage("✅ OpenSSH 格式密钥（推荐）");
            return result;
        }
        
        // Check for RSA format
        if (privateKey.contains(RSA_BEGIN) && privateKey.contains(RSA_END)) {
            result.setValid(true);
            result.setKeyType("RSA");
            result.setMessage("✅ RSA 格式密钥");
            return result;
        }
        
        // Check for EC format
        if (privateKey.contains(EC_BEGIN) && privateKey.contains(EC_END)) {
            result.setValid(true);
            result.setKeyType("EC");
            result.setMessage("✅ EC 格式密钥");
            return result;
        }
        
        // Check for SSH2 format
        if (privateKey.contains(PUTTYGEN_BEGIN)) {
            result.setValid(false);
            result.setKeyType("SSH2");
            result.setMessage("❌ 检测到 SSH2 公钥格式。请提供私钥而不是公钥。");
            return result;
        }
        
        // Unknown format
        result.setValid(false);
        result.setKeyType("UNKNOWN");
        result.setMessage("❌ 无法识别的密钥格式。支持的格式:\n" +
                "- OpenSSH (-----BEGIN OPENSSH PRIVATE KEY-----)\n" +
                "- RSA (-----BEGIN RSA PRIVATE KEY-----)\n" +
                "- EC (-----BEGIN EC PRIVATE KEY-----)");
        
        return result;
    }
    
    /**
     * Clean SSH key - remove extra whitespace and normalize format
     */
    public static String cleanSSHKey(String privateKey) {
        if (privateKey == null) {
            return null;
        }
        
        StringBuilder cleaned = new StringBuilder();
        String[] lines = privateKey.split("\n");
        
        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()) {
                cleaned.append(trimmed).append("\n");
            }
        }
        
        return cleaned.toString().trim();
    }
    
    /**
     * Diagnose SSH key issues
     */
    public static SSHKeyDiagnosticResult diagnoseKey(String privateKey) {
        SSHKeyDiagnosticResult result = new SSHKeyDiagnosticResult();
        
        if (privateKey == null || privateKey.isEmpty()) {
            result.addIssue("密钥内容为空");
            return result;
        }
        
        // Check for encryption indicators
        if (privateKey.contains("ENCRYPTED")) {
            result.addIssue("⚠️ 检测到密钥可能被加密（含有 ENCRYPTED 标记）");
            result.addSolution("请尝试：\n" +
                    "1. 如果使用 OpenSSH 格式，可能需要密码来解密\n" +
                    "2. 检查密钥是否需要密码，当前系统暂不支持密码保护的密钥\n" +
                    "3. 建议创建无密码的 SSH 密钥对");
        }
        
        // Check for proper formatting
        int beginCount = 0;
        int endCount = 0;
        String[] lines = privateKey.split("\n");
        
        for (String line : lines) {
            if (line.contains("BEGIN")) beginCount++;
            if (line.contains("END")) endCount++;
        }
        
        if (beginCount == 0 || endCount == 0) {
            result.addIssue("密钥缺少 BEGIN 或 END 标记");
        }
        
        if (beginCount != endCount) {
            result.addIssue("BEGIN 和 END 标记数量不匹配 (BEGIN: " + beginCount + ", END: " + endCount + ")");
        }
        
        // Check for suspicious patterns
        if (privateKey.length() < 100) {
            result.addIssue("密钥长度过短 (< 100 字符)，可能不是有效的私钥");
        }
        
        // Check for common issues
        if (privateKey.contains("\r\n")) {
            result.addInfo("检测到 Windows 行尾符 (CRLF)，系统将自动转换");
        }
        
        if (privateKey.startsWith(" ") || privateKey.endsWith(" ")) {
            result.addInfo("检测到前后空格，系统将自动清理");
        }
        
        // Check if it's a valid key format
        if (!privateKey.contains("BEGIN RSA PRIVATE KEY") &&
            !privateKey.contains("BEGIN OPENSSH PRIVATE KEY") &&
            !privateKey.contains("BEGIN EC PRIVATE KEY") &&
            !privateKey.contains("BEGIN DSA PRIVATE KEY") &&
            !privateKey.contains("BEGIN PRIVATE KEY")) {
            result.addIssue("⚠️ 无法识别密钥格式");
            result.addSolution("请确保上传的是私钥（通常包含 'BEGIN XXX PRIVATE KEY'）");
        }
        
        return result;
    }
    
    /**
     * Diagnostic result class
     */
    public static class SSHKeyDiagnosticResult {
        private List<String> issues = new ArrayList<>();
        private List<String> solutions = new ArrayList<>();
        private List<String> info = new ArrayList<>();
        
        public void addIssue(String issue) {
            this.issues.add(issue);
        }
        
        public void addSolution(String solution) {
            this.solutions.add(solution);
        }
        
        public void addInfo(String information) {
            this.info.add(information);
        }
        
        public boolean hasIssues() {
            return !issues.isEmpty();
        }
        
        public String getFullReport() {
            StringBuilder report = new StringBuilder();
            
            if (!info.isEmpty()) {
                report.append("ℹ️  信息:\n");
                for (String i : info) {
                    report.append("  - ").append(i).append("\n");
                }
                report.append("\n");
            }
            
            if (!issues.isEmpty()) {
                report.append("❌ 问题:\n");
                for (String issue : issues) {
                    report.append("  - ").append(issue).append("\n");
                }
                report.append("\n");
            }
            
            if (!solutions.isEmpty()) {
                report.append("💡 解决方案:\n");
                for (String solution : solutions) {
                    report.append("  ").append(solution).append("\n");
                }
            }
            
            return report.toString();
        }
        
        public List<String> getIssues() {
            return issues;
        }
        
        public List<String> getSolutions() {
            return solutions;
        }
    }
    
    /**
     * Result class for key validation
     */
    public static class SSHKeyValidationResult {
        private boolean valid;
        private String keyType;
        private String message;
        
        public boolean isValid() {
            return valid;
        }
        
        public void setValid(boolean valid) {
            this.valid = valid;
        }
        
        public String getKeyType() {
            return keyType;
        }
        
        public void setKeyType(String keyType) {
            this.keyType = keyType;
        }
        
        public String getMessage() {
            return message;
        }
        
        public void setMessage(String message) {
            this.message = message;
        }
        
        @Override
        public String toString() {
            return "SSHKeyValidationResult{" +
                    "valid=" + valid +
                    ", keyType='" + keyType + '\'' +
                    ", message='" + message + '\'' +
                    '}';
        }
    }
}
