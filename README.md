# New API 现代化轻量前端

一个为 **New API** 设计的现代化管理前端，目标是：

- 单二进制部署
- 低内存占用
- 无 Node.js 构建依赖
- 适合资源受限 VPS

> 所有请求统一通过本地 `/proxy` 转发到目标 New API，避免浏览器跨域与 Cookie 会话问题。

## 功能

- ✅ 自定义 BaseURL（前端输入并持久化）
- ✅ 用户名/邮箱 + 密码登录
- ✅ Token（API Key）查看、编辑、修改、删除
- ✅ Token Key 完整显示
- ✅ 模型列表拉取支持已选 API Key 鉴权（存在可用 Token 时默认选中首个可用 Key，仍可手动切换）
- ✅ `/favicon.png` 通过本地 VPS 透传获取（不再前端直连远端）
- ✅ 用户日志查看与基础筛选（动态加载 + 无限滚动，筛选后自动回到顶部并重新加载）
- ✅ 顶部用户信息“额度”显示为 `quota / 500000`（保留两位小数）
- ✅ 日志统计“总消耗”显示为 `quota / 500000`（保留两位小数），并继续展示 RPM / TPM
- ✅ 日志审计 Tab 在未打开时后台预拉取第一页，提升首次打开速度
- ✅ 日志模型下拉在“全部 Token”场景由 VPS 聚合拉取各 Token 模型并去重返回
- ✅ 模型/日志筛选下拉框长文本优化（中间省略 + 原文提示）
- ✅ 模型面板与日志筛选关键下拉改为前端自绘下拉（不使用原生 select 渲染）
- ✅ Token 面板页大小下拉改为前端自绘，修复原生 select 箭头重影问题
- ✅ 新建/编辑 Token 状态改为前端自绘下拉（与日志审计下拉统一样式）
- ✅ 新建/编辑 Token 过期时间改为纯手动输入（移除日期选择器，支持自动补全日期时间格式）
- ✅ 日志审计开始/结束时间改为文本输入（支持自动补全格式，兼容常见日期时间文本与时间戳）
- ✅ 日志审计模型筛选改为前端自绘下拉（按 Token 动态刷新候选）
- ✅ 日志审计分组支持动态下拉（优先读取用户可用分组，无可选项时展示提示）
- ✅ 日志审计表格表头固定（滚动数据区时表头不跟随移动）
- ✅ 日志审计耗时改为“总耗时 - 首字耗时”，新增“输出速率”（输出 / 调整后耗时），并将 Prompt/Completion 重命名为输入/输出
- ✅ 默认暗色模式 + 手动切换亮暗主题

## 技术栈

- 后端：Go（标准库）
- 前端：原生 HTML/CSS/JS
- 静态资源：`go:embed` 内嵌

## 项目结构

```text
.
├── AGENTS.md
├── main.go
├── go.mod
├── web/
│   ├── index.html
│   ├── app.js
│   └── style.css
└── .github/workflows/build.yml
```

## 本地运行

### 1) 编译

```bash
go build -o newapi-modern-dashboard .
```

### 2) 启动

```bash
./newapi-modern-dashboard -addr :8099
```

可选参数：

- `-addr`：监听地址（默认 `:8099`）
- `-base-url`：默认 New API 地址（可被前端输入覆盖）

也可通过环境变量：

- `ADDR`
- `BASE_URL`

示例：

```bash
BASE_URL="https://your-newapi.example.com" ./newapi-modern-dashboard
```

### 3) 访问

打开浏览器：

```text
http://127.0.0.1:8099
```

## VPS 部署建议

1. 在本地或 CI 编译 Linux 二进制
2. 上传到 VPS（如 `/opt/newapi-modern-dashboard/`）
3. 直接运行或配合 systemd 守护

示例（前台运行）：

```bash
./newapi-modern-dashboard -addr :8099 -base-url "https://your-newapi.example.com"
```

## 使用注意事项

- 若目标服务要求鉴权访问模型接口，请在“可用模型”面板选择可用 API Key 后再拉取模型列表。
- 系统会在首次进入模型面板时，自动选择首个可用 Token（状态为启用）作为默认 API Key。
- 你仍可手动切换为“公开访问”或其他 Token，系统会保留你的手动选择。
- favicon 由本地服务端透传 `/favicon.png` 获取，避免浏览器侧跨域或直连问题。
- 日志审计模型下拉在“全部 Token”时由后端聚合多 Token 模型并去重，网络延迟较高时首次加载可能略慢。
- 日志模型筛选已改为前端自绘下拉，不再使用浏览器原生 `datalist` 弹层，避免遮挡主视图。
- Token 新建/编辑中的状态下拉已改为前端自绘组件，样式与日志审计下拉保持一致。
- Token 过期时间与日志时间筛选支持连续数字自动补全（如 `20260224130000` 自动整理为 `2026-02-24 13:00:00`）。
- 日志时间筛选仍支持 `2026-02-24 13:00:00`、`2026-02-24T13:00`、10位秒时间戳与13位毫秒时间戳。
- 日志分组会优先尝试从 BaseURL 拉取可选项（`/api/user/self/groups` 等），若无可选分组会展示提示文案。
- Token 页大小下拉已改为前端自绘，避免浏览器原生 `select` 箭头重复/重影。
- 模型与日志筛选下拉框对超长文本会做中间省略显示，鼠标悬停可查看完整文本。
- 下拉框已改为前端自绘，亮色/暗色模式样式保持一致，避免浏览器原生 `select` 在亮色模式下的错位与重影问题。
- 日志表格已启用固定表头，长列表滚动时可持续看到列标题。
- 日志“耗时”显示值为 `use_time - frt`（`frt` 按毫秒换算为秒后参与计算），`输出速率 = 输出 token / 更改后耗时`，展示单位为 `token/s`；当更改后耗时 `<= 0` 时输出速率显示 `-`。

## API 对接说明（已按 New API 源码确认）

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

已提供 workflow：`.github/workflows/build.yml`。

CI 会先执行基础校验（`go test ./...`），再进行多平台交叉编译。

支持构建：

- Linux amd64 / arm64
- Windows amd64 / arm64
- macOS amd64 / arm64

构建产物会作为 Actions Artifacts 上传，可直接下载部署。

## 无本地 Go 环境的使用方式（推荐）

如果本地没有 Go 环境，可以完全依赖 GitHub Actions：

1. 推送代码到 GitHub 仓库。
2. 打开 `Actions` 页面并等待 `build-binaries` 工作流完成。
3. 在对应运行记录的 `Artifacts` 下载目标平台二进制。
4. 上传到 VPS 后直接运行。

## 资源占用（参考）

- 二进制大小：约几 MB（视 Go 版本而定）
- 内存占用：通常十几 MB 内

## 安全说明

- BaseURL 仅允许 `http` / `https`
- 代理层会返回标准 JSON 错误信息
- 前端对输入做基础校验
