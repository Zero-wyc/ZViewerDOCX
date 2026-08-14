# 本地开发

## 项目结构简览

```
ZViewer/
├── backend/          # Express 后端（TypeScript + TypeORM + sql.js）
├── frontend/         # React 前端（Vite + Tailwind CSS）
├── scripts/          # 工具脚本（证书/构建/启动）
├── docker/           # Docker 入口
├── packaging/        # 启动脚本模板
└── dist/             # 构建产物
```

## 工具脚本

| 脚本 | 说明 |
|------|------|
| `scripts/generate-cert.js` | SSL 证书生成（自签 / Let's Encrypt） |
| `scripts/acme-client.js` | ACME v2 HTTP-01 客户端 |
| `scripts/build-exe.js` | 后端单文件编译 |
| `scripts/start.js` | 跨平台启动转发 |