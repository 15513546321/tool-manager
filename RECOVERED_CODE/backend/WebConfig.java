// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   WebConfig.java

package com.toolmanager.config;

import org.springframework.web.servlet.config.annotation.*;

public class WebConfig
    implements WebMvcConfigurer
{

    public WebConfig()
    {
    }

    public void addResourceHandlers(ResourceHandlerRegistry registry)
    {
        registry.addResourceHandler(new String[] {
            "/**"
        }).addResourceLocations(new String[] {
            "classpath:/static/"
        }).setCachePeriod(Integer.valueOf(3600));
    }
}
