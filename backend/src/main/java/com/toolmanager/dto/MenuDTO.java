
package com.toolmanager.dto;

import javax.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 菜单DTO
 * 作者：张擎
 * 时间：2026-05-06
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MenuDTO {

    /**
     * 菜单ID
     */
    private Long id;

    /**
     * 菜单名称
     */
    @NotBlank(message = "菜单名称不能为空")
    private String name;

    /**
     * 菜单路径
     */
    private String path;

    /**
     * 菜单图标
     */
    private String icon;

    /**
     * 权限标识
     */
    private String permission;

    /**
     * 父菜单ID
     */
    private Long parentId;

    /**
     * 排序序号
     */
    private Integer sortOrder;

    /**
     * 是否是按钮
     */
    private Integer isButton;

    /**
     * 是否启用：0-禁用，1-启用
     */
    private Integer status;

    /**
     * 子菜单（用于树形结构）
     */
    private List<MenuDTO> children;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    private LocalDateTime updatedAt;

    /**
     * 创建人
     */
    private String createdBy;

    /**
     * 更新人
     */
    private String updatedBy;
}
