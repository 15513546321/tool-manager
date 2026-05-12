
package com.toolmanager.controller;

import com.toolmanager.dto.MenuDTO;
import com.toolmanager.dto.MenuStatusDTO;
import com.toolmanager.entity.Menu;
import com.toolmanager.service.MenuService;
import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 菜单管理控制器
 * 作者：张擎
 * 时间：2026-05-06
 */
@RestController
@RequestMapping("/api/menus")
public class MenuController {

    @Autowired
    private MenuService menuService;

    /**
     * 创建菜单
     */
    @PostMapping
    public ResponseEntity<?> createMenu(@Valid @RequestBody MenuDTO dto) {
        try {
            Menu menu = menuService.createMenu(dto, "admin");
            return ResponseEntity.ok(menuService.toDTO(menu));
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * 更新菜单
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateMenu(@PathVariable Long id, @Valid @RequestBody MenuDTO dto) {
        try {
            Menu menu = menuService.updateMenu(id, dto, "admin");
            return ResponseEntity.ok(menuService.toDTO(menu));
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * 删除菜单
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteMenu(@PathVariable Long id) {
        try {
            menuService.deleteMenu(id);
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
     * 根据ID获取菜单
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getMenuById(@PathVariable Long id) {
        try {
            Menu menu = menuService.getMenuById(id);
            return ResponseEntity.ok(menuService.toDTO(menu));
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * 获取所有菜单列表
     */
    @GetMapping
    public ResponseEntity<?> getAllMenus() {
        List<Menu> menus = menuService.findAllByOrderBySortOrderAsc();
        List<MenuDTO> dtoList = menus.stream()
                .map(menuService::toDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtoList);
    }

    /**
     * 获取当前用户有权限的菜单（树形结构）- 用于前端导航
     */
    @GetMapping("/tree")
    public ResponseEntity<?> getMenuTree(HttpServletRequest request) {
        // 从请求上下文中获取当前登录用户ID
        Long userId = (Long) request.getAttribute("userId");
        
        if (userId == null) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "用户未登录");
            return ResponseEntity.badRequest().body(error);
        }
        
        List<Menu> menus = menuService.getMenusByUserId(userId);
        List<MenuDTO> dtoList = menus.stream()
                .map(menuService::toDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtoList);
    }

    /**
     * 获取所有菜单（树形结构，不进行权限过滤）- 用于菜单管理和权限管理页面
     */
    @GetMapping("/all-tree")
    public ResponseEntity<?> getAllMenuTree() {
        List<Menu> menus = menuService.getAllMenus();
        List<MenuDTO> dtoList = menus.stream()
                .map(menuService::toDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtoList);
    }

    /**
     * 根据父ID获取子菜单
     */
    @GetMapping("/children/{parentId}")
    public ResponseEntity<?> getChildrenByParentId(@PathVariable Long parentId) {
        List<Menu> menus = menuService.findByParentIdOrderBySortOrderAsc(parentId);
        List<MenuDTO> dtoList = menus.stream()
                .map(menuService::toDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtoList);
    }

    /**
     * 获取所有启用的菜单（非按钮，用于前端导航）
     */
    @GetMapping("/active")
    public ResponseEntity<?> getActiveMenus() {
        List<Menu> menus = menuService.getActiveMenus();
        List<MenuDTO> dtoList = menus.stream()
                .map(menuService::toDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtoList);
    }

    /**
     * 调整菜单排序（上移/下移）
     */
    @PostMapping("/{id}/reorder")
    public ResponseEntity<?> reorderMenu(@PathVariable Long id, @RequestParam("direction") String direction) {
        try {
            menuService.reorderMenu(id, direction);
            Map<String, String> result = new HashMap<>();
            result.put("message", "排序调整成功");
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * 切换菜单状态（启用/停用）
     */
    @PutMapping("/{id}/status")
    public ResponseEntity<?> toggleMenuStatus(@PathVariable Long id, @Valid @RequestBody MenuStatusDTO statusDTO) {
        try {
            Menu menu = menuService.updateMenuStatus(id, statusDTO.getStatus(), "admin");
            return ResponseEntity.ok(menuService.toDTO(menu));
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
