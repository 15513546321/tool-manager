#!/usr/bin/env powershell
# Tool Manager - 一键启动脚本（后端嵌入前端）

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Tool Manager 项目启动" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Java 版本
Write-Host "检查 Java 版本..." -ForegroundColor Yellow
java -version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误：未找到 Java，请先安装 Java 11+" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 检查 Maven 版本
Write-Host "检查 Maven 版本..." -ForegroundColor Yellow
mvn -version 2>&1 | Select-Object -First 3
if ($LASTEXITCODE -ne 0) {
    Write-Host "警告：未找到 Maven。请确保已安装并配置到 PATH" -ForegroundColor Yellow
    Write-Host "可以从 https://maven.apache.org/download.cgi 下载 Maven" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "按 Enter 继续（或 Ctrl+C 退出）"
}
Write-Host ""

# 进入后端目录
$backendPath = ".\backend"
if (!(Test-Path $backendPath)) {
    Write-Host "错误：未找到 backend 目录" -ForegroundColor Red
    exit 1
}

Write-Host "开始编译和启动后端（Spring Boot）..." -ForegroundColor Green
Write-Host "这可能需要 2-3 分钟（首次编译会下载依赖）" -ForegroundColor Yellow
Write-Host ""

Set-Location $backendPath
mvn clean spring-boot:run -DskipTests

Write-Host ""
Write-Host "后端已启动在 http://localhost:8080" -ForegroundColor Green
Write-Host "可以在浏览器中访问：http://localhost:8080" -ForegroundColor Green
