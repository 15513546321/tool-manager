package com.toolmanager.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class ChangeStepCheckDtos {
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskItemDto {
        private String id;
        private String riskType;
        private String riskLabel;
        private String severity;
        private String matchedText;
        private Integer matchedStart;
        private Integer matchedEnd;
        private String rule;
        private String location;
        private Integer lineNumber;
        private String contextBefore;
        private String contextLine;
        private String contextAfter;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScanSummaryDto {
        private Integer total;
        private Integer high;
        private Integer medium;
        private Integer fieldMatches;
        private Integer passwordMatches;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScanResultDto {
        private String fileName;
        private LocalDateTime scannedAt;
        private Integer scannedLineCount;
        private ScanSummaryDto summary;
        private List<RiskItemDto> risks = new ArrayList<>();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KnownPasswordRuleDto {
        private String id;
        private String maskedValue;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScannerConfigDto {
        private List<String> fieldKeywords = new ArrayList<>();
        private List<String> regexPatterns = new ArrayList<>();
        private List<KnownPasswordRuleDto> knownPasswords = new ArrayList<>();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateScannerConfigRequest {
        private List<String> fieldKeywords = new ArrayList<>();
        private List<String> regexPatterns = new ArrayList<>();
        private List<String> retainedKnownPasswordIds = new ArrayList<>();
        private List<String> newKnownPasswords = new ArrayList<>();
    }
}
