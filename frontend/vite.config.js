import {defineConfig} from 'vite'; import react from '@vitejs/plugin-react'
// dev: proxy API to Spring Boot. build: output straight into Spring's static folder.
export default defineConfig({plugins:[react()],server:{proxy:{'/api':'http://localhost:8080','/ws':{target:'ws://localhost:8080',ws:true}}},build:{outDir:'../src/main/resources/static',emptyOutDir:true}})
