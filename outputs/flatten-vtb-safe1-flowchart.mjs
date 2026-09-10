import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const base='http://127.0.0.1:31515/api/project-management/'+encodeURIComponent('vtb-二代safe')+'/modules';
const id='pm-item-6f453a21-684f-42bf-88ed-9d7e9fbe5e75';
async function read(){const r=await fetch(base+'/flowcharts/items');assert(r.ok);return (await r.json()).find(x=>x.id===id);}
const before=await read();assert.equal(before.content.graph.nodes.length,68,'Original graph changed; review first');
const old=before.content.graph;
const graph={...old,objective:'单层全景：上方导入主线，中间贷款加工规则，下方另行提取正式表。虚线表示规则展开、数据来源或人工衔接，并非额外自动调用。详细条件、原始分析和源码统一保存在节点详情。',nodes:[],edges:[]};
const used=new Set();
function node(key,label,col,row,kind,ids,intro=''){
 const originals=ids.map(id=>{assert(!used.has(id),'Duplicate '+id);used.add(id);const n=old.nodes.find(n=>n.id===id);assert(n,'Missing '+id);return n;});
 graph.nodes.push({id:key,type:'analysis',position:{x:80+col*260,y:70+row*180},data:{label,kind,scope:'root',source:originals.find(n=>n.data.source)?.data.source||'',verified:originals.every(n=>n.data.verified),description:[intro,...originals.map(n=>'【'+n.data.label.replace(/【展开】/g,'')+'】\n'+n.data.description)].filter(Boolean).join('\n\n')}});
}
const entry='747273ad-aa25-4e45-8476-94809383df71';
node(entry,'VTB 数据导入',0,0,'boundary',[entry,'304bed33-ff1d-42d7-b4da-fef7218f732d','i-dir','limits']);
node('i-count','检查 5 个文件',1,0,'decision',['i-count','i-reject'],'不满足文件数检查则抛异常终止；REPORT 没有内容状态校验。');
node('parse','TXT → 原始中间表',2,0,'table',['parse','p-read','p-cif','p-aif','p-bln','p-report','p-close'],'CIF→客户，AIF→账户，BLN→余额，TRN→交易；四张原始中间表，不是四张正式客户表。');
node('cfa','CFA 贷款加工',3,0,'step',['cfa','c-load','c-filter','c-skip','c-loop'],'读取当日交易。下方为同一方法内的两组独立规则，不是互斥分支。');
node('proc','后处理过程 · 未知',4,0,'decision',['proc'],'proc_processData：仅确认调用，原始过程内部未知。');
node('i-archive','归档 · 导入完成',5,0,'boundary',['i-archive','i-end','7475156a-9230-4bdd-9a69-acf20293e4c5']);
node('bop','TRN → BOP 中间表',1,1,'table',['bop','b-start','b-own','b-opp','b-save','b-trn'],'在 TRN 解析中转换 BOP；这里不是 BOPA–F 正式报表提取。');
node('ca-stage','外汇贷款 · CA / CB',3,1,'step',['ca-stage','ca-issue','ca-principal','ca-interest','ca-out','s-ca','s-cb']);
node('da-stage','外保内贷 · DA / DB',4,1,'step',['da-stage','da-issue','da-principal','da-interest','da-out','s-da','s-db']);
node('c-save','四类贷款中间表',5,1,'table',['c-save'],'非空列表才按日替换；落库顺序 DA→DB→CA→CB。完成贷款加工后返回主线执行后处理过程。');
node('extract-entry','另行发起提取',0,2,'boundary',['extract-entry'],'这是用户另行发起的独立操作，不是导入后自动触发。');
node('extract','按报表类型分派',1,2,'decision',['extract','x-select','x-bop'],'所选类型独立匹配，多个匹配可顺序执行；此入口无 BOPA–F 分派。');
node('x-cfa','CFA 正式表提取',2,2,'step',['x-cfa','xcf-start','xcf-other']);
node('formal-ca','CFACA · 新增／更新',3,2,'table',['formal-ca','formal','q-load','q-find','q-create','q-change','q-action','q-save','q-errors','q-missing','q-end']);
node('formal-cb','CFACB / DA / DB',4,2,'table',['formal-cb','formal-da','formal-db'],'已确认分派入口，三个正式提取器内部待进一步核验；不能直接套用 CFACA 的写入规则。');
node('x-msg','正式数据 · 提取反馈',5,2,'boundary',['x-msg'],'落库结果取决于各提取器；不代表审核、报文生成或监管发送完成。');
node('x-acc','ACC · 客户／账户／余额',1,3,'step',['x-acc']);
node('x-jsh','JSH · 基础信息',2,3,'step',['x-jsh']);
node('x-fal','FAL · 金融资产负债',3,3,'step',['x-fal']);
assert.equal(used.size,old.nodes.length,'Every original node must be retained in details');
// Stagger parallel branches so their horizontal connectors do not cross other cards.
const branchY={'ca-stage':220,'da-stage':330,'c-save':275,'formal-ca':460,'formal-cb':570,'x-msg':510,'extract-entry':510,'extract':510,'x-cfa':510,'x-acc':690,'x-jsh':780,'x-fal':870};
for(const n of graph.nodes) if(branchY[n.id]!==undefined) n.position.y=branchY[n.id];
function edge(a,b,label='',dashed=false){graph.edges.push({id:'flat-'+a+'-'+b,source:a,target:b,type:'smoothstep',label,markerEnd:{type:'arrowclosed',color:dashed?'#657c91':'#64b8ce'},...(dashed?{style:{strokeDasharray:'5 5'}}:{})});}
function chain(ids){ids.slice(1).forEach((id,i)=>edge(ids[i],id));}
chain([entry,'i-count','parse','cfa','proc','i-archive']);
edge('parse','bop','TRN 内部',true);
edge('cfa','ca-stage','规则展开',true);edge('cfa','da-stage','独立判断',true);
edge('ca-stage','c-save');edge('da-stage','c-save');
chain(['extract-entry','extract','x-cfa']);
edge('x-cfa','formal-ca','所选类型');edge('x-cfa','formal-cb','所选类型');
edge('formal-ca','x-msg');edge('formal-cb','x-msg');
for(const key of ['x-acc','x-jsh','x-fal'])edge('extract',key,'匹配时');
// Import and extraction deliberately remain visually separate, avoiding an implied automatic call.
const ids=new Set(graph.nodes.map(n=>n.id));
for(const e of graph.edges)assert(ids.has(e.source)&&ids.has(e.target));
assert(graph.nodes.every(n=>n.data.scope==='root'));
const stamp=new Date().toISOString().replaceAll(':','-');
const backup=new URL('./vtb-safe1-before-flat-'+stamp+'.json',import.meta.url);
await fs.writeFile(backup,JSON.stringify(before,null,2),{flag:'wx'});
const fresh=await read();assert.deepEqual(fresh,before,'Task changed while preparing');
const response=await fetch(base+'/items/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:{...before.content,graph}})});
assert(response.ok,await response.text());
assert.deepEqual((await read()).content.graph,graph);
await fs.writeFile(new URL('./vtb-safe1-flat.graph.json',import.meta.url),JSON.stringify(graph,null,2));
console.log(JSON.stringify({saved:true,nodes:graph.nodes.length,scopes:1,originalNodesPreservedInDetails:used.size,backup:backup.pathname}));
