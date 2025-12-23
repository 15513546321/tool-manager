// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   ParameterCategoryRepository.java

package com.toolmanager.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ParameterCategoryRepository
    extends JpaRepository
{

    public abstract List findByBigClass(String s);

    public abstract List findByBigClassAndSmallClass(String s, String s1);

    public abstract boolean existsByBigClassAndSmallClass(String s, String s1);
}
