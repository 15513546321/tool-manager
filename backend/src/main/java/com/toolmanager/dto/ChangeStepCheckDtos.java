package com.toolmanager.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
        private String systemCode;
        private String systemName;
        private String documentType;
        private String documentTypeLabel;
        private String companionManualFileName;
        private String validationEngineVersion;
        private LocalDateTime scannedAt;
        private Integer scannedLineCount;
        private ScanSummaryDto summary;
        private List<RiskItemDto> risks = new ArrayList<>();
        private ValidationSummaryDto validationSummary;
        private List<ValidationCheckDto> validationChecks = new ArrayList<>();
        private Long recordId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ValidationCheckDto {
        private String id;
        private String code;
        private String category;
        private String label;
        private String status;
        private String severity;
        private String message;
        private String expectedValue;
        private String actualValue;
        private String location;
        private Integer lineNumber;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ValidationSummaryDto {
        private Integer total;
        private Integer passed;
        private Integer failed;
        private Integer warnings;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScanRecordDto {
        private Long id;
        private String fileName;
        private String systemCode;
        private String documentType;
        private Long fileSize;
        private String scanStatus;
        private String errorMessage;
        private Integer scannedLineCount;
        private Integer totalRisks;
        private Integer highRisks;
        private Integer fieldMatches;
        private Integer passwordMatches;
        private Integer confirmedRisks;
        private Integer falsePositiveRisks;
        private Integer pendingRisks;
        private Integer validationTotal;
        private Integer validationPassed;
        private Integer validationFailed;
        private Integer validationWarnings;
        private String reviewStatus;
        private String scannedBy;
        private LocalDateTime scannedAt;
        private String reviewedBy;
        private LocalDateTime reviewedAt;
        private LocalDateTime updatedAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScanRecordPageDto {
        private List<ScanRecordDto> content = new ArrayList<>();
        private Long totalElements;
        private Integer totalPages;
        private Integer page;
        private Integer size;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateReviewSummaryRequest {
        private Integer confirmedRisks;
        private Integer falsePositiveRisks;
        private Integer pendingRisks;
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
        /** 兼容旧前端，值始终等于中台资产清单。 */
        private List<String> serverAssetNames = new ArrayList<>();
        private Map<String, List<String>> serverAssetNamesBySystem = new LinkedHashMap<>();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateScannerConfigRequest {
        private List<String> fieldKeywords = new ArrayList<>();
        private List<String> regexPatterns = new ArrayList<>();
        private List<String> retainedKnownPasswordIds = new ArrayList<>();
        private List<String> newKnownPasswords = new ArrayList<>();
        /** 兼容旧前端；新前端优先提交 serverAssetNamesBySystem。 */
        private List<String> serverAssetNames = new ArrayList<>();
        private Map<String, List<String>> serverAssetNamesBySystem = new LinkedHashMap<>();
    }
}
