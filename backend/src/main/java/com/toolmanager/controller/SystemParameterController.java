package com.toolmanager.controller;

import com.toolmanager.dto.SystemParameterDto;
import com.toolmanager.service.SystemParameterService;
import com.toolmanager.entity.ParameterCategory;
import com.toolmanager.repository.ParameterCategoryRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/system-param")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class SystemParameterController {

    private final SystemParameterService systemParameterService;
    private final ParameterCategoryRepository parameterCategoryRepository;

    /**
     * Get parameter by key
     * GET /api/system-param/{paramKey}
     */
    @GetMapping("/{paramKey}")
    public ResponseEntity<SystemParameterDto> getParameterByKey(@PathVariable String paramKey) {
        SystemParameterDto param = systemParameterService.getParameterByKey(paramKey);
        if (param == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(param);
    }

    /**
     * Get all parameters by category
     * GET /api/system-param/category/{category}
     */
    @GetMapping("/category/{category}")
    public ResponseEntity<List<SystemParameterDto>> getParametersByCategory(@PathVariable String category) {
        List<SystemParameterDto> params = systemParameterService.getParametersByCategory(category);
        return ResponseEntity.ok(params);
    }

    /**
     * Get all parameters
     * GET /api/system-param/all
     */
    @GetMapping("/all")
    public ResponseEntity<List<SystemParameterDto>> getAllParameters() {
        List<SystemParameterDto> params = systemParameterService.getAllParameters();
        return ResponseEntity.ok(params);
    }

    /**
     * Create or update a parameter
     * POST /api/system-param
     */
    @PostMapping
    public ResponseEntity<SystemParameterDto> saveParameter(@RequestBody SystemParameterDto dto) {
        SystemParameterDto saved = systemParameterService.saveParameter(dto);
        return ResponseEntity.ok(saved);
    }

    /**
     * Delete a parameter
     * DELETE /api/system-param/{paramKey}
     */
    @DeleteMapping("/{paramKey}")
    public ResponseEntity<Void> deleteParameter(@PathVariable String paramKey) {
        systemParameterService.deleteParameter(paramKey);
        return ResponseEntity.ok().build();
    }

    /**
     * Get all parameter categories
     * GET /api/system-param/categories/all
     */
    @GetMapping("/categories/all")
    public ResponseEntity<Map<String, List<String>>> getAllCategories() {
        List<ParameterCategory> categories = parameterCategoryRepository.findAll();
        Map<String, List<String>> categoryMap = categories.stream()
                .collect(Collectors.groupingBy(
                        ParameterCategory::getBigClass,
                        Collectors.mapping(ParameterCategory::getSmallClass, Collectors.toList())
                ));
        return ResponseEntity.ok(categoryMap);
    }

    /**
     * Save parameter categories
     * POST /api/system-param/categories
     */
    @PostMapping("/categories")
    public ResponseEntity<Map<String, List<String>>> saveCategories(@RequestBody Map<String, List<String>> categoryMap) {
        // Clear existing categories
        parameterCategoryRepository.deleteAll();
        
        // Save new categories
        categoryMap.forEach((bigClass, smallClasses) -> {
            for (String smallClass : smallClasses) {
                ParameterCategory category = new ParameterCategory();
                category.setBigClass(bigClass);
                category.setSmallClass(smallClass);
                category.setUpdatedBy("admin");
                category.setCreatedAt(LocalDateTime.now());
                category.setUpdatedAt(LocalDateTime.now());
                parameterCategoryRepository.save(category);
            }
        });
        parameterCategoryRepository.flush();
        
        return ResponseEntity.ok(categoryMap);
    }

    /**
     * Batch save parameters
     * POST /api/system-param/batch
     */
    @PostMapping("/batch")
    public ResponseEntity<List<SystemParameterDto>> batchSaveParameters(@RequestBody List<SystemParameterDto> dtos) {
        List<SystemParameterDto> savedParams = systemParameterService.batchSaveParameters(dtos);
        return ResponseEntity.ok(savedParams);
    }

    /**
     * Export parameters to Excel
     * GET /api/system-param/export
     */
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportParametersToExcel() {
        byte[] excelData = systemParameterService.exportParametersToExcel();
        return ResponseEntity.ok()
                .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                .header("Content-Disposition", "attachment; filename=system_parameters.xlsx")
                .body(excelData);
    }

    /**
     * Import parameters from Excel
     * POST /api/system-param/import
     */
    @PostMapping(value = "/import", consumes = "multipart/form-data")
    public ResponseEntity<List<SystemParameterDto>> importParametersFromExcel(@RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        try {
            byte[] excelData = file.getBytes();
            List<SystemParameterDto> importedParams = systemParameterService.importParametersFromExcel(excelData);
            return ResponseEntity.ok(importedParams);
        } catch (IOException e) {
            throw new RuntimeException("Failed to read uploaded file", e);
        }
    }
}