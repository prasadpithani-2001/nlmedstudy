#!/usr/bin/env sh
set -e
cd frontend && npm install && npm run build && cd ..
mvn spring-boot:run
