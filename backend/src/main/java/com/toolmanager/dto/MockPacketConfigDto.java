package com.toolmanager.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MockPacketConfigDto {
    private String host;
    private String port;
    private String serviceName;
    private String username;
    private String password;
}
