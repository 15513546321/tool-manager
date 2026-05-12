
package com.toolmanager.service;

import com.toolmanager.dto.LoginRequest;
import com.toolmanager.dto.LoginResponse;
import com.toolmanager.entity.Menu;
import com.toolmanager.entity.Role;
import com.toolmanager.entity.User;
import com.toolmanager.repository.UserRepository;
import com.toolmanager.util.JwtUtil;
import com.toolmanager.util.PasswordUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 认证服务
 * 作者：张擎
 * 时间：2026-05-06
 */
@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordUtil passwordUtil;

    @Autowired
    private JwtUtil jwtUtil;

    /**
     * 用户登录
     */
    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new RuntimeException("用户名或密码错误"));

        if (user.getStatus() != 1) {
            throw new RuntimeException("用户已被禁用");
        }

        if (!passwordUtil.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("用户名或密码错误");
        }

        // 获取角色列表
        List<String> roles = user.getRoles().stream()
                .map(Role::getRoleCode)
                .collect(Collectors.toList());

        // 获取权限列表
        List<String> permissions = new ArrayList<>();
        for (Role role : user.getRoles()) {
            for (Menu menu : role.getMenus()) {
                if (menu.getPermission() != null && !menu.getPermission().isEmpty()) {
                    permissions.add(menu.getPermission());
                }
            }
        }

        // 生成令牌
        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getUsername());
        String refreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getUsername());

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(86400L)
                .userId(user.getId())
                .username(user.getUsername())
                .realName(user.getRealName())
                .roles(roles)
                .permissions(permissions)
                .build();
    }

    /**
     * 刷新令牌
     */
    public LoginResponse refreshToken(String refreshToken) {
        Long userId = jwtUtil.getUserIdFromToken(refreshToken);
        String username = jwtUtil.getUsernameFromToken(refreshToken);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        String newAccessToken = jwtUtil.generateAccessToken(user.getId(), user.getUsername());
        String newRefreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getUsername());

        // 获取角色列表
        List<String> roles = user.getRoles().stream()
                .map(Role::getRoleCode)
                .collect(Collectors.toList());

        // 获取权限列表
        List<String> permissions = new ArrayList<>();
        for (Role role : user.getRoles()) {
            for (Menu menu : role.getMenus()) {
                if (menu.getPermission() != null && !menu.getPermission().isEmpty()) {
                    permissions.add(menu.getPermission());
                }
            }
        }

        return LoginResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .expiresIn(86400L)
                .userId(user.getId())
                .username(user.getUsername())
                .realName(user.getRealName())
                .roles(roles)
                .permissions(permissions)
                .build();
    }

    /**
     * 获取当前用户信息
     */
    @Transactional(readOnly = true)
    public User getUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
    }
}
