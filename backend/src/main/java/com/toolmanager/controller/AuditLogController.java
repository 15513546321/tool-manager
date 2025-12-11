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
     * Priority: X-Forwarded-For > X-Real-IP > X-Client-IP > remoteAddr
     */
    private String getClientIp(javax.servlet.http.HttpServletRequest request) {
        // 1. Check X-Forwarded-For first (most common for proxies)
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

        // 2. Check X-Real-IP (used by Nginx reverse proxy)
        String xri = request.getHeader("X-Real-IP");
        if (xri != null && !xri.isEmpty()) {
            String trimmedIp = xri.trim();
            if (isValidIPv4(trimmedIp)) {
                return trimmedIp;
            }
        }

        // 3. Check X-Client-IP (used by some proxies)
        String xci = request.getHeader("X-Client-IP");
        if (xci != null && !xci.isEmpty()) {
            String trimmedIp = xci.trim();
            if (isValidIPv4(trimmedIp)) {
                return trimmedIp;
            }
        }

        // 4. Check CF-Connecting-IP (Cloudflare)
        String cfip = request.getHeader("CF-Connecting-IP");
        if (cfip != null && !cfip.isEmpty()) {
            String trimmedIp = cfip.trim();
            if (isValidIPv4(trimmedIp)) {
                return trimmedIp;
            }
        }

        // 5. Fallback to remoteAddr (direct connection)
        String remoteAddr = request.getRemoteAddr();
        if (remoteAddr != null && !remoteAddr.isEmpty()) {
            return remoteAddr;
        }

        return "0.0.0.0";
    }

    /**
     * Validate if the given string is a valid IPv4 address format
     */
    private boolean isValidIPv4(String ip) {
        if (ip == null || ip.isEmpty()) return false;
        
        // Reject IPv6 addresses (contain colon)
        if (ip.contains(":")) return false;
        
        // Check format: should have exactly 4 parts separated by dots
        String[] parts = ip.split("\\.");
        if (parts.length != 4) return false;
        
        // Validate each octet is 0-255
        for (String part : parts) {
            if (part.isEmpty()) return false;
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
