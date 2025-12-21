package com.toolmanager.service;

import com.toolmanager.dto.DocumentDto;
import com.toolmanager.dto.DocumentVersionDto;
import com.toolmanager.entity.Document;
import com.toolmanager.entity.DocumentVersion;
import com.toolmanager.repository.DocumentRepository;
import com.toolmanager.repository.DocumentVersionRepository;
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
    private final DocumentVersionRepository documentVersionRepository;

    /**
     * Get all documents
     */
    public List<DocumentDto> getAll() {
        return documentRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Get documents by category
     */
    public List<DocumentDto> getByCategory(String category) {
        return documentRepository.findByCategoryOrderByUpdatedAtDesc(category).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Get documents by category and sub-category
     */
    public List<DocumentDto> getBySubCategory(String category, String subCategory) {
        return documentRepository.findByCategoryAndSubCategory(category, subCategory).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Search documents by title
     */
    public List<DocumentDto> searchByTitle(String title) {
        return documentRepository.findByTitleContainingIgnoreCase(title).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Get document by ID with versions
     */
    public DocumentDto getById(Long id) {
        return documentRepository.findById(id)
                .map(this::toDto)
                .orElse(null);
    }

    /**
     * Create or update a document
     */
    @Transactional
    public DocumentDto save(DocumentDto dto) {
        Document entity = new Document();
        if (dto.getId() != null) {
            entity = documentRepository.findById(dto.getId())
                    .orElseThrow(() -> new RuntimeException("Document not found"));
        }

        entity.setTitle(dto.getTitle());
        entity.setCategory(dto.getCategory());
        entity.setSubCategory(dto.getSubCategory());
        entity.setDescription(dto.getDescription());
        entity.setUpdatedBy(dto.getUpdatedBy() != null ? dto.getUpdatedBy() : "admin");
        if (entity.getId() == null) {
            entity.setCreatedAt(LocalDateTime.now());
        }
        entity.setUpdatedAt(LocalDateTime.now());

        Document saved = documentRepository.save(entity);
        documentRepository.flush();
        return toDto(saved);
    }

    /**
     * Delete a document and all its versions
     */
    @Transactional
    public void delete(Long id) {
        // Delete all versions
        documentVersionRepository.findByDocumentIdOrderByCreatedAtDesc(id)
                .forEach(v -> documentVersionRepository.delete(v));
        // Delete document
        documentRepository.deleteById(id);
        documentRepository.flush();
        documentVersionRepository.flush();
    }

    private DocumentDto toDto(Document entity) {
        DocumentDto dto = new DocumentDto();
        dto.setId(entity.getId());
        dto.setTitle(entity.getTitle());
        dto.setCategory(entity.getCategory());
        dto.setSubCategory(entity.getSubCategory());
        dto.setDescription(entity.getDescription());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        dto.setUpdatedBy(entity.getUpdatedBy());

        // Load versions
        if (entity.getId() != null) {
            List<DocumentVersionDto> versions = documentVersionRepository
                    .findByDocumentIdOrderByCreatedAtDesc(entity.getId())
                    .stream()
                    .map(this::versionToDto)
                    .collect(Collectors.toList());
            dto.setVersions(versions);
        }

        return dto;
    }

    private DocumentVersionDto versionToDto(DocumentVersion entity) {
        return new DocumentVersionDto(
                entity.getId(),
                entity.getDocumentId(),
                entity.getVersionNumber(),
                entity.getFileName(),
                entity.getFileContent(),
                entity.getFileSize(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getUpdatedBy()
        );
    }
}

