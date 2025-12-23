// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   NacosSyncController.java

package com.toolmanager.controller;


// Referenced classes of package com.toolmanager.controller:
//            NacosSyncController

public static class NacosSyncController$GitConnectionRequest
{

    public String getRepoUrl()
    {
        return repoUrl;
    }

    public void setRepoUrl(String repoUrl)
    {
        this.repoUrl = repoUrl;
    }

    public String getAuthType()
    {
        return authType;
    }

    public void setAuthType(String authType)
    {
        this.authType = authType;
    }

    public String getAuthUsername()
    {
        return authUsername;
    }

    public void setAuthUsername(String authUsername)
    {
        this.authUsername = authUsername;
    }

    public String getAuthPassword()
    {
        return authPassword;
    }

    public void setAuthPassword(String authPassword)
    {
        this.authPassword = authPassword;
    }

    public String getAuthToken()
    {
        return authToken;
    }

    public void setAuthToken(String authToken)
    {
        this.authToken = authToken;
    }

    public String getSshKeyContent()
    {
        return sshKeyContent;
    }

    public void setSshKeyContent(String sshKeyContent)
    {
        this.sshKeyContent = sshKeyContent;
    }

    public String getSshPassphrase()
    {
        return sshPassphrase;
    }

    public void setSshPassphrase(String sshPassphrase)
    {
        this.sshPassphrase = sshPassphrase;
    }

    private String repoUrl;
    private String authType;
    private String authUsername;
    private String authPassword;
    private String authToken;
    private String sshKeyContent;
    private String sshPassphrase;

    public NacosSyncController$GitConnectionRequest()
    {
    }
}
