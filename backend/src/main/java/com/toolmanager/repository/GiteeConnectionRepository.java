package com.toolmanager.repository;

import com.toolmanager.entity.GiteeConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GiteeConnectionRepository extends JpaRepository<GiteeConnection, Long> {
    /**
     * 根据名称和认证方式查找连接
     */
    Optional<GiteeConnection> findByNameAndAuthType(String name, String authType);

    /**
     * 根据仓库 URL 和认证方式查找连接
     */
    Optional<GiteeConnection> findByRepoUrlAndAuthType(String repoUrl, String authType);

    /**
     * 查找所有连接
     */
    List<GiteeConnection> findAll();

    /**
     * 根据认证方式查找所有连接
     */
    List<GiteeConnection> findByAuthType(String authType);

    /**
     * 查找默认连接
     */
    Optional<GiteeConnection> findByIsDefaultTrue();
}
