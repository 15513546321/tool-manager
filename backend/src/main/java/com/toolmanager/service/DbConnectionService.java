package com.toolmanager.service;

import com.toolmanager.dto.DbConnectionDto;
import com.toolmanager.entity.DbConnection;
import com.toolmanager.repository.DbConnectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DbConnectionService {
    private final DbConnectionRepository dbConnectionRepository;

    public List<DbConnectionDto> getByType(String type) {
        return dbConnectionRepository.findByType(type).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<DbConnectionDto> getAll() {
        return dbConnectionRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public DbConnectionDto getById(Long id) {
        return dbConnectionRepository.findById(id)
                .map(this::toDto)
                .orElse(null);
    }

    @Transactional
    public DbConnectionDto save(DbConnectionDto dto) {
        DbConnection entity = toEntity(dto);
        if (entity.getId() == null) {
            entity.setCreatedAt(LocalDateTime.now());
        }
        entity.setUpdatedAt(LocalDateTime.now());
        DbConnection saved = dbConnectionRepository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public void delete(Long id) {
        try {
            // 删除记录
            dbConnectionRepository.deleteById(id);
            
            // 强制刷新，确保数据库操作立即执行
            dbConnectionRepository.flush();
            
            log.info("✓ 成功删除数据库连接: ID={}", id);
        } catch (Exception e) {
            log.error("❌ 删除连接失败: ID={}, Error={}", id, e.getMessage());
            throw new RuntimeException("Failed to delete connection: " + e.getMessage(), e);
        }
    }

    private DbConnectionDto toDto(DbConnection entity) {
        return new DbConnectionDto(
                entity.getId(),
                entity.getName(),
                entity.getType(),
                entity.getHost(),
                entity.getPort(),
                entity.getDatabase(),
                entity.getUsername(),
                entity.getPassword(),
                entity.getConnectionString(),
                entity.getNotes(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getUpdatedBy()
        );
    }

    private DbConnection toEntity(DbConnectionDto dto) {
        DbConnection entity = new DbConnection();
        entity.setId(dto.getId());
        entity.setName(dto.getName());
        entity.setType(dto.getType());
        entity.setHost(dto.getHost());
        entity.setPort(dto.getPort());
        entity.setDatabase(dto.getDatabase());
        entity.setUsername(dto.getUsername());
        entity.setPassword(dto.getPassword());
        entity.setConnectionString(dto.getConnectionString());
        entity.setNotes(dto.getNotes());
        entity.setCreatedAt(dto.getCreatedAt());
        entity.setUpdatedAt(dto.getUpdatedAt());
        entity.setUpdatedBy(dto.getUpdatedBy());
        return entity;
    }
}
