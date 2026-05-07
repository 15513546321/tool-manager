
package com.toolmanager.dto;

import javax.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 修改密码请求DTO
 * 作者：张擎
 * 时间：2026-05-06
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChangePasswordRequest {

    /**
     * 用户ID（管理员重置时使用）
     */
    private Long userId;

    /**
     * 旧密码（用户修改自己密码时必填）
     */
    private String oldPassword;

    /**
     * 新密码
     */
    @NotBlank(message = "新密码不能为空")
    private String newPassword;

    /**
     * 是否强制重置（管理员操作）
     */
    private Boolean forceReset = false;
}
