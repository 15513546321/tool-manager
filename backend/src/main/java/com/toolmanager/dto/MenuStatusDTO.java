package com.toolmanager.dto;

import javax.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 菜单状态切换DTO
 * 作者：张擎
 * 时间：2026-05-07 14:45:00
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MenuStatusDTO {

    /**
     * 是否启用：0-禁用，1-启用
     */
    @NotNull(message = "状态不能为空")
    private Integer status;
}
