package com.toolmanager.service;

import com.toolmanager.dto.ChangeStepCheckDtos.ScanRecordDto;
import com.toolmanager.dto.ChangeStepCheckDtos.ScanResultDto;
import com.toolmanager.dto.ChangeStepCheckDtos.ScanSummaryDto;
import com.toolmanager.dto.ChangeStepCheckDtos.UpdateReviewSummaryRequest;
import com.toolmanager.entity.ChangeStepScanRecord;
import com.toolmanager.repository.ChangeStepScanRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChangeStepCheckRecordServiceTest {
    @Mock
    private ChangeStepScanRecordRepository repository;

    private ChangeStepCheckRecordService service;
    private final AtomicLong ids = new AtomicLong(1);

    @BeforeEach
    void setUp() {
        when(repository.save(any(ChangeStepScanRecord.class))).thenAnswer(invocation -> {
            ChangeStepScanRecord record = invocation.getArgument(0);
            if (record.getId() == null) record.setId(ids.getAndIncrement());
            if (record.getUpdatedAt() == null) record.setUpdatedAt(LocalDateTime.now());
            return record;
        });
        service = new ChangeStepCheckRecordService(repository);
    }

    @Test
    void createsPublicSummaryAndPersistsReviewProgress() {
        ScanResultDto result = new ScanResultDto(
                "上线变更步骤.docx",
                LocalDateTime.now(),
                18,
                new ScanSummaryDto(3, 3, 0, 1, 2),
                new ArrayList<>(),
                null
        );

        ScanRecordDto created = service.recordSuccess(result.getFileName(), 4096, result, "reviewer-a");
        assertThat(result.getRecordId()).isEqualTo(created.getId());
        assertThat(created.getPendingRisks()).isEqualTo(3);
        assertThat(created.getReviewStatus()).isEqualTo("PENDING");

        ChangeStepScanRecord stored = new ChangeStepScanRecord();
        stored.setId(created.getId());
        stored.setFileName(created.getFileName());
        stored.setFileSize(created.getFileSize());
        stored.setScanStatus("SUCCESS");
        stored.setScannedLineCount(18);
        stored.setTotalRisks(3);
        stored.setHighRisks(3);
        stored.setFieldMatches(1);
        stored.setPasswordMatches(2);
        stored.setConfirmedRisks(0);
        stored.setFalsePositiveRisks(0);
        stored.setPendingRisks(3);
        stored.setReviewStatus("PENDING");
        stored.setScannedBy("reviewer-a");
        stored.setScannedAt(LocalDateTime.now());
        stored.setUpdatedAt(LocalDateTime.now());
        when(repository.findById(created.getId())).thenReturn(Optional.of(stored));

        ScanRecordDto reviewed = service.updateReview(
                created.getId(), new UpdateReviewSummaryRequest(2, 1, 0), "reviewer-b");

        assertThat(reviewed.getReviewStatus()).isEqualTo("COMPLETED");
        assertThat(reviewed.getConfirmedRisks()).isEqualTo(2);
        assertThat(reviewed.getFalsePositiveRisks()).isEqualTo(1);
        assertThat(reviewed.getPendingRisks()).isZero();
        assertThat(reviewed.getReviewedBy()).isEqualTo("reviewer-b");
        assertThat(reviewed.getReviewedAt()).isNotNull();
    }

    @Test
    void recordsFailedScanWithoutSensitiveDocumentContent() {
        ScanRecordDto failed = service.recordFailure(
                "broken.docx", 1024, "Word 文档解析失败，请确认文件未损坏或加密", "reviewer-a");

        assertThat(failed.getScanStatus()).isEqualTo("FAILED");
        assertThat(failed.getReviewStatus()).isEqualTo("NOT_APPLICABLE");
        assertThat(failed.getTotalRisks()).isZero();
        assertThat(failed.getErrorMessage()).contains("文档解析失败");
    }
}
