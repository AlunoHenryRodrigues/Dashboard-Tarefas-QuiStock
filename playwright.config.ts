import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
export default defineConfig({testDir:'tests',fullyParallel:false,use:{baseURL:'http://127.0.0.1:5174',launchOptions:existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{}},webServer:{command:'node scripts/test-server.mjs',url:'http://127.0.0.1:5174',reuseExistingServer:false},reporter:'list'});
