// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   DocumentVersionRepository.java

package com.toolmanager.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentVersionRepository
    extends JpaRepository
{

    public abstract List findByDocumentIdOrderByCreatedAtDesc(Long long1);

    public abstract Optional findByDocumentIdAndVersionNumber(Long long1, String s);

    public abstract long countByDocumentId(Long long1);
}
