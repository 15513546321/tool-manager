package com.toolmanager.config;

import org.apache.coyote.http11.AbstractHttp11Protocol;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.boot.web.servlet.MultipartConfigFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.unit.DataSize;

import javax.servlet.MultipartConfigElement;

/**
 * 统一设置大文件上传限制，避免部署环境遗漏 application.properties 后回退到 1 MB 默认值。
 */
@Configuration
public class MultipartUploadConfig {
    public static final long MAX_FILE_SIZE_BYTES = 200L * 1024L * 1024L;
    public static final long MAX_REQUEST_SIZE_BYTES = 205L * 1024L * 1024L;
    private static final int FILE_SIZE_THRESHOLD_BYTES = 2 * 1024 * 1024;

    @Bean
    public MultipartConfigElement multipartConfigElement() {
        MultipartConfigFactory factory = new MultipartConfigFactory();
        factory.setMaxFileSize(DataSize.ofBytes(MAX_FILE_SIZE_BYTES));
        factory.setMaxRequestSize(DataSize.ofBytes(MAX_REQUEST_SIZE_BYTES));
        factory.setFileSizeThreshold(DataSize.ofBytes(FILE_SIZE_THRESHOLD_BYTES));
        return factory.createMultipartConfig();
    }

    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> multipartTomcatCustomizer() {
        return factory -> factory.addConnectorCustomizers(connector -> {
            connector.setMaxPostSize((int) MAX_REQUEST_SIZE_BYTES);
            if (connector.getProtocolHandler() instanceof AbstractHttp11Protocol) {
                ((AbstractHttp11Protocol<?>) connector.getProtocolHandler())
                        .setMaxSwallowSize((int) MAX_REQUEST_SIZE_BYTES);
            }
        });
    }
}
