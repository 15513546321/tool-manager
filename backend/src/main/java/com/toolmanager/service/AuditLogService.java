package com.toolmanager.service;

import com.toolmanager.dto.AuditLogDto;
import com.toolmanager.entity.AuditLog;
import com.toolmanager.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuditLogService {
    private final AuditLogRepository auditLogRepository;
    private final IpMappingService ipMappingService;

    /**
     * Record an audit log entry with the client's real IP and mapped username
     */
    @Transactional
    public AuditLogDto recordAction(String clientIp, String action, String details) {
        // Get the mapped name by IP
        String username = ipMappingService.getNameByIp(clientIp);

        AuditLog log = new AuditLog();
        log.setTimestamp(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        log.setIp(clientIp);
        log.setUsername(username);
        log.setAction(action);
        log.setDetails(details);

        AuditLog saved = auditLogRepository.save(log);
        auditLogRepository.flush();
        return convertToDto(saved);
    }

    /**
     * Get the latest audit logs (limit 2000)
     */
    public List<AuditLogDto> getLatestLogs(int limit) {
        if (limit <= 0) limit = 2000;
        List<AuditLog> logs = auditLogRepository.findLatestLogs(Math.min(limit, 2000));
        return logs.stream().map(this::convertToDto).collect(Collectors.toList());
    }

    /**
     * Get all audit logs
     */
    public List<AuditLogDto> getAllLogs() {
        return auditLogRepository.findAll()
                .stream()
                .map(this::convertToDto)
                .sorted((a, b) -> Long.compare(b.getId(), a.getId())) // Descending by ID
                .collect(Collectors.toList());
    }

    private AuditLogDto convertToDto(AuditLog log) {
        return new AuditLogDto(
                log.getId(),
                log.getTimestamp(),
                log.getIp(),
                log.getUsername(),
                log.getAction(),
                log.getDetails()
        );
    }
}
