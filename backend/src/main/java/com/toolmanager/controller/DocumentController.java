package com.toolmanager.controller;

import com.toolmanager.dto.DocumentDto;
import com.toolmanager.service.DocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/document")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class DocumentController {

    private final DocumentService documentService;

    /**
     * Get all documents
     * GET /api/document/all
     */
    @GetMapping("/all")
    public ResponseEntity<List<DocumentDto>> getAllDocuments() {
        return ResponseEntity.ok(documentService.getAll());
    }

    /**
     * Get documents by category
     * GET /api/document/category/{category}
     */
    @GetMapping("/category/{category}")
    public ResponseEntity<List<DocumentDto>> getByCategory(@PathVariable String category) {
        return ResponseEntity.ok(documentService.getByCategory(category));
    }

    /**
     * Get documents by type
     * GET /api/document/type/{type}
     */
    @GetMapping("/type/{type}")
    public ResponseEntity<List<DocumentDto>> getByType(@PathVariable String type) {
        return ResponseEntity.ok(documentService.getByType(type));
    }

    /**
     * Get document by ID
     * GET /api/document/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<DocumentDto> getById(@PathVariable Long id) {
        DocumentDto document = documentService.getById(id);
        if (document == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(document);
    }

    /**
     * Create or update a document
     * POST /api/document
     * PUT /api/document/{id}
     */
    @PostMapping
    public ResponseEntity<DocumentDto> createDocument(@RequestBody DocumentDto dto) {
        DocumentDto saved = documentService.save(dto);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<DocumentDto> updateDocument(@PathVariable Long id, @RequestBody DocumentDto dto) {
        dto.setId(id);
        DocumentDto updated = documentService.save(dto);
        return ResponseEntity.ok(updated);
    }

    /**
     * Delete a document
     * DELETE /api/document/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocument(@PathVariable Long id) {
        documentService.delete(id);
        return ResponseEntity.ok().build();
    }
}
