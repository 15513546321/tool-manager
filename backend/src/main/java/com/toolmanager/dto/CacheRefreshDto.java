package com.toolmanager.dto;


import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CacheRefreshDto {

    private String env;
    private String appName;
    private String cacheName;


}
