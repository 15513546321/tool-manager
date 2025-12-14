package com.toolmanager.config;

import com.toolmanager.entity.*;
import com.toolmanager.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {
    private final MenuItemRepository menuItemRepository;
    private final SystemParameterRepository systemParameterRepository;
    private final AnnouncementRepository announcementRepository;
    private final DbConnectionRepository dbConnectionRepository;
    private final CodeTemplateRepository codeTemplateRepository;
    private final DocumentRepository documentRepository;

    @Override
    public void run(String... args) throws Exception {
        try {
            initializeMenuItems();
            initializeSystemParameters();
            initializeAnnouncements();
            initializeDbConnections();
            initializeCodeTemplates();
            initializeDocuments();
            System.out.println("✓ All data initialization completed successfully!");
        } catch (Exception e) {
            System.err.println("Error during data initialization: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void initializeMenuItems() {
        if (menuItemRepository.count() == 0) {
            // Root menus
            menuItemRepository.save(new MenuItem(null, "1", "首页", "/dashboard", "dashboard", true, null, 1, LocalDateTime.now(), LocalDateTime.now(), "admin"));
            menuItemRepository.save(new MenuItem(null, "6", "公告通知", "/announcement", "docs", true, null, 2, LocalDateTime.now(), LocalDateTime.now(), "admin"));
            menuItemRepository.save(new MenuItem(null, "10", "优化建议", "/suggestions", "suggestions", true, null, 3, LocalDateTime.now(), LocalDateTime.now(), "admin"));
            menuItemRepository.save(new MenuItem(null, "2", "接口管理", "/interface", "interface", true, null, 4, LocalDateTime.now(), LocalDateTime.now(), "admin"));
            menuItemRepository.save(new MenuItem(null, "11", "数据同步", "/sync", "sync", true, null, 5, LocalDateTime.now(), LocalDateTime.now(), "admin"));
            menuItemRepository.save(new MenuItem(null, "9", "GitLab 报表", "/gitlab-reports", "gitlab", true, null, 6, LocalDateTime.now(), LocalDateTime.now(), "admin"));
            menuItemRepository.save(new MenuItem(null, "12", "Gitee管理", "/gitee", "gitee", true, null, 7, LocalDateTime.now(), LocalDateTime.now(), "admin"));
            menuItemRepository.save(new MenuItem(null, "8", "格式化工具", "/format", "format", true, null, 8, LocalDateTime.now(), LocalDateTime.now(), "admin"));
            menuItemRepository.save(new MenuItem(null, "3", "参数配置", "/params", "params", true, null, 9, LocalDateTime.now(), LocalDateTime.now(), "admin"));
            menuItemRepository.save(new MenuItem(null, "4", "知识库", "/repo", "repo", true, null, 10, LocalDateTime.now(), LocalDateTime.now(), "admin"));
            menuItemRepository.save(new MenuItem(null, "7", "审计日志", "/audit", "settings", true, null, 11, LocalDateTime.now(), LocalDateTime.now(), "admin"));
            menuItemRepository.save(new MenuItem(null, "5", "系统设置", "/admin", "settings", true, null, 12, LocalDateTime.now(), LocalDateTime.now(), "admin"));

            // Child menus
            menuItemRepository.save(new MenuItem(null, "2-1", "文档管理", "/interface/docs", "docs", true, "2", 1, LocalDateTime.now(), LocalDateTime.now(), "admin"));
            menuItemRepository.save(new MenuItem(null, "2-2", "代码生成", "/interface/code", "code", true, "2", 2, LocalDateTime.now(), LocalDateTime.now(), "admin"));
            menuItemRepository.save(new MenuItem(null, "11-1", "Nacos配置同步", "/sync/nacos", "nacos", true, "11", 1, LocalDateTime.now(), LocalDateTime.now(), "admin"));
            menuItemRepository.save(new MenuItem(null, "11-2", "Oracle DDL同步", "/sync/oracle", "oracle", true, "11", 2, LocalDateTime.now(), LocalDateTime.now(), "admin"));
            menuItemRepository.save(new MenuItem(null, "5-1", "菜单管理", "/admin/menus", "settings", true, "5", 1, LocalDateTime.now(), LocalDateTime.now(), "admin"));
            menuItemRepository.save(new MenuItem(null, "5-2", "IP映射配置", "/admin/ip-config", "ip", true, "5", 2, LocalDateTime.now(), LocalDateTime.now(), "admin"));
        }
    }

    private void initializeSystemParameters() {
        if (systemParameterRepository.count() == 0) {
            systemParameterRepository.save(new SystemParameter(null, "SESSION_TIMEOUT", "3000", "NUMBER", "Session timeout in seconds", "System", LocalDateTime.now(), LocalDateTime.now(), "admin"));
            systemParameterRepository.save(new SystemParameter(null, "MAX_RETRY", "3", "NUMBER", "Max login retries", "System", LocalDateTime.now(), LocalDateTime.now(), "admin"));
            systemParameterRepository.save(new SystemParameter(null, "TRANSFER_FEE", "1.50", "NUMBER", "Default fee", "Business", LocalDateTime.now(), LocalDateTime.now(), "admin"));
        }
    }

    private void initializeAnnouncements() {
        if (announcementRepository.count() == 0) {
            Announcement announcement = new Announcement();
            announcement.setTitle("欢迎使用系统");
            announcement.setDescription("系统已成功部署，欢迎使用！");
            announcement.setContent("这是一条欢迎公告，系统已正式上线。");
            announcement.setVersion("20251213");
            announcement.setStatus("PUBLISHED");
            announcement.setCreatedBy("admin");
            announcement.setUpdatedBy("admin");
            announcementRepository.save(announcement);
        }
    }

    private void initializeDbConnections() {
        if (dbConnectionRepository.count() == 0) {
            // Sample Oracle Source Connection
            DbConnection oracleSource = new DbConnection();
            oracleSource.setName("Oracle_Source");
            oracleSource.setType("ORACLE_SOURCE");
            oracleSource.setHost("localhost");
            oracleSource.setPort(1521);
            oracleSource.setDatabase("ORCL");
            oracleSource.setUsername("scott");
            oracleSource.setPassword("tiger");
            oracleSource.setConnectionString("jdbc:oracle:thin:@localhost:1521:ORCL");
            oracleSource.setCreatedAt(LocalDateTime.now());
            oracleSource.setUpdatedAt(LocalDateTime.now());
            oracleSource.setUpdatedBy("admin");
            dbConnectionRepository.save(oracleSource);

            // Sample Oracle Target Connection
            DbConnection oracleTarget = new DbConnection();
            oracleTarget.setName("Oracle_Target");
            oracleTarget.setType("ORACLE_TARGET");
            oracleTarget.setHost("192.168.1.100");
            oracleTarget.setPort(1521);
            oracleTarget.setDatabase("PROD");
            oracleTarget.setUsername("system");
            oracleTarget.setPassword("change_on_install");
            oracleTarget.setConnectionString("jdbc:oracle:thin:@192.168.1.100:1521:PROD");
            oracleTarget.setCreatedAt(LocalDateTime.now());
            oracleTarget.setUpdatedAt(LocalDateTime.now());
            oracleTarget.setUpdatedBy("admin");
            dbConnectionRepository.save(oracleTarget);
        }
    }

    private void initializeCodeTemplates() {
        if (codeTemplateRepository.count() == 0) {
            // Default template
            CodeTemplate template = new CodeTemplate();
            template.setName("Default");
            template.setType("default");
            template.setContent("// Auto-generated code template\npublic class ${ClassName} {\n    // Add your code here\n}");
            template.setDescription("Default code generation template");
            template.setIsBuiltIn(true);
            template.setCreatedAt(LocalDateTime.now());
            template.setUpdatedAt(LocalDateTime.now());
            template.setUpdatedBy("admin");
            codeTemplateRepository.save(template);

            // Java template
            CodeTemplate javaTemplate = new CodeTemplate();
            javaTemplate.setName("Java Entity");
            javaTemplate.setType("java");
            javaTemplate.setContent("package ${packageName};\n\npublic class ${ClassName} {\n    // Properties\n    // Getters/Setters\n}");
            javaTemplate.setDescription("Java entity class template");
            javaTemplate.setIsBuiltIn(true);
            javaTemplate.setCreatedAt(LocalDateTime.now());
            javaTemplate.setUpdatedAt(LocalDateTime.now());
            javaTemplate.setUpdatedBy("admin");
            codeTemplateRepository.save(javaTemplate);
        }
    }

    private void initializeDocuments() {
        if (documentRepository.count() == 0) {
            // Sample documentation
            Document doc1 = new Document();
            doc1.setTitle("系统使用指南");
            doc1.setContent("这是系统的基本使用指南...");
            doc1.setType("TEXT");
            doc1.setCategory("使用指南");
            doc1.setDocOrder(1);
            doc1.setCreatedAt(LocalDateTime.now());
            doc1.setUpdatedAt(LocalDateTime.now());
            doc1.setUpdatedBy("admin");
            documentRepository.save(doc1);

            Document doc2 = new Document();
            doc2.setTitle("API文档");
            doc2.setContent("REST API接口文档...");
            doc2.setType("TEXT");
            doc2.setCategory("技术文档");
            doc2.setDocOrder(1);
            doc2.setCreatedAt(LocalDateTime.now());
            doc2.setUpdatedAt(LocalDateTime.now());
            doc2.setUpdatedBy("admin");
            documentRepository.save(doc2);

            Document doc3 = new Document();
            doc3.setTitle("常见问题");
            doc3.setContent("1. 如何登录？\n2. 如何重置密码？");
            doc3.setType("TEXT");
            doc3.setCategory("常见问题");
            doc3.setDocOrder(1);
            doc3.setCreatedAt(LocalDateTime.now());
            doc3.setUpdatedAt(LocalDateTime.now());
            doc3.setUpdatedBy("admin");
            documentRepository.save(doc3);
        }
    }
}
