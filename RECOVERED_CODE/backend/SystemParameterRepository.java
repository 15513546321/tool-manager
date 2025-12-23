// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   SystemParameterRepository.java

package com.toolmanager.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SystemParameterRepository
    extends JpaRepository
{

    public abstract Optional findByParamKey(String s);

    public abstract List findByCategory(String s);
}
