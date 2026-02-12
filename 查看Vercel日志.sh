#!/bin/bash
# 安装Vercel CLI并查看日志

echo "正在安装Vercel CLI..."
npm install -g vercel

echo "登录Vercel..."
vercel login

echo "查看最近的日志..."
vercel logs content-factory --follow

# 或者查看特定时间范围的日志
# vercel logs content-factory --since 1h
