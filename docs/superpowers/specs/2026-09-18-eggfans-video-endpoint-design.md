# EggFans 视频接口适配设计

## 目标

仅更新 EggFans 的视频生成链路，使其遵循 `https://api.aigcly.top/docs/video.html` 的视频接口格式，并使用新的服务地址：

- 视频调用基址：`https://vip.eggfans.asia`
- 余额查询入口：`https://vip.eggfans.work`

文本和图片 EggFans 适配器、其他视频供应商、现有数据库文件和已保存 AI 配置均保持不变。

## 接口与字段映射

EggFans 视频创建使用 `POST /v1/videos`，任务查询使用 `GET /v1/videos/{taskId}`。配置中的 `base_url` 仍然作为可覆盖项；新建/手动配置的默认提示指向 `https://vip.eggfans.asia`。

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

空值字段不发送。现有 `generate_audio` 只在 EggFans 视频请求中继续透传；接口文档未定义的内部控制字段不发送。参考素材仍由后端统一转换为可访问 URL/数据，遵守现有安全和本地文件处理逻辑。

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
2. 参考图、参考视频、参考音频、首帧和尾帧字段映射正确，空值不发送。
3. 自定义 endpoint/query endpoint 仍可覆盖默认路径。
4. 文本/图片 EggFans 适配器和其他视频供应商没有被改动。
5. 设置页包含新的视频 Base URL/余额查询提示。

验证命令：后端 `npm run typecheck`；EggFans 适配器测试；前端 `npm run generate`。
