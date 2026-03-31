package com.toolmanager.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MockPacketGenerateResponseDto {
    private boolean success;
    private boolean usingFallback;
    private String message;
    private List<MockPacketPayloadDto> packets;
}
