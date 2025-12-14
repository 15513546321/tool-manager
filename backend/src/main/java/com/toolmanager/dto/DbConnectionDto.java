package com.toolmanager.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DbConnectionDto {
    private Long id;
    private String name;
    private String type;
    private String host;
    private Integer port;
    private String database;
    private String username;
    private String password;
    private String connectionString;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String updatedBy;
}
