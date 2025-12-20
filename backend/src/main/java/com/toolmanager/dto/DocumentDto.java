package com.toolmanager.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentDto {
    private Long id;
    private String title;
    private String category;
    private String subCategory;
    private String description;
    private List<DocumentVersionDto> versions;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String updatedBy;
}

