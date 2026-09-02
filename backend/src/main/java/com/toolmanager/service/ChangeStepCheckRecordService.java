package com.toolmanager.service;

import com.toolmanager.dto.ChangeStepCheckDtos.ScanRecordDto;
import com.toolmanager.dto.ChangeStepCheckDtos.ScanRecordPageDto;
import com.toolmanager.dto.ChangeStepCheckDtos.ScanResultDto;
import com.toolmanager.dto.ChangeStepCheckDtos.UpdateReviewSummaryRequest;
import com.toolmanager.entity.ChangeStepScanRecord;
import com.toolmanager.repository.ChangeStepScanRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChangeStepCheckRecordService {
    private final ChangeStepScanRecordRepository repository;

    @Transactional
    public ScanRecordDto recordSuccess(String fileName, long fileSize, ScanResultDto result, String username) {
        ChangeStepScanRecord record = baseRecord(fileName, fileSize, username);
        record.setScanStatus("SUCCESS");
        record.setScannedLineCount(result.getScannedLineCount());
        record.setTotalRisks(result.getSummary().getTotal());
        record.setHighRisks(result.getSummary().getHigh());
        record.setFieldMatches(result.getSummary().getFieldMatches());
        record.setPasswordMatches(result.getSummary().getPasswordMatches());
        record.setPendingRisks(result.getSummary().getTotal());
        if (result.getSummary().getTotal() == 0) {
            record.setReviewStatus("COMPLETED");
            record.setReviewedBy(normalizeUsername(username));
            record.setReviewedAt(LocalDateTime.now());
        } else {
            record.setReviewStatus("PENDING");
        }
        ChangeStepScanRecord saved = repository.save(record);
        result.setRecordId(saved.getId());
        return toDto(saved);
    }

    @Transactional
    public ScanRecordDto recordFailure(String fileName, long fileSize, String errorMessage, String username) {
        ChangeStepScanRecord record = baseRecord(fileName, Math.max(fileSize, 0), username);
        record.setScanStatus("FAILED");
        record.setReviewStatus("NOT_APPLICABLE");
        record.setErrorMessage(truncate(errorMessage, 500));
        return toDto(repository.save(record));
    }

    @Transactional
    public ScanRecordDto updateReview(Long recordId, UpdateReviewSummaryRequest request, String username) {
        ChangeStepScanRecord record = repository.findById(recordId)
                .orElseThrow(() -> new IllegalArgumentException("检查记录不存在"));
        if (!"SUCCESS".equals(record.getScanStatus())) {
            throw new IllegalArgumentException("扫描失败的记录不能进行风险核查");
        }
        if (request == null) {
            throw new IllegalArgumentException("核查摘要不能为空");
        }
        int confirmed = nonNegative(request.getConfirmedRisks(), "已确认数量");
        int falsePositive = nonNegative(request.getFalsePositiveRisks(), "误报数量");
        int pending = nonNegative(request.getPendingRisks(), "待核查数量");
        if (confirmed + falsePositive + pending != record.getTotalRisks()) {
            throw new IllegalArgumentException("核查数量与风险总数不一致");
        }
        record.setConfirmedRisks(confirmed);
        record.setFalsePositiveRisks(falsePositive);
        record.setPendingRisks(pending);
        record.setReviewedBy(normalizeUsername(username));
        if (pending == 0) {
            record.setReviewStatus("COMPLETED");
            record.setReviewedAt(LocalDateTime.now());
        } else {
            record.setReviewStatus("PENDING");
            record.setReviewedAt(null);
        }
        return toDto(repository.save(record));
    }

    @Transactional(readOnly = true)
    public ScanRecordPageDto search(String keyword, int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        PageRequest pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "scannedAt", "id"));
        Page<ChangeStepScanRecord> records;
        String normalizedKeyword = keyword == null ? "" : keyword.trim();
        if (normalizedKeyword.isEmpty()) {
            records = repository.findAll(pageable);
        } else {
            records = repository.findByFileNameContainingIgnoreCaseOrScannedByContainingIgnoreCase(
                    normalizedKeyword, normalizedKeyword, pageable);
        }
        List<ScanRecordDto> content = records.getContent().stream().map(this::toDto).collect(Collectors.toList());
        return new ScanRecordPageDto(content, records.getTotalElements(), records.getTotalPages(), safePage, safeSize);
    }

    private ChangeStepScanRecord baseRecord(String fileName, long fileSize, String username) {
        ChangeStepScanRecord record = new ChangeStepScanRecord();
        record.setFileName(truncate(fileName == null || fileName.trim().isEmpty() ? "未知文件" : fileName, 500));
        record.setFileSize(fileSize);
        record.setScannedBy(normalizeUsername(username));
        record.setScannedAt(LocalDateTime.now());
        return record;
    }

    private int nonNegative(Integer value, String label) {
        if (value == null || value < 0) throw new IllegalArgumentException(label + "不能为负数");
        return value;
    }

    private String normalizeUsername(String username) {
        return username == null || username.trim().isEmpty() ? "未知用户" : truncate(username.trim(), 100);
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return null;
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private ScanRecordDto toDto(ChangeStepScanRecord record) {
        return new ScanRecordDto(
                record.getId(), record.getFileName(), record.getFileSize(), record.getScanStatus(), record.getErrorMessage(),
                record.getScannedLineCount(), record.getTotalRisks(), record.getHighRisks(), record.getFieldMatches(),
                record.getPasswordMatches(), record.getConfirmedRisks(), record.getFalsePositiveRisks(), record.getPendingRisks(),
                record.getReviewStatus(), record.getScannedBy(), record.getScannedAt(), record.getReviewedBy(),
                record.getReviewedAt(), record.getUpdatedAt());
    }
}
