@echo off
cd frontend
call npm install
call npm run build
cd ..
call mvn spring-boot:run
