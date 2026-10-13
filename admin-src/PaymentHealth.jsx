import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Clock3, CreditCard, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";

const stages = ["auth", "checkout", "callback", "webhook"];
const providers = ["viva", "paypal"];
const marketNames = { ro: "Romania", fr: "France", com: "International" };
const colors = {
  ok: { ink: "#176b50", bg: "#e8f4ee", line: "#b9dfcc" },
  error: { ink: "#a34337", bg: "#fbefec", line: "#ecc9c2" },
  unknown: { ink: "#755d32", bg: "#f6f1e5", line: "#e8d9b5" },
};

function formatDate(value, locale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function StatusPill({ status, t }) {
  const knownStatus = status === "ok" || status === "error" ? status : "unknown";
  return <span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 9px",borderRadius:99,border:`1px solid ${colors[knownStatus].line}`,background:colors[knownStatus].bg,color:colors[knownStatus].ink,fontSize:12,fontWeight:700,letterSpacing:".02em"}}>
    <span aria-hidden="true" style={{width:6,height:6,borderRadius:"50%",background:"currentColor"}} />{t(`paymentHealth.status.${knownStatus}`)}
  </span>;
}

export default function PaymentHealth({ token, market, t, locale = "en" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState("");
  const [checkResult, setCheckResult] = useState(null);

  const loadHealth = useCallback(async ({ quiet = false } = {}) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await fetch(`/admin/api/payments/health?market=${encodeURIComponent(market || "all")}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`${response.status}`);
      setData(await response.json());
    } catch (err) {
      setError(err.message === "401" || err.message === "403" ? t("paymentHealth.errorAuth") : t("paymentHealth.errorLoad"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [market, token, t]);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  const runAuthCheck = async (provider, channelMarket) => {
    const key = `${provider}:${channelMarket}`;
    setChecking(key);
    setCheckResult(null);
    setError("");
    try {
      const response = await fetch("/admin/api/payments/health/check-auth", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ provider, market: channelMarket }),
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const result = await response.json();
      setCheckResult({ ...result, provider, market: channelMarket });
      await loadHealth({ quiet: true });
    } catch (err) {
      setError(err.message === "401" || err.message === "403" ? t("paymentHealth.errorAuth") : t("paymentHealth.errorCheck"));
    } finally {
      setChecking("");
    }
  };

  const channels = useMemo(() => data?.channels || [], [data]);
  const events = useMemo(() => data?.events || [], [data]);
  const alerts = useMemo(() => data?.alerts || [], [data]);
  const localeCode = locale === "ro" ? "ro-RO" : locale === "fr" ? "fr-FR" : "en-GB";
  const channelKey = (provider, channelMarket) => `${provider}:${channelMarket}`;
  const sortedEvents = [...events].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const sortedAlerts = [...alerts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const frame = { background:"#fff", border:"1px solid #e1e8e5", borderRadius:12, boxShadow:"0 2px 8px rgba(24,54,45,.04)" };
  const muted = { color:"#64756f" };
  const heading = { color:"#173b32", margin:0 };

  return (
    <section style={{maxWidth:1440,margin:"0 auto",padding:"24px 26px 40px",color:"#243b35"}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:18,flexWrap:"wrap",marginBottom:20}}>
        <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
          <div style={{width:44,height:44,borderRadius:12,background:"#e8f1ed",color:"#27614f",display:"grid",placeItems:"center",flex:"0 0 auto"}}><Activity size={21}/></div>
          <div>
            <div style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".13em",color:"#678078",marginBottom:6}}>{t("paymentHealth.kicker")}</div>
            <h1 style={{...heading,fontSize:25,letterSpacing:"-.03em"}}>{t("paymentHealth.title")}</h1>
            <p style={{...muted,fontSize:14,lineHeight:1.55,margin:"7px 0 0",maxWidth:760}}>{t("paymentHealth.description")}</p>
          </div>
        </div>
        <button type="button" onClick={() => loadHealth({ quiet:true })} disabled={refreshing || loading} style={{display:"inline-flex",alignItems:"center",gap:8,border:"1px solid #cad8d2",borderRadius:8,background:"#fff",color:"#214d40",fontWeight:700,padding:"10px 14px",cursor:refreshing||loading?"wait":"pointer"}}>
          <RefreshCw size={15} className={refreshing ? "payment-health-spin" : ""}/>{refreshing ? t("paymentHealth.refreshing") : t("paymentHealth.refresh")}
        </button>
      </header>

      <div style={{...frame,background:"#f0f5f2",borderColor:"#d8e5de",padding:"14px 17px",display:"flex",gap:12,alignItems:"flex-start",marginBottom:22}}>
        <ShieldCheck size={18} color="#38725d" style={{flex:"0 0 auto",marginTop:1}}/>
        <div><strong style={{fontSize:13,color:"#234d3f"}}>{t("paymentHealth.monitoringTitle")}</strong><div style={{fontSize:13,color:"#567067",lineHeight:1.55,marginTop:3}}>{t("paymentHealth.monitoringNotice")}</div></div>
      </div>
      {data?.environment === "development" && <div role="status" style={{...frame,background:"#fbf4e7",borderColor:"#ead6aa",padding:"13px 16px",display:"flex",gap:10,alignItems:"flex-start",marginBottom:18,color:"#755d32"}}>
        <AlertTriangle size={17} style={{flex:"0 0 auto",marginTop:1}}/><div style={{fontSize:13,lineHeight:1.55}}><strong>{t("paymentHealth.developmentTitle")}</strong> {t("paymentHealth.developmentNotice")}</div>
      </div>}
      {data?.environment === "production" && <div style={{...muted,fontSize:11,margin:"-12px 0 18px"}}>{t("paymentHealth.environment")}: <strong style={{color:"#34594b"}}>{t("paymentHealth.production")}</strong> · {t("paymentHealth.productionNotice")}</div>}

      {error && <div role="alert" style={{...frame,padding:15,marginBottom:18,borderColor:"#ecc9c2",background:"#fbefec",color:"#873c32",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <span style={{display:"flex",gap:9,alignItems:"center"}}><AlertTriangle size={17}/>{error}</span><button type="button" onClick={() => loadHealth()} style={{border:"1px solid #d8aaa1",background:"transparent",borderRadius:6,padding:"7px 11px",color:"inherit",fontWeight:700,cursor:"pointer"}}>{t("paymentHealth.retry")}</button>
      </div>}

      {checkResult && <div role="status" style={{...frame,padding:14,marginBottom:18,borderColor:checkResult.ok?"#b9dfcc":"#ecc9c2",background:checkResult.ok?"#e8f4ee":"#fbefec",color:checkResult.ok?"#176b50":"#a34337",fontSize:13}}>
        <strong>{checkResult.ok ? t("paymentHealth.checkPassed") : t("paymentHealth.checkFailed")}</strong> — {providers.find(p=>p===checkResult.provider)?.toUpperCase()} · {checkResult.market.toUpperCase()}. {t("paymentHealth.checkScope")}
      </div>}

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,margin:"0 0 11px",flexWrap:"wrap"}}>
        <div><h2 style={{...heading,fontSize:17}}>{t("paymentHealth.channelsTitle")}</h2><div style={{...muted,fontSize:12,marginTop:4}}>{t("paymentHealth.marketScope", { market: market === "all" ? t("paymentHealth.allMarkets") : market?.toUpperCase() })}</div></div>
        <span style={{fontSize:12,...muted}}>{t("paymentHealth.channelCount", { count:channels.length })}</span>
      </div>

      {loading ? <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,310px),1fr))",gap:12}} aria-label={t("paymentHealth.loading")}>
        {[0,1,2].map((item)=><div key={item} style={{...frame,padding:19,minHeight:150}}><div className="payment-health-skeleton" style={{width:"34%",height:13,marginBottom:18}}/><div className="payment-health-skeleton" style={{width:"60%",height:23,marginBottom:16}}/><div className="payment-health-skeleton" style={{width:"86%",height:12}}/></div>)}
      </div> : channels.length === 0 && !error ? <div style={{...frame,padding:"34px 20px",textAlign:"center"}}>
        <div style={{width:42,height:42,borderRadius:12,background:"#f3f2ed",color:"#806c42",display:"grid",placeItems:"center",margin:"0 auto 12px"}}><Clock3 size={19}/></div>
        <h3 style={{...heading,fontSize:16,marginBottom:6}}>{t("paymentHealth.emptyTitle")}</h3><p style={{...muted,fontSize:13,margin:0}}>{t("paymentHealth.emptyBody")}</p>
      </div> : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,340px),1fr))",gap:13,marginBottom:24}}>
        {channels.map((channel) => {
          const key = channelKey(channel.provider, channel.market);
          const authAllowed = channel.provider === "viva" || (channel.provider === "paypal" && channel.market === "fr");
          return <article key={key} style={{...frame,overflow:"hidden"}}>
            <div style={{height:3,background:channel.status==="error"?"#b85c4f":channel.status==="ok"?"#49856d":"#c9ae72"}}/>
            <div style={{padding:"16px 17px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
                <div><div style={{fontSize:11,fontWeight:800,letterSpacing:".12em",color:"#70827b",textTransform:"uppercase"}}>{marketNames[channel.market] || channel.market}</div><h3 style={{...heading,fontSize:20,marginTop:4}}>{channel.provider === "viva" ? "Viva.com" : "PayPal"}</h3></div>
                <StatusPill status={channel.status} t={t}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,margin:"16px 0 14px"}}>
                <div style={{padding:"10px 11px",background:"#f7f9f7",borderRadius:8}}><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:"#788982",fontWeight:700}}>{t("paymentHealth.lastObserved")}</div><div style={{fontSize:12,fontWeight:650,color:"#344d44",marginTop:5}}>{formatDate(channel.lastObservedAt,localeCode)}</div></div>
                <div style={{padding:"10px 11px",background:"#f7f9f7",borderRadius:8}}><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:"#788982",fontWeight:700}}>{t("paymentHealth.lastSuccess")}</div><div style={{fontSize:12,fontWeight:650,color:"#344d44",marginTop:5}}>{formatDate(channel.lastSuccessAt,localeCode)}</div></div>
              </div>
              <div style={{borderTop:"1px solid #edf1ee",paddingTop:10}}>
                {stages.map((stage) => {
                  const record = channel.stages?.find((item) => item.stage === stage);
                  const stageStatus = record?.status || "unknown";
                  return <div key={stage} style={{display:"grid",gridTemplateColumns:"minmax(76px,.8fr) minmax(60px,.55fr) minmax(0,1.6fr)",gap:8,alignItems:"center",padding:"7px 0",borderBottom:"1px solid #f1f3f1",fontSize:12}}>
                    <span style={{fontWeight:700,color:"#405b50"}}>{t(`paymentHealth.stage.${stage}`)}</span><StatusPill status={stageStatus} t={t}/><span style={{...muted,overflowWrap:"anywhere",textAlign:"right"}}>{stageStatus==="error" ? [record?.errorCode,record?.httpStatus ? `HTTP ${record.httpStatus}` : null,record?.responseType].filter(Boolean).join(" · ") || t("paymentHealth.failureRecorded") : formatDate(record?.lastObservedAt,localeCode)}</span>
                    {stageStatus==="error" && <span style={{gridColumn:"1 / -1",fontSize:10,color:"#788982",lineHeight:1.45}}>
                      {[record?.reference && `${t("paymentHealth.reference")}: ${record.reference}`, record?.lastFailureAt && `${t("paymentHealth.lastFailure")}: ${formatDate(record.lastFailureAt,localeCode)}`, record?.lastAlertAt && `${t("paymentHealth.lastAlert")}: ${formatDate(record.lastAlertAt,localeCode)}`].filter(Boolean).join(" · ")}
                    </span>}
                  </div>;
                })}
              </div>
              {authAllowed ? <div style={{marginTop:13,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                <span style={{fontSize:11,...muted}}>{t("paymentHealth.readOnlyAuth")}</span>
                <button type="button" disabled={checking===key} onClick={() => runAuthCheck(channel.provider,channel.market)} style={{display:"inline-flex",gap:7,alignItems:"center",border:0,borderRadius:7,background:"#245c4a",color:"#fff",padding:"9px 11px",fontWeight:700,fontSize:12,cursor:checking===key?"wait":"pointer",opacity:checking===key?.68:1}}>
                  <CreditCard size={14}/>{checking===key?t("paymentHealth.checking"):t("paymentHealth.checkAuth")}
                </button>
              </div> : <div style={{marginTop:13,fontSize:11,...muted}}>{t("paymentHealth.authUnavailable")}</div>}
            </div>
          </article>;
        })}
      </div>}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,440px),1fr))",gap:14}}>
        <section style={{...frame,overflow:"hidden"}}>
          <div style={{padding:"15px 17px",borderBottom:"1px solid #e8eeea",display:"flex",alignItems:"center",gap:9}}><Activity size={17} color="#477362"/><div><h2 style={{...heading,fontSize:16}}>{t("paymentHealth.historyTitle")}</h2><div style={{...muted,fontSize:12,marginTop:3}}>{t("paymentHealth.historyDescription")}</div></div></div>
          {sortedEvents.length===0 ? <div style={{padding:"23px 17px",fontSize:13,...muted}}>{loading?t("paymentHealth.loading"):t("paymentHealth.noEvents")}</div> : <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:470}}><thead><tr style={{textAlign:"left",color:"#71827a",fontSize:10,textTransform:"uppercase",letterSpacing:".08em",background:"#fafbf9"}}>{["event","channel","stage","detail","time"].map((key)=><th key={key} style={{padding:"9px 12px",fontWeight:750}}>{t(`paymentHealth.column.${key}`)}</th>)}</tr></thead><tbody>{sortedEvents.map(event=><tr key={event.id} style={{borderTop:"1px solid #eef1ee"}}><td style={{padding:"10px 12px"}}><StatusPill status={event.status} t={t}/></td><td style={{padding:"10px 12px",fontWeight:700,color:"#3a5549"}}>{event.provider==="viva"?"Viva.com":"PayPal"} · {event.market.toUpperCase()}</td><td style={{padding:"10px 12px"}}>{t(`paymentHealth.stage.${event.stage}`)}</td><td style={{padding:"10px 12px",color:"#65766e"}}>{[event.code,event.httpStatus?`HTTP ${event.httpStatus}`:null].filter(Boolean).join(" · ")||"—"}</td><td style={{padding:"10px 12px",whiteSpace:"nowrap",color:"#65766e"}}>{formatDate(event.createdAt,localeCode)}</td></tr>)}</tbody></table></div>}
        </section>
        <section style={{...frame,overflow:"hidden"}}>
          <div style={{padding:"15px 17px",borderBottom:"1px solid #e8eeea",display:"flex",alignItems:"center",gap:9}}><ShieldAlert size={17} color="#927441"/><div><h2 style={{...heading,fontSize:16}}>{t("paymentHealth.alertsTitle")}</h2><div style={{...muted,fontSize:12,marginTop:3}}>{t("paymentHealth.alertsRecipient")} · {data?.alertRecipient || "—"}</div></div></div>
          {sortedAlerts.length===0 ? <div style={{padding:"23px 17px",fontSize:13,...muted}}>{loading?t("paymentHealth.loading"):t("paymentHealth.noAlerts")}</div> : <div style={{padding:"2px 16px"}}>{sortedAlerts.map(alert=><div key={alert.id} style={{display:"grid",gridTemplateColumns:"minmax(110px,1fr) auto",gap:10,alignItems:"center",padding:"12px 0",borderBottom:"1px solid #eef1ee"}}>
            <div><div style={{fontSize:13,fontWeight:700,color:"#3b5449"}}>{alert.provider==="viva"?"Viva.com":"PayPal"} · {alert.market.toUpperCase()} <span style={{fontWeight:500,color:"#76847e"}}>· {t(`paymentHealth.stage.${alert.stage}`)}</span></div><div style={{fontSize:11,...muted,marginTop:4}}>{t(`paymentHealth.alertKind.${alert.kind}`)} · {formatDate(alert.createdAt,localeCode)}{alert.sentAt?` · ${t("paymentHealth.sentAt")} ${formatDate(alert.sentAt,localeCode)}`:""}</div></div>
            <span title={alert.status==="sent"?t("paymentHealth.sentAcceptedHint"):undefined} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:750,color:alert.status==="sent"?"#176b50":alert.status==="sending"?"#80662f":"#845b35"}}>{alert.status==="sent"?<Check size={13}/>:alert.status==="sending"?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>} {t(`paymentHealth.alertStatus.${alert.status}`)}</span>
          </div>)}</div>}
        </section>
      </div>
      <div style={{...muted,fontSize:11,lineHeight:1.5,marginTop:10}}>{t("paymentHealth.sentAcceptedHint")}</div>
      <style>{`@keyframes ph-shimmer{0%{opacity:.45}50%{opacity:1}100%{opacity:.45}}.payment-health-skeleton{border-radius:5px;background:#e9efeb;animation:ph-shimmer 1.4s ease-in-out infinite}.payment-health-spin{animation:ph-spin .9s linear infinite}@keyframes ph-spin{to{transform:rotate(360deg)}}@media(max-width:650px){.payment-health-table{font-size:11px}}`}</style>
    </section>
  );
}
