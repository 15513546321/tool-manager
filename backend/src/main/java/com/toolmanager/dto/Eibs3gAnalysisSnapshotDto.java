package com.toolmanager.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Eibs3gAnalysisSnapshotDto {
    private Long id;
    private String savedBy;
    private LocalDateTime savedAt;
    private JsonNode snapshot;
}
