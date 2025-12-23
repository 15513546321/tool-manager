// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   NacosSyncController.java

package com.toolmanager.controller;


// Referenced classes of package com.toolmanager.controller:
//            NacosSyncController

public static class NacosSyncController$NacosConnectionRequest
{

    public String getUrl()
    {
        return url;
    }

    public void setUrl(String url)
    {
        this.url = url;
    }

    public String getNamespace()
    {
        return namespace;
    }

    public void setNamespace(String namespace)
    {
        this.namespace = namespace;
    }

    public String getUsername()
    {
        return username;
    }

    public void setUsername(String username)
    {
        this.username = username;
    }

    public String getPassword()
    {
        return password;
    }

    public void setPassword(String password)
    {
        this.password = password;
    }

    private String url;
    private String namespace;
    private String username;
    private String password;

    public NacosSyncController$NacosConnectionRequest()
    {
    }
}
