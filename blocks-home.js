
(() => {
 const button=document.getElementById("blocks-start");
 if(!button)return;
 button.addEventListener("click",async()=>{
  button.disabled=true;button.textContent="계정 확인 중…";
  try{
   const user=await window.BLOCKS.user();
   if(!user){await window.BLOCKS.login(new URL("./blocks.html",location.href).href);return;}
   const allowed=await window.BLOCKS.tester();
   location.href=allowed?"./blocks-dashboard.html":"./blocks-beta.html";
  }catch(error){console.error("BLOCKS start failed",error);window.BLOCKS.notify(error.message||"계정 확인에 실패했어요.");button.disabled=false;button.textContent="시작하기 →";}
 });
})();
