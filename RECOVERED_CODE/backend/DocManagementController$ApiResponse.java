// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   DocManagementController.java

package com.toolmanager.controller;


// Referenced classes of package com.toolmanager.controller:
//            DocManagementController

public static class DocManagementController$ApiResponse
{

    public boolean isSuccess()
    {
        return success;
    }

    public void setSuccess(boolean success)
    {
        this.success = success;
    }

    public String getMessage()
    {
        return message;
    }

    public void setMessage(String message)
    {
        this.message = message;
    }

    public Object getData()
    {
        return data;
    }

    public void setData(Object data)
    {
        this.data = data;
    }

    private boolean success;
    private String message;
    private Object data;

    public DocManagementController$ApiResponse(boolean success, String message, Object data)
    {
        this.success = success;
        this.message = message;
        this.data = data;
    }
}
