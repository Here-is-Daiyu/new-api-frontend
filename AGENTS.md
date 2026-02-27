# AGENTS.md

## 项目目标

构建一个可在资源受限 VPS 上运行的 New API 现代化前端管理程序，要求单二进制部署、低内存占用、低依赖。

## 核心约束

1. **先保证可运行，再追求复杂特性**（KISS）。
2. **避免引入重型依赖**，优先使用 Go 标准库与原生前端能力。
3. **仅实现当前需求功能**（YAGNI）。
4. **统一 API 访问层**，避免重复请求逻辑（DRY）。
5. **所有** API 请求都通过本地 `/proxy` 反向代理，避免浏览器跨域与 Cookie 问题。
6. 涉及 New API 字段来源或行为判断时，先在仓库源码中搜索，并在回复里明确告知对应文件路径与结论（“要在仓库里搜告诉我”）。
7. 每次开始实现功能前，先更新 `AGENTS.md` 明确“本次要实现的功能范围/任务项”。
8. 每次功能实现完成后，及时更新 `README.md`（运行方式、功能说明、已支持能力与注意事项）和 `AGENTS.md`。
9. 每次完成修改后，先查看 `view_diff` 再提供建议 commit message 写中文 要body（仅提供文案，不执行 git commit/push）。

## 本次要实现的功能范围 / 任务项（2026-02-27 第六轮）

1. 新建/编辑 Token 的“状态”字段改为前端自绘下拉，样式与日志审计下拉一致。
2. 新建/编辑 Token 的“过期时间”移除日期选择器，仅保留手动输入，并自动补全日期时间格式。
3. 日志审计“开始时间/结束时间”输入改为同款自动补全日期时间格式。

## 本次任务完成情况（2026-02-27 第六轮）

- [x] 新建/编辑 Token 的“状态”字段改为前端自绘下拉，样式与日志审计下拉一致。
- [x] 新建/编辑 Token 的“过期时间”移除日期选择器，仅保留手动输入，并自动补全日期时间格式。
- [x] 日志审计“开始时间/结束时间”输入改为同款自动补全日期时间格式。
- [x] 同步更新 README 与 AGENTS 文档说明。

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

## 测试约定

- 本地没装环境，全部测试用 GitHub Action 进行。

## 推送部署约定（Windows 本地 + VPS）

1. 使用 GitHub Actions 产物进行部署，优先使用 Linux 对应架构压缩包。
2. 本地通过 SSH 别名 `vps` 连接目标服务器。
3. **过程性文件统一放在 `/tmp`**（上传、解压、临时日志）。
4. 最终二进制路径固定为：`/opt/newapi-modern-dashboard/newapi-modern-dashboard`。
5. systemd 服务名固定为：`newapi-modern-dashboard`。
6. 当前默认监听端口：`12002`。
7. 支持使用产物直链在 VPS 远端直接下载并部署（无需本地中转上传）。

### 标准推送部署命令（覆盖升级）

```powershell
$zip = "newapi-modern-dashboard-linux-amd64.zip"
scp "$zip" "vps:/tmp/"
ssh "vps" "set -e
rm -rf /tmp/newapi-modern-dashboard
mkdir -p /tmp/newapi-modern-dashboard
unzip -o /tmp/newapi-modern-dashboard-linux-amd64.zip -d /tmp/newapi-modern-dashboard >/tmp/newapi-modern-dashboard-unzip.log
install -d /opt/newapi-modern-dashboard
install -m 0755 /tmp/newapi-modern-dashboard/newapi-modern-dashboard-linux-amd64 /opt/newapi-modern-dashboard/newapi-modern-dashboard
systemctl restart newapi-modern-dashboard
systemctl --no-pager --full status newapi-modern-dashboard
curl -fsS http://127.0.0.1:12002/healthz
"
```

### 直链部署命令（VPS 远端下载）

```bash
ARTIFACT_URL="https://example.com/newapi-modern-dashboard-linux-amd64.zip"
ssh "vps" "set -e
curl -fL \"$ARTIFACT_URL\" -o /tmp/newapi-modern-dashboard-linux-amd64.zip
rm -rf /tmp/newapi-modern-dashboard
mkdir -p /tmp/newapi-modern-dashboard
unzip -o /tmp/newapi-modern-dashboard-linux-amd64.zip -d /tmp/newapi-modern-dashboard >/tmp/newapi-modern-dashboard-unzip.log
install -d /opt/newapi-modern-dashboard
install -m 0755 /tmp/newapi-modern-dashboard/newapi-modern-dashboard-linux-amd64 /opt/newapi-modern-dashboard/newapi-modern-dashboard
systemctl restart newapi-modern-dashboard
systemctl --no-pager --full status newapi-modern-dashboard
curl -fsS http://127.0.0.1:12002/healthz
"
```

### 服务状态与日志检查

```bash
systemctl status newapi-modern-dashboard
journalctl -u newapi-modern-dashboard -f
```

## API 对接约定（基于 New API 源码）

- 接口参考（仓库树）：`https://api.github.com/repos/QuantumNous/new-api/git/trees/main?recursive=1`
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
