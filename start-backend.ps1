#!/usr/bin/env powershell
# Tool Manager 后端启动脚本 - 无需 Maven（使用 Gradle）

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Tool Manager 后端启动（Gradle 版本）" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Java
Write-Host "检查 Java 版本..." -ForegroundColor Yellow
java -version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误：未找到 Java" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "检查 Gradle..." -ForegroundColor Yellow
gradle -version 2>&1 | Select-Object -First 1
if ($LASTEXITCODE -ne 0) {
    Write-Host "警告：未找到 Gradle，尝试使用 gradlew..." -ForegroundColor Yellow
}
Write-Host ""

$backendPath = ".\backend"
if (!(Test-Path $backendPath)) {
    Write-Host "错误：未找到 backend 目录" -ForegroundColor Red
    exit 1
}

Write-Host "准备启动后端应用..." -ForegroundColor Green
Set-Location $backendPath

# 尝试使用 gradle
gradle bootRun -x test
if ($LASTEXITCODE -eq 0) {
    exit 0
}

# 如果 gradle 失败，提示用户安装 Maven 或 Gradle
Write-Host ""
Write-Host "⚠️  无法找到 Maven 或 Gradle" -ForegroundColor Yellow
Write-Host ""
Write-Host "请选择以下任一方式安装：" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  安装 Maven（推荐）" -ForegroundColor White
Write-Host "   下载：https://maven.apache.org/download.cgi" -ForegroundColor Gray
Write-Host "   解压后添加到 PATH，然后运行：" -ForegroundColor Gray
Write-Host "   mvn clean spring-boot:run" -ForegroundColor Gray
Write-Host ""
Write-Host "2️⃣  安装 Gradle" -ForegroundColor White
Write-Host "   下载：https://gradle.org/releases/" -ForegroundColor Gray
Write-Host "   解压后添加到 PATH" -ForegroundColor Gray
Write-Host ""
Write-Host "3️⃣  使用 IntelliJ IDEA/Eclipse 直接运行后端项目" -ForegroundColor White
Write-Host ""
exit 1
