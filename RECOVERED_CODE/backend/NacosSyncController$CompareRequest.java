// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   NacosSyncController.java

package com.toolmanager.controller;


// Referenced classes of package com.toolmanager.controller:
//            NacosSyncController

public static class NacosSyncController$CompareRequest
{

    public Long getConfigId()
    {
        return configId;
    }

    public void setConfigId(Long configId)
    {
        this.configId = configId;
    }

    public String getSourceUrl()
    {
        return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl)
    {
        this.sourceUrl = sourceUrl;
    }

    public String getSourceNamespace()
    {
        return sourceNamespace;
    }

    public void setSourceNamespace(String sourceNamespace)
    {
        this.sourceNamespace = sourceNamespace;
    }

    public String getSourceUsername()
    {
        return sourceUsername;
    }

    public void setSourceUsername(String sourceUsername)
    {
        this.sourceUsername = sourceUsername;
    }

    public String getSourcePassword()
    {
        return sourcePassword;
    }

    public void setSourcePassword(String sourcePassword)
    {
        this.sourcePassword = sourcePassword;
    }

    public String getTargetUrl()
    {
        return targetUrl;
    }

    public void setTargetUrl(String targetUrl)
    {
        this.targetUrl = targetUrl;
    }

    public String getTargetNamespace()
    {
        return targetNamespace;
    }

    public void setTargetNamespace(String targetNamespace)
    {
        this.targetNamespace = targetNamespace;
    }

    public String getTargetUsername()
    {
        return targetUsername;
    }

    public void setTargetUsername(String targetUsername)
    {
        this.targetUsername = targetUsername;
    }

    public String getTargetPassword()
    {
        return targetPassword;
    }

    public void setTargetPassword(String targetPassword)
    {
        this.targetPassword = targetPassword;
    }

    private Long configId;
    private String sourceUrl;
    private String sourceNamespace;
    private String sourceUsername;
    private String sourcePassword;
    private String targetUrl;
    private String targetNamespace;
    private String targetUsername;
    private String targetPassword;

    public NacosSyncController$CompareRequest()
    {
    }
}
