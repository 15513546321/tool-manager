package com.toolmanager.config;

import lombok.extern.slf4j.Slf4j;
import org.h2.tools.Server;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.sql.SQLException;

/**
 * H2 数据库远程连接配置
 * 
 * 支持的连接方式：
 * 1. 嵌入式 (应用内): jdbc:h2:file:./data/toolmanager;MODE=MySQL
 * 2. Web Console: http://localhost:8080/h2-console
 * 3. TCP 远程: tcp://localhost:9092
 *    - 工具连接: jdbc:h2:tcp://localhost:9092/file:./data/toolmanager;MODE=MySQL
 *    - 支持 DBeaver、DataGrip、Navicat 等工具
 */
@Slf4j
@Configuration
public class H2ServerConfig {

    /**
     * 启动 H2 TCP 服务器，支持远程连接
     * 
     * 监听地址: tcp://0.0.0.0:9092
     * 允许来自所有主机的连接
     * 
     * @return H2 TCP 服务器实例
     * @throws SQLException 如果服务器启动失败
     */
    @Bean
    @ConditionalOnProperty(
        name = "h2.tcp.enabled",
        havingValue = "true",
        matchIfMissing = true  // 默认启用
    )
    public Server h2TcpServer() throws SQLException {
        log.info("════════════════════════════════════════════════════════════");
        log.info("✓ H2 TCP 服务器已启动");
        log.info("────────────────────────────────────────────────────────────");
        log.info("监听地址: tcp://0.0.0.0:9092 (所有网卡)");
        log.info("允许远程连接");
        log.info("");
        log.info("本地连接示例:");
        log.info("  JDBC URL: jdbc:h2:tcp://localhost:9092/file:./data/toolmanager;MODE=MySQL");
        log.info("");
        log.info("远程工具连接示例（DBeaver/DataGrip）:");
        log.info("  JDBC URL: jdbc:h2:tcp://192.168.56.1:9092/file:./data/toolmanager;MODE=MySQL");
        log.info("  用户名: sa");
        log.info("  密码: (空)");
        log.info("════════════════════════════════════════════════════════════");
        
        return Server.createTcpServer(
            "-tcp",              // 启用 TCP 模式
            "-tcpAllowOthers",   // 允许远程连接
            "-tcpPort", "9092"   // 监听端口
        ).start();
    }
}
