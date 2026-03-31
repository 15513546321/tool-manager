package com.toolmanager.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MockPacketPayloadDto {
    private String transCode;
    private String prdName;
    private String payloadRaw;
    private String payloadPretty;
    private boolean fallback;
    private String sourceLabel;
    private String note;
    private Integer matchedRows;
}
