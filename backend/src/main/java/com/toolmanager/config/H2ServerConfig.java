package com.toolmanager.config;

import org.h2.tools.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.sql.SQLException;

/**
 * H2 TCP Server 配置
 * 允许远程客户端（如 IDEA、DBeaver 等）通过 TCP 连接到 H2 数据库
 * 连接地址：jdbc:h2:tcp://localhost:9092/~/tooldb
 */
@Configuration
public class H2ServerConfig {

    /**
     * 启动 H2 TCP 服务器，允许远程连接
     * 默认监听端口 9092
     * 
     * @return H2 Server 实例
     * @throws SQLException 如果服务器启动失败
     */
    @Bean(initMethod = "start", destroyMethod = "stop")
    public Server h2Server() throws SQLException {
        // 启动 H2 TCP 服务器
        // -tcpPort 9092: 监听 TCP 端口 9092
        // -baseDir ./data: 数据库文件保存位置
        return Server.createTcpServer("-tcpPort", "9092", "-baseDir", "./data");
    }

    /**
     * 启动 H2 Web 控制台服务器
     * 访问地址：http://localhost:8081
     * 
     * @return H2 Web Server 实例
     * @throws SQLException 如果服务器启动失败
     */
    @Bean(initMethod = "start", destroyMethod = "stop")
    public Server h2WebServer() throws SQLException {
        // 启动 H2 Web 控制台（可选）
        // -webPort 8081: Web 控制台监听端口
        return Server.createWebServer("-webPort", "8081");
    }
}
