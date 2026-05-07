package com.toolmanager.controller;

import com.toolmanager.dto.RoleDTO;
import com.toolmanager.entity.Role;
import com.toolmanager.service.RoleService;
import javax.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 角色管理控制器
 * 作者：张擎
 * 时间：2026-05-06
 */
@RestController
@RequestMapping("/api/roles")
public class RoleController {

    @Autowired
    private RoleService roleService;

    /**
     * 创建角色
     */
    @PostMapping
    public ResponseEntity<?> createRole(@Valid @RequestBody RoleDTO dto) {
        try {
            Role role = roleService.createRole(dto, "admin");
            return ResponseEntity.ok(roleService.toDTO(role));
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * 更新角色
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateRole(@PathVariable Long id, @Valid @RequestBody RoleDTO dto) {
        try {
            Role role = roleService.updateRole(id, dto, "admin");
            return ResponseEntity.ok(roleService.toDTO(role));
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * 删除角色
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteRole(@PathVariable Long id) {
        try {
            roleService.deleteRole(id);
            Map<String, String> result = new HashMap<>();
            result.put("message", "删除成功");
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * 更新角色状态
     */
    @PostMapping("/{id}/status")
    public ResponseEntity<?> updateRoleStatus(@PathVariable Long id, @RequestBody Map<String, Integer> request) {
        try {
            Integer status = request.get("status");
            if (status == null) {
                Map<String, String> error = new HashMap<>();
                error.put("message", "状态不能为空");
                return ResponseEntity.badRequest().body(error);
            }
            Role role = roleService.updateRoleStatus(id, status, "admin");
            return ResponseEntity.ok(roleService.toDTO(role));
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * 根据ID获取角色
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getRoleById(@PathVariable Long id) {
        try {
            Role role = roleService.getRoleById(id);
            return ResponseEntity.ok(roleService.toDTO(role));
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * 分页查询角色
     */
    @GetMapping
    public ResponseEntity<?> listRoles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String roleCode,
            @RequestParam(required = false) String roleName) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Role> roles = roleService.listRoles(roleCode, roleName, pageable);
        Page<RoleDTO> dtoPage = roles.map(roleService::toDTO);
        return ResponseEntity.ok(dtoPage);
    }

    /**
     * 获取所有角色
     */
    @GetMapping("/all")
    public ResponseEntity<?> getAllRoles() {
        List<Role> roles = roleService.getAllRoles();
        List<RoleDTO> dtoList = roles.stream()
                .map(roleService::toDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtoList);
    }

    /**
     * 获取所有启用的角色（下拉列表）
     */
    @GetMapping("/active")
    public ResponseEntity<?> getActiveRoles() {
        List<Role> roles = roleService.getActiveRoles();
        List<RoleDTO> dtoList = roles.stream()
                .map(roleService::toDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtoList);
    }

    /**
     * 获取角色的菜单
     */
    @GetMapping("/{id}/menus")
    public ResponseEntity<?> getRoleMenus(@PathVariable Long id) {
        try {
            List<?> menus = roleService.getRoleMenus(id);
            return ResponseEntity.ok(menus);
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * 为角色分配菜单
     */
    @PostMapping("/{id}/menus")
    public ResponseEntity<?> assignMenus(@PathVariable Long id, @RequestBody Map<String, List<Long>> request) {
        try {
            List<Long> menuIds = request.get("menuIds");
            roleService.assignMenus(id, menuIds, "admin");
            Map<String, String> result = new HashMap<>();
            result.put("message", "菜单分配成功");
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
