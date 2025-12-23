package com.toolmanager.service;

import lombok.extern.slf4j.Slf4j;
import com.toolmanager.dto.MenuItemDto;
import com.toolmanager.entity.MenuItem;
import com.toolmanager.repository.MenuItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 菜单项服务类
 * 处理菜单项的增删改查、层级查询等业务逻辑
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MenuItemService {
    private final MenuItemRepository menuItemRepository;

    /**
     * Get all menu items
     */
    public List<MenuItemDto> getAllMenuItems() {
        return menuItemRepository.findAllByOrderBySortOrder()
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Get menu items by parent ID
     */
    public List<MenuItemDto> getMenuItemsByParentId(String parentId) {
        return menuItemRepository.findByParentIdOrderBySortOrder(parentId)
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Get menu item by ID
     */
    public MenuItemDto getMenuItemById(String menuId) {
        return menuItemRepository.findByMenuId(menuId)
                .map(this::convertToDto)
                .orElse(null);
    }

    /**
     * Create a new menu item
     */
    @Transactional
    public MenuItemDto createMenuItem(MenuItemDto dto) {
        MenuItem menuItem = new MenuItem();
        menuItem.setMenuId(dto.getMenuId());
        menuItem.setName(dto.getName());
        menuItem.setPath(dto.getPath());
        menuItem.setIcon(dto.getIcon());
        menuItem.setVisible(dto.getVisible());
        menuItem.setParentId(dto.getParentId());
        menuItem.setSortOrder(dto.getSortOrder());
        menuItem.setUpdatedBy(dto.getUpdatedBy());

        MenuItem saved = menuItemRepository.save(menuItem);
        menuItemRepository.flush();
        return convertToDto(saved);
    }

    /**
     * Update a menu item
     */
    @Transactional
    public MenuItemDto updateMenuItem(String menuId, MenuItemDto dto) {
        log.info("=== updateMenuItem START: menuId=: {}", menuId + ", dto=" + dto);
        
        MenuItem menuItem = menuItemRepository.findByMenuId(menuId)
                .orElseThrow(() -> new IllegalArgumentException("Menu item not found: " + menuId));

        System.out.println("Found menu item: id=" + menuItem.getId() + ", name=" + menuItem.getName());

        // 更新所有字段
        menuItem.setName(dto.getName());
        menuItem.setPath(dto.getPath());
        menuItem.setIcon(dto.getIcon());
        menuItem.setVisible(dto.getVisible() != null ? dto.getVisible() : true);
        menuItem.setParentId(dto.getParentId());
        if (dto.getSortOrder() != null) {
            menuItem.setSortOrder(dto.getSortOrder());
        }
        menuItem.setUpdatedBy(dto.getUpdatedBy());

        log.info("Before save: menuItem=: {}", menuItem);
        
        // 显式保存
        MenuItem updated = menuItemRepository.save(menuItem);
        menuItemRepository.flush();
        
        log.info("After save: updated=: {}", updated);
        System.out.println("Menu item updated: " + menuId + ", name: " + updated.getName() + ", visible: " + updated.getVisible());
        log.info("{}",  "=== updateMenuItem END");
        
        return convertToDto(updated);
    }

    /**
     * Delete a menu item
     */
    @Transactional
    public void deleteMenuItem(String menuId) {
        MenuItem menuItem = menuItemRepository.findByMenuId(menuId)
                .orElseThrow(() -> new IllegalArgumentException("Menu item not found: " + menuId));
        menuItemRepository.delete(menuItem);
        menuItemRepository.flush();
    }

    private MenuItemDto convertToDto(MenuItem menuItem) {
        return new MenuItemDto(
                menuItem.getId(),
                menuItem.getMenuId(),
                menuItem.getName(),
                menuItem.getPath(),
                menuItem.getIcon(),
                menuItem.getVisible(),
                menuItem.getParentId(),
                menuItem.getSortOrder(),
                menuItem.getCreatedAt(),
                menuItem.getUpdatedAt(),
                menuItem.getUpdatedBy()
        );
    }
}



