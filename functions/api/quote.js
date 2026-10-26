export async function onRequestPost({ request, env }) {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers });
  if (!env.RESEND_API_KEY || !env.CONTACT_EMAIL || !env.FROM_EMAIL) return json(503, { error: "Le service d’envoi n’est pas encore configuré." });
  let d; try { d = await request.json(); } catch { return json(400, { error: "Requête invalide." }); }
  if (String(d.website || "").trim()) return json(200, { ok: true });
  const required = ["aircraft","quantity","usage","firstName","lastName","company","email","country","projectDetails"];
  for (const key of required) if (typeof d[key] !== "string" || !d[key].trim() || d[key].length > 3000) return json(400, { error: "Certains champs obligatoires sont manquants ou invalides." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) || d.email.length > 254) return json(400, { error: "Adresse e-mail invalide." });
  if (!(d.consent === "on" || d.consent === true || d.consent === "true")) return json(400, { error: "Le consentement est nécessaire pour traiter la demande." });
  const clean = value => String(value ?? "—").replace(/[<>]/g, "").slice(0, 3000);
  const fields = [
    ["Appareil", d.aircraft], ["Quantité", d.quantity], ["Type d’exploitation", d.usage], ["Configuration de cabine", d.cabinType],
    ["Passagers souhaités", d.passengers], ["Sièges Économie", d.economySeats], ["Sièges Affaires / Premium", d.businessSeats], ["Fret / bagages", d.cargoNeed], ["Charge utile visée (t)", d.payload],
    ["Options demandées", Array.isArray(d.options) ? d.options.join(", ") : d.options], ["Notes cabine", d.cabinNotes], ["Profil de réseau", d.routeProfile], ["Distance habituelle", d.flightDistance], ["Heures annuelles", d.annualHours],
    ["Horizon", d.timeframe], ["Région de livraison", d.deliveryRegion], ["Budget indicatif déclaré", d.budget], ["Description du projet", d.projectDetails],
    ["Prénom", d.firstName], ["Nom", d.lastName], ["Entreprise", d.company], ["Fonction", d.role], ["E-mail", d.email], ["Téléphone", d.phone], ["Pays", d.country]
  ];
  const text = "Nouvelle demande de configuration — Airbus Fleet Explorer\n\n" + fields.map(([k,v]) => `${k}: ${clean(v)}`).join("\n") + "\n\nAucun prix automatique. Projet indépendant, non affilié à Airbus ; cette demande n’est pas une offre ni une commande officielle.";
  const esc = value => clean(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const html = `<h2>Nouvelle demande de configuration</h2><table cellpadding="8" cellspacing="0" border="0">${fields.map(([k,v]) => `<tr><th align="left" valign="top">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table><p><em>Aucun prix automatique. Projet indépendant, non affilié à Airbus ; cette demande n’est pas une offre ni une commande officielle.</em></p>`;
  const resp = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.FROM_EMAIL, to: [env.CONTACT_EMAIL], reply_to: d.email, subject: `Configuration ${clean(d.aircraft)} — ${clean(d.company)}`, text, html }) });
  if (!resp.ok) return json(502, { error: "L’envoi a échoué. Veuillez réessayer plus tard." });
  return json(200, { ok: true });
}
