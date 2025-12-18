package com.toolmanager.controller;

import com.toolmanager.dto.GiteeConnectionDto;
import com.toolmanager.service.GiteeConnectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/gitee-connections")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
             allowCredentials = "true")
public class GiteeConnectionController {
    
    private final GiteeConnectionService service;

    /**
     * 获取所有 Gitee 连接配置
     */
    @GetMapping
    public ResponseEntity<List<GiteeConnectionDto>> getAllConnections() {
        return ResponseEntity.ok(service.getAllConnections());
    }

    /**
     * 根据认证方式获取连接配置
     */
    @GetMapping("/by-auth-type/{authType}")
    public ResponseEntity<List<GiteeConnectionDto>> getConnectionsByAuthType(@PathVariable String authType) {
        return ResponseEntity.ok(service.getConnectionsByAuthType(authType));
    }

    /**
     * 获取默认连接配置
     */
    @GetMapping("/default")
    public ResponseEntity<?> getDefaultConnection() {
        return service.getDefaultConnection()
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * 根据 ID 获取连接配置
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getConnectionById(@PathVariable Long id) {
        return service.getConnectionById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * 保存或更新连接配置
     */
    @PostMapping
    public ResponseEntity<GiteeConnectionDto> saveConnection(@RequestBody GiteeConnectionDto dto) {
        return ResponseEntity.ok(service.saveConnection(dto));
    }

    /**
     * 测试并保存连接配置
     */
    @PostMapping("/test-and-save")
    public ResponseEntity<GiteeConnectionDto> testAndSaveConnection(@RequestBody GiteeConnectionDto dto) {
        return ResponseEntity.ok(service.testAndSaveConnection(dto));
    }

    /**
     * 删除连接配置
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteConnection(@PathVariable Long id) {
        try {
            service.deleteConnection(id);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Connection deleted successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * 设置为默认连接
     */
    @PutMapping("/{id}/set-default")
    public ResponseEntity<GiteeConnectionDto> setAsDefault(@PathVariable Long id) {
        return ResponseEntity.ok(service.setAsDefault(id));
    }
}
