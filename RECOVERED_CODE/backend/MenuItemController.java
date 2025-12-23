// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   MenuItemController.java

package com.toolmanager.controller;

import com.toolmanager.dto.MenuItemDto;
import com.toolmanager.service.MenuItemService;
import org.springframework.http.ResponseEntity;

public class MenuItemController
{

    public ResponseEntity getAllMenuItems()
    {
        java.util.List menus = menuItemService.getAllMenuItems();
        return ResponseEntity.ok(menus);
    }

    public ResponseEntity getMenuItemsByParentId(String parentId)
    {
        java.util.List menus = menuItemService.getMenuItemsByParentId(parentId);
        return ResponseEntity.ok(menus);
    }

    public ResponseEntity getMenuItemById(String menuId)
    {
        MenuItemDto menu = menuItemService.getMenuItemById(menuId);
        if(menu == null)
            return ResponseEntity.notFound().build();
        else
            return ResponseEntity.ok(menu);
    }

    public ResponseEntity createMenuItem(MenuItemDto dto)
    {
        MenuItemDto created = menuItemService.createMenuItem(dto);
        return ResponseEntity.ok(created);
    }

    public ResponseEntity updateMenuItem(String menuId, MenuItemDto dto)
    {
        MenuItemDto updated = menuItemService.updateMenuItem(menuId, dto);
        return ResponseEntity.ok(updated);
    }

    public ResponseEntity deleteMenuItem(String menuId)
    {
        menuItemService.deleteMenuItem(menuId);
        return ResponseEntity.ok().build();
    }

    public MenuItemController(MenuItemService menuItemService)
    {
        this.menuItemService = menuItemService;
    }

    private final MenuItemService menuItemService;
}
