package com.toolmanager.repository;

import com.toolmanager.entity.ReleasePackageDiff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReleasePackageDiffRepository extends JpaRepository<ReleasePackageDiff, Long> {
    List<ReleasePackageDiff> findByVersionIdOrderByFilePathAsc(Long versionId);

    List<ReleasePackageDiff> findByVersionIdAndFilePathContainingIgnoreCaseOrderByFilePathAsc(Long versionId, String keyword);

    Long countByVersionId(Long versionId);

    Long countByVersionIdAndConfirmStatus(Long versionId, String confirmStatus);

    void deleteByVersionId(Long versionId);
}
