package com.toolmanager.config;

import lombok.extern.slf4j.Slf4j;

import com.toolmanager.entity.*;
import com.toolmanager.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 数据初始化器 - 应用启动时初始化系统基础数据
 * 包括菜单、系统参数、公告、数据库连接、代码模板等
 */
@Slf4j
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

    /**
     * 运行初始化逻辑 - 初始化所有基础数据
     */
    @Override
    public void run(String... args) throws Exception {
        try {
            // 初始化菜单项
            initializeMenuItems();
            // 初始化系统参数
            initializeSystemParameters();
            // 初始化公告
            initializeAnnouncements();
            // 初始化数据库连接
            initializeDbConnections();
            // 初始化代码模板
            initializeCodeTemplates();
            // 初始化文档
            initializeDocuments();
            log.info("✓ All data initialization completed successfully!");
        } catch (Exception e) {
            log.error("Error during data initialization: {}", e.getMessage(), e);
            e.printStackTrace();
        }
    }

    /**
     * 初始化菜单项 - MenuItem由SecurityDataInitializer统一管理
     * 此方法保留为空以避免重复初始化
     */
    private void initializeMenuItems() {
        // MenuItem数据由SecurityDataInitializer统一管理，此处不做任何操作
    }

    /**
     * 初始化系统参数 - 设置系统级别的配置参数
     */
    private void initializeSystemParameters() {
        if (systemParameterRepository.count() == 0) {
//            systemParameterRepository.save(new SystemParameter(null, "SESSION_TIMEOUT", "3000", "NUMBER", "Session timeout in seconds", "System", LocalDateTime.now(), LocalDateTime.now(), "admin"));
//            systemParameterRepository.save(new SystemParameter(null, "MAX_RETRY", "3", "NUMBER", "Max login retries", "System", LocalDateTime.now(), LocalDateTime.now(), "admin"));
//            systemParameterRepository.save(new SystemParameter(null, "TRANSFER_FEE", "1.50", "NUMBER", "Default fee", "Business", LocalDateTime.now(), LocalDateTime.now(), "admin"));
        }
    }

    private void initializeAnnouncements() {
        if (announcementRepository.count() == 0) {
//            Announcement announcement = new Announcement();
//            announcement.setTitle("欢迎使用系统");
//            announcement.setDescription("系统已成功部署，欢迎使用！");
//            announcement.setContent("这是一条欢迎公告，系统已正式上线。");
//            announcement.setVersion("20251213");
//            announcement.setStatus("PUBLISHED");
//            announcement.setCreatedBy("admin");
//            announcement.setUpdatedBy("admin");
//            announcementRepository.save(announcement);
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
//            Document doc1 = new Document();
//            doc1.setTitle("Java 编码规范 v2.0");
//            doc1.setCategory("技术规范");
//            doc1.setSubCategory("后端开发");
//            doc1.setDescription("公司统一 Java 后端开发风格指南");
//            doc1.setCreatedAt(LocalDateTime.now());
//            doc1.setUpdatedAt(LocalDateTime.now());
//            doc1.setUpdatedBy("admin");
//            documentRepository.save(doc1);

//            Document doc2 = new Document();
//            doc2.setTitle("React 组件库使用手册");
//            doc2.setCategory("技术规范");
//            doc2.setSubCategory("前端开发");
//            doc2.setDescription("内部 UI 组件库 API 文档");
//            doc2.setCreatedAt(LocalDateTime.now());
//            doc2.setUpdatedAt(LocalDateTime.now());
//            doc2.setUpdatedBy("admin");
//            documentRepository.save(doc2);

//            Document doc3 = new Document();
//            doc3.setTitle("支付网关接入流程");
//            doc3.setCategory("业务文档");
//            doc3.setSubCategory("支付中心");
//            doc3.setDescription("商户接入支付网关的标准流程");
//            doc3.setCreatedAt(LocalDateTime.now());
//            doc3.setUpdatedAt(LocalDateTime.now());
//            doc3.setUpdatedBy("admin");
//            documentRepository.save(doc3);

            // Initialize document versions
//            initializeDocumentVersions(doc1, doc2, doc3);
        }
    }

    private void initializeDocumentVersions(Document doc1, Document doc2, Document doc3) {
        // Add versions for doc1
//        DocumentVersion v1 = new DocumentVersion();
//        v1.setDocumentId(doc1.getId());
//        v1.setVersionNumber("2.0");
//        v1.setFileName("java_style_v2.md");
//        v1.setFileContent("# Java Style Guide v2\n\n1. Naming\n2. Formatting...");
//        v1.setFileSize("12KB");
//        v1.setUpdatedBy("admin");
//        v1.setCreatedAt(LocalDateTime.now());
//        v1.setUpdatedAt(LocalDateTime.now());
//        documentVersionRepository.save(v1);
//
//        DocumentVersion v2 = new DocumentVersion();
//        v2.setDocumentId(doc1.getId());
//        v2.setVersionNumber("1.0");
//        v2.setFileName("java_style_v1.md");
//        v2.setFileContent("# Java Style Guide v1\n\nInitial release.");
//        v2.setFileSize("10KB");
//        v2.setUpdatedBy("admin");
//        v2.setCreatedAt(LocalDateTime.now());
//        v2.setUpdatedAt(LocalDateTime.now());
//        documentVersionRepository.save(v2);

        // Add versions for doc2
//        DocumentVersion v3 = new DocumentVersion();
//        v3.setDocumentId(doc2.getId());
//        v3.setVersionNumber("1.0");
//        v3.setFileName("ui_lib.md");
//        v3.setFileContent("# UI Lib\n\n## Button\n...");
//        v3.setFileSize("5KB");
//        v3.setUpdatedBy("admin");
//        v3.setCreatedAt(LocalDateTime.now());
//        v3.setUpdatedAt(LocalDateTime.now());
//        documentVersionRepository.save(v3);

        // Add versions for doc3
//        DocumentVersion v4 = new DocumentVersion();
//        v4.setDocumentId(doc3.getId());
//        v4.setVersionNumber("1.0");
//        v4.setFileName("pay_flow.txt");
//        v4.setFileContent("Flow:\n1. Sign contract\n2. Get keys...");
//        v4.setFileSize("2KB");
//        v4.setUpdatedBy("admin");
//        v4.setCreatedAt(LocalDateTime.now());
//        v4.setUpdatedAt(LocalDateTime.now());
//        documentVersionRepository.save(v4);
    }
}
