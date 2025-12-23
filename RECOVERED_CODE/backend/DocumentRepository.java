// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   DocumentRepository.java

package com.toolmanager.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository
    extends JpaRepository
{

    public abstract List findByCategory(String s);

    public abstract List findByCategoryAndSubCategory(String s, String s1);

    public abstract List findByTitleContainingIgnoreCase(String s);

    public abstract List findByCategoryOrderByUpdatedAtDesc(String s);
}
