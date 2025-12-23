// Decompiled by Jad v1.5.8g. Copyright 2001 Pavel Kouznetsov.
// Jad home page: http://www.kpdus.com/jad.html
// Decompiler options: packimports(3) 
// Source File Name:   SSHKeyConverter.java

package com.toolmanager.util;

import java.util.*;

// Referenced classes of package com.toolmanager.util:
//            SSHKeyConverter

public static class SSHKeyConverter$SSHKeyDiagnosticResult
{

    public void addIssue(String issue)
    {
        issues.add(issue);
    }

    public void addSolution(String solution)
    {
        solutions.add(solution);
    }

    public void addInfo(String information)
    {
        info.add(information);
    }

    public boolean hasIssues()
    {
        return !issues.isEmpty();
    }

    public String getFullReport()
    {
        StringBuilder report = new StringBuilder();
        if(!info.isEmpty())
        {
            report.append("\u2139\uFE0F  \u4FE1\u606F:\n");
            String i;
            for(Iterator iterator = info.iterator(); iterator.hasNext(); report.append("  - ").append(i).append("\n"))
                i = (String)iterator.next();

            report.append("\n");
        }
        if(!issues.isEmpty())
        {
            report.append("\u274C \u95EE\u9898:\n");
            String issue;
            for(Iterator iterator1 = issues.iterator(); iterator1.hasNext(); report.append("  - ").append(issue).append("\n"))
                issue = (String)iterator1.next();

            report.append("\n");
        }
        if(!solutions.isEmpty())
        {
            report.append("\uD83D\uDCA1 \u89E3\u51B3\u65B9\u6848:\n");
            String solution;
            for(Iterator iterator2 = solutions.iterator(); iterator2.hasNext(); report.append("  ").append(solution).append("\n"))
                solution = (String)iterator2.next();

        }
        return report.toString();
    }

    public List getIssues()
    {
        return issues;
    }

    public List getSolutions()
    {
        return solutions;
    }

    private List issues;
    private List solutions;
    private List info;

    public SSHKeyConverter$SSHKeyDiagnosticResult()
    {
        issues = new ArrayList();
        solutions = new ArrayList();
        info = new ArrayList();
    }
}
