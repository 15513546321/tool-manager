package com.toolmanager.controller;

import com.toolmanager.dto.MockPacketConfigDto;
import com.toolmanager.dto.MockPacketGenerateResponseDto;
import com.toolmanager.dto.MockPacketQueryRequestDto;
import com.toolmanager.dto.MockPacketTransactionTypesResponseDto;
import com.toolmanager.service.MockPacketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/mock-packet")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
        allowCredentials = "true")
public class MockPacketController {

    private final MockPacketService mockPacketService;

    @GetMapping("/config")
    public ResponseEntity<MockPacketConfigDto> getConfig() {
        return ResponseEntity.ok(mockPacketService.loadConfig());
    }

    @PostMapping("/config")
    public ResponseEntity<MockPacketConfigDto> saveConfig(
            @RequestBody MockPacketConfigDto config,
            @RequestParam(value = "username", defaultValue = "system") String username) {
        return ResponseEntity.ok(mockPacketService.saveConfig(config, username));
    }

    @PostMapping("/test-connection")
    public ResponseEntity<Map<String, Object>> testConnection(@RequestBody(required = false) MockPacketQueryRequestDto request) {
        return ResponseEntity.ok(mockPacketService.testConnection(request));
    }

    @PostMapping("/transaction-types")
    public ResponseEntity<MockPacketTransactionTypesResponseDto> loadTransactionTypes(
            @RequestBody(required = false) MockPacketQueryRequestDto request) {
        return ResponseEntity.ok(mockPacketService.loadTransactionTypes(request));
    }

    @PostMapping("/generate")
    public ResponseEntity<MockPacketGenerateResponseDto> generatePackets(
            @RequestBody(required = false) MockPacketQueryRequestDto request) {
        return ResponseEntity.ok(mockPacketService.generatePackets(request));
    }
}
