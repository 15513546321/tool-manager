package com.toolmanager.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Component
@Slf4j
public class IpWhitelistConfigInterceptor implements HandlerInterceptor {

    private static final String WHITELIST_CONFIG_FILE = "config/whiteList.txt";
    private static final ConcurrentMap<String, Boolean> ipCache = new ConcurrentHashMap<>();
    private static volatile List<String> whitelist = new ArrayList<>();
    private static volatile long lastModifiedTime = 0;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 检查是否启用IP白名单功能
        if (!isIpWhitelistEnabled()) {
            return true; // 功能未启用，直接放行
        }

        // 获取客户端IP
        String clientIp = getClientIpAddress(request);
        
        // 检查是否在白名单中
        if (isIpInWhitelist(clientIp)) {
            return true; // IP在白名单中，放行
        }

        // 检查请求路径是否在排除列表中（排除静态资源和错误页面）
        String requestPath = request.getRequestURI();
        if (isPathExcluded(requestPath)) {
            return true; // 路径在排除列表中，放行
        }

        // IP不在白名单中，拒绝访问
        log.warn("IP白名单拦截: 客户端IP {} 不在白名单中，拒绝访问路径: {}", clientIp, requestPath);
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("text/html;charset=UTF-8");
        response.getWriter().write("<!DOCTYPE html><html><head><title>访问被拒绝</title><meta charset=\"UTF-8\"></head><body><h1 style=\"color: #d32f2f; text-align: center; margin-top: 100px;\">您无权限访问！</h1><p style=\"text-align: center; color: #666;\">您的IP地址（" + clientIp + "）不在白名单中</p></body></html>");
        return false;
    }

    private boolean isIpWhitelistEnabled() {
        try {
            // 检查配置文件是否存在
            Path configPath = Paths.get(WHITELIST_CONFIG_FILE);
            if (!Files.exists(configPath)) {
                log.info("IP白名单配置文件不存在: {}", WHITELIST_CONFIG_FILE);
                return false;
            }
            
            // 检查文件是否为空
            List<String> lines = Files.readAllLines(configPath);
            boolean hasValidIp = lines.stream()
                    .filter(line -> !line.trim().isEmpty() && !line.trim().startsWith("#"))
                    .findAny()
                    .isPresent();
            
            return hasValidIp;
        } catch (Exception e) {
            log.warn("检查IP白名单启用状态失败: {}", e.getMessage());
            return false;
        }
    }

    private boolean isIpInWhitelist(String clientIp) {
        try {
            // 检查缓存
            if (ipCache.containsKey(clientIp)) {
                return ipCache.get(clientIp);
            }

            // 重新加载配置文件
            reloadWhitelist();

            // 检查精确匹配或CIDR匹配
            boolean allowed = whitelist.stream().anyMatch(allowedIp -> {
                if (allowedIp.contains("/")) {
                    // CIDR格式匹配
                    return isIpInCidrRange(clientIp, allowedIp);
                } else {
                    // 精确匹配
                    return clientIp.equals(allowedIp);
                }
            });

            // 更新缓存
            ipCache.put(clientIp, allowed);
            
            return allowed;
        } catch (Exception e) {
            log.warn("检查IP白名单失败: {}", e.getMessage());
            return false;
        }
    }

    private boolean isPathExcluded(String requestPath) {
        // 排除静态资源路径
        return requestPath.startsWith("/assets/") || 
               requestPath.startsWith("/static/") ||
               requestPath.startsWith("/css/") ||
               requestPath.startsWith("/js/") ||
               requestPath.startsWith("/images/") ||
               requestPath.equals("/error");
    }

    private synchronized void reloadWhitelist() {
        try {
            Path configPath = Paths.get(WHITELIST_CONFIG_FILE);
            if (!Files.exists(configPath)) {
                log.warn("IP白名单配置文件不存在: {}", WHITELIST_CONFIG_FILE);
                whitelist = new ArrayList<>();
                ipCache.clear();
                return;
            }

            // 检查文件是否被修改
            long currentModifiedTime = Files.getLastModifiedTime(configPath).toMillis();
            if (currentModifiedTime <= lastModifiedTime) {
                return; // 文件未修改，不需要重新加载
            }

            // 重新加载配置文件
            List<String> lines = Files.readAllLines(configPath);
            List<String> newWhitelist = new ArrayList<>();

            for (String line : lines) {
                String trimmedLine = line.trim();
                if (!trimmedLine.isEmpty() && !trimmedLine.startsWith("#")) {
                    newWhitelist.add(trimmedLine);
                }
            }

            whitelist = newWhitelist;
            lastModifiedTime = currentModifiedTime;
            ipCache.clear(); // 清空缓存

            log.info("IP白名单配置已重新加载，共 {} 个规则", whitelist.size());
            if (!whitelist.isEmpty()) {
                log.info("白名单规则: {}", String.join(", ", whitelist));
            }

        } catch (IOException e) {
            log.error("重新加载IP白名单配置失败: {}", e.getMessage());
        }
    }

    private String getClientIpAddress(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        
        // 处理多个IP的情况（X-Forwarded-For可能包含多个IP）
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        
        return ip;
    }

    private boolean isIpInCidrRange(String ip, String cidr) {
        try {
            String[] parts = cidr.split("/");
            String network = parts[0];
            int prefixLength = Integer.parseInt(parts[1]);
            
            long ipLong = ipToLong(ip);
            long networkLong = ipToLong(network);
            long mask = (0xFFFFFFFFL) << (32 - prefixLength);
            
            return (ipLong & mask) == (networkLong & mask);
        } catch (Exception e) {
            log.warn("CIDR匹配失败: {} - {}", ip, cidr);
            return false;
        }
    }

    private long ipToLong(String ip) {
        String[] octets = ip.split("\\.");
        long result = 0;
        for (int i = 0; i < 4; i++) {
            result |= Long.parseLong(octets[i]) << (24 - (8 * i));
        }
        return result;
    }
}