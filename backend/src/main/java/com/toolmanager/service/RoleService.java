package com.toolmanager.service;

import com.toolmanager.dto.RoleDTO;
import com.toolmanager.entity.Menu;
import com.toolmanager.entity.Role;
import com.toolmanager.repository.MenuRepository;
import com.toolmanager.repository.RoleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 角色服务
 * 作者：张擎
 * 时间：2026-05-06
 */
@Service
public class RoleService {

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private MenuRepository menuRepository;

    /**
     * 创建角色
     */
    @Transactional
    public Role createRole(RoleDTO dto, String operator) {
        if (roleRepository.existsByRoleCode(dto.getRoleCode())) {
            throw new RuntimeException("角色编码已存在");
        }

        Role role = new Role();
        role.setRoleCode(dto.getRoleCode());
        role.setRoleName(dto.getRoleName());
        role.setDescription(dto.getDescription());
        role.setLevel(dto.getLevel() != null ? dto.getLevel() : 1);
        role.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        role.setCreatedBy(operator);
        role.setUpdatedBy(operator);

        // 绑定菜单权限
        if (dto.getMenuIds() != null && !dto.getMenuIds().isEmpty()) {
            Set<Menu> menus = new LinkedHashSet<>(menuRepository.findAllById(dto.getMenuIds()));
            role.setMenus(menus);
        }

        return roleRepository.save(role);
    }

    /**
     * 更新角色
     */
    @Transactional
    public Role updateRole(Long id, RoleDTO dto, String operator) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("角色不存在"));

        // 检查角色编码是否被其他角色使用
        roleRepository.findByRoleCode(dto.getRoleCode())
                .ifPresent(r -> {
                    if (!r.getId().equals(id)) {
                        throw new RuntimeException("角色编码已被使用");
                    }
                });

        role.setRoleCode(dto.getRoleCode());
        role.setRoleName(dto.getRoleName());
        role.setDescription(dto.getDescription());
        if (dto.getLevel() != null) {
            role.setLevel(dto.getLevel());
        }
        if (dto.getStatus() != null) {
            role.setStatus(dto.getStatus());
        }
        role.setUpdatedBy(operator);

        // 更新菜单权限
        if (dto.getMenuIds() != null) {
            Set<Menu> menus = new LinkedHashSet<>(menuRepository.findAllById(dto.getMenuIds()));
            role.setMenus(menus);
        }

        return roleRepository.save(role);
    }

    /**
     * 删除角色
     */
    @Transactional
    public void deleteRole(Long id) {
        if (!roleRepository.existsById(id)) {
            throw new RuntimeException("角色不存在");
        }
        roleRepository.deleteById(id);
    }

    /**
     * 更新角色状态
     */
    @Transactional
    public Role updateRoleStatus(Long id, Integer status, String operator) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("角色不存在"));
        role.setStatus(status);
        role.setUpdatedBy(operator);
        return roleRepository.save(role);
    }

    /**
     * 根据ID获取角色
     */
    @Transactional(readOnly = true)
    public Role getRoleById(Long id) {
        return roleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("角色不存在"));
    }

    /**
     * 分页查询角色
     */
    @Transactional(readOnly = true)
    public Page<Role> listRoles(String roleCode, String roleName, Pageable pageable) {
        return roleRepository.findAll(pageable);
    }

    /**
     * 获取所有角色
     */
    @Transactional(readOnly = true)
    public List<Role> getAllRoles() {
        return roleRepository.findAll();
    }

    /**
     * 获取所有启用的角色
     */
    @Transactional(readOnly = true)
    public List<Role> getActiveRoles() {
        return roleRepository.findByStatus(1);
    }

    /**
     * 获取角色的菜单
     */
    @Transactional(readOnly = true)
    public List<?> getRoleMenus(Long roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new RuntimeException("角色不存在"));
        return role.getMenus().stream()
                .map(this::menuToDTO)
                .collect(Collectors.toList());
    }

    /**
     * 为角色分配菜单
     */
    @Transactional
    public void assignMenus(Long roleId, List<Long> menuIds, String operator) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new RuntimeException("角色不存在"));

        Set<Menu> menus = new LinkedHashSet<>(menuRepository.findAllById(menuIds));
        role.setMenus(menus);
        role.setUpdatedBy(operator);
        roleRepository.save(role);
    }

    /**
     * 转换为DTO
     */
    public RoleDTO toDTO(Role role) {
        RoleDTO dto = new RoleDTO();
        dto.setId(role.getId());
        dto.setRoleCode(role.getRoleCode());
        dto.setRoleName(role.getRoleName());
        dto.setDescription(role.getDescription());
        dto.setLevel(role.getLevel());
        dto.setStatus(role.getStatus());
        dto.setMenuIds(role.getMenus().stream()
                .map(Menu::getId)
                .collect(Collectors.toList()));
        dto.setCreatedAt(role.getCreatedAt());
        dto.setUpdatedAt(role.getUpdatedAt());
        dto.setCreatedBy(role.getCreatedBy());
        dto.setUpdatedBy(role.getUpdatedBy());
        return dto;
    }

    /**
     * 菜单转换为DTO
     */
    private Object menuToDTO(Menu menu) {
        java.util.Map<String, Object> dto = new java.util.HashMap<>();
        dto.put("id", menu.getId());
        dto.put("name", menu.getName());
        dto.put("path", menu.getPath());
        dto.put("icon", menu.getIcon());
        dto.put("permission", menu.getPermission());
        dto.put("parentId", menu.getParentId());
        dto.put("sortOrder", menu.getSortOrder());
        dto.put("isButton", menu.getIsButton());
        dto.put("status", menu.getStatus());
        return dto;
    }
}
