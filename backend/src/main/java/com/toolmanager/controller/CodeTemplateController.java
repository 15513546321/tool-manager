package com.toolmanager.controller;

import com.toolmanager.dto.CodeTemplateDto;
import com.toolmanager.service.CodeTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/code-template")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class CodeTemplateController {

    private final CodeTemplateService codeTemplateService;

    /**
     * Get all code templates
     * GET /api/code-template/all
     */
    @GetMapping("/all")
    public ResponseEntity<List<CodeTemplateDto>> getAllTemplates() {
        return ResponseEntity.ok(codeTemplateService.getAll());
    }

    /**
     * Get templates by type
     * GET /api/code-template/type/{type}
     */
    @GetMapping("/type/{type}")
    public ResponseEntity<List<CodeTemplateDto>> getByType(@PathVariable String type) {
        return ResponseEntity.ok(codeTemplateService.getByType(type));
    }

    /**
     * Get template by ID
     * GET /api/code-template/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<CodeTemplateDto> getById(@PathVariable Long id) {
        CodeTemplateDto template = codeTemplateService.getById(id);
        if (template == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(template);
    }

    /**
     * Get template by name
     * GET /api/code-template/name/{name}
     */
    @GetMapping("/name/{name}")
    public ResponseEntity<CodeTemplateDto> getByName(@PathVariable String name) {
        CodeTemplateDto template = codeTemplateService.getByName(name);
        if (template == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(template);
    }

    /**
     * Create or update a code template
     * POST /api/code-template
     * PUT /api/code-template/{id}
     */
    @PostMapping
    public ResponseEntity<CodeTemplateDto> createTemplate(@RequestBody CodeTemplateDto dto) {
        CodeTemplateDto saved = codeTemplateService.save(dto);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<CodeTemplateDto> updateTemplate(@PathVariable Long id, @RequestBody CodeTemplateDto dto) {
        dto.setId(id);
        CodeTemplateDto updated = codeTemplateService.save(dto);
        return ResponseEntity.ok(updated);
    }

    /**
     * Delete a code template
     * DELETE /api/code-template/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id) {
        codeTemplateService.delete(id);
        return ResponseEntity.ok().build();
    }
}
