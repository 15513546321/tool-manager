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
    private final DocumentVersionRepository documentVersionRepository;

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
            menuItemRepository.save(new MenuItem(null, "2", "接口管理", "/interface", "api", true, null, 4, LocalDateTime.now(), LocalDateTime.now(), "admin"));
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

    /**
     * 禁用自动初始化Oracle连接配置 (2025-12-21)
     * 用户需要手动在UI中配置并持久化连接信息到数据库
     */
    private void initializeDbConnections() {
        // 不再自动创建mock Oracle连接
        // 用户应通过UI添加实际的数据库连接信息
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
            doc1.setTitle("Java 编码规范 v2.0");
            doc1.setCategory("技术规范");
            doc1.setSubCategory("后端开发");
            doc1.setDescription("公司统一 Java 后端开发风格指南");
            doc1.setCreatedAt(LocalDateTime.now());
            doc1.setUpdatedAt(LocalDateTime.now());
            doc1.setUpdatedBy("admin");
            documentRepository.save(doc1);

            Document doc2 = new Document();
            doc2.setTitle("React 组件库使用手册");
            doc2.setCategory("技术规范");
            doc2.setSubCategory("前端开发");
            doc2.setDescription("内部 UI 组件库 API 文档");
            doc2.setCreatedAt(LocalDateTime.now());
            doc2.setUpdatedAt(LocalDateTime.now());
            doc2.setUpdatedBy("admin");
            documentRepository.save(doc2);

            Document doc3 = new Document();
            doc3.setTitle("支付网关接入流程");
            doc3.setCategory("业务文档");
            doc3.setSubCategory("支付中心");
            doc3.setDescription("商户接入支付网关的标准流程");
            doc3.setCreatedAt(LocalDateTime.now());
            doc3.setUpdatedAt(LocalDateTime.now());
            doc3.setUpdatedBy("admin");
            documentRepository.save(doc3);

            // Initialize document versions
            initializeDocumentVersions(doc1, doc2, doc3);
        }
    }

    private void initializeDocumentVersions(Document doc1, Document doc2, Document doc3) {
        // Add versions for doc1
        DocumentVersion v1 = new DocumentVersion();
        v1.setDocumentId(doc1.getId());
        v1.setVersionNumber("2.0");
        v1.setFileName("java_style_v2.md");
        v1.setFileContent("# Java Style Guide v2\n\n1. Naming\n2. Formatting...");
        v1.setFileSize("12KB");
        v1.setUpdatedBy("admin");
        v1.setCreatedAt(LocalDateTime.now());
        v1.setUpdatedAt(LocalDateTime.now());
        documentVersionRepository.save(v1);

        DocumentVersion v2 = new DocumentVersion();
        v2.setDocumentId(doc1.getId());
        v2.setVersionNumber("1.0");
        v2.setFileName("java_style_v1.md");
        v2.setFileContent("# Java Style Guide v1\n\nInitial release.");
        v2.setFileSize("10KB");
        v2.setUpdatedBy("admin");
        v2.setCreatedAt(LocalDateTime.now());
        v2.setUpdatedAt(LocalDateTime.now());
        documentVersionRepository.save(v2);

        // Add versions for doc2
        DocumentVersion v3 = new DocumentVersion();
        v3.setDocumentId(doc2.getId());
        v3.setVersionNumber("1.0");
        v3.setFileName("ui_lib.md");
        v3.setFileContent("# UI Lib\n\n## Button\n...");
        v3.setFileSize("5KB");
        v3.setUpdatedBy("admin");
        v3.setCreatedAt(LocalDateTime.now());
        v3.setUpdatedAt(LocalDateTime.now());
        documentVersionRepository.save(v3);

        // Add versions for doc3
        DocumentVersion v4 = new DocumentVersion();
        v4.setDocumentId(doc3.getId());
        v4.setVersionNumber("1.0");
        v4.setFileName("pay_flow.txt");
        v4.setFileContent("Flow:\n1. Sign contract\n2. Get keys...");
        v4.setFileSize("2KB");
        v4.setUpdatedBy("admin");
        v4.setCreatedAt(LocalDateTime.now());
        v4.setUpdatedAt(LocalDateTime.now());
        documentVersionRepository.save(v4);
    }
}
