// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   IpMappingController.java

package com.toolmanager.controller;

import com.toolmanager.service.IpMappingService;
import java.util.Map;
import org.springframework.http.ResponseEntity;

public class IpMappingController
{

    public ResponseEntity getAllMappings()
    {
        java.util.List mappings = ipMappingService.getAllMappings();
        return ResponseEntity.ok(mappings);
    }

    public ResponseEntity createMapping(Map payload)
    {
        String ip = (String)payload.get("ip");
        String name = (String)payload.get("name");
        if(ip == null || ip.isEmpty() || name == null || name.isEmpty())
        {
            return ResponseEntity.badRequest().build();
        } else
        {
            com.toolmanager.dto.IpMappingDto mapping = ipMappingService.createMapping(ip, name);
            return ResponseEntity.ok(mapping);
        }
    }

    public ResponseEntity updateMapping(String ip, Map payload)
    {
        String newName = (String)payload.get("name");
        if(newName == null || newName.isEmpty())
        {
            return ResponseEntity.badRequest().build();
        } else
        {
            com.toolmanager.dto.IpMappingDto mapping = ipMappingService.updateMapping(ip, newName);
            return ResponseEntity.ok(mapping);
        }
    }

    public ResponseEntity deleteMapping(String ip)
    {
        ipMappingService.deleteMapping(ip);
        return ResponseEntity.noContent().build();
    }

    public ResponseEntity lookupIp(String ip)
    {
        String name = ipMappingService.getNameByIp(ip);
        return ResponseEntity.ok(Map.of("ip", ip, "name", name));
    }

    public IpMappingController(IpMappingService ipMappingService)
    {
        this.ipMappingService = ipMappingService;
    }

    private final IpMappingService ipMappingService;
}
