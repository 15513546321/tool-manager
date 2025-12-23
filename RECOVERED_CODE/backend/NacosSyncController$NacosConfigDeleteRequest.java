// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   NacosSyncController.java

package com.toolmanager.controller;


// Referenced classes of package com.toolmanager.controller:
//            NacosSyncController

public static class NacosSyncController$NacosConfigDeleteRequest extends NacosSyncController.NacosConnectionRequest
{

    public String getDataId()
    {
        return dataId;
    }

    public void setDataId(String dataId)
    {
        this.dataId = dataId;
    }

    public String getGroup()
    {
        return group;
    }

    public void setGroup(String group)
    {
        this.group = group;
    }

    private String dataId;
    private String group;

    public NacosSyncController$NacosConfigDeleteRequest()
    {
    }
}
