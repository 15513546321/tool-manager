package com.toolmanager.service;

import com.toolmanager.dto.GiteeConnectionDto;
import com.toolmanager.entity.GiteeConnection;
import com.toolmanager.repository.GiteeConnectionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GiteeConnectionService {
    
    private final GiteeConnectionRepository repository;
    private final GitOperationService gitOperationService;

    /**
     * 保存或更新 Gitee 连接配置
     */
    public GiteeConnectionDto saveConnection(GiteeConnectionDto dto) {
        GiteeConnection entity = toEntity(dto);
        
        // 如果是新增，检查是否需要设置为默认
        if (entity.getId() == null && (entity.getIsDefault() == null || !entity.getIsDefault())) {
            // 检查是否有其他连接
            if (repository.findAll().isEmpty()) {
                entity.setIsDefault(true);
            }
        }
        
        entity = repository.save(entity);
        return toDto(entity);
    }

    /**
     * 测试连接并保存结果
     */
    public GiteeConnectionDto testAndSaveConnection(GiteeConnectionDto dto) {
        // 执行连接测试
        var testResult = gitOperationService.testConnection(
            dto.getRepoUrl(),
            dto.getAuthType(),
            dto.getAccessToken(),
            dto.getPrivateKey()
        );

        // 更新连接状态
        dto.setConnectionStatus((Boolean) testResult.getOrDefault("success", false) ? "connected" : "failed");
        dto.setLastTestTime(LocalDateTime.now());
        dto.setLastTestMessage((String) testResult.getOrDefault("message", ""));

        // 保存配置
        return saveConnection(dto);
    }

    /**
     * 查询所有连接
     */
    public List<GiteeConnectionDto> getAllConnections() {
        return repository.findAll().stream()
            .map(this::toDto)
            .collect(Collectors.toList());
    }

    /**
     * 根据认证方式查询连接
     */
    public List<GiteeConnectionDto> getConnectionsByAuthType(String authType) {
        return repository.findByAuthType(authType).stream()
            .map(this::toDto)
            .collect(Collectors.toList());
    }

    /**
     * 查询默认连接
     */
    public Optional<GiteeConnectionDto> getDefaultConnection() {
        return repository.findByIsDefaultTrue().map(this::toDto);
    }

    /**
     * 根据 ID 查询连接
     */
    public Optional<GiteeConnectionDto> getConnectionById(Long id) {
        return repository.findById(id).map(this::toDto);
    }

    /**
     * 根据名称和认证方式查询连接
     */
    public Optional<GiteeConnectionDto> getConnectionByNameAndAuthType(String name, String authType) {
        return repository.findByNameAndAuthType(name, authType).map(this::toDto);
    }

    /**
     * 删除连接
     */
    public void deleteConnection(Long id) {
        Optional<GiteeConnection> connection = repository.findById(id);
        if (connection.isPresent()) {
            // 如果删除的是默认连接，设置另一个为默认
            if (connection.get().getIsDefault() != null && connection.get().getIsDefault()) {
                repository.delete(connection.get());
                List<GiteeConnection> remaining = repository.findAll();
                if (!remaining.isEmpty()) {
                    remaining.get(0).setIsDefault(true);
                    repository.save(remaining.get(0));
                }
            } else {
                repository.delete(connection.get());
            }
        }
    }

    /**
     * 设置为默认连接
     */
    public GiteeConnectionDto setAsDefault(Long id) {
        // 取消其他默认连接
        repository.findByIsDefaultTrue().ifPresent(conn -> {
            conn.setIsDefault(false);
            repository.save(conn);
        });

        // 设置新的默认连接
        GiteeConnection connection = repository.findById(id)
            .orElseThrow(() -> new RuntimeException("Connection not found"));
        connection.setIsDefault(true);
        connection = repository.save(connection);
        return toDto(connection);
    }

    private GiteeConnectionDto toDto(GiteeConnection entity) {
        GiteeConnectionDto dto = new GiteeConnectionDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        dto.setRepoUrl(entity.getRepoUrl());
        dto.setAuthType(entity.getAuthType());
        dto.setAccessToken(entity.getAccessToken());
        dto.setPrivateKey(entity.getPrivateKey());
        dto.setPublicKey(entity.getPublicKey());
        dto.setIsDefault(entity.getIsDefault());
        dto.setConnectionStatus(entity.getConnectionStatus());
        dto.setLastTestTime(entity.getLastTestTime());
        dto.setLastTestMessage(entity.getLastTestMessage());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        dto.setUpdatedBy(entity.getUpdatedBy());
        dto.setNotes(entity.getNotes());
        return dto;
    }

    private GiteeConnection toEntity(GiteeConnectionDto dto) {
        GiteeConnection entity = new GiteeConnection();
        if (dto.getId() != null) {
            entity.setId(dto.getId());
        }
        entity.setName(dto.getName());
        entity.setRepoUrl(dto.getRepoUrl());
        entity.setAuthType(dto.getAuthType());
        entity.setAccessToken(dto.getAccessToken());
        entity.setPrivateKey(dto.getPrivateKey());
        entity.setPublicKey(dto.getPublicKey());
        entity.setIsDefault(dto.getIsDefault());
        entity.setConnectionStatus(dto.getConnectionStatus());
        entity.setLastTestTime(dto.getLastTestTime());
        entity.setLastTestMessage(dto.getLastTestMessage());
        entity.setCreatedAt(dto.getCreatedAt());
        entity.setUpdatedAt(dto.getUpdatedAt());
        entity.setUpdatedBy(dto.getUpdatedBy());
        entity.setNotes(dto.getNotes());
        return entity;
    }
}
