package com.toolmanager.entity;

import javax.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "release_change_sets")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReleaseChangeSet {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "version_id", nullable = false)
    private Long versionId;

    @Column(name = "requirement_code", nullable = false)
    private String requirementCode;

    @Column(name = "requirement_name", columnDefinition = "TEXT")
    private String requirementName;

    @Column(name = "developer", nullable = false)
    private String developer;

    @Column(name = "reviewer")
    private String reviewer;

    @Column(name = "review_status")
    private String reviewStatus;

    @Column(name = "review_remark", columnDefinition = "TEXT")
    private String reviewRemark;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (reviewStatus == null) {
            reviewStatus = "PENDING";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
