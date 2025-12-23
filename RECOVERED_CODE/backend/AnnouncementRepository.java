// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   AnnouncementRepository.java

package com.toolmanager.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnnouncementRepository
    extends JpaRepository
{

    public abstract Optional findByVersion(String s);

    public abstract List findByStatus(String s);

    public abstract List findByStatusOrderByCreatedAtDesc(String s);
}
