
package com.toolmanager.repository;

import com.toolmanager.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 角色数据访问层
 * 作者：张擎
 * 时间：2026-05-06
 */
@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {

    /**
     * 根据角色编码查找角色
     * @param roleCode 角色编码
     * @return 角色信息
     */
    Optional<Role> findByRoleCode(String roleCode);

    /**
     * 检查角色编码是否存在
     * @param roleCode 角色编码
     * @return 是否存在
     */
    boolean existsByRoleCode(String roleCode);

    /**
     * 根据状态查询角色列表
     * @param status 状态
     * @return 角色列表
     */
    List<Role> findByStatus(Integer status);
}
