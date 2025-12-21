package com.toolmanager.service;

import com.toolmanager.dto.ConfigSettingDto;
import com.toolmanager.entity.ConfigSetting;
import com.toolmanager.repository.ConfigSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ConfigSettingService {
    private final ConfigSettingRepository configSettingRepository;

    /**
     * Get config by key
     */
    public ConfigSettingDto getConfigByKey(String configKey) {
        return configSettingRepository.findByConfigKey(configKey)
                .map(this::convertToDto)
                .orElse(null);
    }

    /**
     * Get all configs by type
     */
    public List<ConfigSettingDto> getConfigsByType(String configType) {
        return configSettingRepository.findByConfigType(configType)
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Get all configs
     */
    public List<ConfigSettingDto> getAllConfigs() {
        return configSettingRepository.findAll()
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Create or update a config
     */
    @Transactional
    public ConfigSettingDto saveConfig(ConfigSettingDto dto) {
        ConfigSetting config = configSettingRepository.findByConfigKey(dto.getConfigKey())
                .orElse(new ConfigSetting());

        config.setConfigKey(dto.getConfigKey());
        config.setConfigValue(dto.getConfigValue());
        config.setConfigType(dto.getConfigType());
        config.setDescription(dto.getDescription());
        config.setUpdatedBy(dto.getUpdatedBy());

        ConfigSetting saved = configSettingRepository.save(config);
        // ✅ 立即刷新到数据库，确保数据持久化
        configSettingRepository.flush();
        return convertToDto(saved);
    }

    /**
     * Delete a config
     */
    @Transactional
    public void deleteConfig(String configKey) {
        ConfigSetting config = configSettingRepository.findByConfigKey(configKey)
                .orElseThrow(() -> new IllegalArgumentException("Config not found: " + configKey));
        configSettingRepository.delete(config);
    }

    private ConfigSettingDto convertToDto(ConfigSetting config) {
        return new ConfigSettingDto(
                config.getId(),
                config.getConfigKey(),
                config.getConfigValue(),
                config.getConfigType(),
                config.getDescription(),
                config.getCreatedAt(),
                config.getUpdatedAt(),
                config.getUpdatedBy()
        );
    }
}
