// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   ClientIpController.java

package com.toolmanager.controller;

import java.util.HashMap;
import java.util.Map;
import javax.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;

public class ClientIpController
{

    public ClientIpController()
    {
    }

    public ResponseEntity getClientIp(HttpServletRequest request)
    {
        String remoteAddr = request.getRemoteAddr();
        String remoteHost = request.getRemoteHost();
        Map response = new HashMap();
        response.put("ip", remoteAddr);
        response.put("remoteAddr", remoteAddr);
        response.put("remoteHost", remoteHost);
        response.put("note", "For direct JAR deployment: remoteAddr is the actual client IP");
        return ResponseEntity.ok(response);
    }

    public ResponseEntity debugClientIp(HttpServletRequest request)
    {
        Map debug = new HashMap();
        debug.put("remoteAddr", request.getRemoteAddr());
        debug.put("remoteHost", request.getRemoteHost());
        debug.put("X-Forwarded-For", request.getHeader("X-Forwarded-For"));
        debug.put("X-Real-IP", request.getHeader("X-Real-IP"));
        debug.put("X-Client-IP", request.getHeader("X-Client-IP"));
        debug.put("CF-Connecting-IP", request.getHeader("CF-Connecting-IP"));
        debug.put("detected-ip", getClientIpFromRequest(request));
        debug.put("note", "\u5982\u679C detected-ip \u662F 127.0.0.1\uFF0C\u8BF7\u786E\u4FDD\u901A\u8FC7\u5C40\u57DF\u7F51 IP \u8BBF\u95EE\uFF08\u5982 192.168.1.x\uFF09\u800C\u975E localhost");
        return ResponseEntity.ok(debug);
    }

    private String getClientIpFromRequest(HttpServletRequest request)
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
}
