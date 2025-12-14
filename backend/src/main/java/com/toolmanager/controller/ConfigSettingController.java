package com.toolmanager.controller;

import com.toolmanager.dto.ConfigSettingDto;
import com.toolmanager.service.ConfigSettingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;

import java.util.List;

@RestController
@RequestMapping("/api/config")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class ConfigSettingController {

    private final ConfigSettingService configSettingService;

    /**
     * Get config by key
     * GET /api/config/{configKey}
     */
    @GetMapping("/{configKey}")
    public ResponseEntity<ConfigSettingDto> getConfigByKey(@PathVariable String configKey) {
        ConfigSettingDto config = configSettingService.getConfigByKey(configKey);
        if (config == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(config);
    }

    /**
     * Get all configs by type
     * GET /api/config/type/{configType}
     */
    @GetMapping("/type/{configType}")
    public ResponseEntity<List<ConfigSettingDto>> getConfigsByType(@PathVariable String configType) {
        List<ConfigSettingDto> configs = configSettingService.getConfigsByType(configType);
        return ResponseEntity.ok(configs);
    }

    /**
     * Get all configs
     * GET /api/config/all
     */
    @GetMapping("/all")
    public ResponseEntity<List<ConfigSettingDto>> getAllConfigs() {
        List<ConfigSettingDto> configs = configSettingService.getAllConfigs();
        return ResponseEntity.ok(configs);
    }

    /**
     * Create or update a config
     * POST /api/config
     */
    @PostMapping
    public ResponseEntity<ConfigSettingDto> saveConfig(@RequestBody ConfigSettingDto dto) {
        ConfigSettingDto saved = configSettingService.saveConfig(dto);
        return ResponseEntity.ok(saved);
    }

    /**
     * Delete a config
     * DELETE /api/config/{configKey}
     */
    @DeleteMapping("/{configKey}")
    public ResponseEntity<Void> deleteConfig(@PathVariable String configKey) {
        configSettingService.deleteConfig(configKey);
        return ResponseEntity.ok().build();
    }
}
