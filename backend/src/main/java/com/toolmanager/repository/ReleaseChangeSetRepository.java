package com.toolmanager.repository;

import com.toolmanager.entity.ReleaseChangeSet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReleaseChangeSetRepository extends JpaRepository<ReleaseChangeSet, Long> {
    List<ReleaseChangeSet> findByVersionIdOrderByUpdatedAtDesc(Long versionId);

    Long countByVersionId(Long versionId);

    void deleteByVersionId(Long versionId);
}
