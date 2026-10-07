@echo off
rem Rebuilds css/style.min.css and js/script.min.js from the files you edit.
rem Double-click this before every deploy.
cd /d "%~dp0"
call npx --yes esbuild css/style.css --minify --outfile=css/style.min.css
call npx --yes esbuild js/script.js --minify --outfile=js/script.min.js
echo.
echo Done. Minified files are up to date.
pause
