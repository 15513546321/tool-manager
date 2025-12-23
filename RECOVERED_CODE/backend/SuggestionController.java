// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   SuggestionController.java

package com.toolmanager.controller;

import com.toolmanager.dto.SuggestionDto;
import com.toolmanager.service.SuggestionService;
import javax.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;

public class SuggestionController
{

    public ResponseEntity getAllSuggestions()
    {
        java.util.List suggestions = suggestionService.getAllSuggestions();
        return ResponseEntity.ok(suggestions);
    }

    public ResponseEntity getSuggestionsByStatus(String status)
    {
        java.util.List suggestions = suggestionService.getSuggestionsByStatus(status);
        return ResponseEntity.ok(suggestions);
    }

    public ResponseEntity getSuggestionsByCategory(String category)
    {
        java.util.List suggestions = suggestionService.getSuggestionsByCategory(category);
        return ResponseEntity.ok(suggestions);
    }

    public ResponseEntity createSuggestion(SuggestionDto dto, HttpServletRequest request)
    {
        String clientIp = request.getRemoteAddr();
        SuggestionDto created = suggestionService.createSuggestion(dto, clientIp);
        return ResponseEntity.ok(created);
    }

    public ResponseEntity updateSuggestion(Long id, SuggestionDto dto)
    {
        SuggestionDto updated = suggestionService.updateSuggestion(id, dto);
        return ResponseEntity.ok(updated);
    }

    public ResponseEntity deleteSuggestion(Long id)
    {
        suggestionService.deleteSuggestion(id);
        return ResponseEntity.ok().build();
    }

    public SuggestionController(SuggestionService suggestionService)
    {
        this.suggestionService = suggestionService;
    }

    private final SuggestionService suggestionService;
}
