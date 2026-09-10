USE [fbds_vtb]
GO

/****** Object:  StoredProcedure [dbo].[proc_processData]    Script Date: 2026/9/8 17:52:48 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO


CREATE PROCEDURE  [dbo].[proc_processData]
@dadt  datetime
as
BEGIN

UPDATE T1 SET
CNUM = T2.BankCustomerCode
FROM BopTransaction T1,(
SELECT BOP.ID,CUST.BankCustomerCode FROM 
BopTransaction BOP
LEFT JOIN
(SELECT ROW_NUMBER() OVER (PARTITION BY accountNo ORDER BY business_Date desc,id desc) AS ROW_,
CASE WHEN LEFT(accountNo,3)='NRA' THEN RIGHT(accountNo,LEN(accountNo)-3) ELSE accountNo END AS ACCNO,
CUSTOMERID FROM Account) ACC
ON 
BOP.Acod = ACC.ACCNO AND ACC.ROW_='1'
LEFT JOIN
(SELECT * FROM CUSTOMER WHERE ENABLED='1') CUST
ON ACC.CustomerId = CUST.ID
WHERE BOP.importDate=@dadt
AND CNUM IS NULL)T2
WHERE T1.ID = T2.ID;

UPDATE BlnTab SET currency ='RUB' WHERE busDate = @dadt and currency ='RUR';
UPDATE VTB_RCPMIS_ACCT SET CCY ='RUB' WHERE  CCY ='RUR';
exec proc_extract_rcpmis_2121 @dadt;
exec proc_extract_rcpmis_2105y @dadt;
exec proc_extract_rcpmis_2105n @dadt;
end
GO

