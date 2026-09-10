import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// New task only: never replace the earlier code-analysis diagram.
const base = 'http://127.0.0.1:31515/api/project-management/' + encodeURIComponent('vtb-二代safe') + '/modules/flowcharts/items';
const title = 'VTB 一代任务与表依赖全景图';
const root = '/Users/binkerking/Documents/Riking-Project/8-VBT/06-版本管理/SVN源码/SVN/FBDS/代码/fbds_vtb/src/net/';
const impl = root + 'riking/business/service/impl/';
const original = JSON.parse(await fs.readFile(new URL('./vtb-safe1-flowchart.graph.json', import.meta.url), 'utf8'));
const graph = {version:1,status:'active',objective:'第一版任务—数据依赖全景：区域是任务分组，输入→任务→输出；同名表在不同任务区域为同一表的引用，不是新表。实线为读写，紫色虚线为调用/执行顺序，青色虚线为跨任务数据来源。内部算法保存在详情。本图核验静态源码，不代表跑批成功。贷款、ACC、JSH和真实proc主要依赖已展开；CFA AN/AS、FAL深层依赖和三个RCPMIS子过程仍待完整追踪，不能据此声称全系统表清单已完备。',nodes:[],edges:[]};
let counter=0;
function node(id,label,kind,x,y,description='',source='',verified=true){
  graph.nodes.push({id,type:'analysis',position:{x,y},data:{label,kind,scope:'root',description,source,verified}});return id;
}
function edge(source,target,label='读取',mode='data'){
  graph.edges.push({id:'relation-'+(++counter),source,target,type:'smoothstep',label,markerEnd:{type:'arrowclosed',width:14,height:14,color:mode==='call'?'#b7a0ee':'#8bd5d0'},style:{stroke:mode==='call'?'#b7a0ee':'#8bd5d0',strokeWidth:1.2,...(mode==='data'?{}:{strokeDasharray:'6 5'})}});
}
function note(id,label,caption,x,y){graph.nodes.push({id,type:'note',position:{x,y},connectable:false,data:{label,caption,kind:'note',scope:'root',tone:'amber',source:'',verified:false,description:caption}});}
function region(id,label,caption,x,y,height=720){graph.nodes.push({id:'region-'+id,type:'region',position:{x,y},style:{width:1320,height},zIndex:-10,draggable:false,connectable:false,data:{label,caption,kind:'region',scope:'root',tone:'cyan',source:'',verified:true,description:caption}});return {id,x,y};}
function task(area,id,label,inputs,outputs,ref,description='',verified=true){
  const x=area.x,y=area.y;
  node(id,label,'step',x+540,y+290,description,ref,verified);
  inputs.forEach((label,i)=>{node(id+'-in-'+i,label,'table',x+65,y+105+i*92,'输入引用：'+label+'。同名表与其他区域为同一实体。\n'+description,ref,verified);edge(id+'-in-'+i,id);});
  outputs.forEach((label,i)=>{node(id+'-out-'+i,label,'table',x+1060,y+140+i*105,'输出/更新目标：'+label+'。\n'+description,ref,verified);edge(id,id+'-out-'+i,'写入 / 更新');});
  return id;
}
const old=(id)=>original.nodes.find(n=>n.id===id)?.data.description||'';
note('legend','阅读方式 / 第一版','左：输入 → 中：任务 → 右：输出\n同名表为跨区域引用，不是新表\n紫虚线：调用；青虚线：数据来源',30,-240);
note('boundary','核验边界','已核验：静态源码，不等于跑批通过\n待核验区域不会虚构结果表\n原代码解析图保留不动',440,-240);
note('risk','迁移先后顺序要单独设计','Customer / Account 等已有正式数据\n在导入加工阶段就会被读取\n不能假设本次文件已生成正式数据',860,-240);

const a=region('files','01 / 文件入库 · parseTxtFile','五文件检查后逐文件分派；REPORT 无业务落表；TRN 转 BOP 发生在保存 TransactionTab 之前',0,0);
for(const [i,file,table,key] of [[0,'CIF2','CifTab','p-cif'],[1,'AIF2','AifTab','p-aif'],[2,'BLN2','BlnTab','p-bln'],[3,'TRN2','TransactionTab','b-trn']]){
  const y=120+i*130;node('file-'+file,file,'boundary',65,y,'源文件前缀；完整匹配规则见 system.properties。',impl+'DataImportServiceImpl.java:2500');
  node('parse-'+file,'解析 '+file,'step',540,y,old(key),impl+'DataImportServiceImpl.java:2500');
  node('table-'+table,table,'table',1060,y,old(key),impl+'DataImportServiceImpl.java:2500');
  edge('file-'+file,'parse-'+file,'读取文件');edge('parse-'+file,'table-'+table,'入库');
}
node('file-REPORT','REPORT','boundary',65,640,old('p-report'),impl+'DataImportServiceImpl.java:2506');
node('report-count','文件数量检查 · 共 5 个','step',540,640,old('i-count'),impl+'DataImportServiceImpl.java:1838');edge('file-REPORT','report-count','计数 / 不落表');

task(region('bop','02 / TRN → BOP 转换','使用刚解析的 TRN 内存列表；Customer 是已有正式客户数据',1460,0),'bop','converVtbBopTransaction',['TRN2 · 解析后的内存记录','Customer'],['BopTransaction'],impl+'DataImportServiceImpl.java:2709',old('b-start')+'\n'+old('b-own')+'\n'+old('b-opp')+'\n'+old('b-save'));
edge('parse-TRN2','bop-in-0','TRN 内存数据','reference');

task(region('cfa','03 / CFA 贷款中间层 · importCFATab','读取交易、客户与已有正式贷款记录，产生四张贷款中间表；不是四张客户表',0,840),'cfa','importCFATab',['TransactionTab','Customer','CFACA','CFACB','CFADA','CFADB'],['CFACATab','CFACBTab','CFADATab','CFADBTab'],impl+'CfaVTBImportServiceImpl.java:97',old('c-load')+'\n'+old('ca-issue')+'\n'+old('ca-principal')+'\n'+old('da-principal')+'\n'+old('c-save'));
edge('table-TransactionTab','cfa-in-0','交易入库结果','reference');
note('cfa-config','配置依赖','cfaCnumFilter.properties：DA 排除名单\n配置文件，不是数据库表',540,1390);

task(region('proc','04 / 真实一代 proc_processData','仅展示读写表；回填、币种规则放在详情；RCPMIS 子过程单独显示调用边界',1460,840),'proc','proc_processData',['BopTransaction','Account','Customer','BlnTab','VTB_RCPMIS_ACCT'],['BopTransaction','BlnTab','VTB_RCPMIS_ACCT'],'/Users/binkerking/Downloads/proc_processData.sql:14','读取当日 CNUM 为空的 BopTransaction，关联按账号选最新的 Account 与 ENABLED=1 的 Customer，更新 BopTransaction.CNUM。更新当日 BlnTab 的 RUR→RUB；更新 VTB_RCPMIS_ACCT 的 RUR→RUB（无日期限制）。依次调用三个 RCPMIS 子过程。这里不将子过程未知表假装成已核验依赖。');
edge('bop-out-0','proc-in-0','BOP 转换结果','reference');edge('table-BlnTab','proc-in-3','余额入库结果','reference');edge('cfa','proc','随后调用','call');

const r=region('rcp','05 / 后处理子过程 · 待取得过程体','只核验到真实调用；不能从过程名称猜测输入表或结果表',1460,1680);
for(const [i,name] of ['proc_extract_rcpmis_2121','proc_extract_rcpmis_2105y','proc_extract_rcpmis_2105n'].entries()){
  node('rcp-'+i,name,'step',r.x+480,r.y+120+i*160,'proc_processData 内真实调用，参数 @dadt。子过程体尚未核验，输入输出表未确认。','/Users/binkerking/Downloads/proc_processData.sql:39',false);edge('proc','rcp-'+i,'调用 · '+(i+1),'call');
}
note('rcp-pending','缺失证据 / 不猜表名','三个子过程的表依赖待补齐\nVTB_RCPMIS_ACCT 是父过程更新目标\n不能直接当作三个子过程共同输入',r.x+70,r.y+170);

task(region('customer','06 / ACC 客户提取','extractVTBData 匹配 ACC 后先执行客户提取；不是 parseTxtFile 的直接输出',0,1680),'customer','importVTBCustomerData',['CifTab','Customer','AccountMainType'],['Customer'],impl+'CustomerImportServiceImpl.java:352','读取 CifTab、已有 Customer 和 AccountMainType。依据已有客户与主体类型处理后 saveAll；注释中的 BI_Customer SQL 不属于当前执行链。');
edge('table-CifTab','customer-in-0','客户中间表','reference');

task(region('account','07 / ACC 账户提取','客户 → 账户 → 余额是 ACC 分支的调用顺序；账户还依赖多张码表',0,2520,870),'account','importVTBAccountData',['AifTab','Customer','Account','AccountStatus','AccountType','AccountCategory','Currency'],['Account'],impl+'AccountImportServiceImpl.java:591','读取 AifTab、Customer、有效 Account、AccountStatus、AccountType、AccountCategory、Currency；使用 aboqfoacc.properties 配置。完整字段规则保留在后续详情核验，不把码表当作本任务输出。');
edge('table-AifTab','account-in-0','账户中间表','reference');edge('customer-out-0','account-in-1','客户提取结果','reference');edge('customer','account','ACC 顺序 1→2','call');

task(region('balance','08 / ACC 余额提取','交易 + 余额中间表 + 正式账户 → 正式余额；Balancetemp 在这里是内存计算列表',1460,2520,870),'balance','importVTBBalanceData',['TransactionTab','BlnTab','Account','Balance'],['Balance'],impl+'BalanceImportServiceImpl.java:597','读取当天 TransactionTab，经 filter 生成内存 Balancetemp 列表；读取有效 Account、当日 Balance、BlnTab，再处理正式 Balance。Balancetemp 不在本链中标成必然落库表。');
edge('account-out-0','balance-in-2','账户提取结果','reference');edge('account','balance','ACC 顺序 2→3','call');edge('table-BlnTab','balance-in-1','余额中间表','reference');

const f=region('formal','09 / CFA 正式提取 · CA / CB / DA / DB','按所选报表执行；变动表还依赖对应正式签约表，不是中间表简单复制',0,3500,840);
for(const [i,type] of ['CA','CB','DA','DB'].entries()){
  const y=f.y+130+i*160, id='formal-'+type;
  node(id+'-in','CFA'+type+'Tab','table',65,y,'贷款中间表输入',impl+'Cfa'+type.toLowerCase()+'MetroExtractServiceImpl.java:43');
  node(id,'提取 CFA'+type,'step',540,y,old(type==='CA'?'q-load':'formal-'+type.toLowerCase()),impl+'Cfa'+type.toLowerCase()+'MetroExtractServiceImpl.java:43');
  node(id+'-out','CFA'+type,'table',1060,y,'正式表：查询现有记录并按规则新增、更新或清理。非一律覆盖。',impl+'Cfa'+type.toLowerCase()+'MetroExtractServiceImpl.java:43');
  edge(id+'-in',id);edge(id+'-out',id,'读取现有');edge(id,id+'-out','写入 / 更新');edge('cfa-out-'+i,id+'-in','中间层结果','reference');
}
edge('formal-CA-out','formal-CB','读取正式签约');edge('formal-DA-out','formal-DB','读取正式签约');
node('fogu','FoguCodeInfos','table',790,f.y+660,'Cfada 提取清理/重建担保人信息子记录；关联 CFADA。',impl+'CfadaMetroExtractServiceImpl.java:156');edge('formal-DA','fogu','维护子表');
node('fogu-input','FoguCodeInfosTab','table',290,f.y+660,'CFADA 提取按 cfadaTabId 读取担保人中间子表。',impl+'CfadaMetroExtractServiceImpl.java:155');edge('fogu-input','formal-DA','读取担保人');

task(region('jsh','10 / JSH 结售汇提取','读取当日及历史交易，结合客户、用途码和交易码；处理细节保留在详情',1460,3500,840),'jsh','importFAEBaseInfoData',['TransactionTab · 当日 / 历史','Customer','FAEBaseInfo','UseType','TxCode'],['FAEBaseInfo','FAEManage'],root+'riking/aboq/service/impl/FaeBaseInfoServiceImpl.java:488','当日及历史交易配对。查询已有 FAEBaseInfo；setFAEBaseInfos 读取 Customer、UseType、TxCode，建立 FAEManage 关联。通过基础信息持久化关联记录；更深层 DAO 选数和级联映射仍需继续核验。');
edge('table-TransactionTab','jsh-in-0','交易中间表','reference');

const extra=region('extra','11 / CFA AN / AS · 待进一步追踪','先展示已确认的直接表链；其上游来源和动态合同表依赖尚不完整',0,4480,720);
for(const [i,table,out] of [[0,'CFAATab','CFAAN'],[1,'CFAASTab','CFAAS']]){
  node('extra-in-'+i,table,'table',65,extra.y+150+i*200,'已确认提取器读取；本图尚未完成该中间表的上游来源追踪。',impl+(i?'Cfaas':'Cfaan')+'MetroExtractServiceImpl.java',false);
  node('extra-task-'+i,'提取 '+out,'step',540,extra.y+150+i*200,'直接输入输出已确认；历史正式记录、合同实体及深层 DAO 依赖待补全。',impl+(i?'Cfaas':'Cfaan')+'MetroExtractServiceImpl.java',false);
  node('extra-out-'+i,out,'table',1060,extra.y+150+i*200,'正式输出表；尚非完整依赖清单。','',false);edge('extra-in-'+i,'extra-task-'+i);edge('extra-task-'+i,'extra-out-'+i,'写入 / 更新');
}
note('extra-note','待核验依赖','CFAAS 按 dataType 查询合同实体\n不能只画 CFAASTab → CFAAS\n完整来源和合同表后续补齐',540,extra.y+530);

task(region('fal','12 / FAL 提取 · 初步表清单','直接调用链已定位；CFA 聚合数据来源、初始化与动态清理表依赖仍待补全',1460,4480,920),'fal','extractFalData',['FalWarehouse','Z01','Z02 · 历史','TransactionTab','D0501 · 历史'],['Z02','D02','F01','D0501','D09'],impl+'DataExtractVtbFalServiceImpl.java:106','活动分支 FALZB→Z02、FALDB→D02、FALFA→F01、FALDE→D0501、FALDK→D09。初始化还读取其他历史表，D0501 依赖 cfaDataMap，深层来源未完整追踪。本区域明确是初步清单，不表示完整或全部表由四个 TXT 产生。',false);
note('fal-note','尚未完整 / 不能直接配置迁移','FAL 的 CFA 聚合源、历史初始化\n动态清理依赖和外部入仓链待补齐',1950,5260);

node('archive','源文件归档','step',2470,-190,old('i-archive'),impl+'DataImportServiceImpl.java:1854');
edge('proc','archive','全部子过程正常返回后','call');
node('dispatch','另行发起报表提取','boundary',1810,-190,old('extract-entry')+'\n'+old('x-select'),impl+'DataImportServiceImpl.java:2796');
for(const id of ['customer','formal-CA','formal-CB','formal-DA','formal-DB','jsh','extra-task-0','extra-task-1','fal'])edge('dispatch',id,'所选报表匹配','call');

assert.equal(new Set(graph.nodes.map(n=>n.id)).size,graph.nodes.length);
const ids=new Set(graph.nodes.map(n=>n.id));
for(const e of graph.edges)assert(ids.has(e.source)&&ids.has(e.target));
assert(graph.nodes.every(n=>n.data.scope==='root'));
assert(graph.nodes.some(n=>n.data.label==='REPORT'));
assert.equal(graph.nodes.filter(n=>n.data.kind==='region').length,12);
await fs.writeFile(new URL('./vtb-data-lineage.graph.json',import.meta.url),JSON.stringify(graph,null,2));
if(process.argv.includes('--apply')){
  const beforeResponse=await fetch(base);assert(beforeResponse.ok);const before=await beforeResponse.json();
  assert(!before.some(i=>i.title===title),'A same-title task exists: inspect before retrying.');
  const response=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,content:{graph}})});
  assert(response.ok,await response.clone().text());const created=await response.json();
  const afterResponse=await fetch(base);assert(afterResponse.ok);const after=await afterResponse.json();
  assert.deepEqual(after.find(i=>i.id===created.id).content.graph,graph);
  for(const previous of before)assert.deepEqual(after.find(i=>i.id===previous.id),previous,'Existing task changed during creation');
  await fs.writeFile(new URL('./vtb-data-lineage.created.json',import.meta.url),JSON.stringify(created,null,2));
  console.log(JSON.stringify({id:created.id,title,nodes:graph.nodes.length,edges:graph.edges.length,regions:12,previousTasksUnchanged:true}));
}else console.log(JSON.stringify({valid:true,nodes:graph.nodes.length,edges:graph.edges.length}));
