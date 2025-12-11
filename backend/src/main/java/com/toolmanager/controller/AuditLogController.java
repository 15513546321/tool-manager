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
     * Get client's real IPv4 from request headers (handles proxy cases)
     * Filters out IPv6 and loopback addresses
     */
    private String getClientIp(javax.servlet.http.HttpServletRequest request) {
        // Check X-Forwarded-For first (for proxy/load balancer)
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) {
            String[] ips = xff.split(",");
            for (String ip : ips) {
                String trimmedIp = ip.trim();
                if (isValidIPv4(trimmedIp)) {
                    return trimmedIp;
                }
            }
        }

        // Check X-Real-IP
        String xri = request.getHeader("X-Real-IP");
        if (xri != null && !xri.isEmpty() && isValidIPv4(xri.trim())) {
            return xri.trim();
        }

        // Fallback to request.getRemoteAddr()
        String remoteAddr = request.getRemoteAddr();
        if (isValidIPv4(remoteAddr)) {
            return remoteAddr;
        }

        // Fallback to placeholder
        return "127.0.0.1";
    }

    /**
     * Validate if the given string is a valid IPv4 address (not IPv6 or loopback like ::1)
     */
    private boolean isValidIPv4(String ip) {
        if (ip == null || ip.isEmpty()) return false;
        // Reject IPv6 addresses
        if (ip.contains(":")) return false;
        // Reject IPv4 loopback
        if (ip.startsWith("127.")) return false;
        // Basic IPv4 format check: should have 4 octets
        String[] parts = ip.split("\\.");
        if (parts.length != 4) return false;
        for (String part : parts) {
            try {
                int num = Integer.parseInt(part);
                if (num < 0 || num > 255) return false;
            } catch (NumberFormatException e) {
                return false;
            }
        }
        return true;
    }

    /**
     * Record an audit action
     * POST /api/audit/log
     * Body: { "action": "...", "details": "..." }
     */
    @PostMapping("/log")
        public ResponseEntity<AuditLogDto> recordLog(
            @RequestBody Map<String, String> payload,
            javax.servlet.http.HttpServletRequest request) {
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
