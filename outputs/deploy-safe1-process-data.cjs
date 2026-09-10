const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sql = require('../apps/server/node_modules/mssql');
const configPath = '/Users/binkerking/Documents/Riking-Project/Tomcat/tomcat-9.0.120-fbds/webapps/fbds_vtb/WEB-INF/classes/net/config/applicationContext-hib.xml';
const sourcePath = '/Users/binkerking/Downloads/proc_processData.sql';
const xml = fs.readFileSync(configPath,'utf8').replace(/<!--[\s\S]*?-->/g,'');
const props = Object.fromEntries([...xml.matchAll(/<property\s+name="([^"]+)"\s+value="([^"]*)"/g)].map(m=>[m[1],m[2].replaceAll('&amp;','&')]));
const match = props.driverUrl.match(/^jdbc:jtds:sqlserver:\/\/([^:]+):(\d+)\/([^;]+)$/);
assert(match);assert.equal(match[3],'fbdsALL');
const config={server:match[1],port:Number(match[2]),database:match[3],user:props.user,password:props.password,options:{encrypt:false,trustServerCertificate:true},requestTimeout:30000};
const definitionQuery="SELECT o.object_id, o.type, m.definition, m.uses_ansi_nulls, m.uses_quoted_identifier FROM sys.objects o LEFT JOIN sys.sql_modules m ON m.object_id=o.object_id WHERE o.object_id=OBJECT_ID(N'dbo.proc_processData')";
async function main(){
 const pool=await new sql.ConnectionPool(config).connect();
 try{
  const identity=(await pool.request().query('SELECT DB_NAME() AS database_name, CONVERT(nvarchar(128),SERVERPROPERTY(\'ServerName\')) AS server_name')).recordset[0];
  assert.equal(identity.database_name,'fbdsALL');
  const before=(await pool.request().query(definitionQuery)).recordset[0]||null;
  const dependencies=(await pool.request().query("SELECT s.name AS schema_name,o.name,o.type_desc FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id WHERE o.name IN ('BopTransaction','Account','CUSTOMER','BlnTab','VTB_RCPMIS_ACCT','proc_extract_rcpmis_2121','proc_extract_rcpmis_2105y','proc_extract_rcpmis_2105n') ORDER BY o.name")).recordset;
  console.log(JSON.stringify({identity,existing:before,dependencies},null,2));
  if(process.argv.includes('--columns'))console.log(JSON.stringify((await pool.request().query("SELECT OBJECT_NAME(c.object_id) AS table_name,c.name,TYPE_NAME(c.user_type_id) AS data_type,c.collation_name FROM sys.columns c WHERE c.object_id IN (OBJECT_ID('dbo.BopTransaction'),OBJECT_ID('dbo.Account'),OBJECT_ID('dbo.Customer'),OBJECT_ID('dbo.BlnTab')) AND c.name IN ('ID','Acod','CNUM','accountNo','CustomerId','BankCustomerCode','currency','busDate','importDate','business_Date','ENABLED') ORDER BY table_name,c.column_id")).recordset,null,2));
  if(!process.argv.includes('--apply'))return;
  if(before){assert.equal(before.type,'P');assert(before.definition,'Cannot back up encrypted definition');}
  const source=fs.readFileSync(sourcePath,'utf8').replace(/^\uFEFF/,'');
  const batches=source.split(/^\s*GO\s*$/mi).map(s=>s.trim()).filter(Boolean);
  const create=batches.find(s=>/^CREATE\s+PROCEDURE\s+\[dbo\]\.\[proc_processData\]/i.test(s));
  assert(create,'Exactly scoped procedure batch required');
  assert.equal(batches.filter(s=>/^CREATE\s+PROCEDURE/i.test(s)).length,1);
  const originalJoin='BOP.Acod = ACC.ACCNO';
  const compatibleJoin='BOP.Acod COLLATE SQL_Latin1_General_CP1_CI_AS = ACC.ACCNO';
  assert.equal(create.split(originalJoin).length,2,'Expected exactly one account-number join');
  const compatible=create.replace(originalJoin,compatibleJoin);
  assert.equal(compatible.replace(compatibleJoin,originalJoin),create,'Only the approved join may change');
  const deploy=before?compatible.replace(/^CREATE\s+PROCEDURE/i,'ALTER PROCEDURE'):compatible;
  const backupDir=path.join(__dirname,'safe1-proc-processData-'+new Date().toISOString().replaceAll(':','-'));
  fs.mkdirSync(backupDir,{mode:0o700});
  fs.writeFileSync(path.join(backupDir,'before.json'),JSON.stringify({identity,before,dependencies},null,2),{mode:0o600});
  fs.copyFileSync(sourcePath,path.join(backupDir,'source-original.sql'));
  if(before)fs.writeFileSync(path.join(backupDir,'restore.sql'),`USE [fbdsALL]\nGO\nSET ANSI_NULLS ${before.uses_ansi_nulls?'ON':'OFF'}\nGO\nSET QUOTED_IDENTIFIER ${before.uses_quoted_identifier?'ON':'OFF'}\nGO\n${before.definition.replace(/^\s*CREATE\s+(?:OR\s+ALTER\s+)?PROCEDURE/i,'ALTER PROCEDURE')}\nGO\n`);
  const transaction=new sql.Transaction(pool);await transaction.begin();
  try{
   const request=new sql.Request(transaction);
   const current=(await request.query(definitionQuery)).recordset[0]||null;assert.deepEqual(current,before,'Procedure changed concurrently');
   await request.batch('SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON;');
   await request.batch(deploy);
   const after=(await request.query(definitionQuery)).recordset[0];
   assert.equal(after.definition.trim(),deploy.trim(),'Stored definition differs from supplied body');
   assert.equal(after.uses_ansi_nulls,true);assert.equal(after.uses_quoted_identifier,true);
   if(before)assert.equal(after.object_id,before.object_id,'Existing object identity must be preserved');
   await transaction.commit();
   const committed=(await pool.request().query(definitionQuery)).recordset[0];
   assert.equal(committed.definition.trim(),deploy.trim(),'Committed definition mismatch');
   fs.writeFileSync(path.join(backupDir,'deployed.sql'),after.definition);
   console.log(JSON.stringify({deployed:true,database:identity.database_name,procedure:'dbo.proc_processData',backupDir,executedProcedure:false}));
  }catch(error){await transaction.rollback();throw error;}
 }finally{await pool.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
