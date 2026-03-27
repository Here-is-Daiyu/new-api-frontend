# New API 现代化轻量前端

一个面向 **New API** 的轻量管理前端，采用 **Go 单二进制 + 原生 HTML/CSS/JavaScript** 实现，无需 Node.js 构建环境，适合部署在资源受限的 VPS。

所有浏览器请求统一通过本地 `/proxy` 转发到目标 New API，避免跨域、Cookie 与会话问题。

## 功能特性

- **单二进制部署**：后端与静态资源一体化打包，部署简单，依赖极少。
- **自定义 BaseURL**：支持前端输入并持久化保存，便于切换不同 New API 实例。
- **账号登录**：支持邮箱/用户名 + 密码登录，并获取当前用户信息。
- **Token 管理**：支持列表、搜索、分页、创建、编辑、启用/禁用与删除。
- **Token Key 脱敏显示**：前端默认仅显示前缀（长度 `<= 12` 显示前 4 位，否则显示前 8 位）+ `****`，可点击眼睛图标切换显示/隐藏。
- **模型拉取**：支持按选中 API Key 鉴权获取模型列表，兼容公开访问与多 Token 场景。
- **日志审计**：支持日志列表、统计信息、基础筛选、动态加载与固定表头浏览。
- **静默刷新**：Token / 模型 / 日志刷新时保留当前内容，响应返回后再整体替换，降低浏览打断感。
- **统一加载交互**：刷新按钮保留原文案或图标，仅在按钮旁显示 spinner，并自动防止重复并发点击。
- **主题与移动端适配**：默认暗色模式，支持手动切换；移动端采用 `768px` + `480px` 双断点响应式设计。
- **主题底色层级统一**：页面统一按 `body / 主面板 / 次级表面` 三层背景变量渲染，顶部导航、登录卡片、筛选区、统计卡片、加载提示与移动端 Token / 日志卡片内部模块在 light / dark theme 下保持一致。
- **手机端紧凑布局**：`Token` 页面在手机端自动切换为卡片 / 栈式信息展示，`日志审计` 页面自动切换为紧凑日志卡片，优先避免横向滚动；桌面端继续保留原有表格交互。

## 技术栈

- **后端**：Go 标准库
- **前端**：原生 HTML / CSS / JavaScript
- **静态资源嵌入**：`go:embed`
- **交付方式**：单二进制直接运行

## 项目结构

```text
.
├── .github/
│   └── workflows/
│       └── build.yml
├── main.go
├── go.mod
├── Makefile
├── web/
│   ├── index.html
│   ├── app.js
│   └── style.css
└── README.md
```

## 本地运行

本地已安装 Go 时，建议优先在本机执行 `go build`（必要时再补 `go test`）做基础验证，通过后再考虑上传 VPS 覆盖测试或推送远端。

涉及 UI 样式调整时，建议按 `本地修改 -> 本地 go build -> 浏览器切换 light / dark theme + 桌面 / 约 430px 视口复查` 的顺序完成自测，再决定是否部署到 VPS。

### 1. 编译

```bash
go build -o newapi-modern-dashboard .
```

### 2. 启动

```bash
./newapi-modern-dashboard -addr :8099
```

可选启动参数：

- `-addr`：监听地址，默认 `:8099`
- `-base-url`：默认 New API 地址，可被前端配置覆盖

也可通过环境变量配置：

- `ADDR`
- `BASE_URL`

示例：

```bash
BASE_URL="https://your-newapi.example.com" ./newapi-modern-dashboard
```

### 3. 访问

```text
http://127.0.0.1:8099
```

## VPS 部署建议

- 建议流程：`本地改动 -> 本地 go build 验证 -> 视需要上传 VPS 覆盖测试 -> 确认无误后再决定是否提交 / 推送`。
- 优先使用 **GitHub Actions** 生成的 Linux 对应架构产物进行部署。
- 推荐将过程性文件放在 `/tmp`，最终二进制安装到：

  ```text
  /opt/newapi-modern-dashboard/newapi-modern-dashboard
  ```

- 建议使用 systemd 守护，服务名统一为：`newapi-modern-dashboard`
- 部署约定端口建议使用：`12002`（程序内置默认仍为 `:8099`，可通过 `-addr` 覆盖）
- 部署完成后，建议检查：

  ```bash
  systemctl status newapi-modern-dashboard
  curl -fsS http://127.0.0.1:12002/healthz
  ```

## API 对接说明

前端所有请求均通过本地 `/proxy` 转发，并携带 `credentials: "include"`。当前已对接接口如下：

- `POST /api/user/login`
- `GET /api/user/self`
- `GET /api/token/?p=1&page_size=10`
- `PUT /api/token/`
- `POST /api/token/`
- `DELETE /api/token/:id`
- `GET /api/log/self`
- `GET /api/log/self/stat`
- `GET /api/user/self/groups`（日志分组候选，优先）
- `GET /api/user/groups`（日志分组候选，兼容回退）
- `GET /api/group/`（管理员分组接口，末级回退）

## GitHub Actions 自动编译

项目内置工作流：`.github/workflows/build.yml`

- CI 会先执行基础校验：`go test ./...`
- 随后进行多平台交叉编译
- 支持平台：Linux / Windows / macOS（amd64、arm64）
- 构建产物会上传为 Actions Artifacts
- 当推送 `v*` 标签时，会自动发布 Release 产物

如果本地没有 Go 环境，可直接在 GitHub Actions 中获取编译产物并部署到 VPS。

## 安全说明

- BaseURL 仅允许 `http` / `https`
- 代理层会拒绝非法目标地址，并返回标准 JSON 错误信息
- 前端会进行基础输入校验，避免空请求或无效请求
- Token Key 默认脱敏显示，降低界面误暴露风险
- 统一走本地 `/proxy`，减少浏览器侧跨域与 Cookie 会话问题

## 使用注意事项

- 若目标服务要求鉴权访问模型接口，请先在“可用模型”面板选择可用 API Key。
- 首次进入模型面板时，系统会自动选中首个可用 Token；你仍可手动切换为“公开访问”或其他 Token。
- Token Key 默认脱敏显示；长度 `<= 12` 显示前 4 位，否则显示前 8 位，复制操作始终使用完整值。
- 手机端 `Token` / `日志审计` 列表会自动切换为紧凑卡片布局，优先保证约 `430px` 宽度下无需依赖横向滚动查看核心信息。
- 页面背景统一遵循 `body / 主面板 / 次级表面` 层级；若后续继续调整样式，顶部导航、筛选区、统计卡片、加载提示与移动端卡片内部信息块应继续复用同一套主题变量，避免新增硬编码底色。
- Token / 模型 / 日志刷新会保留当前列表与滚动位置，待新数据返回后再更新。
- 日志时间筛选支持常见日期时间文本、10 位秒时间戳、13 位毫秒时间戳，以及连续数字自动补全。
- 日志分组会优先尝试从用户可用分组接口读取；若无可选项，会显示提示文案或回退到兼容接口。
- `/favicon.png` 由本地服务端透传获取，避免浏览器直接跨域访问远端资源。
