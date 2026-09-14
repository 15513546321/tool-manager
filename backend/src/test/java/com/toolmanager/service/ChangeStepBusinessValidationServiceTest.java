package com.toolmanager.service;

import com.toolmanager.dto.ChangeStepCheckDtos.ValidationCheckDto;
import com.toolmanager.service.ChangeStepBusinessValidationService.TextSegment;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ChangeStepBusinessValidationServiceTest {
    private final ChangeStepBusinessValidationService service = new ChangeStepBusinessValidationService();

    @Test
    void automaticChangePassesAllRequiredChecksWhenCompanionIsSelected() {
        String manualFileName = "企业渠道支撑系统变更步骤-手动-20260910.docx";
        List<TextSegment> segments = automaticSegments(manualFileName, "prod", "20260910", "ecss-release");

        List<ValidationCheckDto> checks = service.validate(
                "企业渠道支撑系统变更步骤DevOps2G-自动变更-20260910.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM,
                manualFileName,
                segments);

        assertThat(checks).hasSize(12).allMatch(item -> "PASSED".equals(item.getStatus()));
    }

    @Test
    void automaticChangeAllowsMissingCompanionAndReturnsWarningAfterFormatCheck() {
        String manualFileName = "企业渠道支撑系统变更步骤-手动-20260910.docx";

        List<ValidationCheckDto> checks = service.validate(
                "企业渠道支撑系统变更步骤DevOps2G-自动变更-20260910.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM,
                null,
                automaticSegments(manualFileName, "prod", "20260910", "ecss-release"));

        assertThat(checks).filteredOn(item -> "AUTO_MANUAL_FILE_REFERENCE".equals(item.getCode()))
                .singleElement().satisfies(item -> {
                    assertThat(item.getStatus()).isEqualTo("WARNING");
                    assertThat(item.getMessage()).contains("未选择配套手动文件");
                });
    }

    @Test
    void fileNameMustUseExactMiddlePlatformConvention() {
        List<TextSegment> segments = manualSegments("ECSS01APP", "ecss");

        List<ValidationCheckDto> checks = service.validate(
                "企业渠道 支撑系统变更步骤-20260910.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM,
                null,
                segments,
                Collections.singletonList("ECSS01APP"));

        assertThat(checks).filteredOn(item -> "FILE_NAME_FORMAT".equals(item.getCode()))
                .singleElement().satisfies(item -> {
                    assertThat(item.getStatus()).isEqualTo("FAILED");
                    assertThat(item.getMessage()).contains("空格");
                });
    }

    @Test
    void numberingRejectsJumpAndDuplicateAtBothLevels() {
        List<TextSegment> segments = Arrays.asList(
                line(1, "变更实施步骤*"),
                line(2, "生产环境（实施时间：20260910）"),
                line(3, "1 变更准备"),
                line(4, "1.1 停止服务"),
                line(5, "1.1 上传文件"),
                line(6, "3 启动服务"),
                serverHeader(7),
                serverRow(8, "ECSS01APP", "ecss"),
                line(9, "变更验证方案*")
        );

        List<ValidationCheckDto> checks = service.validate(
                "企业渠道支撑系统变更步骤-手动-20260910.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM,
                null,
                segments,
                Collections.singletonList("ECSS01APP"));

        assertThat(checks).filteredOn(item -> "SECTION_NUMBER_CONTINUITY".equals(item.getCode()))
                .singleElement().satisfies(item -> {
                    assertThat(item.getStatus()).isEqualTo("FAILED");
                    assertThat(item.getMessage()).contains("期望 1.2", "一级编号期望 2");
                });
    }

    @Test
    void manualServerRowsRequirePairsValidNamesAndKnownAssets() {
        List<TextSegment> segments = manualSegments("server-01", "");

        List<ValidationCheckDto> checks = service.validate(
                "企业渠道支撑系统变更步骤-手动-20260910.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM,
                null,
                segments,
                Collections.singletonList("ECSS01APP"));

        assertFailed(checks, "MANUAL_SERVER_USER_PAIR");
        assertFailed(checks, "MANUAL_SERVER_NAME_FORMAT");
        assertFailed(checks, "MANUAL_SERVER_ASSET_MATCH");
    }

    @Test
    void manualServerAssetCheckWarnsWhenAssetListIsNotConfigured() {
        List<ValidationCheckDto> checks = service.validate(
                "企业渠道支撑系统变更步骤-手动-20260910.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM,
                null,
                manualSegments("ECSS01APP", "ecss"),
                Collections.emptyList());

        assertThat(checks).filteredOn(item -> "MANUAL_SERVER_ASSET_MATCH".equals(item.getCode()))
                .singleElement().satisfies(item -> assertThat(item.getStatus()).isEqualTo("WARNING"));
    }

    @Test
    void automaticDevOpsFieldsMustBePresentAndProductionMustBeProd() {
        List<ValidationCheckDto> checks = service.validate(
                "企业渠道支撑系统变更步骤DevOps2G-自动变更-20260910.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM,
                null,
                automaticSegments("企业渠道支撑系统变更步骤-手动-20260910.docx", "production", "", ""));

        assertFailed(checks, "AUTO_DEVOPS_ENVIRONMENT");
        assertFailed(checks, "AUTO_DEVOPS_CHANGE_DATE");
        assertFailed(checks, "AUTO_ARTIFACT_REPOSITORY_REQUIRED");
    }

    @Test
    void dangerousCommandFailsWithoutBackupAndWarnsWithPriorBackup() {
        List<TextSegment> withoutBackup = Arrays.asList(
                line(1, "变更实施前备份*"),
                line(2, "本次无需备份"),
                line(3, "变更实施步骤*"),
                line(4, "生产环境（实施时间：20260910）"),
                line(5, "1 变更执行"),
                line(6, "rm -rf /"),
                serverHeader(7),
                serverRow(8, "ECSS01APP", "ecss")
        );
        List<ValidationCheckDto> failedChecks = service.validate(
                "企业渠道支撑系统变更步骤-手动-20260910.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM,
                null,
                withoutBackup,
                Collections.singletonList("ECSS01APP"));
        assertFailed(failedChecks, "DANGEROUS_COMMAND_BACKUP");

        List<TextSegment> withBackup = Arrays.asList(
                line(1, "变更实施前备份*"),
                line(2, "备份当前应用和数据库"),
                line(3, "变更实施步骤*"),
                line(4, "生产环境（实施时间：20260910）"),
                line(5, "1 变更执行"),
                line(6, "TRUNCATE TABLE TEMP_DATA"),
                serverHeader(7),
                serverRow(8, "ECSS01APP", "ecss")
        );
        List<ValidationCheckDto> warningChecks = service.validate(
                "企业渠道支撑系统变更步骤-手动-20260910.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM,
                null,
                withBackup,
                Collections.singletonList("ECSS01APP"));

        assertThat(warningChecks).filteredOn(item -> "DANGEROUS_COMMAND_BACKUP".equals(item.getCode()))
                .singleElement().satisfies(item -> assertThat(item.getStatus()).isEqualTo("WARNING"));
    }

    @Test
    void wechatManualUsesStrictNameTitleStepSequenceAndServerTriples() {
        List<ValidationCheckDto> checks = service.validate(
                "企业微信银行系统变更实施步骤(手动)-20260903.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_WECHAT,
                null,
                wechatManualSegments("企业微信银行系统变更方案", "2026-09-03",
                        "172.19.214.6、EWBS01WEB、wasadmin", "步骤2*"),
                Arrays.asList("EWBS01WEB", "EWBS01APP"));

        assertThat(checks).allMatch(item -> "PASSED".equals(item.getStatus()));
        assertThat(checks).extracting(ValidationCheckDto::getCode)
                .contains("SYSTEM_TITLE_FORMAT", "MANUAL_SERVER_IP_FORMAT", "MANUAL_SERVER_USER_PAIR")
                .doesNotContain("AUTO_DATA_SECTION_NUMBER", "AUTO_MANUAL_FILE_REFERENCE");
    }

    @Test
    void wechatManualRejectsDuplicateSystemInvalidIpMissingUserAndJumpedStep() {
        List<ValidationCheckDto> checks = service.validate(
                "企业微信银行系统变更实施步骤(手动)-20260903.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_WECHAT,
                null,
                wechatManualSegments("企业微信银行系统系统变更方案", "",
                        "999.19.214.6、EWBS01WEB、", "步骤3*"),
                Collections.singletonList("EWBS01WEB"));

        assertFailed(checks, "SYSTEM_TITLE_FORMAT");
        assertFailed(checks, "IMPLEMENTATION_DATE_MATCH");
        assertFailed(checks, "SECTION_NUMBER_CONTINUITY");
        assertFailed(checks, "MANUAL_SERVER_IP_FORMAT");
        assertFailed(checks, "MANUAL_SERVER_USER_PAIR");
    }

    @Test
    void wechatAutomaticAcceptsProdNumberAndAllRepeatedDevOpsFields() {
        List<ValidationCheckDto> checks = service.validate(
                "企业微信银行系统变更实施步骤(DevOps2G自动)-20260903.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_WECHAT,
                null,
                wechatAutomaticSegments("prod1", "prod2", "20260903"));

        assertThat(checks).allMatch(item -> "PASSED".equals(item.getStatus()));
        assertThat(checks).extracting(ValidationCheckDto::getCode)
                .doesNotContain("IMPLEMENTATION_DATE_MATCH", "AUTO_MANUAL_FILE_REFERENCE",
                        "AUTO_DATA_SECTION_NUMBER", "AUTO_PACKAGE_SECTION_NUMBER");
    }

    @Test
    void wechatAutomaticRejectsProdWithoutNumberAndMismatchedDate() {
        List<ValidationCheckDto> checks = service.validate(
                "企业微信银行系统变更实施步骤(DevOps2G自动)-20260903.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_WECHAT,
                null,
                wechatAutomaticSegments("prod", "prod2", "20260904"));

        assertFailed(checks, "AUTO_DEVOPS_ENVIRONMENT");
        assertFailed(checks, "AUTO_DEVOPS_CHANGE_DATE");
    }

    @Test
    void wechatFileNameRequiresExactParenthesesAndChangeType() {
        List<ValidationCheckDto> checks = service.validate(
                "企业微信银行系统变更实施步骤-手动-20260903.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_WECHAT,
                null,
                wechatManualSegments("企业微信银行系统变更方案", "2026-09-03",
                        "172.19.214.6、EWBS01WEB、wasadmin", "步骤2*"),
                Collections.singletonList("EWBS01WEB"));

        assertFailed(checks, "FILE_NAME_FORMAT");
    }

    @Test
    void onlineBankingManualAcceptsGroupedServersWithoutIpOrUserWhitelist() {
        List<TextSegment> segments = Arrays.asList(
                line(1, "变更方案（企业网上银行系统三代）"),
                line(2, "变更实施步骤*"),
                line(3, "生产环境（实施时间：20260910）"),
                serverHeader(4),
                serverRow(5, "EIBS3G01XCWEB\nEIBS3G02XCWEB", "tangweb"),
                serverRow(6, "eibs3g01db", "oracle"),
                line(7, "步骤1* 登录NTC平台"),
                line(8, "步骤2* 执行应用部署"),
                line(9, "变更验证方案*")
        );

        List<ValidationCheckDto> checks = service.validate(
                "企业网上银行系统三代(EIBS3G)变更步骤-手动-20260910.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_ONLINE_BANKING,
                null,
                segments,
                Arrays.asList("EIBS3G01XCWEB", "EIBS3G02XCWEB", "EIBS3G01DB"));

        assertThat(checks).allMatch(item -> "PASSED".equals(item.getStatus()));
        assertThat(checks).extracting(ValidationCheckDto::getCode)
                .contains("SYSTEM_TITLE_FORMAT", "MANUAL_SERVER_USER_PAIR", "MANUAL_SERVER_ASSET_MATCH")
                .doesNotContain("MANUAL_SERVER_IP_FORMAT");
    }

    @Test
    void onlineBankingManualRejectsInvalidHostAndUnpairedUser() {
        List<TextSegment> segments = Arrays.asList(
                line(1, "变更方案（企业网上银行系统三代）"),
                line(2, "变更实施步骤*"),
                line(3, "生产环境（实施时间：20260910）"),
                serverHeader(4),
                serverRow(5, "EIBS3G01RAC", ""),
                line(6, "步骤1* 执行变更"),
                line(7, "变更验证方案*")
        );

        List<ValidationCheckDto> checks = service.validate(
                "企业网上银行系统三代(EIBS3G)变更步骤-手动-20260910.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_ONLINE_BANKING,
                null,
                segments,
                Collections.singletonList("EIBS3G01XCWEB"));

        assertFailed(checks, "MANUAL_SERVER_USER_PAIR");
        assertFailed(checks, "MANUAL_SERVER_NAME_FORMAT");
        assertFailed(checks, "MANUAL_SERVER_ASSET_MATCH");
    }

    @Test
    void onlineBankingAutomaticRequiresExactProfileAndSkipsArtifactRepository() {
        List<ValidationCheckDto> checks = service.validate(
                "企业网上银行系统三代(EIBS3G)变更步骤-DevOps2G自动-20260910.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_ONLINE_BANKING,
                null,
                onlineBankingAutomaticSegments("企业网上银行系统三代", "EIBS3G_ALL_prod_main",
                        "CHG-N-A123456", "prod", "20260910"));

        assertThat(checks).allMatch(item -> "PASSED".equals(item.getStatus()));
        assertThat(checks).extracting(ValidationCheckDto::getCode)
                .contains("IMPLEMENTATION_DATE_MATCH", "AUTO_DEVOPS_WORKSPACE", "AUTO_CHANGE_TICKET_REQUIRED")
                .doesNotContain("AUTO_ARTIFACT_REPOSITORY_REQUIRED", "AUTO_MANUAL_FILE_REFERENCE",
                        "MANUAL_SERVER_REQUIRED", "MANUAL_SERVER_IP_FORMAT");
    }

    @Test
    void onlineBankingAutomaticRejectsWrongWorkspacePipelineTicketEnvironmentAndDate() {
        List<ValidationCheckDto> checks = service.validate(
                "企业网上银行系统三代(EIBS3G)变更步骤-DevOps2G自动-20260910.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_ONLINE_BANKING,
                null,
                onlineBankingAutomaticSegments("企业网上银行系统", "EIBS3G_XC_prod_main",
                        "CHG-N-123", "prod1", "20260911"));

        assertFailed(checks, "AUTO_DEVOPS_WORKSPACE");
        assertFailed(checks, "AUTO_DEVOPS_PIPELINE_REQUIRED");
        assertFailed(checks, "AUTO_CHANGE_TICKET_REQUIRED");
        assertFailed(checks, "AUTO_DEVOPS_ENVIRONMENT");
        assertFailed(checks, "AUTO_DEVOPS_CHANGE_DATE");
    }

    @Test
    void treasurySaasManualUsesExactNameWithoutManualWordAndSaasAssets() {
        List<TextSegment> segments = Arrays.asList(
                line(1, "多银行财资系统二代变更方案"),
                line(2, "变更实施步骤*"),
                new TextSegment(3, "表格#1", "步骤1* | IP、主机名、用户 | 执行变更",
                        Arrays.asList("步骤1*", "IP、主机名、用户", "执行变更")),
                new TextSegment(4, "表格#1", "步骤2* | 172.19.1.8、CBMS2G03GW、cbms | 重启",
                        Arrays.asList("步骤2*", "172.19.1.8、CBMS2G03GW、cbms", "重启")),
                line(5, "变更验证方案*"));

        List<ValidationCheckDto> checks = service.validate(
                "变更方案-20260914-多银行财资二代投产变更步骤-V1.0.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_TREASURY, null, segments,
                Collections.singletonList("CBMS2G03GW"));

        assertThat(checks).allMatch(item -> "PASSED".equals(item.getStatus()));
        assertThat(checks).extracting(ValidationCheckDto::getCode)
                .doesNotContain("IMPLEMENTATION_DATE_MATCH");
    }

    @Test
    void treasuryNtManualAcceptsConfirmedJumpHostExemption() {
        List<TextSegment> segments = Arrays.asList(
                line(1, "多银行财资系统二代变更方案-nt"),
                line(2, "变更实施步骤*"),
                new TextSegment(3, "表格#1", "步骤1* | IP、主机名、用户 | 执行变更",
                        Arrays.asList("步骤1*", "IP、主机名、用户", "执行变更")),
                new TextSegment(4, "表格#1", "步骤2* | 应用跳板机 | 上传文件",
                        Arrays.asList("步骤2*", "应用跳板机", "上传文件")),
                line(5, "变更验证方案*"));

        List<ValidationCheckDto> checks = service.validate(
                "变更方案-20260914-多银行财资二代投产变更步骤-V1.0-nt.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_TREASURY, null, segments,
                Collections.singletonList("CBMS2G01IIDNT"));

        assertThat(checks).allMatch(item -> "PASSED".equals(item.getStatus()));
    }

    @Test
    void treasuryAutomaticAllowsOneBranchButRequiresStrictPairAndBothManualReferences() {
        List<TextSegment> valid = treasuryAutomaticSegments("CBMS2G_ALL_prod_main", "prod", true);
        List<ValidationCheckDto> passed = service.validate(
                "多银行财资系统二代变更步骤DevOps2G-自动变更-20260914.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_TREASURY, null,
                "变更方案-20260914-多银行财资二代投产变更步骤-V1.0.docx",
                "变更方案-20260914-多银行财资二代投产变更步骤-V1.0-nt.docx",
                valid, Collections.emptyList());
        assertThat(passed).allMatch(item -> "PASSED".equals(item.getStatus()));

        List<ValidationCheckDto> withoutUploads = service.validate(
                "多银行财资系统二代变更步骤DevOps2G-自动变更-20260914.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_TREASURY, null, valid);
        assertThat(withoutUploads).filteredOn(item -> item.getCode().startsWith("AUTO_TREASURY_")
                        && item.getCode().endsWith("_REFERENCE"))
                .allMatch(item -> "WARNING".equals(item.getStatus()));

        List<ValidationCheckDto> mismatchedUpload = service.validate(
                "多银行财资系统二代变更步骤DevOps2G-自动变更-20260914.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_TREASURY, null,
                "变更方案-20260915-多银行财资二代投产变更步骤-V1.0.docx",
                "变更方案-20260914-多银行财资二代投产变更步骤-V1.0-nt.docx",
                valid, Collections.emptyList());
        assertFailed(mismatchedUpload, "AUTO_TREASURY_SAAS_REFERENCE");

        List<ValidationCheckDto> failed = service.validate(
                "多银行财资系统二代变更步骤DevOps2G-自动变更-20260914.docx",
                ChangeStepBusinessValidationService.TYPE_AUTOMATIC,
                ChangeStepBusinessValidationService.SYSTEM_TREASURY, null,
                treasuryAutomaticSegments("CBMS2G_ALL_prod_main_nt", "prod", false));
        assertFailed(failed, "AUTO_TREASURY_PIPELINE_ENV_MATCH");
        assertFailed(failed, "AUTO_TREASURY_NT_REFERENCE");
    }

    @Test
    void redisFlushRequiresPriorBackup() {
        List<TextSegment> segments = Arrays.asList(
                line(1, "多银行财资系统二代变更方案"), line(2, "变更实施步骤*"),
                line(3, "步骤1* 执行 redis-cli flushall"), line(4, "变更验证方案*"));
        List<ValidationCheckDto> checks = service.validate(
                "变更方案-20260914-多银行财资二代投产变更步骤-V1.0.docx",
                ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_TREASURY, null, segments);
        assertFailed(checks, "DANGEROUS_COMMAND_BACKUP");
    }

    private List<TextSegment> automaticSegments(String manualFileName,
                                                String environment,
                                                String changeDate,
                                                String repository) {
        return Arrays.asList(
                line(1, "变更实施前备份*"),
                line(2, "备份当前应用部署包"),
                line(3, "变更实施步骤*"),
                line(4, "生产环境（实施时间：20260910）"),
                line(5, "DevOps2G自动变更（请先执行 " + manualFileName + "）"),
                line(6, "1 登录DevOps2G平台"),
                line(7, "2 选择发布流水线"),
                line(8, "流水线：ECSS_ALL_prod_main"),
                line(9, "环境：" + environment),
                line(10, "变更日期：" + changeDate),
                line(11, "变更单号 BGDCHG：CHG-N-A123456"),
                line(12, "制品库名称：" + repository),
                line(13, "3 运行流水线"),
                line(14, "数据库失败时执行手动文件中的“3.2 数据变更”流程。"),
                line(15, "应用失败时执行手动文件中的“3.3 上传应用部署包”流程。"),
                line(16, "变更验证方案*")
        );
    }

    private List<TextSegment> manualSegments(String server, String user) {
        return Arrays.asList(
                line(1, "变更实施步骤*"),
                line(2, "生产环境（实施时间：20260910）"),
                line(3, "1 变更准备"),
                line(4, "2 应用部署"),
                serverHeader(5),
                serverRow(6, server, user),
                line(7, "变更验证方案*")
        );
    }

    private List<TextSegment> wechatManualSegments(String title, String implementationDate,
                                                   String firstTriple, String secondStep) {
        return Arrays.asList(
                line(1, title),
                line(2, "手动变更实施步骤*"),
                line(3, "生产环境（实施时间：" + implementationDate + "）"),
                new TextSegment(4, "表格#1", " | IP、主机名、用户 | 具体步骤",
                        Arrays.asList("", "IP、主机名、用户", "具体步骤")),
                new TextSegment(5, "表格#1", "步骤1* | " + firstTriple + " | 执行变更",
                        Arrays.asList("步骤1*", firstTriple, "执行变更")),
                new TextSegment(6, "表格#1", secondStep + " | 172.19.211.64、EWBS01APP、weix | 启动应用",
                        Arrays.asList(secondStep, "172.19.211.64、EWBS01APP、weix", "启动应用")),
                line(7, "变更验证方案*")
        );
    }

    private List<TextSegment> wechatAutomaticSegments(String firstEnvironment,
                                                      String secondEnvironment,
                                                      String changeDate) {
        return Arrays.asList(
                line(1, "企业微信银行系统变更方案"),
                line(2, "变更实施前备份*"),
                line(3, "流水线中已有备份"),
                line(4, "变更实施步骤*"),
                line(5, "步骤1* DevOps2G平台"),
                line(6, "部署流程：EWBS_ALL_prod_main"),
                line(7, "版本号 env：" + firstEnvironment),
                line(8, "变更日期 date：" + changeDate),
                line(9, "变更单号 BGDCHG：CHG-N-A123456"),
                line(10, "制品库名称 sysname：SYS_20220901_1035-prod"),
                line(11, "步骤2* DevOps2G平台"),
                line(12, "部署流程：EWBS_XC_prod_main"),
                line(13, "版本号 env：" + secondEnvironment),
                line(14, "变更日期 date：" + changeDate),
                line(15, "变更单号 BGDCHG：CHG-N-B123456"),
                line(16, "制品库名称 sysname：SYS_20220901_1035-prod"),
                line(17, "变更验证方案*")
        );
    }

    private List<TextSegment> onlineBankingAutomaticSegments(String workspace,
                                                              String pipeline,
                                                              String changeTicket,
                                                              String environment,
                                                              String changeDate) {
        return Arrays.asList(
                line(1, "变更方案（企业网上银行系统三代）"),
                line(2, "变更实施前备份*"),
                line(3, "流水线中已有备份"),
                line(4, "变更实施步骤*"),
                line(5, "生产环境（实施时间：20260910）"),
                line(6, "步骤1* DevOps2G平台"),
                line(7, "选择协作空间：" + workspace),
                line(8, "部署流程：" + pipeline),
                line(9, "变更单号 BGDCHG：" + changeTicket),
                line(10, "版本号 env：" + environment),
                line(11, "变更日期 date：" + changeDate),
                line(12, "变更验证方案*")
        );
    }

    private List<TextSegment> treasuryAutomaticSegments(String pipeline, String environment,
                                                         boolean includeNtReference) {
        List<TextSegment> segments = new java.util.ArrayList<>(Arrays.asList(
                line(1, "变更方案（多银行财资系统二代）"),
                line(2, "变更实施步骤*"),
                line(3, "生产环境（实施时间：20260914）"),
                line(4, "步骤1* DevOps2G自动变更（请先执行 变更方案-20260914-多银行财资二代投产变更步骤-V1.0.docx）"),
                line(5, "选择协作空间：多银行财资系统二代"),
                line(6, "选择流水线：" + pipeline),
                line(7, "变更单号 BGDCHG：CHG-N-A123456"),
                line(8, "版本号 env：" + environment),
                line(9, "变更日期 date：20260914"),
                line(10, "制品库名称 sysname：cbms-release")));
        if (includeNtReference) {
            segments.add(line(11, "请先执行 变更方案-20260914-多银行财资二代投产变更步骤-V1.0-nt.docx"));
        }
        segments.add(line(12, "变更验证方案*"));
        return segments;
    }

    private void assertFailed(List<ValidationCheckDto> checks, String code) {
        assertThat(checks).filteredOn(item -> code.equals(item.getCode()))
                .singleElement().satisfies(item -> assertThat(item.getStatus()).isEqualTo("FAILED"));
    }

    private TextSegment serverHeader(int number) {
        return new TextSegment(number, "表格", "服务器 | 用户", Arrays.asList("服务器", "用户"));
    }

    private TextSegment serverRow(int number, String server, String user) {
        return new TextSegment(number, "表格", server + " | " + user, Arrays.asList(server, user));
    }

    private TextSegment line(int number, String text) {
        return new TextSegment(number, "正文", text, Collections.emptyList());
    }
}
