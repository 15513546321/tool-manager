package com.toolmanager.repository;

import com.toolmanager.entity.NacosConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NacosConfigRepository extends JpaRepository<NacosConfig, Long> {
    List<NacosConfig> findByStatus(String status);
    Optional<NacosConfig> findByName(String name);
    List<NacosConfig> findAll();
}
