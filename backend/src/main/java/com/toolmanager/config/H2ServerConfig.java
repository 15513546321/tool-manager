package com.toolmanager.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.jdbc.DataSourceBuilder;
import javax.sql.DataSource;

/**
 * H2 Database Configuration
 * Uses embedded mode and also supports TCP connections.
 * Connection URL: jdbc:h2:file:./data/toolmanager;AUTO_SERVER=TRUE
 */
@Configuration
public class H2ServerConfig {

    /**
     * ����Ƕ��ʽH2���ݿ�����Դ
     * ʹ���ļ�ģʽ�洢���ݣ�ͬʱ֧��TCP����
     * 
     * @return ���úõ�����Դ
     */
    // 注释掉此方法，让Spring Boot使用application.properties中的配置
    // H2ServerConfig中的DataSource Bean会覆盖application.properties的配置
    // 导致数据库连接不稳定
    /*
    @Bean
    public DataSource dataSource() {
        // ʹ��Ƕ��ʽģʽ��ͬʱ֧��TCP����
        // ���ݿ�洢���ļ��У��������ڴ���
        return DataSourceBuilder.create()
                .url("jdbc:h2:file:./data/toolmanager;AUTO_SERVER=TRUE;DB_CLOSE_DELAY=-1")
                .driverClassName("org.h2.Driver")
                .username("sa")
                .password("")
                .build();
    }
    */
}