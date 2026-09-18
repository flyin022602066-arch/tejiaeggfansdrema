# EggFans 视频接口适配设计

## 目标

仅更新 EggFans 的视频生成链路，使其遵循 `https://api.aigcly.top/docs/video.html` 的视频接口格式，并使用新的服务地址：

- 视频调用基址：`https://vip.eggfans.asia`
- 余额查询入口：`https://vip.eggfans.work`

文本和图片 EggFans 适配器、其他视频供应商、现有数据库文件和已保存 AI 配置均保持不变。

## 接口与字段映射

EggFans 视频创建使用 `POST /v1/videos`，任务查询使用 `GET /v1/videos/{taskId}`。配置中的 `base_url` 仍然作为可覆盖项；新建/手动配置的默认提示指向 `https://vip.eggfans.asia`。

### `sd-2.5-A` 模型约束

标准 EggFans 视频配置默认使用且只预置模型调用名 `sd-2.5-A`。提交请求前由前后端共同校验以下约束：

- 时长：整数 `4`–`30` 秒（含边界）；超出范围时阻止提交并显示明确错误，不静默截断。
- 分辨率：固定为 `720p`；前端只展示 `720p`，后端向 EggFans 发送的 `resolution` 始终为 `720p`。
- 参考图片：`image_refs` 最多 `30` 个。
- 参考视频：`video_refs` 最多 `10` 个。
- 参考音频：`audio_refs` 最多 `10` 个。
- 支持首帧与尾帧：分别使用 `first_image`、`last_image`。
- 按接口规则，`first_image`/`last_image` 与 `image_refs`/`video_refs`/`audio_refs` 两种模式不能同时提交；发生冲突时阻止提交并说明应选择“首尾帧”或“多素材参考”模式。

参考图片、视频和音频必须是公网可访问的 HTTPS URL。本地 `static/` 素材使用现有 `PUBLIC_BASE_URL` 转为公网 URL；未配置公网地址时返回可操作的错误，不向 EggFans 提交无效的本机路径或 data URL。

内部请求字段映射如下：

| 现有内部字段 | EggFans 字段 |
| --- | --- |
| `model` | `model` |
| `prompt` | `prompt` |
| `duration` | `duration` |
| `resolution` | `resolution` |
| `aspectRatio` | `aspect_ratio` |
| `referenceImageUrls` | `image_refs` |
| `referenceVideoUrls` | `video_refs` |
| `referenceAudioUrls` | `audio_refs` |
| `firstFrameUrl`，回退 `imageUrl` | `first_image` |
| `lastFrameUrl` | `last_image` |

空值字段不发送。`generate_audio` 及其他接口文档未定义的内部控制字段不发送。参考素材仍由后端统一转换为公网可访问 URL，遵守现有安全和本地文件处理逻辑。

## 余额入口

设置页只显示“EggFans 余额查询”链接，指向 `https://vip.eggfans.work`，不在后端生成任务中调用余额服务，也不保存或传递 API Key。余额站当前页面自行完成 Key 查询。

## 错误与兼容

- 保留当前异步任务解析、轮询和视频结果下载逻辑。
- 兼容响应中的 `id`、`task_id`、`taskId` 任务标识，以及 `video_url`、`url`、`content.url`、`output.url` 等结果形态。
- 已保存的旧 EggFans `base_url`/endpoint 配置不自动改写，避免破坏用户配置；只有默认模板和新接口请求格式更新。
- Grok 专用旧路径继续保持独立，不与标准 `/v1/videos` 请求混用。

## 测试

新增/更新离线结构和适配器单元测试，覆盖：

1. 标准视频请求使用 `/v1/videos` 并发送文档字段。
2. 默认模型精确为 `sd-2.5-A`，分辨率精确为 `720p`。
3. `4` 秒与 `30` 秒可提交，低于 `4` 秒或高于 `30` 秒会被拒绝。
4. `30` 图、`10` 视频、`10` 音频可提交，任一类型超限会被拒绝。
5. 参考图、参考视频、参考音频、首帧和尾帧字段映射正确，空值不发送。
6. 首尾帧模式与多素材参考模式不能同时提交。
7. 本地参考素材仅在可转为公网 HTTPS URL 时提交；缺少 `PUBLIC_BASE_URL` 时明确失败。
8. 自定义 endpoint/query endpoint 仍可覆盖默认路径。
9. 文本/图片 EggFans 适配器和其他视频供应商没有被改动。
10. 设置页包含新的视频 Base URL、`sd-2.5-A` 参数约束和余额查询入口。

验证命令：后端 `npm run typecheck`；EggFans 适配器测试；前端 `npm run generate`。
