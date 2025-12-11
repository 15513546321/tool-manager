package com.toolmanager.repository;

import com.toolmanager.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    @Query(value = "SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?1", nativeQuery = true)
    List<AuditLog> findLatestLogs(int limit);
}
