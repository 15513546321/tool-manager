package com.toolmanager.repository;

import com.toolmanager.entity.ChangeStepScanRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ChangeStepScanRecordRepository extends JpaRepository<ChangeStepScanRecord, Long> {
    Page<ChangeStepScanRecord> findByFileNameContainingIgnoreCaseOrScannedByContainingIgnoreCase(
            String fileName, String scannedBy, Pageable pageable);
}
