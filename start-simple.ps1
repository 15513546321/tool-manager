#!/usr/bin/env powershell
# Tool Manager 后端一键启动 - 无需安装 Maven/Gradle！

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Tool Manager 后端启动（自动下载依赖）" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Java
Write-Host "检查 Java 版本..." -ForegroundColor Yellow
java -version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 错误：未找到 Java，请先安装 Java 11+" -ForegroundColor Red
    Write-Host "下载地址：https://adoptium.net/" -ForegroundColor Gray
    exit 1
}
Write-Host "✅ Java 已安装" -ForegroundColor Green
Write-Host ""

$backendPath = ".\backend"
if (!(Test-Path $backendPath)) {
    Write-Host "❌ 错误：未找到 backend 目录" -ForegroundColor Red
    exit 1
}

Write-Host "📦 准备启动后端应用..." -ForegroundColor Cyan
Write-Host "首次启动会自动下载 Gradle 和依赖（需要网络，可能需要 1-3 分钟）" -ForegroundColor Yellow
Write-Host ""

Set-Location $backendPath

# 使用 gradlew（Gradle Wrapper）
if (Test-Path "gradlew.bat") {
    Write-Host "🚀 启动后端（使用 Gradle Wrapper）..." -ForegroundColor Green
    .\gradlew.bat bootRun --no-build-cache
} elseif (Test-Path "gradlew") {
    Write-Host "🚀 启动后端（使用 Gradle Wrapper）..." -ForegroundColor Green
    .\gradlew bootRun --no-build-cache
} else {
    Write-Host "❌ 未找到 Gradle Wrapper" -ForegroundColor Red
    Write-Host ""
    Write-Host "请选择以下方式之一：" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. 安装 Maven (推荐)" -ForegroundColor Cyan
    Write-Host "   下载：https://maven.apache.org/download.cgi" -ForegroundColor Gray
    Write-Host "   后运行：mvn clean spring-boot:run" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. 安装 Gradle" -ForegroundColor Cyan
    Write-Host "   下载：https://gradle.org/releases/" -ForegroundColor Gray
    Write-Host "   后运行：gradle bootRun" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. 使用 IDE（IntelliJ IDEA 或 Eclipse）" -ForegroundColor Cyan
    Write-Host "   导入 backend 文件夹作为 Maven/Gradle 项目并运行" -ForegroundColor Gray
    Write-Host ""
    exit 1
}
