package com.toolmanager.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.jdbc.DataSourceBuilder;
import javax.sql.DataSource;

/**
 * H2 数据库配置
 * 使用嵌入式模式，同时支持本地TCP连接
 * 连接地址：jdbc:h2:file:./data/toolmanager;AUTO_SERVER=TRUE
 */
@Configuration
public class H2ServerConfig {

    /**
     * 创建嵌入式H2数据库数据源
     * 使用文件模式存储数据，同时支持TCP连接
     * 
     * @return 配置好的数据源
     */
    @Bean
    public DataSource dataSource() {
        // 使用嵌入式模式，同时支持TCP连接
        // 数据库存储在文件中，而不是内存中
        return DataSourceBuilder.create()
                .url("jdbc:h2:file:./data/toolmanager;AUTO_SERVER=TRUE;DB_CLOSE_DELAY=-1")
                .driverClassName("org.h2.Driver")
                .username("sa")
                .password("")
                .build();
    }
}