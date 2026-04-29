package com.toolmanager.entity;

import javax.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "release_package_diffs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReleasePackageDiff {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "version_id", nullable = false)
    private Long versionId;

    @Column(name = "file_path", nullable = false, columnDefinition = "TEXT")
    private String filePath;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "service_tag")
    private String serviceTag;

    @Column(name = "diff_type")
    private String diffType;

    @Column(name = "confirm_status")
    private String confirmStatus;

    @Column(name = "confirm_remark", columnDefinition = "TEXT")
    private String confirmRemark;

    @Column(name = "confirmed_by")
    private String confirmedBy;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (confirmStatus == null) {
            confirmStatus = "PENDING";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
