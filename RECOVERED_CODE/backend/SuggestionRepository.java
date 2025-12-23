// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   SuggestionRepository.java

package com.toolmanager.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SuggestionRepository
    extends JpaRepository
{

    public abstract List findByStatus(String s);

    public abstract List findByCategory(String s);

    public abstract List findAllByOrderByCreatedAtDesc();
}
