
package com.toolmanager.service;

import com.toolmanager.dto.UserDTO;
import com.toolmanager.entity.Role;
import com.toolmanager.entity.User;
import com.toolmanager.repository.RoleRepository;
import com.toolmanager.repository.UserRepository;
import com.toolmanager.util.PasswordUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 用户服务
 * 作者：张擎
 * 时间：2026-05-06
 */
@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PasswordUtil passwordUtil;

    /**
     * 创建用户
     */
    @Transactional
    public User createUser(UserDTO dto, String operator) {
        if (userRepository.existsByUsername(dto.getUsername())) {
            throw new RuntimeException("用户名已存在");
        }

        User user = new User();
        user.setUsername(dto.getUsername());
        user.setPassword(passwordUtil.encryptPassword(dto.getPassword()));
        user.setSalt(passwordUtil.generateSalt());
        user.setRealName(dto.getRealName());
        user.setEmail(dto.getEmail());
        user.setPhone(dto.getPhone());
        user.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        user.setCreatedBy(operator);
        user.setUpdatedBy(operator);

        // 绑定角色
        if (dto.getRoleIds() != null && !dto.getRoleIds().isEmpty()) {
            Set<Role> roles = new HashSet<>(roleRepository.findAllById(dto.getRoleIds()));
            user.setRoles(roles);
        }

        return userRepository.save(user);
    }

    /**
     * 更新用户
     */
    @Transactional
    public User updateUser(Long id, UserDTO dto, String operator) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        // 检查用户名是否被其他用户使用
        userRepository.findByUsername(dto.getUsername())
                .ifPresent(u -> {
                    if (!u.getId().equals(id)) {
                        throw new RuntimeException("用户名已被使用");
                    }
                });

        user.setUsername(dto.getUsername());
        user.setRealName(dto.getRealName());
        user.setEmail(dto.getEmail());
        user.setPhone(dto.getPhone());
        if (dto.getStatus() != null) {
            user.setStatus(dto.getStatus());
        }
        // 更新密码（如果提供了新密码）
        if (dto.getPassword() != null && !dto.getPassword().isEmpty()) {
            user.setPassword(passwordUtil.encryptPassword(dto.getPassword()));
        }
        user.setUpdatedBy(operator);

        // 更新角色
        if (dto.getRoleIds() != null) {
            Set<Role> roles = new HashSet<>(roleRepository.findAllById(dto.getRoleIds()));
            user.setRoles(roles);
        }

        return userRepository.save(user);
    }

    /**
     * 删除用户
     */
    @Transactional
    public void deleteUser(Long id) {
        if (!userRepository.existsById(id)) {
            throw new RuntimeException("用户不存在");
        }
        userRepository.deleteById(id);
    }

    /**
     * 更新用户状态
     */
    @Transactional
    public User updateUserStatus(Long id, Integer status, String operator) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
        user.setStatus(status);
        user.setUpdatedBy(operator);
        return userRepository.save(user);
    }

    /**
     * 根据ID获取用户
     */
    @Transactional(readOnly = true)
    public User getUserById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
    }

    /**
     * 分页查询用户
     */
    @Transactional(readOnly = true)
    public Page<User> listUsers(String username, String realName, Pageable pageable) {
        return userRepository.findAll(pageable);
    }

    /**
     * 修改密码（用户自己修改）
     */
    @Transactional
    public void changePassword(Long userId, String oldPassword, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        if (!passwordUtil.matches(oldPassword, user.getPassword())) {
            throw new RuntimeException("旧密码不正确");
        }

        // 验证新密码复杂度
        if (!passwordUtil.validatePasswordStrength(newPassword)) {
            throw new RuntimeException("密码必须至少8位，包含大小写字母和数字");
        }

        user.setPassword(passwordUtil.encryptPassword(newPassword));
        user.setSalt(passwordUtil.generateSalt());
        userRepository.save(user);
    }

    /**
     * 重置密码（管理员操作）
     */
    @Transactional
    public String resetPassword(Long userId, String operator) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        String newPassword = passwordUtil.generateRandomPassword(12);
        user.setPassword(passwordUtil.encryptPassword(newPassword));
        user.setSalt(passwordUtil.generateSalt());
        user.setUpdatedBy(operator);
        userRepository.save(user);

        return newPassword;
    }

    /**
     * 转换为DTO
     */
    public UserDTO toDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setRealName(user.getRealName());
        dto.setEmail(user.getEmail());
        dto.setPhone(user.getPhone());
        dto.setStatus(user.getStatus());
        dto.setRoleIds(user.getRoles().stream()
                .map(Role::getId)
                .collect(Collectors.toList()));
        dto.setCreatedAt(user.getCreatedAt());
        dto.setUpdatedAt(user.getUpdatedAt());
        dto.setCreatedBy(user.getCreatedBy());
        dto.setUpdatedBy(user.getUpdatedBy());
        return dto;
    }
}
