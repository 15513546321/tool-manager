// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   DocumentCategoryController.java

package com.toolmanager.controller;

import com.toolmanager.dto.DocumentCategoryDto;
import com.toolmanager.service.DocumentCategoryService;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;

public class DocumentCategoryController
{

    public ResponseEntity getAllCategories()
    {
        java.util.List categories = categoryService.getAllCategories();
        return ResponseEntity.ok(categories);
    }

    public ResponseEntity getCategoryByName(String categoryName)
    {
        DocumentCategoryDto category = categoryService.getCategoryByName(categoryName);
        if(category == null)
            return ResponseEntity.notFound().build();
        else
            return ResponseEntity.ok(category);
    }

    public ResponseEntity createOrUpdateCategory(DocumentCategoryDto dto)
    {
        DocumentCategoryDto created = categoryService.createOrUpdateCategory(dto, "admin");
        return ResponseEntity.ok(created);
    }

    public ResponseEntity deleteCategory(String categoryName)
    {
        categoryService.deleteCategory(categoryName);
        Map response = new HashMap();
        response.put("message", "Category deleted successfully");
        return ResponseEntity.ok(response);
    }

    public ResponseEntity renameCategory(String oldName, String newName)
    {
        DocumentCategoryDto updated = categoryService.renameCategory(oldName, newName, "admin");
        return ResponseEntity.ok(updated);
    }

    public ResponseEntity addSubCategory(String categoryName, String subCategoryName)
    {
        DocumentCategoryDto updated = categoryService.addSubCategory(categoryName, subCategoryName, "admin");
        return ResponseEntity.ok(updated);
    }

    public ResponseEntity deleteSubCategory(String categoryName, String subCategoryName)
    {
        DocumentCategoryDto updated = categoryService.deleteSubCategory(categoryName, subCategoryName, "admin");
        return ResponseEntity.ok(updated);
    }

    public ResponseEntity renameSubCategory(String categoryName, String oldSubName, String newSubName)
    {
        DocumentCategoryDto updated = categoryService.renameSubCategory(categoryName, oldSubName, newSubName, "admin");
        return ResponseEntity.ok(updated);
    }

    public DocumentCategoryController(DocumentCategoryService categoryService)
    {
        this.categoryService = categoryService;
    }

    private final DocumentCategoryService categoryService;
}
