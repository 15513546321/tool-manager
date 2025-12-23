// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   ParameterCategoryController.java

package com.toolmanager.controller;

import com.toolmanager.service.ParameterCategoryService;
import java.util.Map;
import org.springframework.http.ResponseEntity;

public class ParameterCategoryController
{

    public ResponseEntity getAllCategories()
    {
        java.util.List categories = parameterCategoryService.getAllCategories();
        return ResponseEntity.ok(categories);
    }

    public ResponseEntity getCategoriesByBigClass(String bigClass)
    {
        java.util.List categories = parameterCategoryService.getCategoriesByBigClass(bigClass);
        return ResponseEntity.ok(categories);
    }

    public ResponseEntity addCategory(Map request)
    {
        String bigClass = (String)request.get("bigClass");
        String smallClass = (String)request.get("smallClass");
        String description = (String)request.get("description");
        String updatedBy = (String)request.getOrDefault("updatedBy", "admin");
        try
        {
            com.toolmanager.dto.ParameterCategoryDto category = parameterCategoryService.addCategory(bigClass, smallClass, description, updatedBy);
            return ResponseEntity.ok(category);
        }
        catch(RuntimeException e)
        {
            return ResponseEntity.badRequest().build();
        }
    }

    public ResponseEntity deleteCategory(String bigClass, String smallClass)
    {
        try
        {
            parameterCategoryService.deleteCategory(bigClass, smallClass);
            return ResponseEntity.ok().build();
        }
        catch(RuntimeException e)
        {
            return ResponseEntity.badRequest().build();
        }
    }

    public ResponseEntity renameBigClass(Map request)
    {
        String oldName = (String)request.get("oldName");
        String newName = (String)request.get("newName");
        String updatedBy = (String)request.getOrDefault("updatedBy", "admin");
        try
        {
            parameterCategoryService.renameBigClass(oldName, newName, updatedBy);
            return ResponseEntity.ok().build();
        }
        catch(RuntimeException e)
        {
            return ResponseEntity.badRequest().build();
        }
    }

    public ResponseEntity renameSmallClass(Map request)
    {
        String bigClass = (String)request.get("bigClass");
        String oldSmallClass = (String)request.get("oldSmallClass");
        String newSmallClass = (String)request.get("newSmallClass");
        String updatedBy = (String)request.getOrDefault("updatedBy", "admin");
        try
        {
            parameterCategoryService.renameSmallClass(bigClass, oldSmallClass, newSmallClass, updatedBy);
            return ResponseEntity.ok().build();
        }
        catch(RuntimeException e)
        {
            return ResponseEntity.badRequest().build();
        }
    }

    public ParameterCategoryController(ParameterCategoryService parameterCategoryService)
    {
        this.parameterCategoryService = parameterCategoryService;
    }

    private final ParameterCategoryService parameterCategoryService;
}
