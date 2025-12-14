package com.toolmanager.controller;

import com.toolmanager.dto.SystemParameterDto;
import com.toolmanager.service.SystemParameterService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;

import java.util.List;

@RestController
@RequestMapping("/api/system-param")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class SystemParameterController {

    private final SystemParameterService systemParameterService;

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
}
