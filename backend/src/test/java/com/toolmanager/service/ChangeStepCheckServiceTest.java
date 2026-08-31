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
import java.util.Arrays;
import java.util.Collections;

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
        service = new ChangeStepCheckService(configService);
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
        assertThat(result.getRisks()).filteredOn(item -> "表格".equals(item.getLocation()))
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
}
