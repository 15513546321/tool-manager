
package com.toolmanager.dto;

import javax.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 角色DTO
 * 作者：张擎
 * 时间：2026-05-06
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoleDTO {

    /**
     * 角色ID
     */
    private Long id;

    /**
     * 角色编码
     */
    @NotBlank(message = "角色编码不能为空")
    private String roleCode;

    /**
     * 角色名称
     */
    @NotBlank(message = "角色名称不能为空")
    private String roleName;

    /**
     * 角色描述
     */
    private String description;

    /**
     * 角色级别
     */
    private Integer level;

    /**
     * 是否启用：0-禁用，1-启用
     */
    private Integer status;

    /**
     * 菜单ID列表
     */
    private List<Long> menuIds;

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
