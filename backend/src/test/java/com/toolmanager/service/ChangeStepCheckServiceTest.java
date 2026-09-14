package com.toolmanager.service;

import com.toolmanager.dto.ChangeStepCheckDtos.RiskItemDto;
import com.toolmanager.dto.ChangeStepCheckDtos.ScanResultDto;
import com.toolmanager.service.ChangeStepCheckConfigService.InternalConfig;
import com.toolmanager.service.ChangeStepCheckConfigService.KnownPasswordFingerprint;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChangeStepCheckServiceTest {
    @Mock
    private ChangeStepCheckConfigService configService;

    private ChangeStepCheckService service;

    @BeforeEach
    void setUp() {
        service = new ChangeStepCheckService(configService, new ChangeStepBusinessValidationService());
    }

    @Test
    void scansParagraphsTablesPatternsAndFingerprintsWithContext() throws Exception {
        String knownPassword = "ProdSecret99!";
        when(configService.getInternalConfig()).thenReturn(new InternalConfig(
                Arrays.asList("password", "pass", "key"),
                Collections.singletonList("(?i)\\bsrcb\\d{4,}\\b"),
                Collections.singletonList(new KnownPasswordFingerprint(
                        "known-1", ChangeStepCheckConfigService.sha256(knownPassword), "P**********!"))
        ));

        byte[] document = createDocx(knownPassword);
        MockMultipartFile file = new MockMultipartFile(
                "file", "上线变更步骤.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document", document);

        ScanResultDto result = service.scan(file);

        assertThat(result.getFileName()).isEqualTo("上线变更步骤.docx");
        assertThat(result.getSummary().getTotal()).isEqualTo(4);
        assertThat(result.getSummary().getFieldMatches()).isEqualTo(2);
        assertThat(result.getSummary().getPasswordMatches()).isEqualTo(2);
        assertThat(result.getRisks()).extracting(RiskItemDto::getRiskType)
                .containsExactlyInAnyOrder("FIELD_KEYWORD", "PASSWORD_PATTERN", "KNOWN_PASSWORD", "FIELD_KEYWORD");

        RiskItemDto passwordRisk = result.getRisks().stream()
                .filter(item -> "PASSWORD_PATTERN".equals(item.getRiskType()))
                .findFirst().orElseThrow(AssertionError::new);
        assertThat(passwordRisk.getMatchedText()).isEqualTo("srcb1234");
        assertThat(passwordRisk.getContextBefore()).isEqualTo("1. 停止应用服务");
        assertThat(passwordRisk.getContextAfter()).contains("ProdSecret99!");
        assertThat(passwordRisk.getLocation()).isEqualTo("正文");

        assertThat(result.getRisks()).filteredOn(item -> "KNOWN_PASSWORD".equals(item.getRiskType()))
                .singleElement()
                .satisfies(item -> {
                    assertThat(item.getMatchedText()).isEqualTo(knownPassword);
                    assertThat(item.getRule()).contains("P**********!");
                });
        assertThat(result.getRisks()).filteredOn(item -> item.getLocation().startsWith("表格#"))
                .singleElement()
                .satisfies(item -> assertThat(item.getContextLine()).contains("key: temporary-value"));
    }

    @Test
    void rejectsUnsupportedFilesBeforeReadingContent() {
        MockMultipartFile file = new MockMultipartFile("file", "steps.txt", "text/plain", "password=abc".getBytes());

        assertThatThrownBy(() -> service.scan(file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("仅支持 .doc 或 .docx");
    }

    @Test
    void scansRawFileStreamWithoutMultipartParsing() throws Exception {
        when(configService.getInternalConfig()).thenReturn(new InternalConfig(
                Collections.singletonList("password"),
                Collections.singletonList("(?i)\\bsrcb\\d{4,}\\b"),
                Collections.emptyList()
        ));
        byte[] document = createDocx("another-secret");

        ScanResultDto result = service.scan(
                "raw-upload.docx", document.length, new ByteArrayInputStream(document));

        assertThat(result.getSummary().getTotal()).isEqualTo(2);
        assertThat(result.getRisks()).extracting(RiskItemDto::getRiskType)
                .containsExactlyInAnyOrder("FIELD_KEYWORD", "PASSWORD_PATTERN");
    }

    @Test
    void scansWechatManualDocxThroughTableParserAndSystemProfile() throws Exception {
        Map<String, List<String>> assets = new LinkedHashMap<>();
        assets.put(ChangeStepBusinessValidationService.SYSTEM_WECHAT,
                Arrays.asList("EWBS01WEB", "EWBS01APP"));
        when(configService.getInternalConfig()).thenReturn(new InternalConfig(
                Collections.singletonList("password"),
                Collections.emptyList(),
                Collections.emptyList(),
                assets));

        byte[] document = createWechatManualDocx();
        ScanResultDto result = service.scan(
                "企业微信银行系统变更实施步骤(手动)-20260903.docx",
                document.length,
                new ByteArrayInputStream(document),
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_WECHAT,
                null);

        assertThat(result.getSystemName()).isEqualTo("微信");
        assertThat(result.getValidationChecks()).allMatch(item -> "PASSED".equals(item.getStatus()));
        assertThat(result.getValidationChecks()).extracting(item -> item.getCode())
                .contains("SYSTEM_TITLE_FORMAT", "MANUAL_SERVER_IP_FORMAT", "MANUAL_SERVER_ASSET_MATCH");
    }

    @Test
    void generatedTestDocumentsProduceExpectedPassAndFailResults() throws Exception {
        Map<String, List<String>> assets = new LinkedHashMap<>();
        assets.put(ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM,
                Arrays.asList("ECSS01RAC", "ECSS01APP", "ECSS02APP", "ECSS01PM"));
        assets.put(ChangeStepBusinessValidationService.SYSTEM_WECHAT,
                Arrays.asList("EWBS01WEB", "EWBS01APP"));
        assets.put(ChangeStepBusinessValidationService.SYSTEM_ONLINE_BANKING,
                Arrays.asList("EIBS3G01XCWEB", "EIBS3G02XCWEB", "EIBS3G01XCAPPJDT", "eibs3g01db"));
        when(configService.getInternalConfig()).thenReturn(new InternalConfig(
                Collections.singletonList("password"), Collections.emptyList(), Collections.emptyList(), assets));

        assertDocumentStatus("企业微信银行系统 变更实施步骤(DevOps2G自动)-20260912.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_WECHAT, 9, "FAILED");
        assertDocumentStatus("企业渠道支撑系统变更步骤DevOps2G自动-20260912.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM, 12, "FAILED");
        assertDocumentStatus("企业微信银行系统变更实施步骤-手动-20260912.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_WECHAT, 10, "FAILED");
        assertDocumentStatus("企业渠道支撑系统 变更步骤-手动-20260912.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM, 8, "FAILED");
        assertDocumentStatus("企业微信银行系统变更实施步骤(DevOps2G自动)-20260911.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_WECHAT, 9, "PASSED");
        assertDocumentStatus("企业微信银行系统变更实施步骤(手动)-20260911.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_WECHAT, 10, "PASSED");
        assertDocumentStatus("企业渠道支撑系统变更步骤DevOps2G-自动变更-20260911.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM,
                "企业渠道支撑系统变更步骤-手动-20260911.docx", 12, "PASSED");
        assertDocumentStatus("企业渠道支撑系统变更步骤-手动-20260911.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM, 8, "PASSED");
        assertDocumentStatus("企业网上银行系统三代 (EIBS3G)变更步骤-手动-20260915.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_ONLINE_BANKING, 9, "FAILED");
        assertDocumentStatus("企业网上银行系统三代(EIBS3G)变更步骤-DevOps2G 自动-20260915.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_ONLINE_BANKING, 10, "FAILED");
        assertDocumentStatus("企业网上银行系统三代(EIBS3G)变更步骤-手动-20260914.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_ONLINE_BANKING, 9, "PASSED");
        assertDocumentStatus("企业网上银行系统三代(EIBS3G)变更步骤-DevOps2G自动-20260914.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_ONLINE_BANKING, 10, "PASSED");
    }

    private byte[] createDocx(String knownPassword) throws Exception {
        try (XWPFDocument document = new XWPFDocument();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            document.createParagraph().createRun().setText("1. 停止应用服务");
            document.createParagraph().createRun().setText("2. password = srcb1234");
            document.createParagraph().createRun().setText("3. 回滚口令 " + knownPassword);
            XWPFTable table = document.createTable(1, 2);
            table.getRow(0).getCell(0).setText("检查项");
            table.getRow(0).getCell(1).setText("key: temporary-value");
            document.write(output);
            return output.toByteArray();
        }
    }

    private byte[] createWechatManualDocx() throws Exception {
        try (XWPFDocument document = new XWPFDocument();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            document.createParagraph().createRun().setText("企业微信银行系统变更方案");
            document.createParagraph().createRun().setText("手动变更实施步骤*");
            document.createParagraph().createRun().setText("生产环境（实施时间：2026-09-03）");
            XWPFTable table = document.createTable(3, 3);
            table.getRow(0).getCell(0).setText("");
            table.getRow(0).getCell(1).setText("IP、主机名、用户");
            table.getRow(0).getCell(2).setText("具体步骤");
            table.getRow(1).getCell(0).setText("步骤1*");
            table.getRow(1).getCell(1).setText("172.19.214.6、EWBS01WEB、wasadmin");
            table.getRow(1).getCell(2).setText("执行变更");
            table.getRow(2).getCell(0).setText("步骤2*");
            table.getRow(2).getCell(1).setText("172.19.211.64、EWBS01APP、weix");
            table.getRow(2).getCell(2).setText("启动应用");
            document.createParagraph().createRun().setText("变更验证方案*");
            document.write(output);
            return output.toByteArray();
        }
    }

    private void assertDocumentStatus(String fileName, String documentType,
                                      String systemCode, int expectedCheckCount,
                                      String expectedStatus) throws Exception {
        assertDocumentStatus(fileName, documentType, systemCode, null, expectedCheckCount, expectedStatus);
    }

    private void assertDocumentStatus(String fileName, String documentType,
                                      String systemCode, String companionManualFileName,
                                      int expectedCheckCount, String expectedStatus) throws Exception {
        Path path = Path.of("..", "samples", "change-step-check", fileName);
        byte[] bytes = Files.readAllBytes(path);
        ScanResultDto result = service.scan(fileName, bytes.length, new ByteArrayInputStream(bytes),
                documentType, systemCode, companionManualFileName);
        assertThat(result.getValidationEngineVersion()).isEqualTo(ChangeStepCheckService.VALIDATION_ENGINE_VERSION);
        assertThat(result.getValidationChecks())
                .as(fileName)
                .hasSize(expectedCheckCount)
                .allMatch(item -> expectedStatus.equals(item.getStatus()),
                        "all business checks should be " + expectedStatus);
        assertThat(result.getValidationSummary().getTotal()).isEqualTo(expectedCheckCount);
        assertThat(result.getValidationSummary().getFailed())
                .isEqualTo("FAILED".equals(expectedStatus) ? expectedCheckCount : 0);
        assertThat(result.getValidationSummary().getPassed())
                .isEqualTo("PASSED".equals(expectedStatus) ? expectedCheckCount : 0);
    }
}
