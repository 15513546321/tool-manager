@echo off
echo 测试IP白名单功能...
echo.

REM 检查配置文件
echo 检查配置文件 config\whiteList.txt...
if exist config\whiteList.txt (
    echo ✓ 配置文件存在
    echo 配置文件内容：
    type config\whiteList.txt
) else (
    echo ✗ 配置文件不存在
)

echo.
echo 测试访问：
echo 1. 使用浏览器访问 http://localhost:8080
echo 2. 检查是否显示"您无权限访问！"页面
echo 3. 将你的IP添加到 config\whiteList.txt 文件中
echo 4. 重新访问页面，应该可以正常访问

echo.
echo 当前白名单配置：
for /f "tokens=*" %%i in ('type config\whiteList.txt 2^>nul ^| findstr /v "^#" ^| findstr /v "^$"') do (
    echo   - %%i
)

echo.
echo 提示：如果配置文件为空或只有注释，IP白名单功能将不会启用
pause