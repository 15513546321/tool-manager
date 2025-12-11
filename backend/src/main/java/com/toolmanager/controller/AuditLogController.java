package com.toolmanager.controller;

import com.toolmanager.dto.AuditLogDto;
import com.toolmanager.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*"}, allowCredentials = "true")
public class AuditLogController {
    private final AuditLogService auditLogService;

    /**
     * Get client's real IP from request headers (handles proxy cases)
     */
    private String getClientIp(jakarta.servlet.http.HttpServletRequest request) {
        // Check X-Forwarded-For first (for proxy/load balancer)
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) {
            return xff.split(",")[0].trim();
        }

        // Check X-Real-IP
        String xri = request.getHeader("X-Real-IP");
        if (xri != null && !xri.isEmpty()) {
            return xri;
        }

        // Fallback to request.getRemoteAddr()
        return request.getRemoteAddr();
    }

    /**
     * Record an audit action
     * POST /api/audit/log
     * Body: { "action": "...", "details": "..." }
     */
    @PostMapping("/log")
    public ResponseEntity<AuditLogDto> recordLog(
            @RequestBody Map<String, String> payload,
            jakarta.servlet.http.HttpServletRequest request) {
        String clientIp = getClientIp(request);
        String action = payload.getOrDefault("action", "Unknown");
        String details = payload.getOrDefault("details", "");

        AuditLogDto log = auditLogService.recordAction(clientIp, action, details);
        return ResponseEntity.ok(log);
    }

    /**
     * Get all audit logs
     * GET /api/audit/logs
     */
    @GetMapping("/logs")
    public ResponseEntity<List<AuditLogDto>> getLogs() {
        List<AuditLogDto> logs = auditLogService.getAllLogs();
        return ResponseEntity.ok(logs);
    }

    /**
     * Get latest N audit logs
     * GET /api/audit/logs?limit=100
     */
    @GetMapping("/logs/latest")
    public ResponseEntity<List<AuditLogDto>> getLatestLogs(
            @RequestParam(defaultValue = "2000") int limit) {
        List<AuditLogDto> logs = auditLogService.getLatestLogs(limit);
        return ResponseEntity.ok(logs);
    }
}
