package com.toolmanager.service;

import com.toolmanager.dto.CodeTemplateDto;
import com.toolmanager.entity.CodeTemplate;
import com.toolmanager.repository.CodeTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CodeTemplateService {
    private final CodeTemplateRepository codeTemplateRepository;

    public List<CodeTemplateDto> getByType(String type) {
        return codeTemplateRepository.findByType(type).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<CodeTemplateDto> getAll() {
        return codeTemplateRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public CodeTemplateDto getById(Long id) {
        return codeTemplateRepository.findById(id)
                .map(this::toDto)
                .orElse(null);
    }

    public CodeTemplateDto getByName(String name) {
        return codeTemplateRepository.findByName(name)
                .map(this::toDto)
                .orElse(null);
    }

    @Transactional
    public CodeTemplateDto save(CodeTemplateDto dto) {
        CodeTemplate entity = toEntity(dto);
        if (entity.getId() == null) {
            entity.setCreatedAt(LocalDateTime.now());
        }
        entity.setUpdatedAt(LocalDateTime.now());
        CodeTemplate saved = codeTemplateRepository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public void delete(Long id) {
        codeTemplateRepository.deleteById(id);
    }

    private CodeTemplateDto toDto(CodeTemplate entity) {
        return new CodeTemplateDto(
                entity.getId(),
                entity.getName(),
                entity.getType(),
                entity.getContent(),
                entity.getDescription(),
                entity.getIsBuiltIn(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getUpdatedBy()
        );
    }

    private CodeTemplate toEntity(CodeTemplateDto dto) {
        CodeTemplate entity = new CodeTemplate();
        entity.setId(dto.getId());
        entity.setName(dto.getName());
        entity.setType(dto.getType());
        entity.setContent(dto.getContent());
        entity.setDescription(dto.getDescription());
        entity.setIsBuiltIn(dto.getIsBuiltIn());
        entity.setCreatedAt(dto.getCreatedAt());
        entity.setUpdatedAt(dto.getUpdatedAt());
        entity.setUpdatedBy(dto.getUpdatedBy());
        return entity;
    }
}
