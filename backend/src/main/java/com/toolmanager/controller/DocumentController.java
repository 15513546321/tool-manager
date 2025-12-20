package com.toolmanager.controller;

import com.toolmanager.dto.DocumentDto;
import com.toolmanager.dto.DocumentVersionDto;
import com.toolmanager.service.DocumentService;
import com.toolmanager.service.DocumentVersionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class DocumentController {

    private final DocumentService documentService;
    private final DocumentVersionService documentVersionService;

    /**
     * Get all documents
     * GET /api/documents/all
     */
    @GetMapping("/all")
    public ResponseEntity<List<DocumentDto>> getAllDocuments() {
        return ResponseEntity.ok(documentService.getAll());
    }

    /**
     * Get documents by category
     * GET /api/documents/category/{category}
     */
    @GetMapping("/category/{category}")
    public ResponseEntity<List<DocumentDto>> getByCategory(@PathVariable String category) {
        return ResponseEntity.ok(documentService.getByCategory(category));
    }

    /**
     * Get documents by category and sub-category
     * GET /api/documents/category/{category}/sub/{subCategory}
     */
    @GetMapping("/category/{category}/sub/{subCategory}")
    public ResponseEntity<List<DocumentDto>> getBySubCategory(
            @PathVariable String category,
            @PathVariable String subCategory) {
        return ResponseEntity.ok(documentService.getBySubCategory(category, subCategory));
    }

    /**
     * Search documents by title
     * GET /api/documents/search?title={title}
     */
    @GetMapping("/search")
    public ResponseEntity<List<DocumentDto>> searchByTitle(@RequestParam String title) {
        return ResponseEntity.ok(documentService.searchByTitle(title));
    }

    /**
     * Get document by ID
     * GET /api/documents/{id}
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
     * POST /api/documents
     */
    @PostMapping
    public ResponseEntity<DocumentDto> saveDocument(@RequestBody DocumentDto dto) {
        DocumentDto saved = documentService.save(dto);
        return ResponseEntity.ok(saved);
    }

    /**
     * Update a document by ID
     * POST /api/documents/{id}
     */
    @PostMapping("/{id}")
    public ResponseEntity<DocumentDto> updateDocument(@PathVariable Long id, @RequestBody DocumentDto dto) {
        dto.setId(id);
        DocumentDto updated = documentService.save(dto);
        return ResponseEntity.ok(updated);
    }

    /**
     * Delete a document
     * DELETE /api/documents/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocument(@PathVariable Long id) {
        documentService.delete(id);
        return ResponseEntity.ok().build();
    }

    // --- Version Management ---

    /**
     * Get all versions of a document
     * GET /api/documents/{documentId}/versions
     */
    @GetMapping("/{documentId}/versions")
    public ResponseEntity<List<DocumentVersionDto>> getVersions(@PathVariable Long documentId) {
        return ResponseEntity.ok(documentVersionService.getVersions(documentId));
    }

    /**
     * Get a specific version
     * GET /api/documents/{documentId}/versions/{versionNumber}
     */
    @GetMapping("/{documentId}/versions/{versionNumber}")
    public ResponseEntity<DocumentVersionDto> getVersion(
            @PathVariable Long documentId,
            @PathVariable String versionNumber) {
        DocumentVersionDto version = documentVersionService.getVersion(documentId, versionNumber);
        if (version == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(version);
    }

    /**
     * Create a new version
     * POST /api/documents/{documentId}/versions
     */
    @PostMapping("/{documentId}/versions")
    public ResponseEntity<DocumentVersionDto> saveVersion(
            @PathVariable Long documentId,
            @RequestBody DocumentVersionDto dto) {
        DocumentVersionDto saved = documentVersionService.saveVersion(documentId, dto);
        return ResponseEntity.ok(saved);
    }

    /**
     * Delete a version
     * DELETE /api/documents/versions/{versionId}
     */
    @DeleteMapping("/versions/{versionId}")
    public ResponseEntity<Void> deleteVersion(@PathVariable Long versionId) {
        documentVersionService.deleteVersion(versionId);
        return ResponseEntity.ok().build();
    }
}
