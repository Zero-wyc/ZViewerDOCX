---
title: 用户与权限
description: 四层权限模型与用户审核机制
---

# 用户与权限

## 四层权限模型

| 角色 | 说明 | 权限 |
| --- | --- | --- |
| `root` | 超级管理员 | 创建/控制/删除任意房间，审核用户，修改角色，管理后台 |
| `admin` | 管理员 | 创建房间并完全控制自己的房间，不能删除他人房间 |
| `user` | 普通用户 | 加入房间观看、发送评论与弹幕，无法创建房间 |
| `guest` | 游客 | 加入房间观看、发送评论与弹幕，无法创建房间 |

## 注册与审核流程

1. 新用户注册后角色为 `guest`，状态为 **`pending`**（待审核）。
2. 仅 `root` 可在管理后台「用户」标签页审核通过用户（`approve`）。
3. 审核通过后用户升级为 `user`，获得观看与互动权限。

### 注册模式

系统支持三种注册模式（见 [系统设置](/admin/settings)）：

| 模式 | 行为 |
| --- | --- |
| `open` | 开放注册，任何人可注册 |
| `approval` | 注册后需管理员审核（默认） |
| `closed` | 关闭注册 |

## 用户管理操作

| 操作 | 接口 | 权限 |
| --- | --- | --- |
| 用户列表 | `GET /api/admin/users` | admin+ |
| 修改角色 | `PATCH /api/admin/users/:id/role` | **root** |
| 审核通过 | `POST /api/admin/users/:id/approve` | **root** |
| 删除用户 | `DELETE /api/admin/users/:id` | admin+ |
| 更新用户 | `PATCH /api/admin/users/:id` | admin+ |

## 房间管理操作

| 操作 | 接口 |
| --- | --- |
| 房间列表 | `GET /api/admin/rooms` |
| 强制关闭房间 | `DELETE /api/admin/rooms/:roomId` |
| 批量删除房间 | `POST /api/admin/rooms/batch-delete` |
| 删除全部房间 | `POST /api/admin/rooms/delete-all` |
| 清理无用房间 | `POST /api/admin/rooms/cleanup-unused` |

## 权限校验实现

- 后端中间件：`authenticateToken`（JWT + cookie 解析）、`requireRoot`（root 专用接口）。
- 管理路由校验：`adminOnly`（root/admin）+ `rootOnly`（root）组合，见 `backend/src/routes/admin.ts`。
- 房间控制权校验：`canControlRoom`（root 或房主本人）。
- 前端守卫：`RequireAuth` 组件（`frontend/src/components/RequireAuth.tsx`）。

> 若你忘记 root 密码，参见 [常见问题](/guide/faq)。
