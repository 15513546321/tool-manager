package com.toolmanager.controller;

import com.toolmanager.dto.ConfigSettingDto;
import com.toolmanager.service.ConfigSettingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.List;

@Slf4j
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
        try {
            ConfigSettingDto config = configSettingService.getConfigByKey(configKey);
            if (config == null) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(config);
        } catch (Exception e) {
            log.error("Error getting config by key: {}", configKey, e);
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * Get all configs by type
     * GET /api/config/type/{configType}
     */
    @GetMapping("/type/{configType}")
    public ResponseEntity<List<ConfigSettingDto>> getConfigsByType(@PathVariable String configType) {
        try {
            List<ConfigSettingDto> configs = configSettingService.getConfigsByType(configType);
            return ResponseEntity.ok(configs);
        } catch (Exception e) {
            log.error("Error getting configs by type: {}", configType, e);
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * Get all configs
     * GET /api/config/all
     */
    @GetMapping("/all")
    public ResponseEntity<List<ConfigSettingDto>> getAllConfigs() {
        try {
            List<ConfigSettingDto> configs = configSettingService.getAllConfigs();
            return ResponseEntity.ok(configs);
        } catch (Exception e) {
            log.error("Error getting all configs", e);
            return ResponseEntity.status(500).build();
        }
    }

    /**
     * Create or update a config
     * POST /api/config
     */
    @PostMapping
    public ResponseEntity<ConfigSettingDto> saveConfig(@RequestBody ConfigSettingDto dto) {
        try {
            if (dto.getConfigKey() == null || dto.getConfigKey().trim().isEmpty()) {
                log.warn("Config key is required");
                return ResponseEntity.badRequest().build();
            }
            ConfigSettingDto saved = configSettingService.saveConfig(dto);
            log.info("Config saved successfully: {}", dto.getConfigKey());
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            log.error("Error saving config: {}", dto.getConfigKey(), e);
            return ResponseEntity.status(400).body(null);
        }
    }

    /**
     * Delete a config
     * DELETE /api/config/{configKey}
     */
    @DeleteMapping("/{configKey}")
    public ResponseEntity<Void> deleteConfig(@PathVariable String configKey) {
        try {
            configSettingService.deleteConfig(configKey);
            log.info("Config deleted successfully: {}", configKey);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            log.warn("Config not found for deletion: {}", configKey);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error deleting config: {}", configKey, e);
            return ResponseEntity.status(400).build();
        }
    }
}
