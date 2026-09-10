import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:31515/api/project-management/'+encodeURIComponent('vtb-二代safe')+'/modules';
const id='pm-item-6f453a21-684f-42bf-88ed-9d7e9fbe5e75';
async function read(){const r=await fetch(base+'/flowcharts/items');assert(r.ok);return (await r.json()).find(i=>i.id===id);}
const before=await read();assert.equal(before.content.graph.nodes.length,19,'Review changed graph before decorating');
const graph=structuredClone(before.content.graph);
const positions={bop:[70,300],'ca-stage':[770,310],'da-stage':[1060,420],'c-save':[1380,365],'extract-entry':[70,710],extract:[340,710],'x-cfa':[600,710],'formal-ca':[970,660],'formal-cb':[970,780],'x-msg':[1380,715],'x-acc':[600,860],'x-jsh':[600,960],'x-fal':[600,1060]};
for(const n of graph.nodes){if(positions[n.id]){const [x,y]=positions[n.id];n.position={x,y};}else n.position.y=100;}
const regions=[
 ['area-import','01 / 文件导入','检查文件 → 解析中间表 → 加工 → 后处理 → 归档','cyan',0,210],
 ['area-stage','02 / 中间层加工','同一画布展开规则 · 虚线表示内部规则或数据关联','mint',235,315],
 ['area-extract','03 / 正式表提取','独立操作 · 按所选报表分派','cyan',575,585],
].map(([id,label,caption,tone,y,height])=>({id,type:'region',position:{x:20,y},style:{width:1595,height},zIndex:-10,draggable:false,connectable:false,data:{label,caption,tone,kind:'region',scope:'root',source:'',verified:true,description:caption+'。此区域只是视觉分组，不是额外业务步骤，也不会增加子流程层级。'}}));
function note(id,label,caption,tone,x,y,description){return {id,type:'note',position:{x,y},connectable:false,data:{label,caption,tone,kind:'note',scope:'root',source:'',verified:true,description}};}
const notes=[
 note('note-report','5 个文件 ≠ 5 份业务数据','4 份业务 TXT + REPORT\nREPORT 未做内容状态校验','mint',70,400,'源码事实见“检查 5 个文件”和“TXT → 原始中间表”详情。只检查匹配文件数量，没有严格验证五文件唯一集合。'),
 note('note-proc','原始过程仍待核验','proc_processData 只确认调用\n不推断其内部业务逻辑','amber',380,310,'原始过程体未取得。当前测试库的空过程不代表一代真实实现，不能据此断言它回填客户号或连接 RCPMIS。'),
 note('note-manual','导入完成，不等于提取完成','提取需要另行发起\n正式落表 ≠ 审核／报送完成','amber',70,860,'人工导入和 extractVTBData 为独立入口。本图未验证后续审核、报文生成与监管发送。'),
];
graph.nodes=[...regions,...graph.nodes,...notes];
assert.equal(graph.nodes.filter(n=>n.data.kind!=='region'&&n.data.kind!=='note').length,19);
assert(graph.nodes.every(n=>n.data.scope==='root'));
assert.deepEqual(graph.edges,before.content.graph.edges);
for(const n of before.content.graph.nodes)assert.equal(graph.nodes.find(x=>x.id===n.id).data.description,n.data.description);
const backup=new URL('./vtb-before-regions-'+Date.now()+'.json',import.meta.url);
await fs.writeFile(backup,JSON.stringify(before,null,2),{flag:'wx'});
assert.deepEqual(await read(),before,'Task changed while preparing');
const r=await fetch(base+'/items/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:{...before.content,graph}})});assert(r.ok);
assert.deepEqual((await read()).content.graph,graph);
console.log(JSON.stringify({saved:true,businessNodes:19,regions:3,notes:3,scopeCount:1,backup:backup.pathname}));
