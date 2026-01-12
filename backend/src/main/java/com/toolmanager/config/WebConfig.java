package com.toolmanager.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final IpWhitelistConfigInterceptor ipWhitelistConfigInterceptor;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 静态资源访问配置
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .setCachePeriod(3600);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 注册IP白名单拦截器，拦截所有请求
        registry.addInterceptor(ipWhitelistConfigInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns("/error"); // 排除错误页面
    }
}