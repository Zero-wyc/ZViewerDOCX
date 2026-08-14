# 项目结构

## 目录概览

```
ZViewer/
├── backend/              # Express 后端（TypeScript + TypeORM + sql.js）
├── frontend/             # React 前端（Vite + Tailwind CSS）
├── scripts/              # 构建 / 证书 / 启动工具脚本
├── docker/               # Docker 入口脚本
├── packaging/            # 启动脚本模板
├── dist/                 # 构建产物（单文件可执行程序）
├── config/               # 运行时配置（自动生成）
├── log/                  # 运行时日志
├── package.json          # 根 package.json（workspaces 配置）
├── build-all.js          # 全量编译脚本
├── start-prod.bat        # 启动脚本（Windows）
└── start-prod.sh         # 启动脚本（Linux/macOS）
```