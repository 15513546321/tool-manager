package com.toolmanager.controller;

import com.toolmanager.dto.MenuItemDto;
import com.toolmanager.service.MenuItemService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;

import java.util.List;

@RestController
@RequestMapping("/api/menu")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class MenuItemController {

    private final MenuItemService menuItemService;

    /**
     * Get all menu items
     * GET /api/menu/all
     */
    @GetMapping("/all")
    public ResponseEntity<List<MenuItemDto>> getAllMenuItems() {
        List<MenuItemDto> menus = menuItemService.getAllMenuItems();
        return ResponseEntity.ok(menus);
    }

    /**
     * Get menu items by parent ID
     * GET /api/menu/children/{parentId}
     */
    @GetMapping("/children/{parentId}")
    public ResponseEntity<List<MenuItemDto>> getMenuItemsByParentId(@PathVariable String parentId) {
        List<MenuItemDto> menus = menuItemService.getMenuItemsByParentId(parentId);
        return ResponseEntity.ok(menus);
    }

    /**
     * Get menu item by ID
     * GET /api/menu/{menuId}
     */
    @GetMapping("/{menuId}")
    public ResponseEntity<MenuItemDto> getMenuItemById(@PathVariable String menuId) {
        MenuItemDto menu = menuItemService.getMenuItemById(menuId);
        if (menu == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(menu);
    }

    /**
     * Create a new menu item
     * POST /api/menu
     */
    @PostMapping
    public ResponseEntity<MenuItemDto> createMenuItem(@RequestBody MenuItemDto dto) {
        MenuItemDto created = menuItemService.createMenuItem(dto);
        return ResponseEntity.ok(created);
    }

    /**
     * Update a menu item
     * PUT /api/menu/{menuId}
     */
    @PutMapping("/{menuId}")
    public ResponseEntity<MenuItemDto> updateMenuItem(@PathVariable String menuId, @RequestBody MenuItemDto dto) {
        MenuItemDto updated = menuItemService.updateMenuItem(menuId, dto);
        return ResponseEntity.ok(updated);
    }

    /**
     * Delete a menu item
     * DELETE /api/menu/{menuId}
     */
    @DeleteMapping("/{menuId}")
    public ResponseEntity<Void> deleteMenuItem(@PathVariable String menuId) {
        menuItemService.deleteMenuItem(menuId);
        return ResponseEntity.ok().build();
    }
}
