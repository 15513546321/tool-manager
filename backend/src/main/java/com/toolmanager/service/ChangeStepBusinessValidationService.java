package com.toolmanager.service;

import com.toolmanager.dto.ChangeStepCheckDtos.ValidationCheckDto;
import lombok.AllArgsConstructor;
import lombok.Data;
import org.springframework.stereotype.Service;

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
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 变更单业务规则入口。公共规则与系统 profile 分离，后续接入网银、财资时
 * 只需增加对应 profile 和少量系统专属解析逻辑，无需修改 Word 解析及敏感信息扫描。
 */
@Service
public class ChangeStepBusinessValidationService {
    public static final String SYSTEM_MIDDLE_PLATFORM = "MIDDLE_PLATFORM";
    public static final String SYSTEM_WECHAT = "WECHAT";
    public static final String SYSTEM_ONLINE_BANKING = "ONLINE_BANKING";
    public static final String SYSTEM_TREASURY = "TREASURY";
    public static final String TREASURY_SAAS_ASSET_SCOPE = "TREASURY_SAAS";
    public static final String TREASURY_NT_ASSET_SCOPE = "TREASURY_NT";
    public static final String TYPE_MANUAL = "MANUAL";
    public static final String TYPE_AUTOMATIC = "AUTOMATIC";

    private static final String MIDDLE_MANUAL_FILE_FORMAT = "企业渠道支撑系统变更步骤-手动-YYYYMMDD.docx";
    private static final String MIDDLE_AUTOMATIC_FILE_FORMAT = "企业渠道支撑系统变更步骤DevOps2G-自动变更-YYYYMMDD.docx";
    private static final Pattern MIDDLE_MANUAL_FILE_NAME = Pattern.compile(
            "^企业渠道支撑系统变更步骤-手动-(20\\d{6})\\.docx$");
    private static final Pattern MIDDLE_AUTOMATIC_FILE_NAME = Pattern.compile(
            "^企业渠道支撑系统变更步骤DevOps2G-自动变更-(20\\d{6})\\.docx$");
    private static final String WECHAT_MANUAL_FILE_FORMAT = "企业微信银行系统变更实施步骤(手动)-YYYYMMDD.docx";
    private static final String WECHAT_AUTOMATIC_FILE_FORMAT = "企业微信银行系统变更实施步骤(DevOps2G自动)-YYYYMMDD.docx";
    private static final Pattern WECHAT_MANUAL_FILE_NAME = Pattern.compile(
            "^企业微信银行系统变更实施步骤\\(手动\\)-(20\\d{6})\\.docx$");
    private static final Pattern WECHAT_AUTOMATIC_FILE_NAME = Pattern.compile(
            "^企业微信银行系统变更实施步骤\\(DevOps2G自动\\)-(20\\d{6})\\.docx$");
    private static final String ONLINE_BANKING_MANUAL_FILE_FORMAT =
            "企业网上银行系统三代(EIBS3G)变更步骤-手动-YYYYMMDD.docx";
    private static final String ONLINE_BANKING_AUTOMATIC_FILE_FORMAT =
            "企业网上银行系统三代(EIBS3G)变更步骤-DevOps2G自动-YYYYMMDD.docx";
    private static final Pattern ONLINE_BANKING_MANUAL_FILE_NAME = Pattern.compile(
            "^企业网上银行系统三代\\(EIBS3G\\)变更步骤-手动-(20\\d{6})\\.docx$");
    private static final Pattern ONLINE_BANKING_AUTOMATIC_FILE_NAME = Pattern.compile(
            "^企业网上银行系统三代\\(EIBS3G\\)变更步骤-DevOps2G自动-(20\\d{6})\\.docx$");
    private static final String TREASURY_SAAS_MANUAL_FILE_FORMAT =
            "变更方案-YYYYMMDD-多银行财资二代投产变更步骤-V1.0.docx";
    private static final String TREASURY_NT_MANUAL_FILE_FORMAT =
            "变更方案-YYYYMMDD-多银行财资二代投产变更步骤-V1.0-nt.docx";
    private static final String TREASURY_AUTOMATIC_FILE_FORMAT =
            "多银行财资系统二代变更步骤DevOps2G-自动变更-YYYYMMDD.docx";
    private static final Pattern TREASURY_SAAS_MANUAL_FILE_NAME = Pattern.compile(
            "^变更方案-(20\\d{6})-多银行财资二代投产变更步骤-V1\\.0\\.docx$");
    private static final Pattern TREASURY_NT_MANUAL_FILE_NAME = Pattern.compile(
            "^变更方案-(20\\d{6})-多银行财资二代投产变更步骤-V1\\.0-nt\\.docx$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern TREASURY_AUTOMATIC_FILE_NAME = Pattern.compile(
            "^多银行财资系统二代变更步骤DevOps2G-自动变更-(20\\d{6})\\.docx$");
    private static final Pattern MANUAL_FILE_REFERENCE = Pattern.compile(
            "DevOps2G\\s*自动变更\\s*[（(][^）)]*?请先执行\\s*([^（）()\\r\\n]*?\\.\\s*docx)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern COMPACT_DATE = Pattern.compile("(?<!\\d)(20\\d{6})(?!\\d)");
    private static final Pattern SEPARATED_DATE = Pattern.compile(
            "(?<!\\d)(20\\d{2})\\s*[-/.年]\\s*(\\d{1,2})\\s*[-/.月]\\s*(\\d{1,2})\\s*日?(?!\\d)");
    private static final Pattern SECTION_NUMBER = Pattern.compile("3\\s*[.．]\\s*([23])\\s*[.．、]?\\s*");
    private static final Pattern NUMBERED_HEADING = Pattern.compile(
            "^\\s*(\\d{1,2})(?:\\s*[.．]\\s*(\\d{1,2}))?\\s*(?:[.．、)]\\s*)?(.+?)\\s*$");
    private static final Pattern MIDDLE_SERVER_NAME = Pattern.compile("^ECSS\\d{2}[A-Z][A-Z0-9]{1,15}$");
    private static final Pattern WECHAT_SERVER_NAME = Pattern.compile("^EWBS\\d{2}[A-Z][A-Z0-9]{1,15}$");
    private static final Pattern ONLINE_BANKING_SERVER_NAME = Pattern.compile(
            "(?i)^EIBS3G\\d{2}(?:(?:XC)?(?:WEB|APP)(?:JDT)?|DB)$");
    private static final Pattern WECHAT_STEP_NUMBER = Pattern.compile("步骤\\s*(\\d{1,2})\\s*\\*?");
    private static final Pattern IPV4_CANDIDATE = Pattern.compile("(?<!\\d)(?:\\d{1,3}\\.){3}\\d{1,3}(?!\\d)");
    private static final Pattern WECHAT_HOST_CANDIDATE = Pattern.compile("(?i)\\b(?:EWBS|CBMS2G)[A-Z0-9_-]+\\b");
    private static final List<String> CHANGE_TICKET_LABELS = Arrays.asList(
            "变更单号\\s*BGDCHG", "BGDCHG");
    private static final Pattern CHANGE_TICKET_VALUE = Pattern.compile("^CHG-N-[A-Za-z0-9]{7}$");
    private static final Pattern DANGEROUS_RM = Pattern.compile(
            "(?i)\\brm\\s+-(?:rf|fr)\\s+(?:--\\s+)?(?:/\\*|\\*|\\./\\*|~/\\*|~|/)\\s*(?:$|[;&|])");
    private static final Pattern DANGEROUS_SQL = Pattern.compile(
            "(?i)\\b(?:DROP\\s+(?:DATABASE|SCHEMA|TABLE|VIEW|INDEX|SEQUENCE|USER)|TRUNCATE\\s+(?:TABLE\\s+)?[A-Z0-9_.$\"`]+)");
    private static final Pattern DANGEROUS_REDIS = Pattern.compile("(?i)\\b(?:flushall|flushdb)\\b");
    private static final Pattern BACKUP_SIGNAL = Pattern.compile(
            "(?i)(备份|快照|导出|backup|snapshot|mysqldump|expdp|pg_dump)");
    private static final Pattern NO_BACKUP_SIGNAL = Pattern.compile(
            "(?i)(无需备份|不需备份|不需要备份|未备份|没有备份|无备份|skip\\s+backup|without\\s+backup)");
    private static final Set<String> EMPTY_VALUES = new LinkedHashSet<>(Arrays.asList(
            "", "无", "-", "--", "/", "n/a", "na", "不涉及", "无需填写"
    ));
    private static final Map<String, ValidationProfile> PROFILES = createProfiles();

    public List<ValidationCheckDto> validate(String fileName,
                                             String documentType,
                                             String systemCode,
                                             String companionManualFileName,
                                             List<TextSegment> allSegments) {
        return validate(fileName, documentType, systemCode, companionManualFileName,
                allSegments, Collections.emptyList());
    }

    public List<ValidationCheckDto> validate(String fileName,
                                             String documentType,
                                             String systemCode,
                                             String companionManualFileName,
                                             List<TextSegment> allSegments,
                                             List<String> serverAssetNames) {
        return validate(fileName, documentType, systemCode, companionManualFileName,
                null, null, allSegments, serverAssetNames);
    }

    public List<ValidationCheckDto> validate(String fileName,
                                             String documentType,
                                             String systemCode,
                                             String companionManualFileName,
                                             String treasurySaasManualFileName,
                                             String treasuryNtManualFileName,
                                             List<TextSegment> allSegments,
                                             List<String> serverAssetNames) {
        String normalizedSystem = normalizeSystemCode(systemCode);
        String normalizedType = normalizeDocumentType(documentType);
        ValidationProfile profile = resolveProfile(normalizedSystem, normalizedType, fileName);

        List<TextSegment> safeSegments = allSegments == null ? Collections.emptyList() : allSegments;
        List<TextSegment> implementationSegments = implementationSegments(safeSegments);
        List<ValidationCheckDto> checks = new ArrayList<>();
        checks.add(validateFileName(fileName, normalizedType, profile));
        if ((TYPE_MANUAL.equals(normalizedType) && !SYSTEM_TREASURY.equals(normalizedSystem))
                || profile.isAutomaticImplementationTimeRequired()) {
            checks.add(validateImplementationDate(fileName, implementationSegments));
        }
        checks.add(profile.isStepNumbering()
                ? validateStepNumberingContinuity(implementationSegments)
                : validateNumberingContinuity(implementationSegments));
        checks.add(validateDangerousCommands(safeSegments, implementationSegments));
        if (profile.getExpectedTitle() != null) {
            checks.add(validateSystemTitle(safeSegments, profile));
        }
        if (TYPE_AUTOMATIC.equals(normalizedType)) {
            if (SYSTEM_TREASURY.equals(normalizedSystem)) {
                checks.addAll(validateTreasuryManualReferences(fileName, implementationSegments,
                        treasurySaasManualFileName, treasuryNtManualFileName));
            }
            if (profile.isManualReferenceRequired()) {
                checks.add(validateManualFileReference(fileName, companionManualFileName, implementationSegments, profile));
            }
            if (profile.isMiddleSectionNumbersRequired()) {
                checks.add(validateSectionNumber(
                        "AUTO_DATA_SECTION_NUMBER", "数据变更章节编号", "数据变更", "2", implementationSegments));
                checks.add(validateSectionNumber(
                        "AUTO_PACKAGE_SECTION_NUMBER", "上传应用部署包章节编号", "上传应用部署包", "3", implementationSegments));
            }
            checks.addAll(validateDevOpsFields(fileName, implementationSegments, profile));
            if (SYSTEM_TREASURY.equals(normalizedSystem)) {
                checks.addAll(validateTreasuryBranches(fileName, implementationSegments, profile));
            }
        } else {
            checks.addAll(profile.isWechatServerTable()
                    ? validateWechatServerRows(implementationSegments, serverAssetNames, profile)
                    : validateServerRows(implementationSegments, serverAssetNames, profile));
        }
        return checks;
    }

    public String normalizeSystemCode(String systemCode) {
        return systemCode == null || systemCode.trim().isEmpty()
                ? SYSTEM_MIDDLE_PLATFORM
                : systemCode.trim().toUpperCase(Locale.ROOT);
    }

    public String normalizeDocumentType(String documentType) {
        String normalized = documentType == null ? "" : documentType.trim().toUpperCase(Locale.ROOT);
        if (!TYPE_MANUAL.equals(normalized) && !TYPE_AUTOMATIC.equals(normalized)) {
            throw new IllegalArgumentException("变更单类型必须为手动变更或自动变更");
        }
        return normalized;
    }

    public String systemName(String systemCode) {
        return requireProfile(normalizeSystemCode(systemCode)).getSystemName();
    }

    public String documentTypeLabel(String documentType) {
        return TYPE_AUTOMATIC.equals(normalizeDocumentType(documentType)) ? "自动变更单" : "手动变更单";
    }

    private static Map<String, ValidationProfile> createProfiles() {
        Map<String, ValidationProfile> profiles = new LinkedHashMap<>();
        profiles.put(SYSTEM_MIDDLE_PLATFORM, new ValidationProfile(
                SYSTEM_MIDDLE_PLATFORM, "中台",
                MIDDLE_MANUAL_FILE_FORMAT, MIDDLE_AUTOMATIC_FILE_FORMAT,
                MIDDLE_MANUAL_FILE_NAME, MIDDLE_AUTOMATIC_FILE_NAME,
                MIDDLE_SERVER_NAME, "ECSS + 2位数字 + 大写角色标识", "例如 ECSS01RAC、ECSS01APP",
                true, true, true, false, false, null,
                Collections.singletonList("流水线"), Collections.singletonList("环境"),
                Collections.singletonList("变更日期"), Collections.singletonList("制品库名称"),
                Pattern.compile("^prod$"), "prod",
                null, null, true, Collections.emptyList(), null));
        profiles.put(SYSTEM_WECHAT, new ValidationProfile(
                SYSTEM_WECHAT, "微信",
                WECHAT_MANUAL_FILE_FORMAT, WECHAT_AUTOMATIC_FILE_FORMAT,
                WECHAT_MANUAL_FILE_NAME, WECHAT_AUTOMATIC_FILE_NAME,
                WECHAT_SERVER_NAME, "EWBS + 2位数字 + 大写角色标识", "例如 EWBS01WEB、EWBS01WEBJDT、EWBS01APP",
                false, false, false, true, true, "企业微信银行系统变更方案",
                Arrays.asList("部署流程", "流水线"), Arrays.asList("版本号\\s*env", "env", "环境"),
                Arrays.asList("变更日期\\s*date", "date", "变更日期"), Arrays.asList("制品库名称\\s*sysname", "sysname", "制品库名称"),
                Pattern.compile("^prod\\d+$"), "prod+数字（例如 prod1、prod2）",
                null, null, true, Collections.emptyList(), null));
        profiles.put(SYSTEM_ONLINE_BANKING, new ValidationProfile(
                SYSTEM_ONLINE_BANKING, "网银",
                ONLINE_BANKING_MANUAL_FILE_FORMAT, ONLINE_BANKING_AUTOMATIC_FILE_FORMAT,
                ONLINE_BANKING_MANUAL_FILE_NAME, ONLINE_BANKING_AUTOMATIC_FILE_NAME,
                ONLINE_BANKING_SERVER_NAME,
                "EIBS3G + 2位数字 + WEB/APP/DB节点标识，可包含XC和JDT",
                "例如 EIBS3G01XCWEB、EIBS3G01XCAPPJDT、eibs3g01db",
                false, false, true, true, false, "变更方案（企业网上银行系统三代）",
                Arrays.asList("部署流程", "流水线"), Arrays.asList("版本号\\s*env", "env", "环境"),
                Arrays.asList("变更日期\\s*date", "date", "变更日期"), Collections.emptyList(),
                Pattern.compile("^prod$"), "prod",
                Pattern.compile("^EIBS3G_ALL_prod_main$"), "EIBS3G_ALL_prod_main", false,
                Arrays.asList("选择协作空间", "协作空间"), "企业网上银行系统三代"));
        Pattern treasuryServer = Pattern.compile("(?i)^CBMS2G\\d{2}[A-Z][A-Z0-9]{1,20}$");
        Pattern treasuryPipeline = Pattern.compile(
                "^(?:CBMS2G_ALL_prod-demo_main|CBMS2G_ALL_prod_main|CBMS2G_ALL_prod_main_nt)$");
        profiles.put(SYSTEM_TREASURY, new ValidationProfile(
                SYSTEM_TREASURY, "财资",
                TREASURY_SAAS_MANUAL_FILE_FORMAT, TREASURY_AUTOMATIC_FILE_FORMAT,
                TREASURY_SAAS_MANUAL_FILE_NAME, TREASURY_AUTOMATIC_FILE_NAME,
                treasuryServer, "CBMS2G + 节点编号及角色标识", "例如 CBMS2G03GW、CBMS2G01IIDNT",
                false, false, true, true, true, "变更方案（多银行财资系统二代）",
                Arrays.asList("选择流水线", "部署流程", "流水线"), Arrays.asList("版本号\\s*env", "env", "环境"),
                Arrays.asList("变更日期\\s*date", "date", "变更日期"), Arrays.asList("制品库名称\\s*sysname", "sysname", "制品库名称"),
                Pattern.compile("^(?:demo|prod|nt)$"), "demo、prod 或 nt（须与流水线严格对应）",
                treasuryPipeline, "CBMS2G_ALL_prod-demo_main / CBMS2G_ALL_prod_main / CBMS2G_ALL_prod_main_nt",
                true, Arrays.asList("选择协作空间", "协作空间"), "多银行财资系统二代"));
        profiles.put(TREASURY_SAAS_ASSET_SCOPE, new ValidationProfile(
                SYSTEM_TREASURY, "财资 SaaS", TREASURY_SAAS_MANUAL_FILE_FORMAT, TREASURY_AUTOMATIC_FILE_FORMAT,
                TREASURY_SAAS_MANUAL_FILE_NAME, TREASURY_AUTOMATIC_FILE_NAME,
                treasuryServer, "CBMS2G + 节点编号及角色标识", "例如 CBMS2G03GW、CBMS2G01GWDEMO",
                false, false, false, true, true, "多银行财资系统二代变更方案",
                Collections.emptyList(), Collections.emptyList(), Collections.emptyList(), Collections.emptyList(),
                Pattern.compile(".*"), "", null, null, false, Collections.emptyList(), null));
        profiles.put(TREASURY_NT_ASSET_SCOPE, new ValidationProfile(
                SYSTEM_TREASURY, "财资 NT", TREASURY_NT_MANUAL_FILE_FORMAT, TREASURY_AUTOMATIC_FILE_FORMAT,
                TREASURY_NT_MANUAL_FILE_NAME, TREASURY_AUTOMATIC_FILE_NAME,
                treasuryServer, "CBMS2G + 节点编号及角色标识", "例如 CBMS2G01IIDNT、CBMS2G01FEBNT",
                false, false, false, true, true, "多银行财资系统二代变更方案-nt",
                Collections.emptyList(), Collections.emptyList(), Collections.emptyList(), Collections.emptyList(),
                Pattern.compile(".*"), "", null, null, false, Collections.emptyList(), null));
        return Collections.unmodifiableMap(profiles);
    }

    private ValidationProfile resolveProfile(String systemCode, String documentType, String fileName) {
        if (SYSTEM_TREASURY.equals(systemCode) && TYPE_MANUAL.equals(documentType)) {
            boolean nt = fileName != null && fileName.toLowerCase(Locale.ROOT).endsWith("-nt.docx");
            return requireProfile(nt ? TREASURY_NT_ASSET_SCOPE : TREASURY_SAAS_ASSET_SCOPE);
        }
        return requireProfile(systemCode);
    }

    private ValidationProfile requireProfile(String systemCode) {
        ValidationProfile profile = PROFILES.get(systemCode);
        if (profile != null) return profile;
        throw new IllegalArgumentException("不支持的业务系统：" + systemCode);
    }

    private ValidationCheckDto validateFileName(String fileName, String documentType, ValidationProfile profile) {
        Pattern expectedPattern = TYPE_AUTOMATIC.equals(documentType)
                ? profile.getAutomaticFileName() : profile.getManualFileName();
        String expectedFormat = TYPE_AUTOMATIC.equals(documentType)
                ? profile.getAutomaticFileFormat() : profile.getManualFileFormat();
        TextSegment source = new TextSegment(0, "文件名", fileName == null ? "" : fileName);
        if (fileName != null && expectedPattern.matcher(fileName).matches()) {
            return passed("FILE_NAME_FORMAT", "文件名", "文件名统一格式",
                    "文件名包含正确的系统名称、变更类型和日期，且没有空格", expectedFormat, fileName, source);
        }

        String reason;
        if (fileName == null || fileName.trim().isEmpty()) {
            reason = "文件名为空";
        } else if (fileName.matches(".*\\s+.*")) {
            reason = "文件名中包含空格";
        } else if (!fileName.contains("手动") && !fileName.contains("自动")) {
            reason = "文件名缺少变更类型";
        } else {
            reason = "系统名称、固定文字、变更类型、日期或扩展名不符合统一格式";
        }
        return failed("FILE_NAME_FORMAT", "文件名", "文件名统一格式",
                reason, expectedFormat, fileName, source);
    }

    private ValidationCheckDto validateManualFileReference(String automaticFileName,
                                                            String expectedFileName,
                                                            List<TextSegment> segments,
                                                            ValidationProfile profile) {
        TextSegment source = findFirstContaining(segments, "请先执行");
        String content = segments.stream().map(TextSegment::getText).collect(Collectors.joining("\n"));
        Matcher matcher = MANUAL_FILE_REFERENCE.matcher(content);
        if (!matcher.find()) {
            return failed("AUTO_MANUAL_FILE_REFERENCE", "文件引用", "配套手动文件名一致性",
                    "未找到“DevOps2G自动变更（请先执行 ...）”中的手动文件名",
                    profile.getManualFileFormat(), "未识别", source);
        }

        String actualFileName = matcher.group(1).trim();
        if (expectedFileName != null && !expectedFileName.trim().isEmpty()) {
            String expected = expectedFileName.trim();
            if (expected.equals(actualFileName)) {
                return passed("AUTO_MANUAL_FILE_REFERENCE", "文件引用", "配套手动文件名一致性",
                        "文档引用的手动文件名与所选文件完全一致", expected, actualFileName, source);
            }
            return failed("AUTO_MANUAL_FILE_REFERENCE", "文件引用", "配套手动文件名一致性",
                    "文档中的手动文件名与实际所选文件不一致", expected, actualFileName, source);
        }

        Matcher nameMatcher = profile.getManualFileName().matcher(actualFileName);
        String automaticDate = extractDate(automaticFileName);
        String referencedDate = extractDate(actualFileName);
        if (nameMatcher.matches() && automaticDate != null && automaticDate.equals(referencedDate)) {
            return warning("AUTO_MANUAL_FILE_REFERENCE", "文件引用", "配套手动文件名一致性",
                    "未选择配套手动文件，已校验文档内引用的命名格式和日期，未执行实际文件名比对",
                    "可选上传配套手动文件进行精确比对", actualFileName, source);
        }
        return failed("AUTO_MANUAL_FILE_REFERENCE", "文件引用", "配套手动文件名一致性",
                "未选择配套手动文件，且文档内引用的文件名格式或日期不正确",
                profile.getManualFileFormat() + "，日期与自动变更单一致", actualFileName, source);
    }

    private ValidationCheckDto validateSectionNumber(String code,
                                                     String label,
                                                     String title,
                                                     String expectedSubNumber,
                                                     List<TextSegment> segments) {
        List<String> actualNumbers = new ArrayList<>();
        TextSegment firstSource = null;
        for (TextSegment segment : segments) {
            String text = segment.getText();
            int titleIndex = text.indexOf(title);
            while (titleIndex >= 0) {
                String prefix = text.substring(Math.max(0, titleIndex - 20), titleIndex);
                Matcher matcher = SECTION_NUMBER.matcher(prefix);
                String number = null;
                while (matcher.find()) number = "3." + matcher.group(1);
                actualNumbers.add(number == null ? "未编号" : number);
                if (firstSource == null) firstSource = segment;
                titleIndex = text.indexOf(title, titleIndex + title.length());
            }
        }

        String expected = "3." + expectedSubNumber + " " + title;
        if (actualNumbers.isEmpty()) {
            return failed(code, "章节编号", label, "未找到“" + title + "”", expected, "未识别", null);
        }
        boolean correct = actualNumbers.stream().allMatch(("3." + expectedSubNumber)::equals);
        String actual = String.join("、", new LinkedHashSet<>(actualNumbers)) + " " + title;
        if (correct) {
            return passed(code, "章节编号", label, "章节名称与编号对应正确", expected, actual, firstSource);
        }
        return failed(code, "章节编号", label, "章节编号重复或与章节名称不匹配", expected, actual, firstSource);
    }

    private ValidationCheckDto validateImplementationDate(String fileName, List<TextSegment> segments) {
        String fileDate = extractDate(fileName);
        List<String> implementationDates = new ArrayList<>();
        TextSegment firstSource = null;
        for (TextSegment segment : segments) {
            if (!segment.getText().contains("实施时间")) continue;
            if (firstSource == null) firstSource = segment;
            String afterLabel = segment.getText().substring(segment.getText().indexOf("实施时间") + "实施时间".length());
            String date = extractDate(afterLabel);
            if (date != null) implementationDates.add(date);
        }

        if (fileDate == null) {
            return failed("IMPLEMENTATION_DATE_MATCH", "日期", "实施日期与文件名一致性",
                    "文件名中未识别到 YYYYMMDD 日期", "文件名包含8位日期", fileName, firstSource);
        }
        if (implementationDates.isEmpty()) {
            return failed("IMPLEMENTATION_DATE_MATCH", "日期", "实施日期与文件名一致性",
                    "变更实施步骤中未填写可识别的实施时间", fileDate, "未识别", firstSource);
        }
        Set<String> actualDates = new LinkedHashSet<>(implementationDates);
        boolean correct = actualDates.stream().allMatch(fileDate::equals);
        String actual = String.join("、", actualDates);
        if (correct) {
            return passed("IMPLEMENTATION_DATE_MATCH", "日期", "实施日期与文件名一致性",
                    "实施时间与文件名日期一致", fileDate, actual, firstSource);
        }
        return failed("IMPLEMENTATION_DATE_MATCH", "日期", "实施日期与文件名一致性",
                "实施时间与文件名日期不一致，或文档内存在多个日期", fileDate, actual, firstSource);
    }

    private ValidationCheckDto validateNumberingContinuity(List<TextSegment> segments) {
        List<NumberedHeading> headings = segments.stream()
                .map(this::parseNumberedHeading).filter(item -> item != null).collect(Collectors.toList());
        if (headings.isEmpty()) {
            return failed("SECTION_NUMBER_CONTINUITY", "章节编号", "一级、二级编号连续性",
                    "变更实施步骤中未识别到一级或二级章节编号",
                    "一级编号从 1 开始连续；每个一级章节下的二级编号从 .1 开始连续", "未识别", null);
        }

        int expectedFirst = 1;
        int currentFirst = 0;
        Map<Integer, Integer> expectedSecond = new LinkedHashMap<>();
        List<String> errors = new ArrayList<>();
        for (NumberedHeading heading : headings) {
            if (heading.getSecond() == null) {
                if (heading.getFirst() != expectedFirst) {
                    errors.add("一级编号期望 " + expectedFirst + "，实际 " + heading.number());
                }
                currentFirst = heading.getFirst();
                expectedFirst = heading.getFirst() + 1;
            } else {
                int expected = expectedSecond.getOrDefault(heading.getFirst(), 1);
                if (heading.getFirst() != currentFirst) {
                    errors.add(heading.number() + " 前缺少对应一级章节 " + heading.getFirst());
                }
                if (heading.getSecond() != expected) {
                    errors.add(heading.getFirst() + ".* 期望 " + heading.getFirst() + "." + expected
                            + "，实际 " + heading.number());
                }
                expectedSecond.put(heading.getFirst(), heading.getSecond() + 1);
            }
        }

        String actual = headings.stream().map(NumberedHeading::number).collect(Collectors.joining("、"));
        if (errors.isEmpty()) {
            return passed("SECTION_NUMBER_CONTINUITY", "章节编号", "一级、二级编号连续性",
                    "一级、二级章节编号连续且没有重复", "连续且不重复", actual, headings.get(0).getSource());
        }
        return failed("SECTION_NUMBER_CONTINUITY", "章节编号", "一级、二级编号连续性",
                String.join("；", errors), "连续且不重复", actual, headings.get(0).getSource());
    }

    private ValidationCheckDto validateStepNumberingContinuity(List<TextSegment> segments) {
        List<Integer> numbers = new ArrayList<>();
        TextSegment firstSource = null;
        for (TextSegment segment : segments) {
            Matcher matcher = WECHAT_STEP_NUMBER.matcher(segment.getText());
            while (matcher.find()) {
                numbers.add(Integer.parseInt(matcher.group(1)));
                if (firstSource == null) firstSource = segment;
            }
        }
        if (numbers.isEmpty()) {
            return failed("SECTION_NUMBER_CONTINUITY", "步骤编号", "步骤编号连续性",
                    "变更实施步骤中未识别到“步骤1*”格式的编号",
                    "从步骤1开始连续，不能跳号或重复", "未识别", null);
        }

        List<String> errors = new ArrayList<>();
        for (int index = 0; index < numbers.size(); index++) {
            int expected = index + 1;
            if (numbers.get(index) != expected) {
                errors.add("期望步骤" + expected + "，实际步骤" + numbers.get(index));
            }
        }
        String actual = numbers.stream().map(number -> "步骤" + number).collect(Collectors.joining("、"));
        if (errors.isEmpty()) {
            return passed("SECTION_NUMBER_CONTINUITY", "步骤编号", "步骤编号连续性",
                    "步骤编号连续且没有重复", "从步骤1开始连续", actual, firstSource);
        }
        return failed("SECTION_NUMBER_CONTINUITY", "步骤编号", "步骤编号连续性",
                String.join("；", errors), "从步骤1开始连续，不能跳号或重复", actual, firstSource);
    }

    private ValidationCheckDto validateSystemTitle(List<TextSegment> segments, ValidationProfile profile) {
        String expectedTitle = profile.getExpectedTitle();
        TextSegment duplicateTitle = findFirstContaining(segments, expectedTitle.replaceFirst("系统", "系统系统"));
        if (duplicateTitle != null) {
            return failed("SYSTEM_TITLE_FORMAT", "标题", "系统名称与标题",
                    "标题中的“系统”重复，属于系统名称错别字", expectedTitle,
                    summarize(duplicateTitle.getText()), duplicateTitle);
        }
        TextSegment source = findFirstContaining(segments, expectedTitle);
        if (source != null) {
            return passed("SYSTEM_TITLE_FORMAT", "标题", "系统名称与标题",
                    "标题中的系统名称填写正确", expectedTitle, expectedTitle, source);
        }
        return failed("SYSTEM_TITLE_FORMAT", "标题", "系统名称与标题",
                "未找到正确的" + profile.getSystemName() + "变更方案标题", expectedTitle, "未识别", null);
    }

    private NumberedHeading parseNumberedHeading(TextSegment segment) {
        String text = segment.getText() == null ? "" : segment.getText().trim();
        Matcher matcher = NUMBERED_HEADING.matcher(text);
        if (!matcher.matches()) return null;
        String title = matcher.group(3).trim();
        if (title.isEmpty() || title.length() > 50 || title.matches(".*[。；;！？!?]$")) return null;
        Integer second = matcher.group(2) == null ? null : Integer.parseInt(matcher.group(2));
        return new NumberedHeading(Integer.parseInt(matcher.group(1)), second, segment);
    }

    private List<ValidationCheckDto> validateServerRows(List<TextSegment> segments,
                                                        List<String> configuredAssets,
                                                        ValidationProfile profile) {
        List<ServerEntry> entries = new ArrayList<>();
        TextSegment firstHeader = null;
        for (int index = 0; index < segments.size(); index++) {
            TextSegment header = segments.get(index);
            int serverColumn = findCellIndex(header.getCells(), "服务器");
            int userColumn = findCellIndex(header.getCells(), "用户");
            if (serverColumn < 0 || userColumn < 0) continue;
            if (firstHeader == null) firstHeader = header;

            int requiredColumns = Math.max(serverColumn, userColumn);
            for (int next = index + 1; next < segments.size(); next++) {
                TextSegment row = segments.get(next);
                if (row.getCells() == null || row.getCells().isEmpty()) break;
                if (!header.getLocation().equals(row.getLocation())) break;
                if (findCellIndex(row.getCells(), "服务器") >= 0) break;
                String server = row.getCells().size() > serverColumn ? row.getCells().get(serverColumn).trim() : "";
                String user = row.getCells().size() > userColumn ? row.getCells().get(userColumn).trim() : "";
                if (row.getCells().size() <= requiredColumns || (isEmptyValue(server) && isEmptyValue(user))) continue;
                List<String> serverNames = splitServerNames(server);
                if (serverNames.isEmpty()) {
                    entries.add(new ServerEntry(server, user, row));
                } else {
                    for (String serverName : serverNames) {
                        entries.add(new ServerEntry(serverName, user, row));
                    }
                }
            }
        }

        List<ValidationCheckDto> checks = new ArrayList<>();
        List<ServerEntry> missingServers = entries.stream().filter(item -> isEmptyValue(item.getServer())).collect(Collectors.toList());
        if (!entries.isEmpty() && missingServers.isEmpty()) {
            checks.add(passed("MANUAL_SERVER_REQUIRED", "服务器", "服务器名称不能为空",
                    "服务器名称均已填写", "每个服务器数据行都填写服务器名称",
                    joinServers(entries), entries.get(0).getSource()));
        } else {
            checks.add(failed("MANUAL_SERVER_REQUIRED", "服务器", "服务器名称不能为空",
                    entries.isEmpty() ? "未识别到服务器数据行" : "存在服务器名称为空的数据行",
                    "每个服务器数据行都填写服务器名称",
                    entries.isEmpty() ? "未识别" : summarizeRows(missingServers),
                    entries.isEmpty() ? firstHeader : missingServers.get(0).getSource()));
        }

        List<ServerEntry> unpaired = entries.stream()
                .filter(item -> isEmptyValue(item.getServer()) != isEmptyValue(item.getUser()))
                .collect(Collectors.toList());
        if (firstHeader != null && unpaired.isEmpty()) {
            checks.add(passed("MANUAL_SERVER_USER_PAIR", "服务器", "服务器与用户成对填写",
                    "服务器和用户均成对填写", "禁止只填写服务器或用户其中一列",
                    entries.isEmpty() ? "无数据行" : summarizeRows(entries), firstHeader));
        } else {
            checks.add(failed("MANUAL_SERVER_USER_PAIR", "服务器", "服务器与用户成对填写",
                    firstHeader == null ? "未识别到“服务器 / 用户”表格" : "存在只填写一列的数据行",
                    "服务器和用户必须同时填写", unpaired.isEmpty() ? "未识别" : summarizeRows(unpaired),
                    unpaired.isEmpty() ? firstHeader : unpaired.get(0).getSource()));
        }

        List<ServerEntry> invalidNames = entries.stream()
                .filter(item -> !isEmptyValue(item.getServer()))
                .filter(item -> !profile.getServerName().matcher(item.getServer()).matches())
                .collect(Collectors.toList());
        if (!entries.isEmpty() && invalidNames.isEmpty()) {
            checks.add(passed("MANUAL_SERVER_NAME_FORMAT", "服务器", "服务器名称格式",
                    "服务器名称均符合" + profile.getSystemName() + "命名规则", profile.getServerNameDescription(),
                    joinServers(entries), entries.get(0).getSource()));
        } else {
            checks.add(failed("MANUAL_SERVER_NAME_FORMAT", "服务器", "服务器名称格式",
                    entries.isEmpty() ? "没有可检查的服务器名称" : "存在不符合" + profile.getSystemName() + "命名规则的服务器名称",
                    profile.getServerNameExample(), invalidNames.isEmpty() ? "未识别" : joinServers(invalidNames),
                    invalidNames.isEmpty() ? firstHeader : invalidNames.get(0).getSource()));
        }

        List<String> safeAssets = configuredAssets == null ? Collections.emptyList() : configuredAssets;
        Set<String> assets = safeAssets.stream().filter(item -> item != null && !item.trim().isEmpty())
                .map(item -> item.trim().toUpperCase(Locale.ROOT))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        List<ServerEntry> populatedEntries = entries.stream()
                .filter(item -> !isEmptyValue(item.getServer())).collect(Collectors.toList());
        if (assets.isEmpty()) {
            checks.add(warning("MANUAL_SERVER_ASSET_MATCH", "服务器", "服务器资产清单核对",
                    "尚未配置服务器资产清单，本次只检查名称格式",
                    "在校验规则中维护" + profile.getSystemName() + "服务器资产名称", joinServers(populatedEntries), firstHeader));
        } else {
            List<ServerEntry> unknownServers = populatedEntries.stream()
                    .filter(item -> !assets.contains(item.getServer().toUpperCase(Locale.ROOT)))
                    .collect(Collectors.toList());
            if (!populatedEntries.isEmpty() && unknownServers.isEmpty()) {
                checks.add(passed("MANUAL_SERVER_ASSET_MATCH", "服务器", "服务器资产清单核对",
                        "服务器名称均存在于已配置的资产清单", "全部服务器存在于资产清单",
                        joinServers(populatedEntries), populatedEntries.get(0).getSource()));
            } else {
                checks.add(failed("MANUAL_SERVER_ASSET_MATCH", "服务器", "服务器资产清单核对",
                        populatedEntries.isEmpty() ? "没有可核对的服务器名称" : "存在资产清单外的服务器名称",
                        "全部服务器存在于资产清单",
                        unknownServers.isEmpty() ? "未识别" : joinServers(unknownServers),
                        unknownServers.isEmpty() ? firstHeader : unknownServers.get(0).getSource()));
            }
        }
        return checks;
    }

    private List<String> splitServerNames(String value) {
        if (isEmptyValue(value)) return Collections.emptyList();
        return Arrays.stream(value.split("[\\s,，、;；|｜]+"))
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .collect(Collectors.toList());
    }

    private List<ValidationCheckDto> validateWechatServerRows(List<TextSegment> segments,
                                                              List<String> configuredAssets,
                                                              ValidationProfile profile) {
        List<WechatServerEntry> entries = new ArrayList<>();
        TextSegment firstHeader = null;
        for (int index = 0; index < segments.size(); index++) {
            TextSegment header = segments.get(index);
            int detailColumn = findWechatServerColumn(header.getCells());
            if (detailColumn < 0) continue;
            if (firstHeader == null) firstHeader = header;

            for (int next = index + 1; next < segments.size(); next++) {
                TextSegment row = segments.get(next);
                if (!header.getLocation().equals(row.getLocation())) break;
                if (findWechatServerColumn(row.getCells()) >= 0) break;
                if (row.getCells() == null || row.getCells().size() <= detailColumn) continue;
                entries.addAll(parseWechatServerCell(row.getCells().get(detailColumn), row));
            }
        }

        if (SYSTEM_TREASURY.equals(profile.getSystemCode()) && entries.isEmpty()) {
            TextSegment exempt = segments.stream()
                    .filter(item -> item.getText().contains("应用跳板机")
                            || item.getText().contains("不涉及") || compact(item.getText()).equals("无"))
                    .findFirst().orElse(null);
            if (exempt != null) {
                return treasuryExemptServerChecks(exempt);
            }
        }

        List<ValidationCheckDto> checks = new ArrayList<>();
        List<WechatServerEntry> missingHosts = entries.stream()
                .filter(item -> isEmptyValue(item.getServer())).collect(Collectors.toList());
        if (!entries.isEmpty() && missingHosts.isEmpty()) {
            checks.add(passed("MANUAL_SERVER_REQUIRED", "服务器", "服务器名称不能为空",
                    profile.getSystemName() + "服务器名称均已填写", "每组数据都填写主机名",
                    joinWechatServers(entries), entries.get(0).getSource()));
        } else {
            checks.add(failed("MANUAL_SERVER_REQUIRED", "服务器", "服务器名称不能为空",
                    entries.isEmpty() ? "未识别到IP、主机名、用户数据" : "存在主机名为空的数据",
                    "每组数据都填写主机名", entries.isEmpty() ? "未识别" : summarizeWechatRows(missingHosts),
                    entries.isEmpty() ? firstHeader : missingHosts.get(0).getSource()));
        }

        List<WechatServerEntry> incomplete = entries.stream()
                .filter(item -> isEmptyValue(item.getIp()) || isEmptyValue(item.getServer()) || isEmptyValue(item.getUser()))
                .collect(Collectors.toList());
        if (!entries.isEmpty() && incomplete.isEmpty()) {
            checks.add(passed("MANUAL_SERVER_USER_PAIR", "服务器", "IP、主机名、用户成组填写",
                    "IP、主机名、用户均成组填写", "三项必须同时填写",
                    summarizeWechatRows(entries), entries.get(0).getSource()));
        } else {
            checks.add(failed("MANUAL_SERVER_USER_PAIR", "服务器", "IP、主机名、用户成组填写",
                    entries.isEmpty() ? "未识别到IP、主机名、用户数据" : "存在三项未同时填写的数据",
                    "IP、主机名、用户必须同时填写", incomplete.isEmpty() ? "未识别" : summarizeWechatRows(incomplete),
                    incomplete.isEmpty() ? firstHeader : incomplete.get(0).getSource()));
        }

        List<WechatServerEntry> invalidIps = entries.stream()
                .filter(item -> !isEmptyValue(item.getIp()) && !isValidIpv4(item.getIp()))
                .collect(Collectors.toList());
        if (!entries.isEmpty() && invalidIps.isEmpty()) {
            checks.add(passed("MANUAL_SERVER_IP_FORMAT", "服务器", "服务器IP格式",
                    "服务器IP均为有效IPv4地址", "四段0至255的IPv4地址",
                    entries.stream().map(WechatServerEntry::getIp).distinct().collect(Collectors.joining("、")),
                    entries.get(0).getSource()));
        } else {
            checks.add(failed("MANUAL_SERVER_IP_FORMAT", "服务器", "服务器IP格式",
                    entries.isEmpty() ? "没有可检查的服务器IP" : "存在无效IPv4地址",
                    "四段0至255的IPv4地址",
                    invalidIps.isEmpty() ? "未识别" : invalidIps.stream().map(WechatServerEntry::getIp).collect(Collectors.joining("、")),
                    invalidIps.isEmpty() ? firstHeader : invalidIps.get(0).getSource()));
        }

        List<WechatServerEntry> invalidNames = entries.stream()
                .filter(item -> !isEmptyValue(item.getServer()))
                .filter(item -> !profile.getServerName().matcher(item.getServer()).matches())
                .collect(Collectors.toList());
        if (!entries.isEmpty() && invalidNames.isEmpty()) {
            checks.add(passed("MANUAL_SERVER_NAME_FORMAT", "服务器", "服务器名称格式",
                    "服务器名称均符合" + profile.getSystemName() + "命名规则", profile.getServerNameDescription(),
                    joinWechatServers(entries), entries.get(0).getSource()));
        } else {
            checks.add(failed("MANUAL_SERVER_NAME_FORMAT", "服务器", "服务器名称格式",
                    entries.isEmpty() ? "没有可检查的服务器名称" : "存在不符合" + profile.getSystemName() + "命名规则的服务器名称",
                    profile.getServerNameExample(), invalidNames.isEmpty() ? "未识别" : joinWechatServers(invalidNames),
                    invalidNames.isEmpty() ? firstHeader : invalidNames.get(0).getSource()));
        }

        Set<String> assets = normalizeAssets(configuredAssets);
        List<WechatServerEntry> populated = entries.stream()
                .filter(item -> !isEmptyValue(item.getServer())).collect(Collectors.toList());
        if (assets.isEmpty()) {
            checks.add(warning("MANUAL_SERVER_ASSET_MATCH", "服务器", "服务器资产清单核对",
                    "尚未配置" + profile.getSystemName() + "服务器资产清单，本次只检查名称及IP格式",
                    "在校验规则中维护" + profile.getSystemName() + "服务器资产名称", joinWechatServers(populated), firstHeader));
        } else {
            List<WechatServerEntry> unknown = populated.stream()
                    .filter(item -> !assets.contains(item.getServer().toUpperCase(Locale.ROOT)))
                    .collect(Collectors.toList());
            if (!populated.isEmpty() && unknown.isEmpty()) {
                checks.add(passed("MANUAL_SERVER_ASSET_MATCH", "服务器", "服务器资产清单核对",
                        "服务器名称均存在于" + profile.getSystemName() + "资产清单", "全部服务器存在于资产清单",
                        joinWechatServers(populated), populated.get(0).getSource()));
            } else {
                checks.add(failed("MANUAL_SERVER_ASSET_MATCH", "服务器", "服务器资产清单核对",
                        populated.isEmpty() ? "没有可核对的服务器名称" : "存在资产清单外的服务器名称",
                        "全部服务器存在于资产清单",
                        unknown.isEmpty() ? "未识别" : joinWechatServers(unknown),
                        unknown.isEmpty() ? firstHeader : unknown.get(0).getSource()));
            }
        }
        return checks;
    }

    private List<ValidationCheckDto> treasuryExemptServerChecks(TextSegment source) {
        List<ValidationCheckDto> checks = new ArrayList<>();
        String actual = summarize(source.getText());
        checks.add(passed("MANUAL_SERVER_REQUIRED", "服务器", "服务器名称不能为空",
                "该步骤属于已确认的服务器豁免场景", "应用跳板机、不涉及或无可不填写", actual, source));
        checks.add(passed("MANUAL_SERVER_USER_PAIR", "服务器", "IP、主机名、用户成组填写",
                "该步骤属于已确认的服务器豁免场景", "非豁免场景三项必须同时填写", actual, source));
        checks.add(passed("MANUAL_SERVER_IP_FORMAT", "服务器", "服务器IP格式",
                "该步骤属于已确认的服务器豁免场景", "非豁免场景填写有效IPv4地址", actual, source));
        checks.add(passed("MANUAL_SERVER_NAME_FORMAT", "服务器", "服务器名称格式",
                "该步骤属于已确认的服务器豁免场景", "非豁免场景遵循CBMS2G命名", actual, source));
        checks.add(passed("MANUAL_SERVER_ASSET_MATCH", "服务器", "服务器资产清单核对",
                "该步骤属于已确认的服务器豁免场景", "非豁免场景与对应资产清单核对", actual, source));
        return checks;
    }

    private int findWechatServerColumn(List<String> cells) {
        if (cells == null) return -1;
        for (int index = 0; index < cells.size(); index++) {
            String value = compact(cells.get(index));
            if (value.contains("IP") && value.contains("主机名") && value.contains("用户")) return index;
        }
        return -1;
    }

    private List<WechatServerEntry> parseWechatServerCell(String value, TextSegment source) {
        if (value == null || value.trim().isEmpty()) return Collections.emptyList();
        List<WechatServerEntry> entries = new ArrayList<>();
        List<MatcherRange> ipRanges = new ArrayList<>();
        Matcher ipMatcher = IPV4_CANDIDATE.matcher(value);
        while (ipMatcher.find()) {
            ipRanges.add(new MatcherRange(ipMatcher.start(), ipMatcher.end(), ipMatcher.group()));
        }
        for (int index = 0; index < ipRanges.size(); index++) {
            MatcherRange current = ipRanges.get(index);
            int end = index + 1 < ipRanges.size() ? ipRanges.get(index + 1).getStart() : value.length();
            String remainder = value.substring(current.getEnd(), end);
            Matcher hostMatcher = WECHAT_HOST_CANDIDATE.matcher(remainder);
            String host = hostMatcher.find() ? hostMatcher.group().toUpperCase(Locale.ROOT) : "";
            String user = "";
            if (!host.isEmpty()) {
                String afterHost = remainder.substring(hostMatcher.end());
                String[] tokens = afterHost.split("[\\s,，、;；|｜]+", -1);
                for (String token : tokens) {
                    if (!token.trim().isEmpty()) {
                        user = token.trim();
                        break;
                    }
                }
            }
            entries.add(new WechatServerEntry(current.getValue(), host, user, source));
        }
        if (entries.isEmpty()) {
            Matcher hostMatcher = WECHAT_HOST_CANDIDATE.matcher(value);
            while (hostMatcher.find()) {
                String afterHost = value.substring(hostMatcher.end());
                String[] tokens = afterHost.split("[\\s,，、;；|｜]+", -1);
                String user = "";
                for (String token : tokens) {
                    if (!token.trim().isEmpty()) {
                        user = token.trim();
                        break;
                    }
                }
                entries.add(new WechatServerEntry("", hostMatcher.group().toUpperCase(Locale.ROOT), user, source));
            }
        }
        return entries;
    }

    private boolean isValidIpv4(String value) {
        if (value == null) return false;
        String[] parts = value.split("\\.", -1);
        if (parts.length != 4) return false;
        for (String part : parts) {
            try {
                if (part.isEmpty() || Integer.parseInt(part) > 255) return false;
            } catch (NumberFormatException ex) {
                return false;
            }
        }
        return true;
    }

    private Set<String> normalizeAssets(List<String> configuredAssets) {
        if (configuredAssets == null) return Collections.emptySet();
        return configuredAssets.stream().filter(item -> item != null && !item.trim().isEmpty())
                .map(item -> item.trim().toUpperCase(Locale.ROOT))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private List<ValidationCheckDto> validateDevOpsFields(String fileName,
                                                          List<TextSegment> segments,
                                                          ValidationProfile profile) {
        List<ValidationCheckDto> checks = new ArrayList<>();
        List<LabeledValue> pipelines = findLabeledValues(segments, profile.getPipelineLabels());
        List<LabeledValue> environments = findLabeledValues(segments, profile.getEnvironmentLabels());
        List<LabeledValue> changeDates = findLabeledValues(segments, profile.getChangeDateLabels());
        List<LabeledValue> repositories = findLabeledValues(segments, profile.getRepositoryLabels());
        List<LabeledValue> changeTickets = findLabeledValues(segments, CHANGE_TICKET_LABELS);
        List<LabeledValue> workspaces = findLabeledValues(segments, profile.getWorkspaceLabels());

        checks.add(validatePipeline(pipelines, profile));
        checks.add(validateChangeTickets(changeTickets));
        if (profile.getExpectedWorkspace() != null) {
            checks.add(validateWorkspace(workspaces, profile));
        }
        List<LabeledValue> invalidEnvironments = environments.stream()
                .filter(item -> isEmptyValue(item.getValue())
                        || !profile.getProductionEnvironment().matcher(item.getValue()).matches())
                .collect(Collectors.toList());
        if (environments.isEmpty()) {
            checks.add(failed("AUTO_DEVOPS_ENVIRONMENT", "DevOps", "DevOps 环境",
                    "未填写 DevOps 环境", profile.getProductionEnvironmentDescription(), "未识别", null));
        } else if (invalidEnvironments.isEmpty()) {
            checks.add(passed("AUTO_DEVOPS_ENVIRONMENT", "DevOps", "DevOps 环境",
                    "生产环境填写正确", profile.getProductionEnvironmentDescription(),
                    joinLabeledValues(environments), environments.get(0).getSource()));
        } else {
            checks.add(failed("AUTO_DEVOPS_ENVIRONMENT", "DevOps", "DevOps 环境",
                    "存在不符合生产环境规则的值", profile.getProductionEnvironmentDescription(),
                    joinLabeledValues(invalidEnvironments), invalidEnvironments.get(0).getSource()));
        }

        String expectedDate = extractDate(fileName);
        if (changeDates.isEmpty()) {
            checks.add(failed("AUTO_DEVOPS_CHANGE_DATE", "DevOps", "DevOps 变更日期",
                    "未填写 DevOps 变更日期", expectedDate == null ? "YYYYMMDD" : expectedDate,
                    "未识别", null));
        } else {
            List<LabeledValue> invalidDates = changeDates.stream()
                    .filter(item -> expectedDate == null || !expectedDate.equals(extractDate(item.getValue())))
                    .collect(Collectors.toList());
            if (invalidDates.isEmpty()) {
                checks.add(passed("AUTO_DEVOPS_CHANGE_DATE", "DevOps", "DevOps 变更日期",
                        "所有 DevOps 变更日期均已填写且与文件名一致", expectedDate,
                        joinLabeledValues(changeDates), changeDates.get(0).getSource()));
            } else {
                checks.add(failed("AUTO_DEVOPS_CHANGE_DATE", "DevOps", "DevOps 变更日期",
                        "存在为空、格式不正确或与文件名不一致的 DevOps 变更日期",
                        expectedDate == null ? "YYYYMMDD" : expectedDate,
                        joinLabeledValues(invalidDates), invalidDates.get(0).getSource()));
            }
        }
        if (profile.isRepositoryRequired()) {
            checks.add(requiredFieldsCheck("AUTO_ARTIFACT_REPOSITORY_REQUIRED", "DevOps",
                    "制品库名称不能为空", repositories));
        }
        return checks;
    }

    private List<ValidationCheckDto> validateTreasuryManualReferences(String automaticFileName,
                                                                       List<TextSegment> segments,
                                                                       String selectedSaasFileName,
                                                                       String selectedNtFileName) {
        String date = extractDate(automaticFileName);
        String saas = date == null ? TREASURY_SAAS_MANUAL_FILE_FORMAT
                : TREASURY_SAAS_MANUAL_FILE_FORMAT.replace("YYYYMMDD", date);
        String nt = date == null ? TREASURY_NT_MANUAL_FILE_FORMAT
                : TREASURY_NT_MANUAL_FILE_FORMAT.replace("YYYYMMDD", date);
        List<ValidationCheckDto> checks = new ArrayList<>();
        checks.add(validateTreasuryManualReference("AUTO_TREASURY_SAAS_REFERENCE",
                "财资 SaaS 手动变更单引用", saas, selectedSaasFileName, segments));
        checks.add(validateTreasuryManualReference("AUTO_TREASURY_NT_REFERENCE",
                "财资 NT 手动变更单引用", nt, selectedNtFileName, segments));
        return checks;
    }

    private ValidationCheckDto validateTreasuryManualReference(String code,
                                                                 String label,
                                                                 String referencedFileName,
                                                                 String selectedFileName,
                                                                 List<TextSegment> segments) {
        TextSegment source = findFirstContaining(segments, referencedFileName);
        if (source == null) {
            return failed(code, "关联文件", label,
                    "自动变更步骤中未找到同日手动变更单文件名",
                    referencedFileName, "未识别", null);
        }
        if (selectedFileName == null || selectedFileName.trim().isEmpty()) {
            return warning(code, "关联文件", label,
                    "未选择配套手动文件，已校验正文引用的命名格式和日期，未执行实际文件名比对",
                    "可选上传配套手动文件进行精确比对", referencedFileName, source);
        }
        String selected = selectedFileName.trim();
        if (referencedFileName.equals(selected)) {
            return passed(code, "关联文件", label,
                    "文档引用的手动文件名与所选文件完全一致",
                    selected, referencedFileName, source);
        }
        return failed(code, "关联文件", label,
                "文档中的手动文件名与实际所选文件不一致",
                selected, referencedFileName, source);
    }

    private List<ValidationCheckDto> validateTreasuryBranches(String fileName,
                                                               List<TextSegment> segments,
                                                               ValidationProfile profile) {
        List<LabeledValue> pipelines = findLabeledValues(segments, profile.getPipelineLabels());
        List<LabeledValue> environments = findLabeledValues(segments, profile.getEnvironmentLabels());
        List<LabeledValue> dates = findLabeledValues(segments, profile.getChangeDateLabels());
        List<LabeledValue> repositories = findLabeledValues(segments, profile.getRepositoryLabels());
        List<LabeledValue> tickets = findLabeledValues(segments, CHANGE_TICKET_LABELS);
        Map<String, String> expected = new LinkedHashMap<>();
        expected.put("CBMS2G_ALL_prod-demo_main", "demo");
        expected.put("CBMS2G_ALL_prod_main", "prod");
        expected.put("CBMS2G_ALL_prod_main_nt", "nt");

        boolean pairValid = !pipelines.isEmpty() && pipelines.size() == environments.size();
        if (pairValid) {
            for (int index = 0; index < pipelines.size(); index++) {
                if (!environments.get(index).getValue().equals(expected.get(pipelines.get(index).getValue()))) {
                    pairValid = false;
                    break;
                }
            }
        }
        List<ValidationCheckDto> checks = new ArrayList<>();
        checks.add(pairValid
                ? passed("AUTO_TREASURY_PIPELINE_ENV_MATCH", "DevOps", "流水线与环境对应关系",
                "每个已填写分支的流水线与环境严格对应", "demo/prod/nt 分别对应规定流水线",
                joinLabeledValues(pipelines), pipelines.get(0).getSource())
                : failed("AUTO_TREASURY_PIPELINE_ENV_MATCH", "DevOps", "流水线与环境对应关系",
                "流水线与环境数量或对应关系不正确", "CBMS2G_ALL_prod-demo_main→demo，CBMS2G_ALL_prod_main→prod，CBMS2G_ALL_prod_main_nt→nt",
                joinLabeledValues(pipelines) + " / " + joinLabeledValues(environments),
                pipelines.isEmpty() ? null : pipelines.get(0).getSource()));

        int branchCount = pipelines.size();
        String expectedDate = extractDate(fileName);
        boolean fieldsValid = branchCount > 0
                && tickets.size() == branchCount && dates.size() == branchCount && repositories.size() == branchCount
                && tickets.stream().allMatch(item -> CHANGE_TICKET_VALUE.matcher(item.getValue()).matches())
                && dates.stream().allMatch(item -> expectedDate != null && expectedDate.equals(extractDate(item.getValue())))
                && repositories.stream().allMatch(item -> !isEmptyValue(item.getValue()));
        checks.add(fieldsValid
                ? passed("AUTO_TREASURY_BRANCH_FIELDS", "DevOps", "财资分支必填参数",
                "每个已填写分支均包含 BGDCHG、变更日期和 sysname", "每个分支三项齐全且日期与文件名一致",
                "分支数=" + branchCount, pipelines.get(0).getSource())
                : failed("AUTO_TREASURY_BRANCH_FIELDS", "DevOps", "财资分支必填参数",
                "至少一个分支缺少 BGDCHG、变更日期或 sysname，或字段数量与分支数不一致",
                "每个分支均填写有效 BGDCHG、同日 date 和非空 sysname",
                "流水线=" + branchCount + "，BGDCHG=" + tickets.size() + "，date=" + dates.size() + "，sysname=" + repositories.size(),
                pipelines.isEmpty() ? null : pipelines.get(0).getSource()));
        return checks;
    }

    private ValidationCheckDto validatePipeline(List<LabeledValue> pipelines, ValidationProfile profile) {
        ValidationCheckDto required = requiredFieldsCheck("AUTO_DEVOPS_PIPELINE_REQUIRED", "DevOps",
                profile.getSystemName() + " DevOps 流程不能为空", pipelines);
        if (!"PASSED".equals(required.getStatus()) || profile.getPipelineValuePattern() == null) {
            return required;
        }
        List<LabeledValue> invalid = pipelines.stream()
                .filter(item -> !profile.getPipelineValuePattern().matcher(item.getValue()).matches())
                .collect(Collectors.toList());
        if (invalid.isEmpty()) {
            return passed("AUTO_DEVOPS_PIPELINE_REQUIRED", "DevOps", profile.getSystemName() + " DevOps 流程",
                    "部署流程填写正确", profile.getPipelineValueDescription(),
                    joinLabeledValues(pipelines), pipelines.get(0).getSource());
        }
        return failed("AUTO_DEVOPS_PIPELINE_REQUIRED", "DevOps", profile.getSystemName() + " DevOps 流程",
                "部署流程与系统规定值不一致", profile.getPipelineValueDescription(),
                joinLabeledValues(invalid), invalid.get(0).getSource());
    }

    private ValidationCheckDto validateChangeTickets(List<LabeledValue> changeTickets) {
        if (changeTickets == null || changeTickets.isEmpty()) {
            return failed("AUTO_CHANGE_TICKET_REQUIRED", "DevOps", "ITSM 变更单号 BGDCHG",
                    "未填写 BGDCHG 变更单号", "CHG-N-后跟7位字母或数字", "未识别", null);
        }
        List<LabeledValue> invalid = changeTickets.stream()
                .filter(item -> isEmptyValue(item.getValue()) || !CHANGE_TICKET_VALUE.matcher(item.getValue()).matches())
                .collect(Collectors.toList());
        if (invalid.isEmpty()) {
            return passed("AUTO_CHANGE_TICKET_REQUIRED", "DevOps", "ITSM 变更单号 BGDCHG",
                    "BGDCHG 已填写且格式正确", "CHG-N-后跟7位字母或数字",
                    joinLabeledValues(changeTickets), changeTickets.get(0).getSource());
        }
        return failed("AUTO_CHANGE_TICKET_REQUIRED", "DevOps", "ITSM 变更单号 BGDCHG",
                "BGDCHG 为空或格式不正确", "CHG-N-后跟7位字母或数字",
                joinLabeledValues(invalid), invalid.get(0).getSource());
    }

    private ValidationCheckDto validateWorkspace(List<LabeledValue> workspaces, ValidationProfile profile) {
        if (workspaces == null || workspaces.isEmpty()) {
            return failed("AUTO_DEVOPS_WORKSPACE", "DevOps", "DevOps 协作空间",
                    "未填写协作空间", profile.getExpectedWorkspace(), "未识别", null);
        }
        List<LabeledValue> invalid = workspaces.stream()
                .filter(item -> !profile.getExpectedWorkspace().equals(item.getValue()))
                .collect(Collectors.toList());
        if (invalid.isEmpty()) {
            return passed("AUTO_DEVOPS_WORKSPACE", "DevOps", "DevOps 协作空间",
                    "协作空间填写正确", profile.getExpectedWorkspace(),
                    joinLabeledValues(workspaces), workspaces.get(0).getSource());
        }
        return failed("AUTO_DEVOPS_WORKSPACE", "DevOps", "DevOps 协作空间",
                "协作空间与网银系统规定值不一致", profile.getExpectedWorkspace(),
                joinLabeledValues(invalid), invalid.get(0).getSource());
    }

    private ValidationCheckDto requiredFieldsCheck(String code, String category, String label,
                                                   List<LabeledValue> fields) {
        if (fields != null && !fields.isEmpty()
                && fields.stream().noneMatch(item -> isEmptyValue(item.getValue()))) {
            return passed(code, category, label, "所有字段均已填写", "非空",
                    joinLabeledValues(fields), fields.get(0).getSource());
        }
        LabeledValue firstEmpty = fields == null ? null : fields.stream()
                .filter(item -> isEmptyValue(item.getValue())).findFirst().orElse(null);
        return failed(code, category, label, "字段未填写或为空", "非空",
                fields == null || fields.isEmpty() ? "未识别" : joinLabeledValues(fields),
                firstEmpty == null ? null : firstEmpty.getSource());
    }

    private List<LabeledValue> findLabeledValues(List<TextSegment> segments, List<String> labels) {
        String alternatives = String.join("|", labels);
        Pattern inline = Pattern.compile("(?i)(?:^|[|｜\\s])(?:" + alternatives
                + ")\\s*[:：]\\s*([^\\s|｜]*)");
        List<LabeledValue> values = new ArrayList<>();
        for (TextSegment segment : segments) {
            Matcher matcher = inline.matcher(segment.getText());
            while (matcher.find()) values.add(new LabeledValue(matcher.group(1).trim(), segment));
        }
        return values;
    }

    private String joinLabeledValues(List<LabeledValue> values) {
        if (values == null || values.isEmpty()) return "未识别";
        return values.stream().map(item -> isEmptyValue(item.getValue()) ? "[空]" : item.getValue())
                .collect(Collectors.joining("、"));
    }

    private ValidationCheckDto validateDangerousCommands(List<TextSegment> allSegments,
                                                          List<TextSegment> implementationSegments) {
        DangerMatch danger = null;
        for (TextSegment segment : implementationSegments) {
            Matcher rmMatcher = DANGEROUS_RM.matcher(segment.getText());
            if (rmMatcher.find()) {
                danger = new DangerMatch(rmMatcher.group(), segment);
                break;
            }
            Matcher sqlMatcher = DANGEROUS_SQL.matcher(segment.getText());
            if (sqlMatcher.find()) {
                danger = new DangerMatch(sqlMatcher.group(), segment);
                break;
            }
            Matcher redisMatcher = DANGEROUS_REDIS.matcher(segment.getText());
            if (redisMatcher.find()) {
                danger = new DangerMatch(redisMatcher.group(), segment);
                break;
            }
        }
        if (danger == null) {
            return passed("DANGEROUS_COMMAND_BACKUP", "安全命令", "危险命令与备份步骤",
                    "未发现无范围限制的 rm -rf、DROP、TRUNCATE、flushall 或 flushdb",
                    "不使用危险命令；确需使用时必须先备份", "未发现", null);
        }

        TextSegment backup = null;
        for (TextSegment segment : allSegments) {
            if (segment.getLineNumber() >= danger.getSource().getLineNumber()) break;
            String compactText = compact(segment.getText());
            boolean backupSectionHeading = compactText.matches("变更实施前备份\\*?");
            if (!backupSectionHeading
                    && BACKUP_SIGNAL.matcher(segment.getText()).find()
                    && !NO_BACKUP_SIGNAL.matcher(segment.getText()).find()) {
                backup = segment;
            }
        }
        if (backup != null) {
            return warning("DANGEROUS_COMMAND_BACKUP", "安全命令", "危险命令与备份步骤",
                    "发现危险命令，且前文存在备份步骤；仍需人工确认命令范围",
                    "危险命令前存在备份步骤，并人工确认影响范围", summarize(danger.getCommand()), danger.getSource());
        }
        return failed("DANGEROUS_COMMAND_BACKUP", "安全命令", "危险命令与备份步骤",
                "发现危险命令，但在它之前未找到备份步骤",
                "先完成备份，再执行限定范围的命令", summarize(danger.getCommand()), danger.getSource());
    }

    private List<TextSegment> implementationSegments(List<TextSegment> allSegments) {
        int start = -1;
        for (int index = 0; index < allSegments.size(); index++) {
            String compact = compact(allSegments.get(index).getText());
            if (compact.equals("变更实施步骤")
                    || compact.startsWith("变更实施步骤*")
                    || compact.startsWith("手动变更实施步骤*")) {
                start = index;
                break;
            }
        }
        if (start < 0) return Collections.emptyList();

        int end = allSegments.size();
        for (int index = start + 1; index < allSegments.size(); index++) {
            String compact = compact(allSegments.get(index).getText());
            if (compact.startsWith("变更复核方案")
                    || compact.startsWith("变更验证方案")
                    || compact.startsWith("变更实施期间发现异常的应急")
                    || compact.startsWith("变更实施发现异常的应急")) {
                end = index;
                break;
            }
        }
        return new ArrayList<>(allSegments.subList(start, end));
    }

    private int findCellIndex(List<String> cells, String expected) {
        if (cells == null) return -1;
        for (int index = 0; index < cells.size(); index++) {
            if (compact(cells.get(index)).equals(expected)) return index;
        }
        return -1;
    }

    private boolean isEmptyValue(String value) {
        return value == null || EMPTY_VALUES.contains(value.trim().toLowerCase(Locale.ROOT));
    }

    private String extractDate(String value) {
        if (value == null) return null;
        Matcher compactMatcher = COMPACT_DATE.matcher(value);
        if (compactMatcher.find()) return compactMatcher.group(1);
        Matcher separatedMatcher = SEPARATED_DATE.matcher(value);
        if (!separatedMatcher.find()) return null;
        return separatedMatcher.group(1)
                + String.format("%02d", Integer.parseInt(separatedMatcher.group(2)))
                + String.format("%02d", Integer.parseInt(separatedMatcher.group(3)));
    }

    private TextSegment findFirstContaining(List<TextSegment> segments, String value) {
        return segments.stream().filter(item -> item.getText().contains(value)).findFirst().orElse(null);
    }

    private String compact(String value) {
        return value == null ? "" : value.replaceAll("\\s+", "").replace("：", ":").trim();
    }

    private String summarize(String value) {
        if (value == null) return "";
        String oneLine = value.replace('\r', ' ').replace('\n', ' ').trim();
        return oneLine.length() <= 120 ? oneLine : oneLine.substring(0, 117) + "...";
    }

    private String joinServers(List<ServerEntry> entries) {
        if (entries == null || entries.isEmpty()) return "未识别";
        return entries.stream().map(ServerEntry::getServer).filter(value -> !isEmptyValue(value))
                .distinct().collect(Collectors.joining("、"));
    }

    private String summarizeRows(List<ServerEntry> entries) {
        if (entries == null || entries.isEmpty()) return "未识别";
        return entries.stream()
                .map(item -> (isEmptyValue(item.getServer()) ? "[服务器为空]" : item.getServer())
                        + " / " + (isEmptyValue(item.getUser()) ? "[用户为空]" : item.getUser()))
                .collect(Collectors.joining("；"));
    }

    private String joinWechatServers(List<WechatServerEntry> entries) {
        if (entries == null || entries.isEmpty()) return "未识别";
        return entries.stream().map(WechatServerEntry::getServer).filter(value -> !isEmptyValue(value))
                .distinct().collect(Collectors.joining("、"));
    }

    private String summarizeWechatRows(List<WechatServerEntry> entries) {
        if (entries == null || entries.isEmpty()) return "未识别";
        return entries.stream()
                .map(item -> (isEmptyValue(item.getIp()) ? "[IP为空]" : item.getIp())
                        + " / " + (isEmptyValue(item.getServer()) ? "[主机名为空]" : item.getServer())
                        + " / " + (isEmptyValue(item.getUser()) ? "[用户为空]" : item.getUser()))
                .collect(Collectors.joining("；"));
    }

    private ValidationCheckDto passed(String code, String category, String label, String message,
                                      String expected, String actual, TextSegment source) {
        return check(code, category, label, "PASSED", "INFO", message, expected, actual, source);
    }

    private ValidationCheckDto warning(String code, String category, String label, String message,
                                       String expected, String actual, TextSegment source) {
        return check(code, category, label, "WARNING", "MEDIUM", message, expected, actual, source);
    }

    private ValidationCheckDto failed(String code, String category, String label, String message,
                                      String expected, String actual, TextSegment source) {
        return check(code, category, label, "FAILED", "HIGH", message, expected, actual, source);
    }

    private ValidationCheckDto check(String code, String category, String label, String status,
                                     String severity, String message, String expected, String actual,
                                     TextSegment source) {
        return new ValidationCheckDto(
                UUID.randomUUID().toString(), code, category, label, status, severity, message,
                expected, actual,
                source == null ? "变更实施步骤" : source.getLocation(),
                source == null || source.getLineNumber() <= 0 ? null : source.getLineNumber());
    }

    @Data
    @AllArgsConstructor
    private static class NumberedHeading {
        private int first;
        private Integer second;
        private TextSegment source;

        private String number() {
            return second == null ? String.valueOf(first) : first + "." + second;
        }
    }

    @Data
    @AllArgsConstructor
    private static class ServerEntry {
        private String server;
        private String user;
        private TextSegment source;
    }

    @Data
    @AllArgsConstructor
    private static class WechatServerEntry {
        private String ip;
        private String server;
        private String user;
        private TextSegment source;
    }

    @Data
    @AllArgsConstructor
    private static class MatcherRange {
        private int start;
        private int end;
        private String value;
    }

    @Data
    @AllArgsConstructor
    private static class LabeledValue {
        private String value;
        private TextSegment source;
    }

    @Data
    @AllArgsConstructor
    private static class DangerMatch {
        private String command;
        private TextSegment source;
    }

    @Data
    @AllArgsConstructor
    private static class ValidationProfile {
        private String systemCode;
        private String systemName;
        private String manualFileFormat;
        private String automaticFileFormat;
        private Pattern manualFileName;
        private Pattern automaticFileName;
        private Pattern serverName;
        private String serverNameDescription;
        private String serverNameExample;
        private boolean manualReferenceRequired;
        private boolean middleSectionNumbersRequired;
        private boolean automaticImplementationTimeRequired;
        private boolean stepNumbering;
        private boolean wechatServerTable;
        private String expectedTitle;
        private List<String> pipelineLabels;
        private List<String> environmentLabels;
        private List<String> changeDateLabels;
        private List<String> repositoryLabels;
        private Pattern productionEnvironment;
        private String productionEnvironmentDescription;
        private Pattern pipelineValuePattern;
        private String pipelineValueDescription;
        private boolean repositoryRequired;
        private List<String> workspaceLabels;
        private String expectedWorkspace;
    }

    @Data
    @AllArgsConstructor
    public static class TextSegment {
        private int lineNumber;
        private String location;
        private String text;
        private List<String> cells;

        public TextSegment(int lineNumber, String location, String text) {
            this(lineNumber, location, text, Collections.emptyList());
        }
    }
}
