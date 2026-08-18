# Apple Health 指标字典

> 给 Rich / Hermes / Codex 解读 `health_raw_import` 里的 Health Auto Export 数据用。
> 最后更新：2026-05-25

## 数据来源

当前数据来自 Health Auto Export REST 自动同步：

- Rich 接收端：`POST /api/health/intake/health-auto-export`
- 原始归档表：`health_raw_import`
- 原始来源标记：`source = health-auto-export-rest`
- 当前时间范围：2026-05-19 到 2026-05-25

Health Auto Export 的 JSON 健康指标使用 `metrics` 数组，每个指标是 snake_case 名称，带 `units` 和 `data`；每条数据点通常有 `qty` 和 `date`。Rich 会完整保存原始 JSON，暂时只把部分指标解析到现有结构化健康表。

Rich 现在有三层存储：

1. `health_raw_import`：原始证据层，完整保留 Health Auto Export 传入的 JSON。
2. `health_metric_sample`：标准化样本层，一条健康指标一个结构化样本，包含 `metric`、`category`、`aggregation_style`、`apple_identifier`、`recorded_at`、标准化后的 `value` 和 `unit`。
3. `health_daily_activity_summary`：每日汇总层，按天拆成明确列，供日报、周报、趋势图、Hermes 汇报直接读取。

## 当前已接收到的指标

| Health Auto Export metric | 当前单位 | 当前记录数 | 中文名 | Apple HealthKit identifier | 指标含义 | 建议聚合 | Rich 当前处理 |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| `step_count` | `count` | 3449+ | 步数 | `HKQuantityTypeIdentifier.stepCount` | 用户已经走过的步数。Apple 文档说明它是累计型 count 指标，iPhone 和 Apple Watch 会自动记录。 | 按天求和。短时间粒度可用于活动分布，但日汇总更适合复盘。 | 已入 `health_metric_sample`，并汇总到 `health_daily_activity_summary.steps_count`；同时保留在 `health_workout_log` 的每日活动摘要。 |
| `walking_running_distance` | `km` | 3416+ | 步行和跑步距离 | `HKQuantityTypeIdentifier.distanceWalkingRunning` | 用户通过步行或跑步移动的距离。Apple 文档说明它是累计型长度指标。 | 按天求和。与步数一起看，可以估算活动量和平均步幅趋势。 | 已入 `health_metric_sample`，并汇总到 `health_daily_activity_summary.walking_running_distance_km`；同时保留在 `health_workout_log` 的每日活动摘要。 |
| `walking_speed` | `km/hr` | 488+ | 步行速度 | `HKQuantityTypeIdentifier.walkingSpeed` | 用户在平地稳定行走时的平均速度。Apple 文档说明 iPhone 8 或之后机型会自动记录，手机通常需要放在腰部附近，且用户身高要准确。 | 按天取平均、P25/P50/P75 或只看稳定步行样本。不要求和。 | 已入 `health_metric_sample`，并汇总到 `health_daily_activity_summary.walking_speed_avg_kmh`。 |
| `walking_step_length` | `cm` | 480+ | 步长 | `HKQuantityTypeIdentifier.walkingStepLength` | 用户平地稳定行走时的平均步长。Apple 文档定义为行走时前脚和后脚之间的距离。 | 按天取平均或中位数。不要求和。可与步行速度一起看。 | 已入 `health_metric_sample`，并汇总到 `health_daily_activity_summary.walking_step_length_avg_cm`。 |
| `walking_double_support_percentage` | `%` | 458+ | 双脚支撑时间比例 | `HKQuantityTypeIdentifier.walkingDoubleSupportPercentage` | 稳定行走时双脚同时接触地面的时间占比。Apple 文档说明典型步行常见范围约 20% 到 40%，会受速度和地形影响。 | 按天取平均或中位数。值偏高通常说明步态更谨慎或速度更慢，但不能单独当诊断。 | 已入 `health_metric_sample`，并汇总到 `health_daily_activity_summary.walking_double_support_avg_pct`。 |
| `walking_asymmetry_percentage` | `%` | 218+ | 步行不对称比例 | `HKQuantityTypeIdentifier.walkingAsymmetryPercentage` | 平地行走时，一只脚比另一只脚更快或更慢的步数比例。Apple 文档说明这是离散百分比样本。 | 按天取平均或中位数。越接近 0 通常越对称；突增可作为复盘提示。 | 已入 `health_metric_sample`，并汇总到 `health_daily_activity_summary.walking_asymmetry_avg_pct`。 |
| `headphone_audio_exposure` | `dBASPL` | 170+ | 耳机音频暴露 | `HKQuantityTypeIdentifier.headphoneAudioExposure` | 来自耳机的音频暴露。Apple 文档说明单位是 A 加权声压级 dBASPL，样本是等效连续声压级。 | 不要普通求和。做时间加权平均、最大值、超过阈值时长更有意义。 | 已入 `health_metric_sample`，并汇总到 `health_daily_activity_summary.headphone_audio_exposure_avg_dbaspl` / `max_dbaspl`。 |
| `flights_climbed` | `count` | 149+ | 爬楼层数 | `HKQuantityTypeIdentifier.flightsClimbed` | 用户爬过的楼层数。Apple 文档说明它是累计型 count 指标，可由 iPhone、Apple Watch 或连接 GymKit 的 Apple Watch 采集。 | 按天求和。适合和步数、距离一起作为活动强度指标。 | 已入 `health_metric_sample`，并汇总到 `health_daily_activity_summary.flights_climbed`。 |

## 给 AI 的解读规则

1. 先区分累计型和离散型。`step_count`、`walking_running_distance`、`flights_climbed` 是累计型，适合求和；步行速度、步长、双脚支撑、不对称、耳机暴露是离散样本，通常不要求和。
2. 需要写给用户时，先说趋势和可执行建议，不要堆字段名。比如「今天走了 1.27 万步，距离 9.74 公里」比「step_count=12722」更适合 Rich 语气。
3. 步态类指标只做行为复盘和异常提醒，不做医学诊断。步行速度、步长、双脚支撑、不对称都会受地形、手机位置、身高设置、当天疲劳影响。
4. 耳机音频暴露要按噪声风险来解释，但不要把单个样本当结论。优先看一段时间内的高暴露次数、峰值、持续时长。
5. 如果用户问「为什么 Rich 没展示某项」，先查 `health_daily_activity_summary` 和 `health_metric_sample`；如果结构化层没有，再查 `health_raw_import`。

## 常用查询

```bash
set -a
source ~/.rich-cloud-postgres.env
set +a

psql "$RICH_DB_URL" -P pager=off -c "
SELECT payload->>'metric' AS metric, payload->>'unit' AS unit, count(*)
FROM health_raw_import
WHERE source = 'health-auto-export-rest'
  AND kind = 'metric'
GROUP BY 1,2
ORDER BY count DESC;
"
```

查看标准化样本：

```bash
psql "$RICH_DB_URL" -P pager=off -c "
SELECT metric, unit, category, aggregation_style, count(*)
FROM health_metric_sample
WHERE source = 'health-auto-export-rest'
GROUP BY 1,2,3,4
ORDER BY count DESC;
"
```

查看每日汇总：

```bash
psql "$RICH_DB_URL" -P pager=off -c "
SELECT summary_date, steps_count, walking_running_distance_km, flights_climbed,
       walking_speed_avg_kmh, walking_step_length_avg_cm,
       walking_double_support_avg_pct, walking_asymmetry_avg_pct,
       headphone_audio_exposure_avg_dbaspl, headphone_audio_exposure_max_dbaspl
FROM health_daily_activity_summary
ORDER BY summary_date DESC;
"
```

查看某个指标最近样本：

```bash
psql "$RICH_DB_URL" -P pager=off -c "
SELECT record_at, payload->>'metric' AS metric, payload->>'unit' AS unit, payload->>'value' AS value, payload
FROM health_raw_import
WHERE source = 'health-auto-export-rest'
  AND kind = 'metric'
  AND payload->>'metric' = 'walking_speed'
ORDER BY record_at DESC
LIMIT 20;
"
```

## 资料来源

- Apple Developer Documentation: [HKQuantityTypeIdentifier](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier)
- Apple Developer Documentation: [stepCount](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/stepcount)
- Apple Developer Documentation: [distanceWalkingRunning](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/distancewalkingrunning)
- Apple Developer Documentation: [flightsClimbed](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/flightsclimbed)
- Apple Developer Documentation: [walkingSpeed](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/walkingspeed)
- Apple Developer Documentation: [walkingStepLength](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/walkingsteplength)
- Apple Developer Documentation: [walkingDoubleSupportPercentage](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/walkingdoublesupportpercentage)
- Apple Developer Documentation: [walkingAsymmetryPercentage](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/walkingasymmetrypercentage)
- Apple Developer Documentation: [headphoneAudioExposure](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/headphoneaudioexposure)
- HealthyApps Help Center: [Health Auto Export REST API](https://help.healthyapps.dev/zh-Hans/health-auto-export/automations/rest-api)
- HealthyApps Help Center: [健康指标 JSON 导出格式](https://help.healthyapps.dev/zh-Hans/health-auto-export/export-format/health-metrics)
