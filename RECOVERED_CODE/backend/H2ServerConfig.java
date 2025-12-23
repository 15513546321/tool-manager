// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   H2ServerConfig.java

package com.toolmanager.config;

import java.sql.SQLException;
import org.h2.tools.Server;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class H2ServerConfig
{

    public H2ServerConfig()
    {
    }

    public Server h2TcpServer()
        throws SQLException
    {
        log.info("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
        log.info("\u2713 H2 TCP \u670D\u52A1\u5668\u5DF2\u542F\u52A8");
        log.info("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
        log.info("\u76D1\u542C\u5730\u5740: tcp://localhost:9092");
        log.info("\u5141\u8BB8\u8FDC\u7A0B\u8FDE\u63A5");
        log.info("");
        log.info("\u8FDC\u7A0B\u5DE5\u5177\u8FDE\u63A5\u793A\u4F8B\uFF08DBeaver/DataGrip\uFF09:");
        log.info("  JDBC URL: jdbc:h2:tcp://localhost:9092/file:./data/toolmanager;MODE=MySQL");
        log.info("  \u7528\u6237\u540D: sa");
        log.info("  \u5BC6\u7801: (\u7A7A)");
        log.info("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
        return Server.createTcpServer(new String[] {
            "-tcp", "-tcpAllowOthers", "-tcpPort", "9092"
        }).start();
    }

    private static final Logger log = LoggerFactory.getLogger(com/toolmanager/config/H2ServerConfig);

}
