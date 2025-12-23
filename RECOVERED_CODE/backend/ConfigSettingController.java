// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   ConfigSettingController.java

package com.toolmanager.controller;

import com.toolmanager.dto.ConfigSettingDto;
import com.toolmanager.service.ConfigSettingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;

public class ConfigSettingController
{

    public ResponseEntity getConfigByKey(String configKey)
    {
        ConfigSettingDto config;
        config = configSettingService.getConfigByKey(configKey);
        if(config == null)
            return ResponseEntity.notFound().build();
        try
        {
            return ResponseEntity.ok(config);
        }
        catch(Exception e)
        {
            log.error("Error getting config by key: {}", configKey, e);
        }
        return ResponseEntity.status(500).build();
    }

    public ResponseEntity getConfigsByType(String configType)
    {
        try
        {
            java.util.List configs = configSettingService.getConfigsByType(configType);
            return ResponseEntity.ok(configs);
        }
        catch(Exception e)
        {
            log.error("Error getting configs by type: {}", configType, e);
        }
        return ResponseEntity.status(500).build();
    }

    public ResponseEntity getAllConfigs()
    {
        try
        {
            java.util.List configs = configSettingService.getAllConfigs();
            return ResponseEntity.ok(configs);
        }
        catch(Exception e)
        {
            log.error("Error getting all configs", e);
        }
        return ResponseEntity.status(500).build();
    }

    public ResponseEntity saveConfig(ConfigSettingDto dto)
    {
        if(dto.getConfigKey() == null || dto.getConfigKey().trim().isEmpty())
        {
            log.warn("Config key is required");
            return ResponseEntity.badRequest().build();
        }
        try
        {
            ConfigSettingDto saved = configSettingService.saveConfig(dto);
            log.info("Config saved successfully: {}", dto.getConfigKey());
            return ResponseEntity.ok(saved);
        }
        catch(Exception e)
        {
            log.error("Error saving config: {}", dto.getConfigKey(), e);
        }
        return ResponseEntity.status(400).body(null);
    }

    public ResponseEntity deleteConfig(String configKey)
    {
        try
        {
            configSettingService.deleteConfig(configKey);
            log.info("Config deleted successfully: {}", configKey);
            return ResponseEntity.ok().build();
        }
        catch(IllegalArgumentException e)
        {
            log.warn("Config not found for deletion: {}", configKey);
            return ResponseEntity.notFound().build();
        }
        catch(Exception e)
        {
            log.error("Error deleting config: {}", configKey, e);
        }
        return ResponseEntity.status(400).build();
    }

    public ConfigSettingController(ConfigSettingService configSettingService)
    {
        this.configSettingService = configSettingService;
    }

    private static final Logger log = LoggerFactory.getLogger(com/toolmanager/controller/ConfigSettingController);
    private final ConfigSettingService configSettingService;

}
