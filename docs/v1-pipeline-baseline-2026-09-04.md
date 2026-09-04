# V1 视频监督管线性能基线

- 生成时间：2026-09-04 20:23（Asia/Shanghai）
- 测试地址：`https://dengxi.site/beta`
- Pipeline：V1
- 帧间隔：20 秒
- 测试序列：玩手机 → 继续玩手机 → 仍在玩手机 → 恢复书写
- Token 来源：模型 Provider usage，非本地估算

## 汇总

| 指标 | V1 基线 |
|---|---:|
| VLM Ground Truth Accuracy | 75%（3/4） |
| Speak Recall | 100%（4/4） |
| 完全相同连续台词 | 0 |
| 平均图片载荷 | 25.8 KB |
| 平均请求 | 37.6 KB |
| 平均响应 | 3.8 KB |
| 平均 VLM Input | 1,570 tokens |
| 平均 Memory Input | 3,038 tokens |
| 平均 Actor Input | 1,544 tokens |
| 平均 VLM Latency | 4,528 ms |
| 平均 Memory Latency | 5,275 ms |
| 平均 Actor Latency | 857 ms |
| 平均 Pipeline Request | 12,982 ms |
| 平均 TTS First Byte | 2,748 ms |
| 平均 Total Before Audio | 15,730 ms |

## 行为结果

| Frame | Ground Truth | VLM | Should Speak | Interaction Outcome | 结果 |
|---:|---|---|---|---|---|
| 1 | PHONE | PHONE | true | no_pending_request | 正确发现手机并首次提醒 |
| 2 | PHONE | PHONE | true | ignored_previous_request | 正确识别提醒被忽略并改变策略 |
| 3 | PHONE | PHONE | true | ignored_previous_request | 继续承接被忽略互动，没有复述原句 |
| 4 | WRITING | OTHER | true | followed_previous_request | VLM 分类未命中 WRITING，但 Memory 正确识别恢复并确认 |

## 已知基线问题

1. 恢复书写测试图被 VLM 分类为 `OTHER`，视觉状态准确率为 75%。阶段一只记录，不修改 Prompt 或判断逻辑。
2. 英文 Actor 输出经过现有字幕清洗后，部分句尾会追加中文句号 `。`。这是 V1 既有行为，阶段一不修改。
3. 当前首段音频平均约 15.7 秒，主要耗时来自 VLM 与 Memory，后续阶段以此作为优化参照。

## 重跑命令

```powershell
npm run baseline:v1 -- https://dengxi.site/beta
```

脚本输出逐帧 JSON，包含字节、Token、模型延迟、Pipeline 请求时间、TTS 首字节及最终台词。
