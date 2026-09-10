import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const base = 'http://127.0.0.1:31515/api/project-management/' + encodeURIComponent('vtb-二代safe') + '/modules';
const itemId = 'pm-item-6f453a21-684f-42bf-88ed-9d7e9fbe5e75';
const sourceRoot = '/Users/binkerking/Documents/Riking-Project/8-VBT/06-版本管理/SVN源码/SVN/FBDS/代码/fbds_vtb/src/net/';
const out = path.dirname(new URL(import.meta.url).pathname);
const files = {
  import: 'riking/business/service/impl/DataImportServiceImpl.java',
  action: 'riking/business/action/DataImportAction.java',
  cfa: 'riking/business/service/impl/CfaVTBImportServiceImpl.java',
  dispatch: 'riking/business/service/impl/CfaMetroExtractServiceImpl.java',
  ca: 'riking/business/service/impl/CfacaMetroExtractServiceImpl.java',
  config: 'config/system.properties',
};
const graph = {version:1, status:'active', objective:'按 VTB 一代实际 Java 源码逐层解析：人工导入 → TXT 中间表 → CFA 贷款中间表 → 存储过程调用边界 → 另行提取正式表。双击有子流程的节点展开；单击查看条件、字段与源码位置。已核验表示已核对静态源码，不等于跑批测试通过。proc_processData 原始内部逻辑未取得；CB/DA/DB 等正式提取器内部待继续展开。', nodes:[], edges:[]};
const entry = '747273ad-aa25-4e45-8476-94809383df71';
const imp = '304bed33-ff1d-42d7-b4da-fef7218f732d';
const done = '7475156a-9230-4bdd-9a69-acf20293e4c5';
function n(id, scope, col, row, label, kind, description, ref, verified=true) {
  let source='';
  if(ref) {
    const [key,line] = ref.split(':');
    source = path.basename(files[key]) + ':' + line;
    description += '\n\n源码：' + sourceRoot + files[key] + ':' + line;
  }
  graph.nodes.push({id,type:'analysis',position:{x:80+col*360,y:80+row*250},data:{label,kind,description,source,verified,scope}});
}
function e(a,b,label='',dashed=false,id) {
  graph.edges.push({id:id || 'edge-'+a+'-'+b,source:a,target:b,type:'smoothstep',label,...(dashed?{style:{strokeDasharray:'6 4'}}:{})});
}
function chain(ids,label='') { ids.slice(1).forEach((id,i)=>e(ids[i],id,label)); }

// L0: two separate operations, not one automatically chained batch.
n(entry,'root',0,0,'01 · VTB 人工导入入口','boundary','DataImportAction.importData 按当前机构号分支。310000167001 → importVTBData(importDate)。本图核验的是人工导入入口；定时调度链尚未追踪。','action:668');
n(imp,'root',1,0,'02 · 数据导入【展开】','step','双击展开：文件数量检查 → 逐文件解析 → importCFATab → proc_processData → 源文件归档。导入阶段并不自动调用 extractVTBData。','import:1829');
n(done,'root',2,0,'03 · 导入返回，等待提取','boundary','只有存储过程调用、源文件移动等步骤未抛异常，方法才正常返回。成功提示文字在存储过程执行之前加入消息，不能以该文字证明全链成功。','import:1849');
n('extract-entry','root',0,1,'04 · 另行选择日期和报表','boundary','DataImportAction.extractData 的 VTB 分支调用 extractVTBData(fileTypes,extractDate,isDelete,fileType)。图中虚线是用户操作衔接，不是自动方法调用。','action:843');
n('extract','root',1,1,'05 · 报表提取【展开】','step','按所选 fileTypes 独立匹配 ACC、JSH、CFA、FAL 分支；多个匹配可顺序执行。CFA 继续按报表类型分派服务。','import:2796');
n('formal','root',2,1,'06 · 正式业务表／提取消息','table','CFA 路径从 CFACATab 等中间层提取到 CFACA 等正式表。本轮已展开 CFACA 新增／更新规则；其他提取器先保留可追踪入口。正式表落库不等于校验、审核、报文生成或监管发送已完成。','ca:43');
n('limits','root',1,2,'阅读边界 · 待核验清单','boundary','1. proc_processData 原始定义未知；当前测试库空过程不代表原系统真实逻辑。\n2. 本图的“已核验”仅指静态源码事实，不代表测试通过。\n3. 未核验事务边界、定时调度、正式表后续校验／审核／报文流程。\n4. CB、DA、DB、AN、AS 等正式提取器内部、历史余额 DAO 选数规则可逐项继续展开。',null,false);
e(entry,imp,'机构号 310000167001',false,'cd70009d-f9ee-4e3d-8623-40cf8195d885');
e(imp,done,'全部正常返回',false,'93466909-0ef1-47b7-b5d4-9bf2cc610a14');
e(done,'extract-entry','用户另行触发',true); chain(['extract-entry','extract','formal']);

// L1 import orchestration.
n('i-dir',imp,0,0,'I1 · 枚举源目录匹配文件','step','使用 srcImportDir 和 patternFile 筛选 listFiles；没有在这里按 CIF/AIF/BLN/TRN 排序，不能把业务文件顺序画成固定依赖链。','import:1836');
n('i-count',imp,1,0,'I2 · 匹配文件数是否等于 5？','decision','代码只判断 txtFiles 非空且 length == 5，不逐项验证五个唯一文件名。配置列出 AIF2、CIF2、BLN2、REPORT、TRN2；正则本身也不是严格五文件集合校验。','import:1838');
n('i-reject',imp,1,-1,'异常 · 拒绝导入','boundary','抛出 BusinessException：导入源文件夹无数据或数据格式不正确。','import:1839');
n('parse',imp,2,0,'I3 · 逐文件解析【展开】','step','for 循环逐个调用 parseTxtFile。业务分支为 CIF、AIF、BLN、TRN；REPORT 无业务解析分支。','import:1843');
n('cfa',imp,0,1,'I4 · CFA 贷款加工【展开】','step','importCFATab(importDate)：读取当天 TransactionTab，形成 CA/CB/DA/DB 四类贷款中间表。需要时读取 Customer 和已存在的正式签约／余额记录。','import:1847');
n('proc',imp,1,1,'I5 · proc_processData（内部未知）','boundary','Java 确实调用 {call proc_processData(?)}，参数 yyyy-MM-dd。原始过程体未取得，不能断言它回填 BOP 客户号、转换币种或连接 RCPMIS。当前测试库按此前授权创建的是空过程；那不是原始业务实现。','import:1850',false);
n('i-archive',imp,2,1,'I6 · 移动源目录 → 历史目录','step','调用 moveFolderSrc(srcImportDir,importHisDir + systemDate)，不是仅归档成功解析的四个 TXT。过程调用报错时不会继续执行该行。移动函数的内部及事务一致性待进一步核验。','import:1854');
n('i-end',imp,2,2,'I7 · 返回导入消息','boundary','捕获 BusinessException／Exception 后重新抛出；无异常时 return msg。不能据此推断所有 SQL 与文件操作是原子的。','import:1857');
chain(['i-dir','i-count']);e('i-count','i-reject','否');e('i-count','parse','是');chain(['parse','cfa','proc','i-archive','i-end']);

// L2 file dispatch; arrows represent alternatives, not fixed file order.
n('p-read','parse',0,2,'F0 · 打开 TXT／按文件名前缀分派','decision','UnicodeReader；读取首行，取文件名点号前部分。以下连线是单个文件的不同分支，不是五路并行或固定顺序。','import:2500');
n('p-cif','parse',1,0,'F1 · CIF2 → CifTab','table','按 | 拆字段并构造客户中间记录；truncate CifTab 后 saveAll 全量替换。此处不是直接写 Customer 正式客户表。','import:2508');
n('p-aif','parse',1,1,'F2 · AIF2 → AifTab','table','构造账户记录，经过 isAccountIdFlag() 条件筛选；truncate AifTab 后 saveAll。账户判定辅助方法内部留待继续展开。','import:2549');
n('p-bln','parse',1,2,'F3 · BLN2 → BlnTab','table','币种 RUR → RUB 明确发生在 BLN 解析 Java 分支；busDate 取日期字段 split("-")[0]。按首条记录业务日期删除旧余额，再保存列表。该转换不能据此归给 proc_processData。','import:2580');
n('bop','parse',1,3,'F4 · TRN2 → 交易／BOP【展开】','step','构造 TransactionTab 列表；先 converVtbBopTransaction，再按列表首条交易日期删除旧 TransactionTab 并保存。当列表为空时，调用转换器取首条日期的表达式有越界风险。','import:2608');
n('p-report','parse',1,4,'F5 · REPORT → 无状态解析','boundary','匹配文件数包含 REPORT。parseTxtFile 会打开并读取首行，但没有 REPORT 分支，未见内容状态成功／失败校验。不是“状态文件校验通过才导入”。','import:2506');
n('p-close','parse',2,2,'F6 · 关闭 reader／继续下一文件','boundary','finally 中关闭 reader；逐文件循环结束后才进行 CFA 贷款加工。异常继续向外传播。','import:2706');
for(const id of ['p-cif','p-aif','p-bln','bop','p-report']) { e('p-read',id,id==='p-report'?'无匹配业务分支':'对应前缀');e(id,'p-close'); }

// L3 BOP conversion: two independent account tests.
n('b-start','bop',0,1,'T1 · TRN 列表 → 转换 BOP','step','先读取 Customer 客户映射；逐笔交易执行两个相互独立的 if。每笔可能产生 0、1 或 2 条 BopTransaction。不是 BOPA–F 正式分类报表。','import:2709');
n('b-own','bop',1,0,'T2 · 本方账户命中？','decision','isAccountIdFlag() 为真则构造一条；CNUM=customerCode，ACOD=accountId，opName=oppositerName。paymentFlag==01 → C，否则 D。金额直接取 tradeAmount，不取绝对值。','import:2717');
n('b-opp','bop',1,1,'T3 · 对方账户命中？','decision','独立调用 isOppositersAccountIDFlag()。命中时 ACOD=oppositersAccountID；opName 从本方 customerCode 对应 Customer 名称获取。paymentFlag==02 → C，否则 D。本分支回填 CNUM 的代码被注释，实际未赋值。','import:2750');
n('b-save','bop',2,1,'T4 · 非空才替换 BopTransaction','table','bopList 非空：按传入 importDate 删除旧数据并 saveAll；为空：不删除原有该日 BOP。日期参数来自 TRN 列表首条交易日期。','import:2791');
n('b-trn','bop',3,1,'T5 · 替换 TransactionTab','table','BOP 转换完成后才删除／保存交易中间表。TransactionTab 删除范围由列表首条 transactionDate 决定，不是逐个日期删除。','import:2696');
chain(['b-start','b-own','b-opp','b-save','b-trn']);

// L2 CFA transaction walk. CA then DA are independent tests, not alternatives.
n('c-load','cfa',0,0,'C1 · 当天交易 + DA 排除名单','step','按 importDate 的 yyyyMMdd 查询 TransactionTab；加载 cfaCnumFilter.properties 中 DA 的 | 分隔客户名单。不是从四张客户表读取当天客户信息。','cfa:97');
n('c-filter','cfa',1,0,'C2 · 排除客户／用途筛选','decision','逐笔：customerCode==829240 不进入处理；usage 不包含 LD 时 continue。贷款号由用途中 LD 开始截取 13 字符，长度不足可能抛异常。','cfa:113');
n('c-skip','cfa',2,-1,'跳过本笔／处理下一笔','boundary','客户 829240、用途无 LD，或还本付息分支找不到所需正式签约记录时，本笔后续处理被跳过。尤其 CA 分支的 continue 会影响同笔后续 DA/DB 分支。','cfa:115');
n('ca-stage','cfa',2,0,'C3 · 国内外汇贷款 CA/CB【展开】','step','按用途分别测试放款、还本、付息；均限制非 CNY。放款形成 CA 签约 + CB 提款；还本付息依赖正式 CFACA，生成 CB。','cfa:120');
n('da-stage','cfa',0,1,'C4 · 外保内贷 DA/DB【展开】','step','在 CA/CB 判断之后独立判断，不是 else。放款仅检查 DA 客户排除名单，无非 CNY 限制；还本付息也没有该排除名单条件。满足条件的同笔贷款可同时进入两组业务。','cfa:196');
n('c-loop','cfa',1,1,'C5 · 继续下一笔，累积四列表','step','依次执行六个 if，直至交易循环结束；CA/CB/DA/DB 此时仍为内存列表，不是在每笔分支立即落库。','cfa:113');
n('c-save','cfa',2,1,'C6 · 中间表落库【展开】','table','全部交易处理后，按 DA → DB → CA → CB 顺序保存。各列表只有非空才删除该导入日期旧数据并 saveAll。四张是贷款业务中间表，不是客户分类表。','cfa:272');
chain(['c-load','c-filter']);e('c-filter','c-skip','不满足');e('c-filter','ca-stage','满足');chain(['ca-stage','da-stage','c-loop','c-save']);e('c-skip','c-loop','下一笔',true);e('c-loop','c-filter','尚有交易',true);

n('ca-issue','ca-stage',0,0,'CA1 · 放款 + 非 CNY？','decision','usage startsWith LOAN ISSUE 且 currencyCode != CNY。生成 CFACATab：债权人=当前机构；债务人代码／名称来自 Customer（不存在则空串）；合同金额=abs(tradeAmount)，起息日=交易日。同步生成 CFACBTab 提款：期初0、提款与期末=abs(金额)。','cfa:120');
n('ca-principal','ca-stage',1,0,'CA2 · 还本条件命中？','decision','PRINCIPAL REPAYMENT + 非 CNY + !isOppositersAccountIDFlag()。必须查到正式 CFACA，否则 continue 跳过本笔剩余处理。查 CFACB 历史方法：期初=历史期末或0；还本=abs(金额)；期末=历史期末−还本，历史缺失时竟取还本金额（如实呈现，业务合理性待验证）。','cfa:151');
n('ca-interest','ca-stage',2,0,'CA3 · 付息条件命中？','decision','INT REPAYMENT + 非 CNY + !isOppositersAccountIDFlag()。正式 CFACA 缺失则 continue。CFACBTab 付息=abs(金额)；期末=历史期末−payAmount，本分支 payAmount 为0；无历史记录时为 null。历史 DAO 的具体选数规则待展开。','cfa:174');
n('ca-out','ca-stage',1,1,'CA4 · 累积 CA 签约／CB 变动','table','三个判断是源码顺序，不是三个都执行。未命中继续下一个 if；未因 continue 跳过本笔时，随后仍执行 DA/DB 判断。CA、CB 是中间表列表，正式签约依赖读取的是 CFACA 而不是本次尚未落库的 CFACATab。','cfa:132');
chain(['ca-issue','ca-principal','ca-interest']);e('ca-interest','ca-out','未 continue');

n('da-issue','da-stage',0,0,'DA1 · 放款 + 不在排除名单？','decision','LOAN ISSUE 且客户不在 DA 名单，无币种条件。生成 CFADATab 签约 + CFADBTab 提款。Customer 在此直接取编码／名称，无 CA 分支的空值保护。金额取绝对值；DA dealNo 去双引号，DB dealNo 不做同样去除。','cfa:196');
n('da-principal','da-stage',1,0,'DA2 · 还本条件命中？','decision','PRINCIPAL REPAYMENT + !isOppositersAccountIDFlag()；无 DA 排除名单和非 CNY 限制。正式 CFADA 不存在则 continue。DB 还本=abs(金额)；本金余额=历史本金余额−还本，无历史则 null。','cfa:228');
n('da-interest','da-stage',2,0,'DA3 · 付息条件命中？','decision','INT REPAYMENT + !isOppositersAccountIDFlag()；正式 CFADA 不存在则 continue。picAmount=abs(金额)；本金余额=历史余额−rePayAmount，本分支 rePayAmount 为0；无历史则 null。','cfa:250');
n('da-out','da-stage',1,1,'DA4 · 累积 DA 签约／DB 变动','table','保证履约金额／担保责任余额等赋值代码被注释，不应画成已加工字段。下一笔交易重新将 payAmount 和 rePayAmount 初始化为0。','cfa:220');
chain(['da-issue','da-principal','da-interest']);e('da-interest','da-out','未 continue');

for(const [id,col,label,line,desc] of [
 ['s-da',0,'CFADATab · 外保内贷签约',275,'daTabList'],
 ['s-db',1,'CFADBTab · 外保内贷变动',279,'dbTabList'],
 ['s-ca',2,'CFACATab · 国内外汇贷款签约',283,'caTabList'],
 ['s-cb',3,'CFACBTab · 国内外汇贷款变动',287,'cbTabList'],
]) n(id,'c-save',col,0,label,'table',desc+' 非空才执行：delete 对应表 where importDate=yyyyMMdd，然后 saveAll。为空则保留原该日数据，重跑时有残留风险。','cfa:'+line);
chain(['s-da','s-db','s-ca','s-cb'],'依次判断列表非空');

// L1 extraction dispatch.
n('x-select','extract',0,1,'E1 · extractVTBData(fileTypes)','decision','以下为独立正则匹配，源码顺序 ACC → JSH → CFA → FAL；并非互斥选择，也不是自动全量执行。图中分叉用于展示报表家族。','import:2796');
n('x-acc','extract',1,-1,'E2 · ACCCA / ACCCB','step','调用顺序：importVTBCustomerData → importVTBAccountData(extractDate) → importVTBBalanceData(extractDate)。本层核验调用链，三个服务的字段加工规则待后续展开。','import:2800');
n('x-jsh','extract',1,0,'E3 · JSH D/E/F/G','step','调用 faeBaseInfoService.importFAEBaseInfoData(extractDate)。内部过滤与落表待后续展开。','import:2811');
n('x-cfa','extract',1,1,'E4 · CFA 报表分派【展开】','step','调用 cfaMetroExtractService.extractCfaData(fileTypes,extractDate)，共享提取器按报表类型执行各服务；不要把共享支持的所有报表等同于 VTB 页面可选项。','import:2819');
n('x-fal','extract',1,2,'E5 · FAL 金融资产负债','step','调用 extractFalData(extractDate,fileTypes,"true",fileType)。FAL 存在另一个 importVTBFalData Excel 导入入口，不应把它画成由四个 TXT 必然生成。此处仅追踪分派边界。','import:2824');
n('x-msg','extract',2,1,'E6 · 返回提取消息','boundary','各匹配服务执行完成后返回 msg；捕获异常后重新抛出。具体每张表写入情况由对应提取器决定。','import:2829');
n('x-bop','extract',1,3,'边界 · 此方法没有 BOP 分派','boundary','在 extractVTBData 中未见 BOPA–F 的匹配分支。不能从 TRN 生成 BopTransaction 推断此提取入口已经生成 BOPA–F；也不能据此断言整个系统不支持 BOP。','import:2796');
for(const id of ['x-acc','x-jsh','x-cfa','x-fal']) {e('x-select',id,'所选类型匹配');e(id,'x-msg');}

n('xcf-start','x-cfa',0,1,'CFA 提取 · 按 fileTypes 分派','decision','共享方法支持多种 CFA。VTB 页面可选 AN、AS、CA、CB、DA、DB；本图聚焦贷款四张。按源码顺序匹配：CA → CB → DA → DB，选择多个时依次执行。','dispatch:110');
n('formal-ca','x-cfa',1,0,'CFACATab → CFACA【展开】','step','cfacaMetroExtractService.extractData(extractDate)。双击查看新增、更新、跳过、逐笔异常及缺失记录处理。','dispatch:151');
n('formal-cb','x-cfa',1,1,'CFACB · 正式变动提取入口','step','分派至 cfacbMetroExtractService.extractData(extractDate)。本节点只确认调用入口；实际选数、余额字段及覆盖策略待读取该服务后展开。','dispatch:156');
n('formal-da','x-cfa',1,2,'CFADA · 正式签约提取入口','step','分派至 cfadaMetroExtractService.extractData(extractDate)。本节点只确认调用入口；内部新增／更新条件不应直接套用 CFACA。','dispatch:159');
n('formal-db','x-cfa',1,3,'CFADB · 正式变动提取入口','step','分派至 cfadbMetroExtractService.extractData(extractDate)。本节点只确认调用入口；内部规则待展开。','dispatch:162');
n('xcf-other','x-cfa',1,-1,'AN / AS 等其他 CFA','boundary','共享分派器还有 AC、AF、AL、AM、AN、AP、AR、AS、BA、BB、BC、EA、EB 等分支。当前未深入这些提取器，不能把 CA/CB/DA/DB 贷款链当成 VTB 全部业务。','dispatch:110');
for(const id of ['formal-ca','formal-cb','formal-da','formal-db','xcf-other']) e('xcf-start',id,'类型匹配');

// L3 actual CFACA state decisions.
n('q-load','formal-ca',0,1,'A1 · 读取当日 CFACATab','step','getCFACATabList(extractDate)，逐条处理并收集 dealNo。','ca:47');
n('q-find','formal-ca',1,1,'A2 · 按 dealNo 找 CFACA','decision','HQL from CFACA a where a.dealNo=?，此查询没有日期或机构筛选；存在多条时取第一条。','ca:55');
n('q-create','formal-ca',2,0,'A3 · 不存在 → 新增 A','step','new CFACA；actionType=A；拷贝业务字段；状态ID设为101001/102001/103001；设置操作人、importDate、VTB 当前机构，save。本图不猜测数字状态的业务名称。','ca:121');
n('q-change','formal-ca',2,1,'A4 · 102002 且到期日变化？','decision','优先判断 sendStatus==102002 且正式 maturity.compareTo(中间 maturity)!=0。空 maturity 有空指针风险。命中则更新到期日与利率，actionType=C，重设确认／发送状态和日期。','ca:60');
n('q-action','formal-ca',3,1,'A5 · 否则 actionType == A？','decision','是：继续判断 confirmStatus==101002 且 valueDate 相同；命中则 continue，不更新。否则拷贝中间字段并保存。非 A 且未命中到期日变更分支则不写。','ca:70');
n('q-save','formal-ca',3,0,'A6 · 按命中分支保存／跳过','step','新增、变更 C、更新 A、跳过是不同路径；不是一律删除重建，也不是有 dealNo 就全部覆盖。','ca:68');
n('q-errors','formal-ca',2,2,'A7 · 逐笔异常 → 计错并记录','boundary','单条 catch 增加 errorRow 并记日志，随后继续循环。此结构不保证事务内异常后还能全部成功，不应把“返回统计”当成全表成功。','ca:159');
n('q-missing','formal-ca',4,1,'A8 · 缺失 dealNo 检查','step','循环后查询当日特定 fill/confirm 状态且不在本次 dealNo 中的记录。C 分支改 D 的语句被注释；A 分支删除语句也被注释。不能声称本步骤会清掉所有残留正式数据。','ca:168');
n('q-end','formal-ca',5,1,'A9 · 返回总数／新增／更新／错误','boundary','返回提取统计。后续校验、审核、报文生成与发送不在本图已核验范围内。','ca:43');
chain(['q-load','q-find']);e('q-find','q-create','不存在');e('q-find','q-change','存在');e('q-change','q-save','是：变更 C');e('q-change','q-action','否');e('q-action','q-save','允许更新 A');e('q-action','q-missing','跳过／循环完成',true);e('q-create','q-save');e('q-save','q-missing','全部记录处理后');e('q-find','q-errors','单条异常',true);e('q-errors','q-missing','循环完成',true);e('q-missing','q-end');

// Validate hierarchy, endpoints, and source anchors before any mutation.
const nodeMap = new Map(graph.nodes.map(node=>[node.id,node]));
assert.equal(nodeMap.size,graph.nodes.length);
assert.equal(new Set(graph.edges.map(edge=>edge.id)).size,graph.edges.length);
for(const node of graph.nodes) {
  const seen = new Set([node.id]); let scope=node.data.scope;
  while(scope!=='root') { assert(nodeMap.has(scope),'Missing parent '+scope);assert(!seen.has(scope),'Scope cycle');seen.add(scope);scope=nodeMap.get(scope).data.scope; }
  if(node.data.source) {
    const anchor=node.data.description.split('源码：').at(-1);
    const sep=anchor.lastIndexOf(':'); const lines=(await fs.readFile(anchor.slice(0,sep),'utf8')).split('\n');
    assert(lines[Number(anchor.slice(sep+1))-1]?.trim(),'Missing source line '+anchor);
  }
}
for(const edge of graph.edges) { assert(nodeMap.has(edge.source)&&nodeMap.has(edge.target));assert.equal(nodeMap.get(edge.source).data.scope,nodeMap.get(edge.target).data.scope); }
await fs.writeFile(path.join(out,'vtb-safe1-flowchart.graph.json'),JSON.stringify(graph,null,2));
console.log(JSON.stringify({nodes:graph.nodes.length,edges:graph.edges.length,scopes:new Set(graph.nodes.map(n=>n.data.scope)).size,unverified:graph.nodes.filter(n=>!n.data.verified).map(n=>n.id)}));
if(process.argv.includes('--apply')) {
  async function getItem() { const r=await fetch(base+'/flowcharts/items'); assert(r.ok);const items=await r.json();return items.find(i=>i.id===itemId); }
  const before=await getItem();assert(before);assert.equal(before.title,'VTB-一代SAFE代码解析');
  assert.equal(before.updatedAt,'2026-09-08T08:32:10.406Z','Task changed; stop rather than overwrite user edits');
  const backup=path.join(out,'vtb-safe1-flowchart.before-20260908.json');
  await fs.writeFile(backup,JSON.stringify(before,null,2),{flag:'wx'});
  const response=await fetch(base+'/items/'+itemId,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:{...before.content,graph}})});
  assert(response.ok,await response.text());
  const after=await getItem();assert.deepEqual(after.content.graph,graph);assert.equal(after.title,before.title);
  await fs.writeFile(path.join(out,'vtb-safe1-flowchart.saved.json'),JSON.stringify(after,null,2));
  console.log(JSON.stringify({saved:true,itemId,updatedAt:after.updatedAt,backup}));
}
