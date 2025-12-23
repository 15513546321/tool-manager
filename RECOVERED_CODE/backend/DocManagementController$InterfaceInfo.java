// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   DocManagementController.java

package com.toolmanager.controller;

import java.util.List;

// Referenced classes of package com.toolmanager.controller:
//            DocManagementController

public static class DocManagementController$InterfaceInfo
{

    public String getId()
    {
        return id;
    }

    public void setId(String id)
    {
        this.id = id;
    }

    public String getName()
    {
        return name;
    }

    public void setName(String name)
    {
        this.name = name;
    }

    public String getModule()
    {
        return module;
    }

    public void setModule(String module)
    {
        this.module = module;
    }

    public String getFilePath()
    {
        return filePath;
    }

    public void setFilePath(String filePath)
    {
        this.filePath = filePath;
    }

    public String getDescription()
    {
        return description;
    }

    public void setDescription(String description)
    {
        this.description = description;
    }

    public List getInputs()
    {
        return inputs;
    }

    public void setInputs(List inputs)
    {
        this.inputs = inputs;
    }

    public List getOutputs()
    {
        return outputs;
    }

    public void setOutputs(List outputs)
    {
        this.outputs = outputs;
    }

    public List getDownstreamCalls()
    {
        return downstreamCalls;
    }

    public void setDownstreamCalls(List downstreamCalls)
    {
        this.downstreamCalls = downstreamCalls;
    }

    private String id;
    private String name;
    private String module;
    private String filePath;
    private String description;
    private List inputs;
    private List outputs;
    private List downstreamCalls;

    public DocManagementController$InterfaceInfo()
    {
    }
}
