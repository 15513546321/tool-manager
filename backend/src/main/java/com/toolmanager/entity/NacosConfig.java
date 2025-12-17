package com.toolmanager.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "NACOS_CONFIGS")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NacosConfig {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String name; // 配置名称

    @Column(nullable = false, length = 500)
    private String sourceUrl; // 源环境 Nacos URL

    @Column(length = 255)
    private String sourceNamespace; // 源环境命名空间

    @Column(length = 255)
    private String sourceUsername; // 源环境用户名

    @Column(length = 500)
    private String sourcePassword; // 源环境密码

    @Column(columnDefinition = "TEXT")
    private String sourceRemark; // 源环境备注说明

    @Column(nullable = false, length = 500)
    private String targetUrl; // 目标环境 Nacos URL

    @Column(length = 255)
    private String targetNamespace; // 目标环境命名空间

    @Column(length = 255)
    private String targetUsername; // 目标环境用户名

    @Column(length = 500)
    private String targetPassword; // 目标环境密码

    @Column(columnDefinition = "TEXT")
    private String targetRemark; // 目标环境备注说明

    @Column(columnDefinition = "LONGTEXT")
    private String syncRules; // 同步规则（JSON格式）

    @Column(columnDefinition = "TEXT")
    private String description; // 描述

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(length = 50)
    private String status; // ACTIVE, INACTIVE, ARCHIVED

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = "ACTIVE";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
