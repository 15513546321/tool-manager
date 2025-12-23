// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   DbConnectionRepository.java

package com.toolmanager.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DbConnectionRepository
    extends JpaRepository
{

    public abstract List findByType(String s);

    public abstract Optional findByNameAndType(String s, String s1);
}
