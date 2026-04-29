package com.toolmanager.repository;

import com.toolmanager.entity.ReleaseChangeFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReleaseChangeFileRepository extends JpaRepository<ReleaseChangeFile, Long> {
    List<ReleaseChangeFile> findByVersionId(Long versionId);

    List<ReleaseChangeFile> findByVersionIdAndFilePathContainingIgnoreCaseOrderByFilePathAsc(Long versionId, String keyword);

    List<ReleaseChangeFile> findByChangeSetId(Long changeSetId);

    Long countByVersionId(Long versionId);

    void deleteByChangeSetId(Long changeSetId);

    void deleteByVersionId(Long versionId);
}
