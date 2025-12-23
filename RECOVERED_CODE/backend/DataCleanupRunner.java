// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   DataCleanupRunner.java

package com.toolmanager.config;

import com.toolmanager.repository.DocumentRepository;
import com.toolmanager.repository.DocumentVersionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DataCleanupRunner
{

    public void cleanupSampleData()
    {
        try
        {
            long versionCount = documentVersionRepository.count();
            long docCount = documentRepository.count();
            log.info("\u6E05\u7406\u524D: \u6587\u6863\u6570 {}, \u7248\u672C\u6570 {}", Long.valueOf(docCount), Long.valueOf(versionCount));
            documentVersionRepository.deleteAll();
            documentRepository.deleteAll();
            log.info("\u6E05\u7406\u5B8C\u6210: \u6240\u6709\u793A\u4F8B\u6570\u636E\u5DF2\u5220\u9664");
        }
        catch(Exception e)
        {
            log.error("\u6E05\u7406\u6570\u636E\u5931\u8D25", e);
        }
    }

    public DataCleanupRunner(DocumentRepository documentRepository, DocumentVersionRepository documentVersionRepository)
    {
        this.documentRepository = documentRepository;
        this.documentVersionRepository = documentVersionRepository;
    }

    private static final Logger log = LoggerFactory.getLogger(com/toolmanager/config/DataCleanupRunner);
    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository documentVersionRepository;

}
