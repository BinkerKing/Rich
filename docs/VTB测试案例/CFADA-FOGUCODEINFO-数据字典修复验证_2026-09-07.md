# CFADA 境外担保人子集合修复与验证

依据 `CfadaMetroExtractServiceImpl`：以 `CFADATab.dealNo` 创建或更新父 CFADA，以 `FoguCodeInfosTab.cfadaTabId` 读取子项，删除并重建父记录的子集合。

二代已补建 `vtb.t_safe_cfada` 父实体，并绑定字典 CFADA。`T_SAFE_CFADA_FOGUCODEINFO` 过程先以 `dealno` 写父表，再以父表真实 `id` 删除/重建子项；不会使用贴源 `cfada_tab.id` 作为报表父键。`guaranteeobject` 保持空，与一代提取未赋值一致。

验证：`UT-CFADA-001` 首次生成父记录及 FG1、FG2 两条子项；源子项调整为 FG1、FG3 后重跑，目标准确重建为 FG1、FG3，无残留 FG2。
