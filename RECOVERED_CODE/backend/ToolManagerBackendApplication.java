// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   ToolManagerBackendApplication.java

package com.toolmanager;

import org.springframework.boot.SpringApplication;
import org.springframework.web.servlet.config.annotation.*;

public class ToolManagerBackendApplication
{

    public ToolManagerBackendApplication()
    {
    }

    public static void main(String args[])
    {
        SpringApplication.run(com/toolmanager/ToolManagerBackendApplication, args);
    }

    public WebMvcConfigurer corsConfigurer()
    {
        return new WebMvcConfigurer() {

            public void addCorsMappings(CorsRegistry registry)
            {
                registry.addMapping("/**").allowedOriginPatterns(new String[] {
                    "http://localhost:*", "http://127.0.0.1:*"
                }).allowedMethods(new String[] {
                    "GET", "POST", "PUT", "DELETE", "OPTIONS"
                }).allowedHeaders(new String[] {
                    "*"
                }).allowCredentials(true).maxAge(3600L);
            }

            final ToolManagerBackendApplication this$0;

            
            {
                this.this$0 = ToolManagerBackendApplication.this;
                super();
            }
        }
;
    }
}
