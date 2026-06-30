require('dotenv').config();
async function callSmm(params){
 const url=process.env.SMM_API_URL; const key=process.env.SMM_API_KEY;
 if(!url||!key||key.includes('coloque_')) throw new Error('API SMM não configurada no .env');
 const body=new URLSearchParams({key,...params});
 const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
 const data=await res.json().catch(()=>({error:'Resposta inválida do fornecedor'}));
 if(data.error) throw new Error(data.error);
 return data;
}
module.exports={callSmm};
