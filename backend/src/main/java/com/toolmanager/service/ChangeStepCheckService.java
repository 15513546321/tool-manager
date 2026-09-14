package com.toolmanager.service;

import com.toolmanager.config.MultipartUploadConfig;
import com.toolmanager.dto.ChangeStepCheckDtos.RiskItemDto;
import com.toolmanager.dto.ChangeStepCheckDtos.ScanResultDto;
import com.toolmanager.dto.ChangeStepCheckDtos.ScanSummaryDto;
import com.toolmanager.dto.ChangeStepCheckDtos.ValidationCheckDto;
import com.toolmanager.dto.ChangeStepCheckDtos.ValidationSummaryDto;
import com.toolmanager.service.ChangeStepCheckConfigService.InternalConfig;
import com.toolmanager.service.ChangeStepCheckConfigService.KnownPasswordFingerprint;
import com.toolmanager.service.ChangeStepBusinessValidationService.TextSegment;
import lombok.RequiredArgsConstructor;
import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFHeaderFooter;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChangeStepCheckService {
    public static final String VALIDATION_ENGINE_VERSION = "2.1";
    private static final long MAX_FILE_SIZE = MultipartUploadConfig.MAX_FILE_SIZE_BYTES;
    private static final int MAX_TEXT_SEGMENTS = 1_000_000;
    private static final long MAX_EXTRACTED_CHARACTERS = 120_000_000L;
    private static final Pattern PASSWORD_TOKEN = Pattern.compile("[\\p{L}\\p{N}@#$%^&*._+!~?/\\-]{4,128}");

    private final ChangeStepCheckConfigService configService;
    private final ChangeStepBusinessValidationService businessValidationService;

    public ScanResultDto scan(MultipartFile file) {
        return scan(file, ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM, null);
    }

    public ScanResultDto scan(MultipartFile file, String documentType, String systemCode,
                              String companionManualFileName) {
        return scan(file, documentType, systemCode, companionManualFileName, null, null);
    }

    public ScanResultDto scan(MultipartFile file, String documentType, String systemCode,
                              String companionManualFileName, String treasurySaasManualFileName,
                              String treasuryNtManualFileName) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("请选择需要检查的 Word 文档");
        }
        try (InputStream inputStream = file.getInputStream()) {
            return scan(file.getOriginalFilename(), file.getSize(), inputStream,
                    documentType, systemCode, companionManualFileName,
                    treasurySaasManualFileName, treasuryNtManualFileName);
        } catch (IOException ex) {
            throw new IllegalArgumentException("Word 文档读取失败，请确认文件未损坏或加密", ex);
        }
    }

    public ScanResultDto scan(String fileName, long fileSize, InputStream inputStream) {
        return scan(fileName, fileSize, inputStream, ChangeStepBusinessValidationService.TYPE_MANUAL,
                ChangeStepBusinessValidationService.SYSTEM_MIDDLE_PLATFORM, null);
    }

    public ScanResultDto scan(String fileName, long fileSize, InputStream inputStream,
                              String documentType, String systemCode, String companionManualFileName) {
        return scan(fileName, fileSize, inputStream, documentType, systemCode,
                companionManualFileName, null, null);
    }

    public ScanResultDto scan(String fileName, long fileSize, InputStream inputStream,
                              String documentType, String systemCode, String companionManualFileName,
                              String treasurySaasManualFileName, String treasuryNtManualFileName) {
        validateFile(fileName, fileSize, inputStream);
        String normalizedType = businessValidationService.normalizeDocumentType(documentType);
        String normalizedSystem = businessValidationService.normalizeSystemCode(systemCode);
        List<TextSegment> lines;
        try (InputStream limitedInputStream = new SizeLimitedInputStream(inputStream, MAX_FILE_SIZE)) {
            lines = fileName.toLowerCase(Locale.ROOT).endsWith(".docx")
                    ? extractDocx(limitedInputStream)
                    : extractDoc(limitedInputStream);
        } catch (IOException ex) {
            throw new IllegalArgumentException("Word 文档读取失败，请确认文件未损坏或加密", ex);
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("Word 文档解析失败，请确认文件未损坏或加密", ex);
        }

        long extractedCharacters = lines.stream().mapToLong(line -> line.getText().length()).sum();
        if (lines.size() > MAX_TEXT_SEGMENTS || extractedCharacters > MAX_EXTRACTED_CHARACTERS) {
            throw new IllegalArgumentException("文档文本内容过大，最多支持 1,000,000 个文本段或 120,000,000 个字符");
        }

        InternalConfig config = configService.getInternalConfig();
        List<RiskItemDto> risks = detectRisks(lines, config);
        String assetScope = normalizedSystem;
        if (ChangeStepBusinessValidationService.SYSTEM_TREASURY.equals(normalizedSystem)
                && ChangeStepBusinessValidationService.TYPE_MANUAL.equals(normalizedType)) {
            assetScope = fileName.toLowerCase(Locale.ROOT).endsWith("-nt.docx")
                    ? ChangeStepBusinessValidationService.TREASURY_NT_ASSET_SCOPE
                    : ChangeStepBusinessValidationService.TREASURY_SAAS_ASSET_SCOPE;
        }
        List<ValidationCheckDto> validationChecks = businessValidationService.validate(
                fileName, normalizedType, normalizedSystem, companionManualFileName,
                treasurySaasManualFileName, treasuryNtManualFileName, lines,
                config.getServerAssetNames(assetScope));
        ValidationSummaryDto validationSummary = summarizeValidation(validationChecks);
        ScanSummaryDto summary = new ScanSummaryDto(
                risks.size(),
                (int) risks.stream().filter(item -> "HIGH".equals(item.getSeverity())).count(),
                (int) risks.stream().filter(item -> "MEDIUM".equals(item.getSeverity())).count(),
                (int) risks.stream().filter(item -> "FIELD_KEYWORD".equals(item.getRiskType())).count(),
                (int) risks.stream().filter(item -> !"FIELD_KEYWORD".equals(item.getRiskType())).count()
        );
        return new ScanResultDto(
                fileName,
                normalizedSystem,
                businessValidationService.systemName(normalizedSystem),
                normalizedType,
                businessValidationService.documentTypeLabel(normalizedType),
                companionManualFileName,
                VALIDATION_ENGINE_VERSION,
                LocalDateTime.now(),
                lines.size(),
                summary,
                risks,
                validationSummary,
                validationChecks,
                null);
    }

    List<RiskItemDto> detectRisks(List<TextSegment> lines, InternalConfig config) {
        List<RiskItemDto> risks = new ArrayList<>();
        Set<String> deduplicationKeys = new HashSet<>();

        Pattern keywordPattern = compileKeywordPattern(config.getFieldKeywords());
        List<Pattern> configuredPatterns = config.getRegexPatterns().stream()
                .map(Pattern::compile)
                .collect(Collectors.toList());
        Map<String, KnownPasswordFingerprint> fingerprints = config.getKnownPasswords().stream()
                .collect(Collectors.toMap(KnownPasswordFingerprint::getFingerprint, item -> item, (first, ignored) -> first, LinkedHashMap::new));

        for (int index = 0; index < lines.size(); index++) {
            TextSegment line = lines.get(index);
            if (line.getText().trim().isEmpty()) {
                continue;
            }

            Matcher keywordMatcher = keywordPattern.matcher(line.getText());
            while (keywordMatcher.find()) {
                addRisk(risks, deduplicationKeys, lines, index, "FIELD_KEYWORD", "密码字段", "HIGH",
                        keywordMatcher.group(), keywordMatcher.start(), keywordMatcher.end(), keywordMatcher.group().toLowerCase(Locale.ROOT));
            }

            for (int patternIndex = 0; patternIndex < configuredPatterns.size(); patternIndex++) {
                Matcher matcher = configuredPatterns.get(patternIndex).matcher(line.getText());
                while (matcher.find()) {
                    if (matcher.start() == matcher.end()) {
                        continue;
                    }
                    addRisk(risks, deduplicationKeys, lines, index, "PASSWORD_PATTERN", "疑似密码", "HIGH",
                            matcher.group(), matcher.start(), matcher.end(), "正则规则 #" + (patternIndex + 1));
                }
            }

            if (!fingerprints.isEmpty()) {
                Matcher tokenMatcher = PASSWORD_TOKEN.matcher(line.getText());
                while (tokenMatcher.find()) {
                    KnownPasswordFingerprint configured = fingerprints.get(ChangeStepCheckConfigService.sha256(tokenMatcher.group()));
                    if (configured != null) {
                        addRisk(risks, deduplicationKeys, lines, index, "KNOWN_PASSWORD", "已知密码", "HIGH",
                                tokenMatcher.group(), tokenMatcher.start(), tokenMatcher.end(), "已知密码 " + configured.getMaskedValue());
                    }
                }
            }
        }
        return risks;
    }

    private void addRisk(List<RiskItemDto> risks, Set<String> deduplicationKeys, List<TextSegment> lines,
                         int index, String type, String label, String severity, String matchedText,
                         int start, int end, String rule) {
        TextSegment line = lines.get(index);
        String deduplicationKey = index + ":" + start + ":" + end + ":" + type;
        if (!deduplicationKeys.add(deduplicationKey)) {
            return;
        }
        risks.add(new RiskItemDto(
                UUID.randomUUID().toString(),
                type,
                label,
                severity,
                matchedText,
                start,
                end,
                rule,
                line.getLocation(),
                line.getLineNumber(),
                findContext(lines, index, -1),
                line.getText(),
                findContext(lines, index, 1)
        ));
    }

    private String findContext(List<TextSegment> lines, int currentIndex, int direction) {
        int index = currentIndex + direction;
        while (index >= 0 && index < lines.size()) {
            String text = lines.get(index).getText().trim();
            if (!text.isEmpty()) {
                return text;
            }
            index += direction;
        }
        return "";
    }

    private Pattern compileKeywordPattern(List<String> keywords) {
        if (keywords == null || keywords.isEmpty()) {
            return Pattern.compile("(?!x)x");
        }
        String alternatives = keywords.stream()
                .map(Pattern::quote)
                .collect(Collectors.joining("|"));
        return Pattern.compile("(?i)(?<![\\p{L}\\p{N}_])(?:" + alternatives + ")(?![\\p{L}\\p{N}_])");
    }

    private void validateFile(String fileName, long fileSize, InputStream inputStream) {
        if (inputStream == null || fileSize == 0) {
            throw new IllegalArgumentException("请选择需要检查的 Word 文档");
        }
        if (fileName == null || fileName.trim().isEmpty()) {
            throw new IllegalArgumentException("文件名不能为空");
        }
        if (fileName.length() > 255) {
            throw new IllegalArgumentException("文件名不能超过 255 个字符");
        }
        String normalized = fileName.toLowerCase(Locale.ROOT);
        if (!normalized.endsWith(".doc") && !normalized.endsWith(".docx")) {
            throw new IllegalArgumentException("仅支持 .doc 或 .docx 格式");
        }
        if (fileSize < 0) {
            throw new IllegalArgumentException("无法确定上传文件大小");
        }
        if (fileSize > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("文件不能超过 200 MB");
        }
    }

    private List<TextSegment> extractDocx(InputStream inputStream) throws IOException {
        List<TextSegment> lines = new ArrayList<>();
        try (XWPFDocument document = new XWPFDocument(inputStream)) {
            appendBodyElements(lines, document.getBodyElements(), "正文");
            for (XWPFHeaderFooter header : document.getHeaderList()) {
                appendHeaderFooter(lines, header, "页眉");
            }
            for (XWPFHeaderFooter footer : document.getFooterList()) {
                appendHeaderFooter(lines, footer, "页脚");
            }
        }
        renumber(lines);
        return lines;
    }

    private void appendHeaderFooter(List<TextSegment> lines, XWPFHeaderFooter part, String location) {
        for (XWPFParagraph paragraph : part.getParagraphs()) {
            addLine(lines, paragraph.getText(), location);
        }
        int tableNumber = 0;
        for (XWPFTable table : part.getTables()) {
            appendTable(lines, table, location + "表格#" + (++tableNumber));
        }
    }

    private void appendBodyElements(List<TextSegment> lines, List<IBodyElement> elements, String location) {
        int tableNumber = 0;
        for (IBodyElement element : elements) {
            if (element instanceof XWPFParagraph) {
                addLine(lines, ((XWPFParagraph) element).getText(), location);
            } else if (element instanceof XWPFTable) {
                appendTable(lines, (XWPFTable) element, "表格#" + (++tableNumber));
            }
        }
    }

    private void appendTable(List<TextSegment> lines, XWPFTable table, String location) {
        for (XWPFTableRow row : table.getRows()) {
            List<String> cells = new ArrayList<>();
            for (XWPFTableCell cell : row.getTableCells()) {
                String text = cell.getParagraphs().stream()
                        .map(XWPFParagraph::getText)
                        .collect(Collectors.joining(" "))
                        .replace('\r', ' ').replace('\n', ' ').trim();
                cells.add(text);
            }
            addLine(lines, String.join(" | ", cells), location, cells);
            int cellNumber = 0;
            for (XWPFTableCell cell : row.getTableCells()) {
                cellNumber++;
                int nestedNumber = 0;
                for (XWPFTable nestedTable : cell.getTables()) {
                    appendTable(lines, nestedTable, location + "-单元格" + cellNumber
                            + "-嵌套表格#" + (++nestedNumber));
                }
            }
        }
    }

    private List<TextSegment> extractDoc(InputStream inputStream) throws IOException {
        List<TextSegment> lines = new ArrayList<>();
        try (HWPFDocument document = new HWPFDocument(inputStream);
             WordExtractor extractor = new WordExtractor(document)) {
            for (String paragraph : extractor.getParagraphText()) {
                addLine(lines, paragraph, "正文");
            }
        }
        renumber(lines);
        return lines;
    }

    private void addLine(List<TextSegment> lines, String rawText, String location) {
        addLine(lines, rawText, location, new ArrayList<>());
    }

    private void addLine(List<TextSegment> lines, String rawText, String location, List<String> cells) {
        String text = rawText == null ? "" : rawText.replace('\u0007', ' ').replace('\r', ' ').trim();
        if (!text.isEmpty()) {
            lines.add(new TextSegment(lines.size() + 1, location, text, new ArrayList<>(cells)));
        }
    }

    private void renumber(List<TextSegment> lines) {
        for (int index = 0; index < lines.size(); index++) {
            lines.get(index).setLineNumber(index + 1);
        }
    }

    private ValidationSummaryDto summarizeValidation(List<ValidationCheckDto> checks) {
        int passed = (int) checks.stream().filter(item -> "PASSED".equals(item.getStatus())).count();
        int failed = (int) checks.stream().filter(item -> "FAILED".equals(item.getStatus())).count();
        int warnings = (int) checks.stream().filter(item -> "WARNING".equals(item.getStatus())).count();
        return new ValidationSummaryDto(checks.size(), passed, failed, warnings);
    }

    private static class SizeLimitedInputStream extends InputStream {
        private final InputStream delegate;
        private final long maxBytes;
        private long bytesRead;

        private SizeLimitedInputStream(InputStream delegate, long maxBytes) {
            this.delegate = delegate;
            this.maxBytes = maxBytes;
        }

        @Override
        public int read() throws IOException {
            int value = delegate.read();
            if (value >= 0) {
                recordRead(1);
            }
            return value;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            int count = delegate.read(buffer, offset, length);
            if (count > 0) {
                recordRead(count);
            }
            return count;
        }

        private void recordRead(int count) throws IOException {
            bytesRead += count;
            if (bytesRead > maxBytes) {
                throw new IOException("上传文件超过 200 MB");
            }
        }

        @Override
        public void close() throws IOException {
            delegate.close();
        }
    }
}
