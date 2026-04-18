# Multi-Modal Chat

多模态聊天应用框架，支持文本、图像、语音等多种输入模式。

## 快速开始 (Phase 0)

### 前置要求
- Docker & Docker Compose
- OpenAI API Key

### 启动

```bash
# 设置 API Key
export OPENAI_API_KEY=your_api_key_here

# 一键启动
docker-compose up -d

# 访问前端
open http://localhost:3000
```

### TTHW (Time to Hello World)
约 90 秒

## 开发模式

### 后端
```bash
cd backend
pip install -e .
uvicorn app.main:app --reload --port 8000
```

### 前端
```bash
cd frontend
npm install
npm run dev
```

## 技术栈

- **前端**: React + Vite + Ant Design X
- **后端**: Python + FastAPI + LangChain + LangGraph
- **部署**: Docker + Docker Compose

## 项目结构

```
├── backend/           # 后端服务
│   ├── app/
│   │   └── main.py   # FastAPI 入口
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/          # 前端服务
│   ├── src/
│   │   ├── App.tsx   # 主应用组件
│   │   └── main.tsx  # 入口文件
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
└── docker-compose.yml  # 容器编排
```
