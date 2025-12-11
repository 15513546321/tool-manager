package com.toolmanager.controller;

import javax.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*"}, allowCredentials = "true")
public class ClientIpController {

    /**
     * Get client's real IP from request headers
     * GET /api/client-ip
     */
    @GetMapping("/client-ip")
    public ResponseEntity<Map<String, String>> getClientIp(HttpServletRequest request) {
        String clientIp = getClientIpFromRequest(request);
        Map<String, String> response = new HashMap<>();
        response.put("ip", clientIp);
        return ResponseEntity.ok(response);
    }

    /**
     * Helper to extract real client IPv4, handling proxy scenarios
     * Filters out IPv6 addresses and loopback addresses
     */
    private String getClientIpFromRequest(HttpServletRequest request) {
        // Check X-Forwarded-For first (for proxy/load balancer/reverse proxy)
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

        // Check X-Real-IP (used by some proxies)
        String xri = request.getHeader("X-Real-IP");
        if (xri != null && !xri.isEmpty() && isValidIPv4(xri.trim())) {
            return xri.trim();
        }

        // Fallback to request.getRemoteAddr()
        String remoteAddr = request.getRemoteAddr();
        if (isValidIPv4(remoteAddr)) {
            return remoteAddr;
        }

        // If all else fails, return a placeholder (should not happen in normal scenarios)
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
}
