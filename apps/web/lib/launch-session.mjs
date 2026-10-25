/** Runs in the document head, before the splash can be painted or React hydrates. */
export const LAUNCH_BOOTSTRAP = String.raw`(()=>{
  const root=document.documentElement;
  const key="scholau.launch.session";
  const navigation=performance.getEntriesByType("navigation")[0];
  const returning=navigation?.type==="reload"||navigation?.type==="back_forward";
  let seen=false;
  try {
    seen=Boolean(sessionStorage.getItem(key)||sessionStorage.getItem("scholau-splash-blue-v4")||sessionStorage.getItem("scholau-splash-orbit-v2")||sessionStorage.getItem("scholau-splash-white-v5"));
    sessionStorage.setItem(key,"active");
  } catch {
    try { seen=Boolean(document.referrer&&new URL(document.referrer).origin===location.origin); } catch {}
  }
  root.dataset.scholauLaunch=returning||seen?"warm":"cold";
  const finish=()=>{root.dataset.scholauLaunch="warm";};
  if(root.dataset.scholauLaunch==="cold") setTimeout(finish,8000);
  addEventListener("pageshow",event=>{if(event.persisted)finish();});
  addEventListener("pagehide",finish);
})();`;
