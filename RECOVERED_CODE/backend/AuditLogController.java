// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   AuditLogController.java

package com.toolmanager.controller;

import com.toolmanager.service.AuditLogService;
import java.util.Map;
import javax.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;

public class AuditLogController
{

    private String getClientIp(HttpServletRequest request)
    {
        String xff = request.getHeader("X-Forwarded-For");
        if(xff != null && !xff.isEmpty())
        {
            String ips[] = xff.split(",");
            String as[] = ips;
            int i = as.length;
            for(int j = 0; j < i; j++)
            {
                String ip = as[j];
                String trimmedIp = ip.trim();
                if(isValidIPv4(trimmedIp))
                    return trimmedIp;
            }

        }
        String xri = request.getHeader("X-Real-IP");
        if(xri != null && !xri.isEmpty())
        {
            String trimmedIp = xri.trim();
            if(isValidIPv4(trimmedIp))
                return trimmedIp;
        }
        String xci = request.getHeader("X-Client-IP");
        if(xci != null && !xci.isEmpty())
        {
            String trimmedIp = xci.trim();
            if(isValidIPv4(trimmedIp))
                return trimmedIp;
        }
        String cfip = request.getHeader("CF-Connecting-IP");
        if(cfip != null && !cfip.isEmpty())
        {
            String trimmedIp = cfip.trim();
            if(isValidIPv4(trimmedIp))
                return trimmedIp;
        }
        String remoteAddr = request.getRemoteAddr();
        if(remoteAddr != null && !remoteAddr.isEmpty())
            return remoteAddr;
        else
            return "0.0.0.0";
    }

    private boolean isValidIPv4(String ip)
    {
        if(ip == null || ip.isEmpty())
            return false;
        if(ip.contains(":"))
            return false;
        String parts[] = ip.split("\\.");
        if(parts.length != 4)
            return false;
        String as[] = parts;
        int i = as.length;
        for(int j = 0; j < i; j++)
        {
            String part = as[j];
            if(part.isEmpty())
                return false;
            try
            {
                int num = Integer.parseInt(part);
                if(num < 0 || num > 255)
                    return false;
            }
            catch(NumberFormatException e)
            {
                return false;
            }
        }

        return true;
    }

    public ResponseEntity recordLog(Map payload, HttpServletRequest request)
    {
        String clientIp = (String)payload.get("ip");
        if(clientIp == null || clientIp.trim().isEmpty() || !isValidIPv4(clientIp))
            clientIp = getClientIp(request);
        String action = (String)payload.getOrDefault("action", "Unknown");
        String details = (String)payload.getOrDefault("details", "");
        com.toolmanager.dto.AuditLogDto log = auditLogService.recordAction(clientIp, action, details);
        return ResponseEntity.ok(log);
    }

    public ResponseEntity getLogs()
    {
        java.util.List logs = auditLogService.getAllLogs();
        return ResponseEntity.ok(logs);
    }

    public ResponseEntity getLatestLogs(int limit)
    {
        java.util.List logs = auditLogService.getLatestLogs(limit);
        return ResponseEntity.ok(logs);
    }

    public AuditLogController(AuditLogService auditLogService)
    {
        this.auditLogService = auditLogService;
    }

    private final AuditLogService auditLogService;
}
