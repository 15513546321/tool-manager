package com.toolmanager.repository;

import com.toolmanager.entity.Eibs3gAnalysisSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface Eibs3gAnalysisSnapshotRepository
        extends JpaRepository<Eibs3gAnalysisSnapshot, Long> {
    Optional<Eibs3gAnalysisSnapshot> findByScopeKey(String scopeKey);
}
