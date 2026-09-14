package com.toolmanager.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Lob;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "eibs3g_analysis_snapshots")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Eibs3gAnalysisSnapshot {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "scope_key", nullable = false, unique = true, length = 50)
    private String scopeKey;

    @Column(name = "schema_version", nullable = false)
    private Integer schemaVersion;

    @Column(name = "project_name", nullable = false, length = 255)
    private String projectName;

    @Column(name = "source_fingerprint", nullable = false, length = 128)
    private String sourceFingerprint;

    @Lob
    @Column(name = "snapshot_json", nullable = false, columnDefinition = "CLOB")
    private String snapshotJson;

    @Column(name = "snapshot_size", nullable = false)
    private Long snapshotSize;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
