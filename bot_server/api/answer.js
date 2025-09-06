// *** Node.js ランタイム用 API Route ***

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

function computeScoring(ab={}) {
  let c=0,p=0;
  if(ab.q1==='A')c++;else if(ab.q1==='B')p++;
  if(ab.q2==='A')c++;else if(ab.q2==='B')p++;
  if(ab.q5==='A')c++;else p++;
  if(ab.q6==='A')c++;else p++;
  if(ab.q7==='A')c++;else p++;
  if(ab.q8==='B')c++;else p++;
  const typeKey=(c-p>=2)?'challenge':(p-c>=2)?'plan':'balance';
  return {challenge:c, plan:p, typeKey};
}

module.exports = async function handler(req,res){
  if(req.method==='GET') return res.status(200).json({ok:true});
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'Method Not Allowed'});
  try{
    const body=req.body||{};
    const ab=body.answers?.ab||{};
    const scoring=computeScoring(ab);
    const row={ ...body, scoring };
    const { data, error } = await supabase.from('responses').insert(row).select().single();
    if(error) throw error;
    return res.status(200).json({ok:true,data});
  }catch(e){
    console.error('API error',e);
    return res.status(500).json({ok:false,error:e.message});
  }
};
