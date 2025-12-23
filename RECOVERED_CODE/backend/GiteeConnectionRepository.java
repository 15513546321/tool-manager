// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   GiteeConnectionRepository.java

package com.toolmanager.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GiteeConnectionRepository
    extends JpaRepository
{

    public abstract Optional findByNameAndAuthType(String s, String s1);

    public abstract Optional findByRepoUrlAndAuthType(String s, String s1);

    public abstract List findAll();

    public abstract List findByAuthType(String s);

    public abstract Optional findByIsDefaultTrue();

    public volatile Iterable findAll()
    {
        return findAll();
    }
}
