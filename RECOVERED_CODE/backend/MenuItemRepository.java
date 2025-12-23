// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   MenuItemRepository.java

package com.toolmanager.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MenuItemRepository
    extends JpaRepository
{

    public abstract Optional findByMenuId(String s);

    public abstract List findByParentIdOrderBySortOrder(String s);

    public abstract List findAllByOrderBySortOrder();
}
