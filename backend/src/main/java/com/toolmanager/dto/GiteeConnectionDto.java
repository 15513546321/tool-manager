package com.toolmanager.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GiteeConnectionDto {
    private Long id;
    private String name;
    private String repoUrl;
    private String authType; // 'ssh' or 'token'
    private String accessToken;
    private String privateKey;
    private String publicKey;
    private Boolean isDefault;
    private String connectionStatus; // 'connected', 'failed', 'unknown'
    private LocalDateTime lastTestTime;
    private String lastTestMessage;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String updatedBy;
    private String notes;
}
