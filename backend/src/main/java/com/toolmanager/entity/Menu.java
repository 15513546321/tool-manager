
package com.toolmanager.entity;

import javax.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 菜单实体类（支持树形结构）
 * 作者：张擎
 * 时间：2026-05-06
 */
@Entity
@Table(name = "sys_menu")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Menu {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 菜单名称
     */
    @Column(nullable = false, length = 100)
    private String name;

    /**
     * 菜单路径（前端路由）
     */
    @Column(length = 200)
    private String path;

    /**
     * 菜单图标
     */
    @Column(length = 50)
    private String icon;

    /**
     * 权限标识（如：user:add、user:delete）
     */
    @Column(length = 100)
    private String permission;

    /**
     * 父菜单ID（0表示根菜单）
     */
    @Column(name = "parent_id")
    private Long parentId = 0L;

    /**
     * 排序序号
     */
    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    /**
     * 是否是叶子节点（按钮/操作权限）
     */
    @Column(name = "is_button")
    private Integer isButton = 0;

    /**
     * 是否启用：0-禁用，1-启用
     */
    @Column(nullable = false)
    private Integer status = 1;

    /**
     * 创建时间
     */
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 创建人
     */
    @Column(name = "created_by", length = 50)
    private String createdBy;

    /**
     * 更新人
     */
    @Column(name = "updated_by", length = 50)
    private String updatedBy;

    /**
     * 子菜单（用于前端树形展示，非持久化）
     */
    @Transient
    private Set<Menu> children = new LinkedHashSet<>();

    /**
     * 角色关联（多对多关系 - inverse side）
     */
    @ManyToMany(mappedBy = "menus", fetch = FetchType.LAZY)
    private Set<Role> roles = new HashSet<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
