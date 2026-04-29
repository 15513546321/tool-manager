package com.toolmanager.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class ReleaseChangeDtos {
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VersionDto {
        private Long id;
        private String versionName;
        private String description;
        private String status;
        private String createdBy;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private Long changeSetCount;
        private Long declaredFileCount;
        private Long diffFileCount;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChangeSetDto {
        private Long id;
        private Long versionId;
        private String requirementCode;
        private String requirementName;
        private String developer;
        private String reviewer;
        private String reviewStatus;
        private String reviewRemark;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private List<String> files = new ArrayList<>();
        private List<ChangeFileDto> fileDetails = new ArrayList<>();
        private Integer fileCount;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChangeFileDto {
        private Long id;
        private Long versionId;
        private Long changeSetId;
        private String filePath;
        private String fileName;
        private String requirementCode;
        private String requirementName;
        private String developer;
        private String reviewStatus;
        private String reviewRemark;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PackageDiffDto {
        private Long id;
        private Long versionId;
        private String filePath;
        private String fileName;
        private String serviceTag;
        private String diffType;
        private String confirmStatus;
        private String confirmRemark;
        private String confirmedBy;
        private LocalDateTime confirmedAt;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private List<ChangeFileDto> owners = new ArrayList<>();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImportTextRequest {
        private String rawText;
        private Boolean replaceExisting;
        private String serviceTag;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConfirmDiffRequest {
        private String confirmStatus;
        private String confirmRemark;
        private String confirmedBy;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReconcileSummaryDto {
        private Integer declaredFileCount;
        private Integer diffFileCount;
        private Integer matchedDiffCount;
        private Integer undeclaredDiffCount;
        private Integer declaredNotInPackageCount;
        private Integer pendingConfirmCount;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReconcileResultDto {
        private ReconcileSummaryDto summary;
        private List<PackageDiffDto> matchedDiffs = new ArrayList<>();
        private List<PackageDiffDto> undeclaredDiffs = new ArrayList<>();
        private List<ChangeFileDto> declaredNotInPackage = new ArrayList<>();
    }
}
