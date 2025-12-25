@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ======================================
echo   Tool Manager 一键编译部署脚本
echo ======================================
echo.

REM 设置项目根目录
set PROJECT_ROOT=G:\vsCodeWorkSpace\tool-manager
cd /d %PROJECT_ROOT%

REM ======== 第一步：前端编译 ========
echo [1/4] 正在编译前端代码...
echo ======================================
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ❌ 前端编译失败！
    pause
    exit /b 1
)
echo ✅ 前端编译成功！
echo.

REM ======== 第二步：清理和复制静态文件 ========
echo [2/4] 正在处理静态文件...
echo ======================================

set STATIC_DIR=%PROJECT_ROOT%\backend\src\main\resources\static
set DIST_DIR=%PROJECT_ROOT%\dist

REM 检查 dist 目录是否存在
if not exist "%DIST_DIR%" (
    echo ❌ dist 目录不存在！
    pause
    exit /b 1
)

REM 清理旧文件（保留目录结构）
echo 清理旧的静态文件...
if exist "%STATIC_DIR%\assets" (
    rd /s /q "%STATIC_DIR%\assets"
)
if exist "%STATIC_DIR%\index.html" (
    del /q "%STATIC_DIR%\index.html"
)

REM 复制新文件
echo 复制新的静态文件...
xcopy "%DIST_DIR%\*" "%STATIC_DIR%\" /E /I /Y >nul
if %errorlevel% neq 0 (
    echo ❌ 文件复制失败！
    pause
    exit /b 1
)
echo ✅ 静态文件处理完成！
echo.

REM ======== 第三步：后端编译和打包 ========
echo [3/4] 正在编译后端代码...
echo ======================================

cd /d %PROJECT_ROOT%\backend

echo 执行 Maven clean...
call mvn clean
if %errorlevel% neq 0 (
    echo ❌ Maven clean 失败！
    pause
    exit /b 1
)

echo.
echo 执行 Maven compile...
call mvn compile -DskipTests
if %errorlevel% neq 0 (
    echo ❌ Maven compile 失败！
    pause
    exit /b 1
)

echo.
echo 执行 Maven package...
call mvn package -DskipTests
if %errorlevel% neq 0 (
    echo ❌ Maven package 失败！
    pause
    exit /b 1
)
echo ✅ 后端编译成功！
echo.

REM ======== 第四步：复制 JAR 到桌面 ========
echo [4/4] 正在复制 JAR 文件到桌面...
echo ======================================

set JAR_SOURCE=%PROJECT_ROOT%\backend\target\tool-manager-backend-1.0.0.jar
set DESKTOP=%USERPROFILE%\Desktop
set JAR_DEST=%DESKTOP%\tool-manager-backend-1.0.0.jar

if not exist "%JAR_SOURCE%" (
    echo ❌ JAR 文件不存在：%JAR_SOURCE%
    pause
    exit /b 1
)

REM 如果目标文件已存在，删除它
if exist "%JAR_DEST%" (
    del /q "%JAR_DEST%"
)

REM 复制文件
copy "%JAR_SOURCE%" "%JAR_DEST%" >nul
if %errorlevel% neq 0 (
    echo ❌ JAR 文件复制失败！
    pause
    exit /b 1
)
echo ✅ JAR 文件已复制到桌面！
echo 路径：%JAR_DEST%
echo.

REM ======== 完成 ========
echo.
echo ======================================
echo   ✅ 所有操作完成！
echo ======================================
echo.
echo 前端编译：✅
echo 静态文件处理：✅
echo 后端编译：✅
echo JAR 文件已在桌面：✅
echo.
echo 文件位置：%JAR_DEST%
echo.
pause
