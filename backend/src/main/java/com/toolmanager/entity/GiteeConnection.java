package com.toolmanager.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * Gitee 仓库连接配置
 * 支持两种认证方式：SSH 和 Token（HTTP）
 */
@Entity
@Table(name = "gitee_connections", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"name", "auth_type"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GiteeConnection {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "repo_url", nullable = false, length = 500)
    private String repoUrl;

    @Column(name = "auth_type", nullable = false)
    private String authType; // 'ssh' or 'token'

    // Token 认证相关字段
    @Column(name = "access_token", length = 2000)
    private String accessToken;

    // SSH 认证相关字段
    @Column(name = "private_key", columnDefinition = "LONGTEXT")
    private String privateKey;

    @Column(name = "public_key", columnDefinition = "LONGTEXT")
    private String publicKey;

    @Column(name = "is_default")
    private Boolean isDefault = false;

    @Column(name = "connection_status")
    private String connectionStatus; // 'connected', 'failed', 'unknown'

    @Column(name = "last_test_time")
    private LocalDateTime lastTestTime;

    @Column(name = "last_test_message", columnDefinition = "TEXT")
    private String lastTestMessage;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "updated_by")
    private String updatedBy;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (connectionStatus == null) {
            connectionStatus = "unknown";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
