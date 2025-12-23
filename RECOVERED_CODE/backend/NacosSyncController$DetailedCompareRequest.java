// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   NacosSyncController.java

package com.toolmanager.controller;


// Referenced classes of package com.toolmanager.controller:
//            NacosSyncController

public static class NacosSyncController$DetailedCompareRequest
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

    public String getSourceContent()
    {
        return sourceContent;
    }

    public void setSourceContent(String sourceContent)
    {
        this.sourceContent = sourceContent;
    }

    public String getTargetContent()
    {
        return targetContent;
    }

    public void setTargetContent(String targetContent)
    {
        this.targetContent = targetContent;
    }

    private String dataId;
    private String group;
    private String sourceContent;
    private String targetContent;

    public NacosSyncController$DetailedCompareRequest()
    {
    }
}
