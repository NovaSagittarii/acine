@ECHO OFF

:: run together; https://stackoverflow.com/a/33586872
(
    start "Acine frontend" frontend\start.bat
    start "Acine testing environment" testenv\start.bat
    start "Acine backend" backend\start.bat
) | set /P "="
