package com.toolmanager.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.toolmanager.dto.ConfigSettingDto;
import com.toolmanager.dto.MockPacketConfigDto;
import com.toolmanager.dto.MockPacketGenerateResponseDto;
import com.toolmanager.dto.MockPacketPayloadDto;
import com.toolmanager.dto.MockPacketQueryRequestDto;
import com.toolmanager.dto.MockPacketTransactionTypeDto;
import com.toolmanager.dto.MockPacketTransactionTypesResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.Reader;
import java.sql.Clob;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MockPacketService {
    private static final String CONFIG_KEY = "mock-packet-oracle-config";
    private static final String CONFIG_TYPE = "mock-packet";
    private static final String CONFIG_DESCRIPTION = "模拟报文生成 Oracle 配置";

    private static final String DEFAULT_HOST = "10.20.75.40";
    private static final String DEFAULT_PORT = "1521";
    private static final String DEFAULT_SERVICE_NAME = "ecss";
    private static final String DEFAULT_USERNAME = "ICHANNEL";
    private static final String DEFAULT_PASSWORD = "Seiitm+252";

    private static final String TRANS_TYPES_SQL =
            "SELECT DISTINCT cpt.TRANS_CODE AS TRANS_CODE, cp.PRD_NAME AS PRD_NAME " +
            "FROM CH_PRD_TRANS cpt " +
            "INNER JOIN CH_PRD cp ON cpt.PRD_ID = cp.PRD_ID " +
            "INNER JOIN CH_CHANNEL_PRD_OPEN ccpo ON cp.PRD_ID = ccpo.PRD_ID " +
            "AND ccpo.CHANNEL_ID = '166000' " +
            "AND ccpo.athr_type = '01'";

    private static final String PAYLOAD_SQL =
            "SELECT caqd.ENTRY_DATA " +
            "FROM CH_ATHR_QUEUE_DATA caqd, CH_ATHR_QUEUE caq, ICUSTOMER.CTM_CIF cc " +
            "WHERE caqd.ENTRY_NO = caq.ENTRY_NO " +
            "AND caqd.STATUS = '11' " +
            "AND caq.TRANS_CODE = ? " +
            "FETCH FIRST 1 ROWS ONLY";

    private final ConfigSettingService configSettingService;
    private final ObjectMapper objectMapper;

    public MockPacketConfigDto loadConfig() {
        ConfigSettingDto configSetting = configSettingService.getConfigByKey(CONFIG_KEY);
        if (configSetting == null || isBlank(configSetting.getConfigValue())) {
            return defaultConfig();
        }

        try {
            MockPacketConfigDto config = objectMapper.readValue(configSetting.getConfigValue(), MockPacketConfigDto.class);
            return normalizeConfig(config);
        } catch (IOException e) {
            log.warn("Failed to parse mock packet config, falling back to defaults", e);
            return defaultConfig();
        }
    }

    public MockPacketConfigDto saveConfig(MockPacketConfigDto config, String updatedBy) {
        MockPacketConfigDto normalized = normalizeConfig(config);
        try {
            configSettingService.saveConfig(new ConfigSettingDto(
                    null,
                    CONFIG_KEY,
                    objectMapper.writeValueAsString(normalized),
                    CONFIG_TYPE,
                    CONFIG_DESCRIPTION,
                    null,
                    null,
                    isBlank(updatedBy) ? "system" : updatedBy
            ));
            return normalized;
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("模拟报文配置保存失败", e);
        }
    }

    public Map<String, Object> testConnection(MockPacketQueryRequestDto request) {
        MockPacketConfigDto resolvedConfig = resolveConfig(request == null ? null : request.getConfig());
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("resolvedConfig", resolvedConfig);

        try (Connection connection = openConnection(resolvedConfig);
             Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(8);
            statement.executeQuery("SELECT 1 FROM DUAL").close();
            response.put("success", true);
            response.put("message", "Oracle 连接成功。");
            return response;
        } catch (Exception e) {
            log.warn("Mock packet Oracle connection test failed: {}", sanitizeError(e.getMessage()));
            response.put("success", false);
            response.put("message", "Oracle 连接失败。");
            return response;
        }
    }

    public MockPacketTransactionTypesResponseDto loadTransactionTypes(MockPacketQueryRequestDto request) {
        MockPacketConfigDto resolvedConfig = resolveConfig(request == null ? null : request.getConfig());
        try (Connection connection = openConnection(resolvedConfig);
             Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(12);
            List<MockPacketTransactionTypeDto> transactionTypes = new ArrayList<>();
            try (ResultSet rs = statement.executeQuery(TRANS_TYPES_SQL)) {
                while (rs.next()) {
                    transactionTypes.add(new MockPacketTransactionTypeDto(
                            rs.getString("TRANS_CODE"),
                            rs.getString("PRD_NAME")
                    ));
                }
            }

            if (transactionTypes.isEmpty()) {
                return new MockPacketTransactionTypesResponseDto(
                        true,
                        true,
                        "Oracle 已连接，但未查到可用交易类型，已切换为示例交易类型。",
                        resolvedConfig,
                        sampleTransactionTypes()
                );
            }

            return new MockPacketTransactionTypesResponseDto(
                    true,
                    false,
                    "已从 Oracle 加载 " + transactionTypes.size() + " 个交易类型。",
                    resolvedConfig,
                    transactionTypes
            );
        } catch (Exception e) {
            log.warn("Load transaction types failed, using fallback: {}", sanitizeError(e.getMessage()));
            return new MockPacketTransactionTypesResponseDto(
                    true,
                    true,
                    "查询数据库失败，已展示示例交易类型。原因：" + sanitizeError(e.getMessage()),
                    resolvedConfig,
                    sampleTransactionTypes()
            );
        }
    }

    public MockPacketGenerateResponseDto generatePackets(MockPacketQueryRequestDto request) {
        List<MockPacketTransactionTypeDto> selectedTypes = sanitizeSelectedTypes(request == null ? null : request.getSelectedTypes());
        if (selectedTypes.isEmpty()) {
            return new MockPacketGenerateResponseDto(false, false, "请先选择交易类型。", new ArrayList<>());
        }

        MockPacketConfigDto resolvedConfig = resolveConfig(request == null ? null : request.getConfig());
        try (Connection connection = openConnection(resolvedConfig)) {
            List<MockPacketPayloadDto> packets = new ArrayList<>();

            for (MockPacketTransactionTypeDto selectedType : selectedTypes) {
                MockPacketPayloadDto payload = loadPayloadForSelection(connection, selectedType);
                if (payload != null) {
                    packets.add(payload);
                }
            }

            if (packets.isEmpty()) {
                return new MockPacketGenerateResponseDto(false, false, "请选择不是查询类型的交易码", new ArrayList<>());
            }

            return new MockPacketGenerateResponseDto(true, false, "已加载最新报文。", packets);
        } catch (Exception e) {
            log.warn("Generate packets failed: {}", sanitizeError(e.getMessage()));
            return new MockPacketGenerateResponseDto(
                    false,
                    false,
                    "加载失败。",
                    new ArrayList<>()
            );
        }
    }

    private MockPacketPayloadDto loadPayloadForSelection(Connection connection, MockPacketTransactionTypeDto selectedType) throws SQLException, IOException {
        try (PreparedStatement statement = connection.prepareStatement(PAYLOAD_SQL)) {
            statement.setQueryTimeout(12);
            statement.setString(1, selectedType.getTransCode());
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                String rawPayload = readPayload(rs, 1);
                if (isBlank(rawPayload)) {
                    return null;
                }
                return new MockPacketPayloadDto(
                        selectedType.getTransCode(),
                        safePrdName(selectedType),
                        rawPayload,
                        toDisplayJson(rawPayload),
                        false,
                        "实时报文",
                        "",
                        1
                );
            }
        }
    }

    private String readPayload(ResultSet rs, int columnIndex) throws SQLException, IOException {
        Clob clob = rs.getClob(columnIndex);
        if (clob != null) {
            try (Reader reader = clob.getCharacterStream()) {
                StringBuilder sb = new StringBuilder();
                char[] buffer = new char[2048];
                int len;
                while ((len = reader.read(buffer)) != -1) {
                    sb.append(buffer, 0, len);
                }
                return sb.toString();
            }
        }
        return rs.getString(columnIndex);
    }

    private MockPacketConfigDto resolveConfig(MockPacketConfigDto overrideConfig) {
        MockPacketConfigDto base = loadConfig();
        if (overrideConfig == null) {
            return normalizeConfig(base);
        }

        return normalizeConfig(new MockPacketConfigDto(
                choose(overrideConfig.getHost(), base.getHost(), DEFAULT_HOST),
                choose(overrideConfig.getPort(), base.getPort(), DEFAULT_PORT),
                choose(overrideConfig.getServiceName(), base.getServiceName(), DEFAULT_SERVICE_NAME),
                choose(overrideConfig.getUsername(), base.getUsername(), DEFAULT_USERNAME),
                choose(overrideConfig.getPassword(), base.getPassword(), DEFAULT_PASSWORD)
        ));
    }

    private MockPacketConfigDto normalizeConfig(MockPacketConfigDto config) {
        if (config == null) {
            return defaultConfig();
        }
        return new MockPacketConfigDto(
                choose(config.getHost(), DEFAULT_HOST),
                choose(config.getPort(), DEFAULT_PORT),
                choose(config.getServiceName(), DEFAULT_SERVICE_NAME),
                choose(config.getUsername(), DEFAULT_USERNAME),
                choose(config.getPassword(), DEFAULT_PASSWORD)
        );
    }

    private MockPacketConfigDto defaultConfig() {
        return new MockPacketConfigDto(
                DEFAULT_HOST,
                DEFAULT_PORT,
                DEFAULT_SERVICE_NAME,
                DEFAULT_USERNAME,
                DEFAULT_PASSWORD
        );
    }

    private Connection openConnection(MockPacketConfigDto config) throws SQLException, ClassNotFoundException {
        Class.forName("oracle.jdbc.OracleDriver");
        DriverManager.setLoginTimeout(10);
        Properties properties = new Properties();
        properties.setProperty("user", config.getUsername());
        properties.setProperty("password", config.getPassword());
        properties.setProperty("oracle.net.CONNECT_TIMEOUT", "10000");
        properties.setProperty("oracle.jdbc.ReadTimeout", "12000");
        properties.setProperty("oracle.net.READ_TIMEOUT", "12000");
        return DriverManager.getConnection(buildJdbcUrl(config), properties);
    }

    private String buildJdbcUrl(MockPacketConfigDto config) {
        return "jdbc:oracle:thin:@//" + config.getHost() + ":" + config.getPort() + "/" + config.getServiceName();
    }

    private List<MockPacketTransactionTypeDto> sanitizeSelectedTypes(List<MockPacketTransactionTypeDto> selectedTypes) {
        if (selectedTypes == null) {
            return new ArrayList<>();
        }
        return selectedTypes.stream()
                .filter(item -> item != null && !isBlank(item.getTransCode()))
                .collect(Collectors.toList());
    }

    private List<MockPacketTransactionTypeDto> sampleTransactionTypes() {
        List<MockPacketTransactionTypeDto> samples = new ArrayList<>();
        samples.add(new MockPacketTransactionTypeDto("apiTrdCapitalPoolTransService.manualCashOut", "手工清款"));
        samples.add(new MockPacketTransactionTypeDto("apiTrdCapitalPoolTransService.cashOutApply", "请款申请"));
        samples.add(new MockPacketTransactionTypeDto("apiTrdBankOuterPayService.rcbTransfer", "农信银转账"));
        samples.add(new MockPacketTransactionTypeDto("apiPrdDiscountService.secondStick", "盈利贴"));
        samples.add(new MockPacketTransactionTypeDto("apiPrdEndorseService.apply", "背书转让申请"));
        samples.add(new MockPacketTransactionTypeDto("apiPrdEndorseService.sign", "背书转让签收"));
        samples.add(new MockPacketTransactionTypeDto("apiTrdLargeDepositService.apply", "大额存单入池"));
        samples.add(new MockPacketTransactionTypeDto("apiPrdNoticeReceiveService.ticket", "提示收票申请"));
        return samples;
    }

    private String toDisplayJson(String rawPayload) {
        if (isBlank(rawPayload)) {
            return "{}";
        }

        String trimmed = rawPayload.trim();
        try {
            JsonNode tree = objectMapper.readTree(trimmed);
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(tree);
        } catch (IOException ignored) {
            // try decoding nested JSON string below
        }

        try {
            String decoded = objectMapper.readValue(trimmed, String.class);
            if (!isBlank(decoded) && !decoded.equals(trimmed)) {
                return toDisplayJson(decoded);
            }
        } catch (IOException ignored) {
            // fall through to wrap raw payload
        }

        Map<String, Object> wrapper = new LinkedHashMap<>();
        wrapper.put("rawEntryData", trimmed);
        wrapper.put("note", "原始报文不是标准 JSON，已按文本形式封装展示。");
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(wrapper);
        } catch (JsonProcessingException e) {
            return trimmed;
        }
    }

    private String choose(String primary, String fallback) {
        return isBlank(primary) ? fallback : primary.trim();
    }

    private String choose(String primary, String fallback, String defaultValue) {
        if (!isBlank(primary)) {
            return primary.trim();
        }
        if (!isBlank(fallback)) {
            return fallback.trim();
        }
        return defaultValue;
    }

    private String sanitizeError(String message) {
        if (isBlank(message)) {
            return "未知错误";
        }
        return message.replaceAll("(?i)(password|passwd|pwd)\\s*=\\s*[^;\\s]+", "$1=***");
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String safePrdName(MockPacketTransactionTypeDto selectedType) {
        return isBlank(selectedType.getPrdName()) ? selectedType.getTransCode() : selectedType.getPrdName();
    }
}
