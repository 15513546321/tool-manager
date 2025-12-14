package com.toolmanager.repository;

import com.toolmanager.entity.CodeTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CodeTemplateRepository extends JpaRepository<CodeTemplate, Long> {
    List<CodeTemplate> findByType(String type);
    Optional<CodeTemplate> findByName(String name);
}
