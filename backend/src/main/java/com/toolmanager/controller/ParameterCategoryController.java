package com.toolmanager.controller;

import com.toolmanager.dto.ParameterCategoryDto;
import com.toolmanager.service.ParameterCategoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/parameter-category")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class ParameterCategoryController {

    private final ParameterCategoryService parameterCategoryService;

    /**
     * Get all categories
     * GET /api/parameter-category/all
     */
    @GetMapping("/all")
    public ResponseEntity<List<ParameterCategoryDto>> getAllCategories() {
        List<ParameterCategoryDto> categories = parameterCategoryService.getAllCategories();
        return ResponseEntity.ok(categories);
    }

    /**
     * Get categories by big class
     * GET /api/parameter-category/big-class/{bigClass}
     */
    @GetMapping("/big-class/{bigClass}")
    public ResponseEntity<List<ParameterCategoryDto>> getCategoriesByBigClass(@PathVariable String bigClass) {
        List<ParameterCategoryDto> categories = parameterCategoryService.getCategoriesByBigClass(bigClass);
        return ResponseEntity.ok(categories);
    }

    /**
     * Add a new category
     * POST /api/parameter-category/add
     */
    @PostMapping("/add")
    public ResponseEntity<ParameterCategoryDto> addCategory(
            @RequestBody Map<String, String> request) {
        String bigClass = request.get("bigClass");
        String smallClass = request.get("smallClass");
        String description = request.get("description");
        String updatedBy = request.getOrDefault("updatedBy", "admin");

        try {
            ParameterCategoryDto category = parameterCategoryService.addCategory(bigClass, smallClass, description, updatedBy);
            return ResponseEntity.ok(category);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Delete a category
     * DELETE /api/parameter-category/delete
     */
    @DeleteMapping("/delete")
    public ResponseEntity<Void> deleteCategory(
            @RequestParam String bigClass,
            @RequestParam String smallClass) {
        try {
            parameterCategoryService.deleteCategory(bigClass, smallClass);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Rename a big class
     * PUT /api/parameter-category/rename-big-class
     */
    @PutMapping("/rename-big-class")
    public ResponseEntity<Void> renameBigClass(
            @RequestBody Map<String, String> request) {
        String oldName = request.get("oldName");
        String newName = request.get("newName");
        String updatedBy = request.getOrDefault("updatedBy", "admin");

        try {
            parameterCategoryService.renameBigClass(oldName, newName, updatedBy);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Rename a small class
     * PUT /api/parameter-category/rename-small-class
     */
    @PutMapping("/rename-small-class")
    public ResponseEntity<Void> renameSmallClass(
            @RequestBody Map<String, String> request) {
        String bigClass = request.get("bigClass");
        String oldSmallClass = request.get("oldSmallClass");
        String newSmallClass = request.get("newSmallClass");
        String updatedBy = request.getOrDefault("updatedBy", "admin");

        try {
            parameterCategoryService.renameSmallClass(bigClass, oldSmallClass, newSmallClass, updatedBy);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
