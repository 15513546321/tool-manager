
package com.toolmanager.config;

import com.toolmanager.util.JwtUtil;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * JWT认证拦截器
 * 作者：张擎
 * 时间：2026-05-06
 */
@Component
public class JwtAuthenticationInterceptor implements HandlerInterceptor {

    @Autowired
    private JwtUtil jwtUtil;

    // 不需要认证的路径
    private static final String[] EXCLUDED_PATHS = {
            "/api/auth/login",
            "/api/auth/logout",
            "/api/auth/refresh-token",
            "/h2-console/**",
            "/public/**",
            "/static/**"
    };

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String requestURI = request.getRequestURI();

        // 检查是否为排除路径
        for (String excludedPath : EXCLUDED_PATHS) {
            if (requestURI.startsWith(excludedPath) || 
                (excludedPath.endsWith("/**") && requestURI.startsWith(excludedPath.substring(0, excludedPath.length() - 3)))) {
                return true;
            }
        }

        // 获取Token
        String token = extractToken(request);
        
        if (token == null || token.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\": \"未登录或Token失效\"}");
            return false;
        }

        try {
            // 验证Token
            if (jwtUtil.isTokenExpired(token)) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"message\": \"Token已过期\"}");
                return false;
            }

            // 将用户信息放入请求上下文
            Long userId = jwtUtil.getUserIdFromToken(token);
            String username = jwtUtil.getUsernameFromToken(token);
            request.setAttribute("userId", userId);
            request.setAttribute("username", username);

            return true;
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\": \"Token无效\"}");
            return false;
        }
    }

    /**
     * 从请求头中提取Token
     */
    private String extractToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
