package com.toolmanager.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MockPacketTransactionTypesResponseDto {
    private boolean success;
    private boolean usingFallback;
    private String message;
    private MockPacketConfigDto resolvedConfig;
    private List<MockPacketTransactionTypeDto> transactionTypes;
}
