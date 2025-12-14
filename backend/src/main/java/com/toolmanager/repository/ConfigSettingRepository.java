package com.toolmanager.repository;

import com.toolmanager.entity.ConfigSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConfigSettingRepository extends JpaRepository<ConfigSetting, Long> {
    Optional<ConfigSetting> findByConfigKey(String configKey);
    
    List<ConfigSetting> findByConfigType(String configType);
}
