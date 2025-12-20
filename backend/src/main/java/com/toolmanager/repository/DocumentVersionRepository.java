package com.toolmanager.repository;

import com.toolmanager.entity.DocumentVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, Long> {
    List<DocumentVersion> findByDocumentIdOrderByCreatedAtDesc(Long documentId);
    
    Optional<DocumentVersion> findByDocumentIdAndVersionNumber(Long documentId, String versionNumber);
    
    long countByDocumentId(Long documentId);
}
