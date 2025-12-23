// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   OracleSynchronizer.java

package com.toolmanager.service;


// Referenced classes of package com.toolmanager.service:
//            OracleSynchronizer

public static class OracleSynchronizer$ColumnInfo
{

    public String getName()
    {
        return name;
    }

    public String getType()
    {
        return type;
    }

    public int getSize()
    {
        return size;
    }

    public boolean isNullable()
    {
        return nullable;
    }

    private final String name;
    private final String type;
    private final int size;
    private final boolean nullable;

    public OracleSynchronizer$ColumnInfo(String name, String type, int size, boolean nullable)
    {
        this.name = name;
        this.type = type;
        this.size = size;
        this.nullable = nullable;
    }
}
