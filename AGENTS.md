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

## 本次要实现的功能范围 / 任务项（2026-03-27 第十一轮）

1. 重做手机端 `Token` 页面布局，优先保证 `430px` 左右宽度下不出现横向滚动；手机端改为卡片 / 栈式信息展示，减少次要信息占位。
2. 重做手机端 `日志审计` 页面布局，将表格改为更适合小屏阅读的紧凑日志卡片展示，避免多列挤压与横向滚动依赖。
3. 保持桌面端现有交互不受影响，同时继续保留 Token Key 脱敏显示与完整复制逻辑。
4. 同步更新 `README.md` 与 `AGENTS.md`，明确新的移动端策略与本地编译 / VPS 先测后推流程。

## 本次任务完成情况（2026-03-27 第十一轮）

- [x] 手机端 Token 页面已改为无横向滚动的紧凑布局。
- [x] 手机端日志页面已改为优先可读、减少次要列的紧凑布局。
- [x] 已同步更新 README / AGENTS 说明。
- [x] 已完成本地编译验证，必要时可先部署 VPS 验证后再决定是否推送远端。

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

1. 本地已安装 Go，优先执行本地 `go build` / `go test`（如可运行）做基础验证。
2. 涉及 UI 或部署相关改动时，可先本地编译，再上传或直传到 VPS 覆盖测试。
3. VPS 验证通过后，再决定是否提交并推送远端仓库。
4. GitHub Actions 继续作为最终多平台构建与补充验证手段。

## 推送部署约定（Windows 本地 + VPS）

1. 本地已安装 Go 时，优先本地编译 Linux 二进制并直接上传 VPS 测试。
2. 若本地不便交叉编译或需要正式产物，再使用 GitHub Actions 产物部署。
3. 本地通过 SSH 直连目标服务器（Git Bash 下 SSH 别名存在中文路径编码问题，必须用绝对路径）。
4. **过程性文件统一放在 `/tmp`**（上传、解压、临时日志）。
5. 最终二进制路径固定为：`/opt/newapi-modern-dashboard/newapi-modern-dashboard`。
6. systemd 服务名固定为：`newapi-modern-dashboard`。
7. 部署约定监听端口：`12002`（程序内置默认仍为 `:8099`，部署时按需通过 `-addr` 覆盖）。
8. 建议流程：`本地改动 -> 本地编译 -> VPS 覆盖验证 -> 确认无误后再 commit/push`。
9. 支持使用产物直链在 VPS 远端直接下载并部署（无需本地中转上传）。

### SSH 连接参数

```bash
SSH_KEY="C:/Users/YZM-一只猫/.ssh/id_ed25519"
SSH_PORT=10860
SSH_HOST=root@204.197.163.238
```

### 标准推送部署命令（本地 scp 上传后安装）

```bash
ZIP="newapi-modern-dashboard-linux-amd64.zip"
scp -i "C:/Users/YZM-一只猫/.ssh/id_ed25519" -P 10860 "$ZIP" root@204.197.163.238:/tmp/
ssh -i "C:/Users/YZM-一只猫/.ssh/id_ed25519" -p 10860 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@204.197.163.238 "set -e
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
ssh -i "C:/Users/YZM-一只猫/.ssh/id_ed25519" -p 10860 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@204.197.163.238 "set -e
curl -fL '$ARTIFACT_URL' -o /tmp/newapi-modern-dashboard-linux-amd64.zip
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
5. Token Key 默认脱敏显示，支持前端显示/隐藏切换，复制时仍使用完整 Key。
6. 移动端布局采用 `768px` 与 `480px` 双断点响应式优化；其中 Token / 日志列表在手机端优先切换为卡片 / 栈式布局，避免依赖横向滚动。

## 安全与稳定性

1. BaseURL 仅允许 `http`/`https`。
2. 禁止代理到非法 URL（基础校验）。
3. 反向代理错误返回明确 JSON 错误信息。
4. 前端输入做基础校验，避免空请求。

## 交付标准

1. `go build` 后得到可直接运行的二进制。
2. 打开页面即可完成配置、登录、Token 管理、Log 查看。
3. GitHub Actions 可生成 Linux/Windows/macOS 多平台构建产物。
