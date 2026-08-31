package com.toolmanager.controller;

import com.toolmanager.dto.ChangeStepCheckDtos.ScanResultDto;
import com.toolmanager.dto.ChangeStepCheckDtos.ScannerConfigDto;
import com.toolmanager.dto.ChangeStepCheckDtos.UpdateScannerConfigRequest;
import com.toolmanager.service.ChangeStepCheckConfigService;
import com.toolmanager.service.ChangeStepCheckService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/change-step-check")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
        allowCredentials = "true")
public class ChangeStepCheckController {
    private final ChangeStepCheckService checkService;
    private final ChangeStepCheckConfigService configService;

    @PostMapping(value = "/scan", consumes = "multipart/form-data")
    public ResponseEntity<ScanResultDto> scan(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(checkService.scan(file));
    }

    @GetMapping("/config")
    public ResponseEntity<ScannerConfigDto> getConfig() {
        return ResponseEntity.ok(configService.getPublicConfig());
    }

    @PutMapping("/config")
    public ResponseEntity<ScannerConfigDto> updateConfig(
            @RequestBody UpdateScannerConfigRequest request,
            @RequestAttribute(value = "username", required = false) String username) {
        return ResponseEntity.ok(configService.updateConfig(request, username));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Collections.singletonMap("message", ex.getMessage()));
    }
}
