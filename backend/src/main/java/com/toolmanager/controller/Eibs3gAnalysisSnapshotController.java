package com.toolmanager.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.toolmanager.dto.Eibs3gAnalysisSnapshotDto;
import com.toolmanager.service.Eibs3gAnalysisSnapshotService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/eibs3g-api-analysis")
@RequiredArgsConstructor
@CrossOrigin(
        origins = {"http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*", "http://10.*:*", "http://172.*:*"},
        allowCredentials = "true"
)
public class Eibs3gAnalysisSnapshotController {
    private final Eibs3gAnalysisSnapshotService service;

    @GetMapping("/latest")
    public ResponseEntity<Eibs3gAnalysisSnapshotDto> getLatest() {
        return service.getLatest()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping("/latest")
    public ResponseEntity<Eibs3gAnalysisSnapshotDto> saveLatest(
            @RequestBody JsonNode snapshot,
            @RequestAttribute(value = "username", required = false) String username) {
        return ResponseEntity.ok(service.saveLatest(snapshot, username));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleInvalidSnapshot(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Collections.singletonMap("message", ex.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleBrokenSnapshot(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("message", ex.getMessage()));
    }
}
