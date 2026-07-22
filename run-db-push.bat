@echo off
cd monorepo
npx drizzle-kit push > "%USERPROFILE%\push-result.txt" 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> "%USERPROFILE%\push-result.txt"
