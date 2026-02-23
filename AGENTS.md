# AGENTS.md

## 项目目标

构建一个可在资源受限 VPS 上运行的 New API 现代化前端管理程序，要求单二进制部署、低内存占用、低依赖。

## 核心约束

1. **先保证可运行，再追求复杂特性**（KISS）。
2. **避免引入重型依赖**，优先使用 Go 标准库与原生前端能力。
3. **仅实现当前需求功能**（YAGNI）。
4. **统一 API 访问层**，避免重复请求逻辑（DRY）。
5. 所有 API 请求都通过本地 `/proxy` 反向代理，避免浏览器跨域与 Cookie 问题。

## 功能范围（本次必须完成）

1. 自定义 BaseURL（支持前端输入并持久化）。
2. 邮箱/用户名 + 密码登录。
3. API Key（Token）信息查看、编辑与修改。
4. Log 查看与基础筛选。
5. GitHub Actions 自动编译多平台二进制产物。

## 技术栈约定

- 后端：Go（标准库，单二进制）。
- 前端：原生 HTML/CSS/JavaScript（不依赖 Node 构建链）。
- 静态资源：`embed` 内嵌到二进制。
- 部署：直接运行可执行文件。

## API 对接约定（基于 New API 源码）

- 登录：`POST /api/user/login`，body:
  - `username`（可填邮箱或用户名）
  - `password`
- 获取当前用户：`GET /api/user/self`
- Token 列表：`GET /api/token/?p=1&page_size=10`
- Token 更新：`PUT /api/token/`
- Token 创建：`POST /api/token/`
- Token 删除：`DELETE /api/token/:id`
- 用户日志：`GET /api/log/self`
- 日志统计：`GET /api/log/self/stat`

## 代码组织约定

- `main.go`：程序入口、配置加载、HTTP 路由注册。
- `web/`：前端静态资源。
- `.github/workflows/`：CI 编译脚本。
- `README.md`：运行、构建、部署说明。

## 前端规范

1. UI 文案使用中文。
2. 默认支持暗色模式，并提供手动切换。
3. 所有请求都带 `credentials: "include"`。
4. 统一请求函数处理错误与 `success/message/data` 响应结构。
5. Token Key 按用户要求完整显示。

## 安全与稳定性

1. BaseURL 仅允许 `http`/`https`。
2. 禁止代理到非法 URL（基础校验）。
3. 反向代理错误返回明确 JSON 错误信息。
4. 前端输入做基础校验，避免空请求。

## 交付标准

1. `go build` 后得到可直接运行的二进制。
2. 打开页面即可完成配置、登录、Token 管理、Log 查看。
3. GitHub Actions 可生成 Linux/Windows/macOS 多平台构建产物。
