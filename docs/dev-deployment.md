# GridProject Dev Deployment

目标：部署 `0.1.0-dev.1` 到 `gridproject_dev` 进行内部用户测试。

本说明只适用于 Dev 环境。不要连接服务器 Prod 数据库，不要录入真实敏感数据，不要在文档、代码或日志中写入真实密码。

## 1. 拉取代码

```bash
git pull --ff-only origin main
```

## 2. 安装依赖

```bash
npm ci
pnpm --dir server install --frozen-lockfile
```

## 3. 配置 `server/.env`

从示例文件复制并填写 Dev 环境变量：

```bash
cp server/.env.example server/.env
```

必须配置：

```text
NODE_ENV=development
APP_VERSION=0.1.0-dev.1
DATABASE_URL=postgresql://gridproject_app:REPLACE_WITH_DEV_PASSWORD@127.0.0.1:5432/gridproject_dev?schema=public
SESSION_SECRET=REPLACE_WITH_DEV_SESSION_SECRET
FRONTEND_ORIGIN=http://127.0.0.1:5173
ADMIN_EMAIL=admin@example.test
ADMIN_PASSWORD=REPLACE_WITH_INITIAL_ADMIN_PASSWORD
ADMIN_DISPLAY_NAME=GridProject Admin
INITIAL_ORGANIZATION_NAME=GridProject Dev
```

`ADMIN_PASSWORD` 只在部署环境中设置，不要提交到 Git，不要写入文档或聊天记录。管理员登录后，通过人员管理页面创建一个 Project Owner 测试账号和一个普通 MEMBER 测试账号。

## 4. 检查数据库地址

```bash
npm run db:safety:dev
```

该检查必须确认：

- `DATABASE_URL` 指向 `127.0.0.1:5432/gridproject_dev`
- `NODE_ENV` 不是 `production`
- 数据库名称不是 `gridproject_prod`
- 端口不是 `5433`

如果发现生产数据库特征，脚本会立即终止。

## 5. 执行发布检查

```bash
npm run release:check
```

该脚本会依次执行前端 lint、前端 test、前端 build、后端 lint、后端 test、后端 build、Prisma validate、Prisma generate、Migration 状态检查、`.env` 和 Secret 跟踪检查。任一环节失败都会返回非零退出码。

首次空库部署时，Migration 状态检查可能提示存在未应用迁移；此时先执行下一步 `migrate deploy`，Seed 后必须再次执行 `npm run release:check`，确认最终状态通过。

## 6. 执行 Prisma Migration

Dev 部署只允许执行：

```bash
npm run db:migrate:deploy:dev
```

禁止在 Dev 部署中执行：

```text
prisma migrate dev
prisma migrate reset
prisma db push
```

## 7. 执行幂等 Seed

```bash
npm run server:prisma:seed
```

建议部署时连续执行两次，确认 Seed 幂等：

```bash
npm run server:prisma:seed
npm run server:prisma:seed
```

重复 Seed 不应产生重复 Organization、ADMIN、角色、权限或成员关系。当前版本 Seed 创建初始 Organization 和 ADMIN；角色、权限、成员关系模型尚未拆分。

## 8. 构建前端和后端

```bash
npm run build
npm run server:build
```

## 9. 启动 Fastify

临时验证：

```bash
pnpm --dir server run start
```

建议用 systemd 管理长期进程。

## 10. systemd 示例

```ini
[Unit]
Description=GridProject Dev API
After=network.target

[Service]
WorkingDirectory=/opt/gridproject/server
EnvironmentFile=/opt/gridproject/server/.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5
User=gridproject

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable gridproject-dev
sudo systemctl restart gridproject-dev
sudo systemctl status gridproject-dev
```

## 11. Nginx `/api` 代理

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:3000/api/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

重新加载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 12. 健康检查

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

期望返回：

```json
{
  "status": "ok",
  "version": "0.1.0-dev.1",
  "environment": "development"
}
```

响应中不得包含 Secret、数据库地址或服务器信息。

## 13. 登录验证

使用 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 登录 Dev 页面。登录成功后，通过人员管理页面创建：

- 一个 Project Owner 测试账号
- 一个普通 MEMBER 测试账号

不要在文档、Issue、截图或聊天记录中暴露真实密码。

## 14. 回滚方式

代码回滚：

```bash
git log --oneline -5
git checkout <previous_commit_sha>
npm ci
pnpm --dir server install --frozen-lockfile
npm run build
npm run server:build
sudo systemctl restart gridproject-dev
```

数据库回滚策略：

- Prisma 已应用迁移不使用 `migrate reset` 或 `db push` 回滚。
- 如迁移已部署且需回滚，优先切回旧代码并由 DBA 基于备份或人工回滚脚本处理。
- Dev 测试数据可在测试结束后按测试计划清理。

## 15. 测试数据规则

Dev 用户测试只允许使用虚拟人员姓名、测试邮箱、测试项目、测试工时和非敏感描述。

禁止录入真实工资、真实人员成本、客户敏感数据、生产账号密码、生产项目数据、真实合同或财务信息。
