package com.toolmanager.controller;

import com.toolmanager.dto.DocumentCategoryDto;
import com.toolmanager.service.DocumentCategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/document-category")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class DocumentCategoryController {

    private final DocumentCategoryService categoryService;

    /**
     * Get all categories
     * GET /api/document-category/all
     */
    @GetMapping("/all")
    public ResponseEntity<List<DocumentCategoryDto>> getAllCategories() {
        List<DocumentCategoryDto> categories = categoryService.getAllCategories();
        return ResponseEntity.ok(categories);
    }

    /**
     * Get a specific category by name
     * GET /api/document-category/{categoryName}
     */
    @GetMapping("/{categoryName}")
    public ResponseEntity<DocumentCategoryDto> getCategoryByName(@PathVariable String categoryName) {
        DocumentCategoryDto category = categoryService.getCategoryByName(categoryName);
        if (category == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(category);
    }

    /**
     * Create or update a category with sub-categories
     * POST /api/document-category
     */
    @PostMapping
    public ResponseEntity<DocumentCategoryDto> createOrUpdateCategory(
            @RequestBody DocumentCategoryDto dto) {
        DocumentCategoryDto created = categoryService.createOrUpdateCategory(dto, "admin");
        return ResponseEntity.ok(created);
    }

    /**
     * Delete a category
     * DELETE /api/document-category/{categoryName}
     */
    @DeleteMapping("/{categoryName}")
    public ResponseEntity<Map<String, String>> deleteCategory(@PathVariable String categoryName) {
        categoryService.deleteCategory(categoryName);
        Map<String, String> response = new HashMap<>();
        response.put("message", "Category deleted successfully");
        return ResponseEntity.ok(response);
    }

    /**
     * Rename a category
     * PUT /api/document-category/{oldName}/rename
     */
    @PutMapping("/{oldName}/rename")
    public ResponseEntity<DocumentCategoryDto> renameCategory(
            @PathVariable String oldName,
            @RequestParam String newName) {
        DocumentCategoryDto updated = categoryService.renameCategory(oldName, newName, "admin");
        return ResponseEntity.ok(updated);
    }

    /**
     * Add a sub-category to an existing category
     * POST /api/document-category/{categoryName}/sub-categories
     */
    @PostMapping("/{categoryName}/sub-categories")
    public ResponseEntity<DocumentCategoryDto> addSubCategory(
            @PathVariable String categoryName,
            @RequestParam String subCategoryName) {
        DocumentCategoryDto updated = categoryService.addSubCategory(categoryName, subCategoryName, "admin");
        return ResponseEntity.ok(updated);
    }

    /**
     * Delete a sub-category
     * DELETE /api/document-category/{categoryName}/sub-categories/{subCategoryName}
     */
    @DeleteMapping("/{categoryName}/sub-categories/{subCategoryName}")
    public ResponseEntity<DocumentCategoryDto> deleteSubCategory(
            @PathVariable String categoryName,
            @PathVariable String subCategoryName) {
        DocumentCategoryDto updated = categoryService.deleteSubCategory(categoryName, subCategoryName, "admin");
        return ResponseEntity.ok(updated);
    }

    /**
     * Rename a sub-category
     * PUT /api/document-category/{categoryName}/sub-categories/{oldSubName}/rename
     */
    @PutMapping("/{categoryName}/sub-categories/{oldSubName}/rename")
    public ResponseEntity<DocumentCategoryDto> renameSubCategory(
            @PathVariable String categoryName,
            @PathVariable String oldSubName,
            @RequestParam String newSubName) {
        DocumentCategoryDto updated = categoryService.renameSubCategory(categoryName, oldSubName, newSubName, "admin");
        return ResponseEntity.ok(updated);
    }
}
