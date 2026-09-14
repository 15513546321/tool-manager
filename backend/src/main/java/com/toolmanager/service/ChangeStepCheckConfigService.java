package com.toolmanager.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.toolmanager.dto.ChangeStepCheckDtos.KnownPasswordRuleDto;
import com.toolmanager.dto.ChangeStepCheckDtos.ScannerConfigDto;
import com.toolmanager.dto.ChangeStepCheckDtos.UpdateScannerConfigRequest;
import com.toolmanager.entity.SystemParameter;
import com.toolmanager.repository.SystemParameterRepository;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChangeStepCheckConfigService {
    static final String KEYWORDS_KEY = "change_step_check.field_keywords";
    static final String REGEX_KEY = "change_step_check.regex_patterns";
    static final String PASSWORDS_KEY = "change_step_check.known_password_fingerprints";
    static final String SERVER_ASSETS_KEY = "change_step_check.server_asset_names";
    static final String SERVER_ASSETS_BY_SYSTEM_KEY = "change_step_check.server_asset_names_by_system";
    private static final String CATEGORY = "变更步骤检查";

    private static final List<String> DEFAULT_KEYWORDS = Arrays.asList(
            "password", "passwd", "pass", "pwd", "passcode", "passphrase",
            "credential", "credentials", "credential_password",
            "key", "secret", "secretkey", "secret_key", "privatekey", "private_key",
            "accesskey", "access_key", "accesskeyid", "access_key_id",
            "apikey", "api_key", "api-key", "appkey", "app_key",
            "appsecret", "app_secret", "clientsecret", "client_secret",
            "signingkey", "signing_key", "encryptionkey", "encryption_key",
            "decryptkey", "decrypt_key", "keystorepassword", "keystore_password",
            "truststorepassword", "truststore_password",
            "token", "access_token", "accesstoken", "refresh_token", "refreshtoken",
            "auth_token", "authtoken", "bearer_token",
            "dbpassword", "db_password", "database_password", "jdbc.password",
            "oracle.password", "mysql.password", "redis.password",
            "密码", "口令", "密钥", "秘钥", "访问密钥", "访问令牌", "认证令牌", "认证信息", "凭据"
    );
    private static final List<String> DEFAULT_REGEX_PATTERNS = Collections.singletonList("(?i)\\bsrcb\\d{4,}\\b");
    private static final Pattern UNSAFE_NESTED_QUANTIFIER = Pattern.compile(
            "\\((?:[^()\\\\]|\\\\.)*[+*](?:[^()\\\\]|\\\\.)*\\)[+*{]"
    );

    private final SystemParameterRepository repository;
    private final ObjectMapper objectMapper;

    public ScannerConfigDto getPublicConfig() {
        InternalConfig config = getInternalConfig();
        List<KnownPasswordRuleDto> knownPasswords = config.getKnownPasswords().stream()
                .map(item -> new KnownPasswordRuleDto(item.getId(), item.getMaskedValue()))
                .collect(Collectors.toList());
        return new ScannerConfigDto(config.getFieldKeywords(), config.getRegexPatterns(), knownPasswords,
                config.getServerAssetNames(ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM),
                config.getServerAssetNamesBySystem());
    }

    public InternalConfig getInternalConfig() {
        List<String> keywords = readStringList(KEYWORDS_KEY, DEFAULT_KEYWORDS);
        List<String> regexPatterns = readStringList(REGEX_KEY, DEFAULT_REGEX_PATTERNS);
        List<KnownPasswordFingerprint> passwords = readPasswords();
        List<String> legacyMiddleAssets = readStringList(SERVER_ASSETS_KEY, Collections.emptyList());
        Map<String, List<String>> serverAssetsBySystem = readStringListMap(SERVER_ASSETS_BY_SYSTEM_KEY);
        serverAssetsBySystem.putIfAbsent(ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM,
                legacyMiddleAssets);
        serverAssetsBySystem.putIfAbsent(ChangeStepBusinessValidationService.SYSTEM_WECHAT,
                new ArrayList<>());
        serverAssetsBySystem.putIfAbsent(ChangeStepBusinessValidationService.SYSTEM_ONLINE_BANKING,
                new ArrayList<>());
        serverAssetsBySystem.putIfAbsent(ChangeStepBusinessValidationService.TREASURY_SAAS_ASSET_SCOPE,
                new ArrayList<>());
        serverAssetsBySystem.putIfAbsent(ChangeStepBusinessValidationService.TREASURY_NT_ASSET_SCOPE,
                new ArrayList<>());
        return new InternalConfig(keywords, regexPatterns, passwords, serverAssetsBySystem);
    }

    @Transactional
    public ScannerConfigDto updateConfig(UpdateScannerConfigRequest request, String updatedBy) {
        if (request == null) {
            throw new IllegalArgumentException("配置内容不能为空");
        }

        List<String> keywords = normalizeValues(request.getFieldKeywords(), 100, 40, "字段关键词");
        if (keywords.isEmpty()) {
            throw new IllegalArgumentException("至少保留一个字段关键词");
        }

        List<String> regexPatterns = normalizeValues(request.getRegexPatterns(), 50, 500, "正则规则");
        for (String regex : regexPatterns) {
            if (UNSAFE_NESTED_QUANTIFIER.matcher(regex).find()) {
                throw new IllegalArgumentException("正则规则包含可能导致性能问题的嵌套量词：" + regex);
            }
            try {
                Pattern.compile(regex);
            } catch (PatternSyntaxException ex) {
                throw new IllegalArgumentException("正则规则无效：" + regex);
            }
        }

        InternalConfig existingConfig = getInternalConfig();
        Set<String> retainedIds = new LinkedHashSet<>(safeList(request.getRetainedKnownPasswordIds()));
        List<KnownPasswordFingerprint> passwords = existingConfig.getKnownPasswords().stream()
                .filter(item -> retainedIds.contains(item.getId()))
                .collect(Collectors.toCollection(ArrayList::new));

        List<String> newPasswords = normalizeValues(request.getNewKnownPasswords(), 200, 128, "已知密码");
        for (String password : newPasswords) {
            if (password.length() < 4) {
                throw new IllegalArgumentException("已知密码长度不能少于 4 个字符");
            }
            String fingerprint = sha256(password);
            boolean exists = passwords.stream().anyMatch(item -> item.getFingerprint().equals(fingerprint));
            if (!exists) {
                passwords.add(new KnownPasswordFingerprint(UUID.randomUUID().toString(), fingerprint, mask(password)));
            }
        }
        if (passwords.size() > 200) {
            throw new IllegalArgumentException("已知密码最多配置 200 条");
        }

        Map<String, List<String>> requestedAssets = request.getServerAssetNamesBySystem() == null
                ? Collections.emptyMap() : request.getServerAssetNamesBySystem();
        Map<String, List<String>> serverAssetsBySystem = new LinkedHashMap<>();
        for (String systemCode : Arrays.asList(
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM,
                ChangeStepBusinessValidationService.SYSTEM_WECHAT,
                ChangeStepBusinessValidationService.SYSTEM_ONLINE_BANKING,
                ChangeStepBusinessValidationService.TREASURY_SAAS_ASSET_SCOPE,
                ChangeStepBusinessValidationService.TREASURY_NT_ASSET_SCOPE)) {
            List<String> values = requestedAssets.get(systemCode);
            if (values == null && ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM.equals(systemCode)) {
                values = request.getServerAssetNames();
            }
            if (values == null) {
                values = existingConfig.getServerAssetNames(systemCode);
            }
            List<String> normalizedAssets = normalizeValues(values, 2000, 64,
                    systemName(systemCode) + "服务器资产名称").stream()
                    .map(value -> value.toUpperCase(Locale.ROOT))
                    .collect(Collectors.toList());
            serverAssetsBySystem.put(systemCode, normalizedAssets);
        }

        saveJson(KEYWORDS_KEY, keywords, "需要识别的密码字段关键词", updatedBy);
        saveJson(REGEX_KEY, regexPatterns, "用于识别疑似密码的正则表达式", updatedBy);
        saveJson(PASSWORDS_KEY, passwords, "已知密码的 SHA-256 指纹（不保存原文）", updatedBy);
        saveJson(SERVER_ASSETS_KEY,
                serverAssetsBySystem.get(ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM),
                "中台服务器资产名称清单（兼容旧版本）", updatedBy);
        saveJson(SERVER_ASSETS_BY_SYSTEM_KEY, serverAssetsBySystem, "按业务系统维护的服务器资产名称清单", updatedBy);
        return getPublicConfig();
    }

    public static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(bytes.length * 2);
            for (byte item : bytes) {
                result.append(String.format("%02x", item));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("当前环境不支持 SHA-256", ex);
        }
    }

    private List<String> readStringList(String key, List<String> defaults) {
        return repository.findByParamKey(key)
                .map(SystemParameter::getParamValue)
                .map(value -> {
                    try {
                        return objectMapper.readValue(value, new TypeReference<List<String>>() {});
                    } catch (Exception ex) {
                        return new ArrayList<>(defaults);
                    }
                })
                .orElseGet(() -> new ArrayList<>(defaults));
    }

    private List<KnownPasswordFingerprint> readPasswords() {
        return repository.findByParamKey(PASSWORDS_KEY)
                .map(SystemParameter::getParamValue)
                .map(value -> {
                    try {
                        return objectMapper.readValue(value, new TypeReference<List<KnownPasswordFingerprint>>() {});
                    } catch (Exception ex) {
                        return new ArrayList<KnownPasswordFingerprint>();
                    }
                })
                .orElseGet(ArrayList::new);
    }

    private Map<String, List<String>> readStringListMap(String key) {
        return repository.findByParamKey(key)
                .map(SystemParameter::getParamValue)
                .map(value -> {
                    try {
                        Map<String, List<String>> parsed = objectMapper.readValue(value,
                                new TypeReference<Map<String, List<String>>>() {});
                        return parsed == null ? new LinkedHashMap<String, List<String>>() : new LinkedHashMap<>(parsed);
                    } catch (Exception ex) {
                        return new LinkedHashMap<String, List<String>>();
                    }
                })
                .orElseGet(LinkedHashMap::new);
    }

    private String systemName(String systemCode) {
        if (ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM.equals(systemCode)) return "中台";
        if (ChangeStepBusinessValidationService.SYSTEM_WECHAT.equals(systemCode)) return "微信";
        if (ChangeStepBusinessValidationService.SYSTEM_ONLINE_BANKING.equals(systemCode)) return "网银";
        if (ChangeStepBusinessValidationService.SYSTEM_TREASURY.equals(systemCode)) return "财资";
        if (ChangeStepBusinessValidationService.TREASURY_SAAS_ASSET_SCOPE.equals(systemCode)) return "财资 SaaS";
        if (ChangeStepBusinessValidationService.TREASURY_NT_ASSET_SCOPE.equals(systemCode)) return "财资 NT";
        return systemCode;
    }

    private List<String> normalizeValues(List<String> values, int maxItems, int maxLength, String label) {
        LinkedHashSet<String> normalized = safeList(values).stream()
                .filter(value -> value != null && !value.trim().isEmpty())
                .map(String::trim)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (normalized.size() > maxItems) {
            throw new IllegalArgumentException(label + "最多配置 " + maxItems + " 条");
        }
        for (String value : normalized) {
            if (value.length() > maxLength) {
                throw new IllegalArgumentException(label + "单条长度不能超过 " + maxLength + " 个字符");
            }
        }
        return new ArrayList<>(normalized);
    }

    private List<String> safeList(List<String> values) {
        return values == null ? Collections.emptyList() : values;
    }

    private void saveJson(String key, Object value, String description, String updatedBy) {
        try {
            SystemParameter parameter = repository.findByParamKey(key).orElseGet(SystemParameter::new);
            parameter.setParamKey(key);
            parameter.setParamValue(objectMapper.writeValueAsString(value));
            parameter.setParamType("JSON");
            parameter.setCategory(CATEGORY);
            parameter.setDescription(description);
            parameter.setUpdatedBy(updatedBy == null || updatedBy.trim().isEmpty() ? "system" : updatedBy);
            repository.save(parameter);
        } catch (Exception ex) {
            throw new IllegalStateException("保存扫描配置失败", ex);
        }
    }

    private String mask(String password) {
        if (password.length() <= 4) {
            return password.substring(0, 1) + "***";
        }
        return password.substring(0, 1) + "*".repeat(Math.min(password.length() - 2, 10))
                + password.substring(password.length() - 1);
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InternalConfig {
        private List<String> fieldKeywords;
        private List<String> regexPatterns;
        private List<KnownPasswordFingerprint> knownPasswords;
        private Map<String, List<String>> serverAssetNamesBySystem;

        public InternalConfig(List<String> fieldKeywords,
                              List<String> regexPatterns,
                              List<KnownPasswordFingerprint> knownPasswords) {
            this(fieldKeywords, regexPatterns, knownPasswords, new LinkedHashMap<>());
        }

        public InternalConfig(List<String> fieldKeywords,
                              List<String> regexPatterns,
                              List<KnownPasswordFingerprint> knownPasswords,
                              List<String> serverAssetNames) {
            this(fieldKeywords, regexPatterns, knownPasswords, new LinkedHashMap<>());
            this.serverAssetNamesBySystem.put(ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM,
                    serverAssetNames == null ? new ArrayList<>() : new ArrayList<>(serverAssetNames));
        }

        public List<String> getServerAssetNames(String systemCode) {
            if (serverAssetNamesBySystem == null) return Collections.emptyList();
            List<String> values = serverAssetNamesBySystem.get(systemCode);
            return values == null ? Collections.emptyList() : values;
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KnownPasswordFingerprint {
        private String id;
        private String fingerprint;
        private String maskedValue;
    }
}
