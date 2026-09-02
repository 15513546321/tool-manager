package com.toolmanager.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "change_step_scan_records")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChangeStepScanRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "file_name", nullable = false, length = 500)
    private String fileName;

    @Column(name = "file_size", nullable = false)
    private Long fileSize;

    @Column(name = "scan_status", nullable = false, length = 20)
    private String scanStatus;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(name = "scanned_line_count", nullable = false)
    private Integer scannedLineCount = 0;

    @Column(name = "total_risks", nullable = false)
    private Integer totalRisks = 0;

    @Column(name = "high_risks", nullable = false)
    private Integer highRisks = 0;

    @Column(name = "field_matches", nullable = false)
    private Integer fieldMatches = 0;

    @Column(name = "password_matches", nullable = false)
    private Integer passwordMatches = 0;

    @Column(name = "confirmed_risks", nullable = false)
    private Integer confirmedRisks = 0;

    @Column(name = "false_positive_risks", nullable = false)
    private Integer falsePositiveRisks = 0;

    @Column(name = "pending_risks", nullable = false)
    private Integer pendingRisks = 0;

    @Column(name = "review_status", nullable = false, length = 20)
    private String reviewStatus;

    @Column(name = "scanned_by", length = 100)
    private String scannedBy;

    @Column(name = "scanned_at", nullable = false)
    private LocalDateTime scannedAt;

    @Column(name = "reviewed_by", length = 100)
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (scannedAt == null) scannedAt = now;
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
