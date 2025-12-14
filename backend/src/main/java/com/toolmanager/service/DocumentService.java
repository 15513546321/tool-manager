package com.toolmanager.service;

import com.toolmanager.dto.DocumentDto;
import com.toolmanager.entity.Document;
import com.toolmanager.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DocumentService {
    private final DocumentRepository documentRepository;

    public List<DocumentDto> getByCategory(String category) {
        return documentRepository.findByCategory(category).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<DocumentDto> getByType(String type) {
        return documentRepository.findByType(type).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<DocumentDto> getAll() {
        return documentRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public DocumentDto getById(Long id) {
        return documentRepository.findById(id)
                .map(this::toDto)
                .orElse(null);
    }

    @Transactional
    public DocumentDto save(DocumentDto dto) {
        Document entity = toEntity(dto);
        if (entity.getId() == null) {
            entity.setCreatedAt(LocalDateTime.now());
        }
        entity.setUpdatedAt(LocalDateTime.now());
        Document saved = documentRepository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public void delete(Long id) {
        documentRepository.deleteById(id);
    }

    private DocumentDto toDto(Document entity) {
        return new DocumentDto(
                entity.getId(),
                entity.getTitle(),
                entity.getContent(),
                entity.getType(),
                entity.getCategory(),
                entity.getFileUrl(),
                entity.getLinkUrl(),
                entity.getDocOrder(),
                entity.getTags(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getUpdatedBy()
        );
    }

    private Document toEntity(DocumentDto dto) {
        Document entity = new Document();
        entity.setId(dto.getId());
        entity.setTitle(dto.getTitle());
        entity.setContent(dto.getContent());
        entity.setType(dto.getType());
        entity.setCategory(dto.getCategory());
        entity.setFileUrl(dto.getFileUrl());
        entity.setLinkUrl(dto.getLinkUrl());
        entity.setDocOrder(dto.getDocOrder());
        entity.setTags(dto.getTags());
        entity.setCreatedAt(dto.getCreatedAt());
        entity.setUpdatedAt(dto.getUpdatedAt());
        entity.setUpdatedBy(dto.getUpdatedBy());
        return entity;
    }
}
