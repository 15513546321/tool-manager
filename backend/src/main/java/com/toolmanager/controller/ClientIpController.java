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
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"}, 
             allowCredentials = "true")
public class ClientIpController {

    /**
     * Get client's real IPv4 address from request
     * GET /api/client-ip
     * 
     * 场景说明：
     * 1. 如果通过代理/负载均衡器访问：返回 X-Forwarded-For 或 X-Real-IP 中的有效 IPv4
     * 2. 如果直连访问（本地局域网）：返回 remoteAddr（实际的 IPv4 或 127.0.0.1）
     * 3. 重要：访问时必须使用局域网 IP（如 http://192.168.1.x:8080），而非 http://localhost:8080
     */
    @GetMapping("/client-ip")
    public ResponseEntity<Map<String, String>> getClientIp(HttpServletRequest request) {
        String clientIp = getClientIpFromRequest(request);
        Map<String, String> response = new HashMap<>();
        response.put("ip", clientIp);
        return ResponseEntity.ok(response);
    }

    /**
     * Diagnostic endpoint to help debug IP detection
     * GET /api/client-ip/debug
     * Returns all available IP source information
     */
    @GetMapping("/client-ip/debug")
    public ResponseEntity<Map<String, Object>> debugClientIp(HttpServletRequest request) {
        Map<String, Object> debug = new HashMap<>();
        debug.put("remoteAddr", request.getRemoteAddr());
        debug.put("remoteHost", request.getRemoteHost());
        debug.put("X-Forwarded-For", request.getHeader("X-Forwarded-For"));
        debug.put("X-Real-IP", request.getHeader("X-Real-IP"));
        debug.put("X-Client-IP", request.getHeader("X-Client-IP"));
        debug.put("CF-Connecting-IP", request.getHeader("CF-Connecting-IP"));
        debug.put("detected-ip", getClientIpFromRequest(request));
        debug.put("note", "如果 detected-ip 是 127.0.0.1，请确保通过局域网 IP 访问（如 192.168.1.x）而非 localhost");
        return ResponseEntity.ok(debug);
    }

    /**
     * Helper to extract real client IPv4, handling proxy scenarios
     * Priority: X-Forwarded-For > X-Real-IP > X-Client-IP > remoteAddr
     */
    private String getClientIpFromRequest(HttpServletRequest request) {
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
        // 返回实际的 remoteAddr，即使是 127.0.0.1（这反映了真实情况）
        String remoteAddr = request.getRemoteAddr();
        if (remoteAddr != null && !remoteAddr.isEmpty()) {
            return remoteAddr;
        }

        // 最后的备用
        return "0.0.0.0";
    }

    /**
     * Validate if the given string is a valid IPv4 address format
     * Note: 允许 127.x.x.x（回环），因为这反映了实际的直连地址
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
}
