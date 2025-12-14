package com.toolmanager.controller;

import com.toolmanager.dto.SuggestionDto;
import com.toolmanager.service.SuggestionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;

import java.util.List;

@RestController
@RequestMapping("/api/suggestion")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class SuggestionController {

    private final SuggestionService suggestionService;

    /**
     * Get all suggestions
     * GET /api/suggestion/all
     */
    @GetMapping("/all")
    public ResponseEntity<List<SuggestionDto>> getAllSuggestions() {
        List<SuggestionDto> suggestions = suggestionService.getAllSuggestions();
        return ResponseEntity.ok(suggestions);
    }

    /**
     * Get suggestions by status
     * GET /api/suggestion/status/{status}
     */
    @GetMapping("/status/{status}")
    public ResponseEntity<List<SuggestionDto>> getSuggestionsByStatus(@PathVariable String status) {
        List<SuggestionDto> suggestions = suggestionService.getSuggestionsByStatus(status);
        return ResponseEntity.ok(suggestions);
    }

    /**
     * Get suggestions by category
     * GET /api/suggestion/category/{category}
     */
    @GetMapping("/category/{category}")
    public ResponseEntity<List<SuggestionDto>> getSuggestionsByCategory(@PathVariable String category) {
        List<SuggestionDto> suggestions = suggestionService.getSuggestionsByCategory(category);
        return ResponseEntity.ok(suggestions);
    }

    /**
     * Create a new suggestion
     * POST /api/suggestion
     */
    @PostMapping
    public ResponseEntity<SuggestionDto> createSuggestion(@RequestBody SuggestionDto dto) {
        SuggestionDto created = suggestionService.createSuggestion(dto);
        return ResponseEntity.ok(created);
    }

    /**
     * Update a suggestion
     * PUT /api/suggestion/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<SuggestionDto> updateSuggestion(@PathVariable Long id, @RequestBody SuggestionDto dto) {
        SuggestionDto updated = suggestionService.updateSuggestion(id, dto);
        return ResponseEntity.ok(updated);
    }

    /**
     * Delete a suggestion
     * DELETE /api/suggestion/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSuggestion(@PathVariable Long id) {
        suggestionService.deleteSuggestion(id);
        return ResponseEntity.ok().build();
    }
}
