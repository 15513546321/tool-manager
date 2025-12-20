package com.toolmanager.config;

import com.toolmanager.repository.DocumentRepository;
import com.toolmanager.repository.DocumentVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 应用启动完成后清理示例数据
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataCleanupRunner {
    
    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository documentVersionRepository;
    
    /**
     * 禁用自动清理数据 (2025-12-20)
     * 用户维护的数据不应该在重启时被清除
     */
    //@EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void cleanupSampleData() {
        try {
            // 删除所有示例文档和版本
            long versionCount = documentVersionRepository.count();
            long docCount = documentRepository.count();
            
            log.info("清理前: 文档数 {}, 版本数 {}", docCount, versionCount);
            
            documentVersionRepository.deleteAll();
            documentRepository.deleteAll();
            
            log.info("清理完成: 所有示例数据已删除");
        } catch (Exception e) {
            log.error("清理数据失败", e);
        }
    }
}
