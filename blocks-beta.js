
(() => {
 const $=s=>document.querySelector(s),sb=window.BLOCKS.sb;
 const account=$("#blocks-beta-account"),form=$("#blocks-beta-form"),submit=$("#blocks-beta-submit"),result=$("#blocks-beta-result");
 let user=null;
 const showResult=(message,type)=>{result.textContent=message;result.className="bl-status "+(type||"");};
 async function init(){
  try{
   user=await window.BLOCKS.user();
   if(!user){
    account.textContent="신청하려면 Discord 로그인이 필요해요.";
    form.classList.add("bl-hidden");
    const login=document.createElement("button");login.className="bl-btn primary";login.textContent="Discord로 로그인";login.type="button";login.style.width="100%";
    login.addEventListener("click",()=>window.BLOCKS.login(new URL("./blocks-beta.html",location.href).href));
    account.after(login);return;
   }
   account.textContent="로그인 계정 · "+window.BLOCKS.discordName(user);
   const {data:tester,error:testerError}=await sb.rpc("blocks_is_beta_tester");
   if(!testerError&&tester){location.replace("./blocks-dashboard.html");return;}
   const {data:rows,error}=await sb.from("blocks_beta_applications").select("status,admin_note,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1);
   if(error)throw error;
   const latest=rows?.[0];
   if(latest?.status==="pending"){form.classList.add("bl-hidden");showResult("신청이 접수되어 검토를 기다리고 있어요. 승인되면 이 계정에 베타 권한이 부여됩니다.");}
   else if(latest?.status==="rejected"){showResult("이전 신청은 승인되지 않았어요."+ (latest.admin_note?" 검토 의견: "+latest.admin_note:"")+" 내용을 보완해 다시 신청할 수 있어요.","error");}
  }catch(error){console.error("BLOCKS beta application load failed",error);account.textContent=error.message||"신청 정보를 불러오지 못했어요.";}
 }
 form.addEventListener("submit",async e=>{
  e.preventDefault();if(!user)return;
  submit.disabled=true;submit.textContent="신청 등록 중…";
  try{
   const {data,error}=await sb.rpc("blocks_submit_beta_application",{application_experience:$("#blocks-experience").value,application_purpose:$("#blocks-purpose").value.trim()});
   if(error)throw error;
   if(data?.status==="approved"){location.href="./blocks-dashboard.html";return;}
   form.classList.add("bl-hidden");showResult(data?.already_submitted?"이미 신청이 접수되어 검토 중이에요.":"신청이 접수됐어요. 최고관리자의 승인을 기다려 주세요.","success");
  }catch(error){console.error("BLOCKS beta submit failed",error);showResult(error.message||"신청을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.","error");submit.disabled=false;submit.textContent="베타테스터 신청하기";}
 });
 init();
})();
