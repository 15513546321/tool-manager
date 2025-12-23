// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   CodeTemplateController.java

package com.toolmanager.controller;

import com.toolmanager.dto.CodeTemplateDto;
import com.toolmanager.service.CodeTemplateService;
import org.springframework.http.ResponseEntity;

public class CodeTemplateController
{

    public ResponseEntity getAllTemplates()
    {
        return ResponseEntity.ok(codeTemplateService.getAll());
    }

    public ResponseEntity getByType(String type)
    {
        return ResponseEntity.ok(codeTemplateService.getByType(type));
    }

    public ResponseEntity getById(Long id)
    {
        CodeTemplateDto template = codeTemplateService.getById(id);
        if(template == null)
            return ResponseEntity.notFound().build();
        else
            return ResponseEntity.ok(template);
    }

    public ResponseEntity getByName(String name)
    {
        CodeTemplateDto template = codeTemplateService.getByName(name);
        if(template == null)
            return ResponseEntity.notFound().build();
        else
            return ResponseEntity.ok(template);
    }

    public ResponseEntity createTemplate(CodeTemplateDto dto)
    {
        CodeTemplateDto saved = codeTemplateService.save(dto);
        return ResponseEntity.ok(saved);
    }

    public ResponseEntity updateTemplate(Long id, CodeTemplateDto dto)
    {
        dto.setId(id);
        CodeTemplateDto updated = codeTemplateService.save(dto);
        return ResponseEntity.ok(updated);
    }

    public ResponseEntity deleteTemplate(Long id)
    {
        codeTemplateService.delete(id);
        return ResponseEntity.ok().build();
    }

    public CodeTemplateController(CodeTemplateService codeTemplateService)
    {
        this.codeTemplateService = codeTemplateService;
    }

    private final CodeTemplateService codeTemplateService;
}
