package com.toolmanager.service;

import com.toolmanager.dto.ChangeStepCheckDtos.RiskItemDto;
import com.toolmanager.dto.ChangeStepCheckDtos.ScanResultDto;
import com.toolmanager.dto.ChangeStepCheckDtos.ScanSummaryDto;
import com.toolmanager.service.ChangeStepCheckConfigService.InternalConfig;
import com.toolmanager.service.ChangeStepCheckConfigService.KnownPasswordFingerprint;
import lombok.AllArgsConstructor;
import lombok.Data;
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
    private static final long MAX_FILE_SIZE = 200L * 1024L * 1024L;
    private static final int MAX_TEXT_SEGMENTS = 1_000_000;
    private static final long MAX_EXTRACTED_CHARACTERS = 120_000_000L;
    private static final Pattern PASSWORD_TOKEN = Pattern.compile("[\\p{L}\\p{N}@#$%^&*._+!~?/\\-]{4,128}");

    private final ChangeStepCheckConfigService configService;

    public ScanResultDto scan(MultipartFile file) {
        validateFile(file);
        String fileName = file.getOriginalFilename();
        List<DocumentLine> lines;
        try (InputStream inputStream = file.getInputStream()) {
            lines = fileName.toLowerCase(Locale.ROOT).endsWith(".docx")
                    ? extractDocx(inputStream)
                    : extractDoc(inputStream);
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
        ScanSummaryDto summary = new ScanSummaryDto(
                risks.size(),
                (int) risks.stream().filter(item -> "HIGH".equals(item.getSeverity())).count(),
                (int) risks.stream().filter(item -> "MEDIUM".equals(item.getSeverity())).count(),
                (int) risks.stream().filter(item -> "FIELD_KEYWORD".equals(item.getRiskType())).count(),
                (int) risks.stream().filter(item -> !"FIELD_KEYWORD".equals(item.getRiskType())).count()
        );
        return new ScanResultDto(fileName, LocalDateTime.now(), lines.size(), summary, risks);
    }

    List<RiskItemDto> detectRisks(List<DocumentLine> lines, InternalConfig config) {
        List<RiskItemDto> risks = new ArrayList<>();
        Set<String> deduplicationKeys = new HashSet<>();

        Pattern keywordPattern = compileKeywordPattern(config.getFieldKeywords());
        List<Pattern> configuredPatterns = config.getRegexPatterns().stream()
                .map(Pattern::compile)
                .collect(Collectors.toList());
        Map<String, KnownPasswordFingerprint> fingerprints = config.getKnownPasswords().stream()
                .collect(Collectors.toMap(KnownPasswordFingerprint::getFingerprint, item -> item, (first, ignored) -> first, LinkedHashMap::new));

        for (int index = 0; index < lines.size(); index++) {
            DocumentLine line = lines.get(index);
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

    private void addRisk(List<RiskItemDto> risks, Set<String> deduplicationKeys, List<DocumentLine> lines,
                         int index, String type, String label, String severity, String matchedText,
                         int start, int end, String rule) {
        DocumentLine line = lines.get(index);
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

    private String findContext(List<DocumentLine> lines, int currentIndex, int direction) {
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

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("请选择需要检查的 Word 文档");
        }
        String fileName = file.getOriginalFilename();
        if (fileName == null || fileName.trim().isEmpty()) {
            throw new IllegalArgumentException("文件名不能为空");
        }
        String normalized = fileName.toLowerCase(Locale.ROOT);
        if (!normalized.endsWith(".doc") && !normalized.endsWith(".docx")) {
            throw new IllegalArgumentException("仅支持 .doc 或 .docx 格式");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("文件不能超过 200 MB");
        }
    }

    private List<DocumentLine> extractDocx(InputStream inputStream) throws IOException {
        List<DocumentLine> lines = new ArrayList<>();
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

    private void appendHeaderFooter(List<DocumentLine> lines, XWPFHeaderFooter part, String location) {
        for (XWPFParagraph paragraph : part.getParagraphs()) {
            addLine(lines, paragraph.getText(), location);
        }
        for (XWPFTable table : part.getTables()) {
            appendTable(lines, table, location + "表格");
        }
    }

    private void appendBodyElements(List<DocumentLine> lines, List<IBodyElement> elements, String location) {
        for (IBodyElement element : elements) {
            if (element instanceof XWPFParagraph) {
                addLine(lines, ((XWPFParagraph) element).getText(), location);
            } else if (element instanceof XWPFTable) {
                appendTable(lines, (XWPFTable) element, "表格");
            }
        }
    }

    private void appendTable(List<DocumentLine> lines, XWPFTable table, String location) {
        for (XWPFTableRow row : table.getRows()) {
            List<String> cells = new ArrayList<>();
            for (XWPFTableCell cell : row.getTableCells()) {
                String text = cell.getText().replace('\r', ' ').replace('\n', ' ').trim();
                cells.add(text);
            }
            addLine(lines, String.join(" | ", cells), location);
        }
    }

    private List<DocumentLine> extractDoc(InputStream inputStream) throws IOException {
        List<DocumentLine> lines = new ArrayList<>();
        try (HWPFDocument document = new HWPFDocument(inputStream);
             WordExtractor extractor = new WordExtractor(document)) {
            for (String paragraph : extractor.getParagraphText()) {
                addLine(lines, paragraph, "正文");
            }
        }
        renumber(lines);
        return lines;
    }

    private void addLine(List<DocumentLine> lines, String rawText, String location) {
        String text = rawText == null ? "" : rawText.replace('\u0007', ' ').replace('\r', ' ').trim();
        if (!text.isEmpty()) {
            lines.add(new DocumentLine(lines.size() + 1, location, text));
        }
    }

    private void renumber(List<DocumentLine> lines) {
        for (int index = 0; index < lines.size(); index++) {
            lines.get(index).setLineNumber(index + 1);
        }
    }

    @Data
    @AllArgsConstructor
    static class DocumentLine {
        private int lineNumber;
        private String location;
        private String text;
    }
}
