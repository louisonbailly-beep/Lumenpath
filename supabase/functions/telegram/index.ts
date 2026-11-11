// Gérard, le bot Telegram de Lumenpath.
// Reçoit les messages Telegram (webhook) et les alertes de la base (déclencheur pg_net).
// Ne répond qu'au propriétaire. Toute action qui modifie quelque chose passe par Confirmer / Annuler.
// Secrets lus dans le coffre Supabase (Vault) : telegram_bot_token, telegram_owner_chat_id, telegram_webhook_secret.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
// Moteur de calcul : le même fichier que le site (app/src/core.js), chargé depuis le dépôt public.
const CORE_URLS = [
  "https://cdn.jsdelivr.net/gh/louisonbailly-beep/Lumenpath@main/app/src/core.js",
  "https://louisonbailly-beep.github.io/Lumenpath/app/src/core.js",
];
// deno-lint-ignore no-explicit-any
let C: any = null;
async function engine() {
  if (C) return C;
  for (const u of CORE_URLS) {
    try { const r = await fetch(u); if (!r.ok) continue; new Function(await r.text()).call(globalThis); C = (globalThis as any).OptiCalc; if (C) return C; } catch (_) { /* source suivante */ }
  }
  throw new Error("moteur indisponible");
}
const SITE = "https://louisonbailly-beep.github.io/Lumenpath/";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

let cfg: { token: string; owner: string; secret: string } | null = null;
async function config() {
  if (cfg) return cfg;
  const { data, error } = await sb.rpc("bot_secrets");
  if (error || !data) throw new Error("Secrets du bot introuvables : " + (error?.message ?? ""));
  cfg = { token: data.telegram_bot_token, owner: String(data.telegram_owner_chat_id ?? ""), secret: data.telegram_webhook_secret };
  return cfg;
}

// ---------- Telegram ----------
type Btn = { text: string; callback_data?: string; url?: string };
async function tg(method: string, body: Record<string, unknown>) {
  const { token } = await config();
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
function kb(rows: Btn[][]) { return { inline_keyboard: rows }; }
async function send(text: string, rows: Btn[][] = []) {
  const { owner } = await config();
  if (!owner) return;
  return tg("sendMessage", { chat_id: owner, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb(rows) });
}
async function edit(chat: number, msg: number, text: string, rows: Btn[][] = []) {
  return tg("editMessageText", { chat_id: chat, message_id: msg, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb(rows) });
}
const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const fr = (n: number, d = 0) => Number.isFinite(n) ? n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "∞";
const when = (d: string) => new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
// Mise en forme : titre, filet, valeurs alignées dans un bloc à chasse fixe
const RULE = "━━━━━━━━━━━━━━━━━━";
function table(rows: [string, string][]) {
  const w = Math.max(...rows.map((r) => r[0].length));
  return "<pre>" + rows.map(([k, v]) => esc(k.padEnd(w + 2, " ")) + esc(v)).join("\n") + "</pre>";
}
function card(title: string, body: string[], foot?: string) {
  return `<b>${title}</b>\n${RULE}\n` + body.filter(Boolean).join("\n\n") + (foot ? `\n${RULE}\n<i>${foot}</i>` : "");
}
const MENU: Btn[][] = [
  [{ text: "📊 Statistiques", callback_data: "stats" }, { text: "👥 Inscriptions", callback_data: "users" }],
  [{ text: "📜 Journal d'audit", callback_data: "audit" }, { text: "🔭 Calcul optique", callback_data: "calchelp" }],
  [{ text: "🌐 Ouvrir Lumenpath", url: SITE }],
];
const HELLO = card("🤖 Gérard · Lumenpath", ["Bonjour ! Que voulez-vous voir ?"], "Les actions qui modifient un compte demandent toujours une confirmation.");
const BACK: Btn[] = [{ text: "↩︎ Menu", callback_data: "menu" }];
const ROLE: Record<string, string> = { utilisateur: "utilisateur", editeur_catalogue: "éditeur du catalogue", admin: "administrateur" };
const ACTION: Record<string, string> = {
  connexion: "🔑 Connexion", connexion_admin: "🛡 Connexion administrateur", connexion_admin_refusee: "⛔ Connexion admin refusée",
  compte_active: "✅ Compte activé", mot_de_passe_reinitialise: "🔁 Mot de passe réinitialisé", projet_enregistre: "💾 Projet enregistré",
  projet_supprime: "🗑 Projet supprimé", accord_donne: "🤝 Accord donné", accord_retire: "↩︎ Accord retiré", profil_modifie: "✏️ Profil modifié",
  deconnexion: "Déconnexion", deconnexion_inactivite: "⏱ Déconnexion admin (inactivité)",
};
// Événements qui déclenchent une alerte (les autres restent dans le journal)
const ALERT = new Set(["connexion_admin", "connexion_admin_refusee", "compte_active", "projet_enregistre", "accord_donne", "accord_retire", "mot_de_passe_reinitialise"]);

async function audit(action: string, detail: Record<string, unknown> = {}) {
  await sb.from("audit_log").insert({ actor: null, action, detail: { ...detail, via: "telegram" }, device: "Gérard (Telegram)" });
}
async function name(id: string) {
  const { data } = await sb.from("profiles").select("prenom,nom,societe").eq("id", id).maybeSingle();
  return data ? `${data.prenom} ${data.nom}`.trim() + (data.societe ? ` · ${data.societe}` : "") : "inconnu";
}

// ---------- Écrans ----------
async function statsText() {
  const [p, pr, c, w] = await Promise.all([
    sb.from("profiles").select("role,created_at"),
    sb.from("projects").select("id", { count: "exact", head: true }),
    sb.from("consents").select("kind,granted"),
    sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString()),
  ]);
  const users = p.data ?? [], cons = c.data ?? [];
  const by = (r: string) => users.filter((u) => u.role === r).length;
  return card("📊 Lumenpath en chiffres", [
    table([
      ["Utilisateurs", String(users.length)],
      ["Cette semaine", "+" + (w.count ?? 0)],
      ["Administrateurs", String(by("admin"))],
      ["Éditeurs", String(by("editeur_catalogue"))],
      ["Projets", String(pr.count ?? 0)],
      ["Accord IA", String(cons.filter((x) => x.granted && x.kind === "ia").length)],
      ["Mise en relation", String(cons.filter((x) => x.granted && x.kind === "bureau_etudes").length)],
    ]),
  ], "Mis à jour le " + when(new Date().toISOString()));
}
async function usersScreen(): Promise<[string, Btn[][]]> {
  const { data } = await sb.from("profiles").select("id,prenom,nom,societe,created_at").order("created_at", { ascending: false }).limit(6);
  const rows = (data ?? []).map((u) => [{ text: `${u.prenom} ${u.nom} · ${u.societe}`.slice(0, 60), callback_data: `u:${u.id}` }]);
  return [card("👥 Dernières inscriptions", [rows.length ? "Touchez un nom pour ouvrir la fiche." : "Aucun utilisateur pour l'instant."]), [...rows, BACK]];
}
async function userScreen(id: string): Promise<[string, Btn[][]]> {
  const { data: u } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!u) return ["Utilisateur introuvable.", [BACK]];
  const { data: au } = await sb.auth.admin.getUserById(id);
  const a = au?.user;
  const banned = !!(a?.banned_until && new Date(a.banned_until) > new Date());
  const [{ count }, { data: cons }] = await Promise.all([
    sb.from("projects").select("id", { count: "exact", head: true }).eq("owner", id),
    sb.from("consents").select("kind,granted").eq("user_id", id),
  ]);
  const acc = (cons ?? []).filter((x) => x.granted).map((x) => x.kind === "ia" ? "IA" : "mise en relation").join(", ") || "aucun";
  const text = card(`👤 ${esc(u.prenom)} ${esc(u.nom)}${banned ? "  ·  ⛔ bloqué" : ""}`, [
    `🏢 ${esc(u.societe)} · ${esc(u.departement)}\n✉️ ${esc(a?.email ?? "?")}${u.telephone ? `\n📞 ${esc(u.telephone)}` : ""}`,
    table([
      ["Rôle", ROLE[u.role] ?? u.role],
      ["Projets", String(count ?? 0)],
      ["Accords", acc],
      ["Inscription", when(u.created_at)],
      ["Connexion", a?.last_sign_in_at ? when(a.last_sign_in_at) : "jamais"],
    ]),
  ]);
  const rows: Btn[][] = [];
  if (u.role === "utilisateur") rows.push([{ text: "🛠 Passer éditeur du catalogue", callback_data: `ask:ed:${id}` }]);
  if (u.role === "editeur_catalogue") rows.push([{ text: "↓ Repasser utilisateur", callback_data: `ask:us:${id}` }]);
  if (u.role !== "admin") rows.push([banned ? { text: "🔓 Débloquer le compte", callback_data: `ask:ub:${id}` } : { text: "⛔ Bloquer le compte", callback_data: `ask:bn:${id}` }]);
  rows.push([{ text: "👥 Inscriptions", callback_data: "users" }, ...BACK]);
  return [text, rows];
}
async function auditScreen(): Promise<[string, Btn[][]]> {
  const { data } = await sb.from("audit_log").select("*").order("at", { ascending: false }).limit(12);
  const ids = [...new Set((data ?? []).map((a) => a.actor).filter(Boolean))];
  const { data: ps } = ids.length ? await sb.from("profiles").select("id,prenom,nom").in("id", ids) : { data: [] };
  const nm: Record<string, string> = {}; (ps ?? []).forEach((p) => nm[p.id] = `${p.prenom} ${p.nom}`);
  const lines = (data ?? []).map((a) => `${when(a.at)} · ${ACTION[a.action] ?? esc(a.action)} · ${esc(a.actor ? nm[a.actor] ?? "?" : a.device ?? "système")}`);
  return [card("📜 Journal d'audit", [lines.join("\n") || "Vide pour l'instant."], "12 derniers événements"), [[{ text: "🔄 Actualiser", callback_data: "audit" }, ...BACK]]];
}

// ---------- Actions avec confirmation ----------
const ASK: Record<string, string> = {
  ed: "donner le rôle <b>éditeur du catalogue</b> à",
  us: "repasser en <b>utilisateur</b>",
  bn: "<b>bloquer</b> le compte de",
  ub: "<b>débloquer</b> le compte de",
};
async function perform(op: string, id: string): Promise<string> {
  if (op === "ed" || op === "us") {
    const role = op === "ed" ? "editeur_catalogue" : "utilisateur";
    const { error } = await sb.from("profiles").update({ role }).eq("id", id).neq("role", "admin");
    if (error) return "❌ " + esc(error.message);
    await audit("bot_role_modifie", { user: id, role });
    return `✅ Rôle modifié : ${ROLE[role]}.`;
  }
  if (op === "bn" || op === "ub") {
    const { data: p } = await sb.from("profiles").select("role").eq("id", id).maybeSingle();
    if (p?.role === "admin") return "❌ Un administrateur ne peut pas être bloqué depuis le bot.";
    const { error } = await sb.auth.admin.updateUserById(id, { ban_duration: op === "bn" ? "876000h" : "none" });
    if (error) return "❌ " + esc(error.message);
    await audit(op === "bn" ? "bot_compte_bloque" : "bot_compte_debloque", { user: id });
    return op === "bn" ? "✅ Compte bloqué : la personne ne peut plus se connecter." : "✅ Compte débloqué.";
  }
  return "Action inconnue.";
}

// ---------- Calcul optique ----------
function calcHelp() {
  return card("🔭 Calcul optique", ["Envoyez par exemple :\n<code>/calcul 100x80 300 200</code>", table([["Champ", "100 × 80 mm"], ["Distance", "300 mm"], ["Défaut", "200 µm"]])], "Ajoutez « mesure » à la fin pour une mesure dimensionnelle.");
}
async function calc(args: string): Promise<[string, Btn[][]]> {
  try { await engine(); } catch (_) { return [card("🔭 Calcul optique", ["Le moteur de calcul n'est pas encore accessible : il sera chargé depuis le dépôt GitHub dès que le site est publié."]), [BACK]]; }
  const m = args.replace(/,/g, ".").match(/([\d.]+)\s*[x×*]\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (!m) return ["Format non reconnu.\n\n" + calcHelp(), [BACK]];
  const meas = /mesure/i.test(args);
  const inp = { fovH: +m[1], fovV: +m[2], wd: +m[3], depth: 2, defect: +m[4], k: meas ? 4 : 3, color: false, globalOnly: true, speed: 0, exposure: 200, nom: 5.6, cocPx: 2, task: meas ? "mesure" : "detection", backlight: false, material: "general", lamCons: "auto", ambient: "maitrisee", nstar: 2 } as Record<string, unknown>;
  const lr = C.resolveLambda(inp); inp.lambda = lr.lam;
  const req = C.requiredPixels(inp), ranked = C.rankSensors(inp);
  const ev = ranked.find((x: any) => !x.excluded && x.status === "ok") || ranked.find((x: any) => !x.excluded) || ranked[0];
  const lt = C.lensType(ev, inp), sp = C.lensSpec(ev, inp, lt);
  const st = ev.status === "ok" ? "✅ convient" : ev.status === "limite" ? "⚠️ à la limite" : "❌ insuffisant";
  const text = card(`🔭 Calcul optique · ${meas ? "mesure" : "détection"}`, [
    `<i>Champ ${fr(inp.fovH as number)} × ${fr(inp.fovV as number)} mm · distance ${fr(inp.wd as number)} mm · défaut ${fr(inp.defect as number)} µm</i>`,
    `📷 <b>Capteur ${esc(ev.sensor.id.split(" / ")[0])}</b>  ${st}\n` + table([
      ["Pixels requis", `${fr(req.nH)} × ${fr(req.nV)} (${fr(req.mpx, 1)} Mpx)`],
      ["Résolution", `${ev.sensor.w} × ${ev.sensor.h}`],
      ["Pixel", `${fr(ev.sensor.p, 2)} µm · ${ev.sensor.fmt}`],
    ]),
    `🔘 <b>Objectif ${esc(lt.label.toLowerCase())}</b>\n` + table([
      sp.kind === "telecentrique" ? ["Grandissement", `≈ ${fr(sp.m, 3)}×`] : ["Focale", `≈ ${fr(sp.f, 1)} mm (${sp.fBelow ?? "-"} / ${sp.fAbove ?? "-"})`],
      ["Résolution", `≥ ${fr(sp.nuK)} lp/mm`],
      ["Cercle d'image", `≥ ${fr(sp.circleMin, 1)} mm`],
      ["Ouverture max", `f/${fr(sp.win.nMax, 1)}`],
    ]),
  ], "Ordre de grandeur, à valider sur la fiche de l'objectif.");
  const other = meas ? args.replace(/mesure/i, "").trim() : args + " mesure";
  return [text, [[{ text: meas ? "🔍 En détection" : "📏 En mesure", callback_data: ("c:" + other).slice(0, 64) }], [{ text: "🌐 Détail complet sur Lumenpath", url: SITE + "#/calculateur" }], BACK]];
}

// ---------- Alertes venant de la base ----------
async function alert(body: any) {
  if (body.kind === "signup") {
    const u = body.row;
    return send(card("🆕 Nouvelle inscription", [`<b>${esc(u.prenom)} ${esc(u.nom)}</b>\n🏢 ${esc(u.societe)} · ${esc(u.departement)}`], "En attente de la confirmation de l'adresse e-mail."),
      [[{ text: "👤 Voir la fiche", callback_data: `u:${u.id}` }, { text: "⛔ Bloquer", callback_data: `ask:bn:${u.id}` }]]);
  }
  if (body.kind === "audit") {
    const a = body.row;
    if (!ALERT.has(a.action)) return;
    const who = a.actor ? await name(a.actor) : "inconnu";
    const extra = a.detail?.kind ? ` (${a.detail.kind === "ia" ? "IA" : "mise en relation"})` : a.detail?.tool ? ` (${a.detail.tool})` : "";
    const rows: Btn[][] = a.actor ? [[{ text: "👤 Voir la fiche", callback_data: `u:${a.actor}` }, { text: "📜 Journal", callback_data: "audit" }]] : [[{ text: "📜 Journal", callback_data: "audit" }]];
    return send(card(`${ACTION[a.action] ?? esc(a.action)}${extra}`, [`<b>${esc(who)}</b>`], `${when(a.at)}${a.ip ? " · IP " + esc(a.ip) : ""}`), rows);
  }
}

// ---------- Point d'entrée ----------
Deno.serve(async (req) => {
  try {
    const { secret, owner } = await config();
    if (req.headers.get("x-telegram-bot-api-secret-token") !== secret) return new Response("forbidden", { status: 403 });
    const body = await req.json();
    if (body.kind) { await alert(body); return new Response("ok"); }

    const msg = body.message, cb = body.callback_query;
    const chat = msg?.chat?.id ?? cb?.message?.chat?.id;
    if (!chat) return new Response("ok");
    if (String(chat) !== owner) {
      if (msg) await tg("sendMessage", { chat_id: chat, text: "Ce bot est privé." });
      if (cb) await tg("answerCallbackQuery", { callback_query_id: cb.id });
      return new Response("ok");
    }

    if (msg?.text) {
      const t: string = msg.text.trim();
      if (/^\/calcul\b/i.test(t)) { const [x, k] = await calc(t.replace(/^\/calcul\S*/i, "").trim()); await send(x, k); }
      else if (/^\/stats\b/i.test(t)) await send(await statsText(), [[{ text: "🔄 Actualiser", callback_data: "stats" }, ...BACK]]);
      else await send(HELLO, MENU);
      return new Response("ok");
    }

    if (cb) {
      const d: string = cb.data ?? "", mid = cb.message.message_id;
      let text = "", rows: Btn[][] = [], note = "";
      if (d === "menu") { text = HELLO; rows = MENU; }
      else if (d === "stats") { text = await statsText(); rows = [[{ text: "🔄 Actualiser", callback_data: "stats" }, ...BACK]]; }
      else if (d === "users") [text, rows] = await usersScreen();
      else if (d === "audit") [text, rows] = await auditScreen();
      else if (d === "calchelp") { text = calcHelp(); rows = [BACK]; }
      else if (d.startsWith("c:")) [text, rows] = await calc(d.slice(2));
      else if (d.startsWith("u:")) [text, rows] = await userScreen(d.slice(2));
      else if (d.startsWith("ask:")) {
        const [, op, id] = d.split(":");
        text = card("⚠️ Confirmation requise", [`Vous allez ${ASK[op]} <b>${esc(await name(id))}</b>.`], "Rien ne change tant que vous n'avez pas confirmé.");
        rows = [[{ text: "✅ Confirmer", callback_data: `do:${op}:${id}` }, { text: "✖ Annuler", callback_data: `u:${id}` }]];
      } else if (d.startsWith("do:")) {
        const [, op, id] = d.split(":");
        note = await perform(op, id);
        const [t2, r2] = await userScreen(id);
        text = note + "\n\n" + t2; rows = r2;
      }
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: note ? note.replace(/<[^>]+>/g, "").slice(0, 190) : undefined });
      if (text) await edit(chat, mid, text, rows);
    }
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("ok");
  }
});
