package com.toolmanager.service;

import com.toolmanager.dto.DocumentVersionDto;
import com.toolmanager.entity.DocumentVersion;
import com.toolmanager.repository.DocumentVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DocumentVersionService {
    private final DocumentVersionRepository documentVersionRepository;

    /**
     * Get all versions of a document
     */
    public List<DocumentVersionDto> getVersions(Long documentId) {
        return documentVersionRepository.findByDocumentIdOrderByCreatedAtDesc(documentId)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Get a specific version
     */
    public DocumentVersionDto getVersion(Long documentId, String versionNumber) {
        return documentVersionRepository.findByDocumentIdAndVersionNumber(documentId, versionNumber)
                .map(this::toDto)
                .orElse(null);
    }

    /**
     * Create a new version
     */
    @Transactional
    public DocumentVersionDto saveVersion(Long documentId, DocumentVersionDto dto) {
        DocumentVersion entity = new DocumentVersion();
        entity.setDocumentId(documentId);
        entity.setVersionNumber(dto.getVersionNumber());
        entity.setFileName(dto.getFileName());
        entity.setFileContent(dto.getFileContent());
        entity.setFileSize(dto.getFileSize());
        entity.setUpdatedBy(dto.getUpdatedBy() != null ? dto.getUpdatedBy() : "admin");
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());

        DocumentVersion saved = documentVersionRepository.save(entity);
        return toDto(saved);
    }

    /**
     * Delete a version
     */
    @Transactional
    public void deleteVersion(Long versionId) {
        documentVersionRepository.deleteById(versionId);
    }

    /**
     * Get count of versions for a document
     */
    public long getVersionCount(Long documentId) {
        return documentVersionRepository.countByDocumentId(documentId);
    }

    private DocumentVersionDto toDto(DocumentVersion entity) {
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
