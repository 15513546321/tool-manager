package com.toolmanager.controller;

import jakarta.servlet.http.HttpServletRequest;
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
     * Helper to extract real client IP, handling proxy scenarios
     */
    private String getClientIpFromRequest(HttpServletRequest request) {
        // Check X-Forwarded-For first (for proxy/load balancer/reverse proxy)
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) {
            return xff.split(",")[0].trim();
        }

        // Check X-Real-IP (used by some proxies)
        String xri = request.getHeader("X-Real-IP");
        if (xri != null && !xri.isEmpty()) {
            return xri;
        }

        // Fallback to request.getRemoteAddr()
        return request.getRemoteAddr();
    }
}
