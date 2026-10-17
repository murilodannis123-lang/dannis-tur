/**
 * Danni's Tur · servidor da renovação 2027 (Google Apps Script)
 *
 * Guarda os cadastros numa planilha Google, entrega o contrato de cada família por um link próprio,
 * deixa a Danni's Tur colocar valor e liberar o contrato, recebe o contrato assinado e avisa
 * aniversariantes e novidades no WhatsApp do dono (via CallMeBot, grátis, só pro próprio número).
 *
 * Como instalar: veja o arquivo LEIA-ME.md nesta mesma pasta.
 */

const ABA = "Renovações";
const COLS = ["id","token","criado_em","status","responsavel","cpf","rg","celular","fone_casa","outro_fone","email",
              "rua","bairro","cidade","cep","alunos_texto","alunos_json","obs","data_cadastro",
              "inicio_idx","mensalidade","parcelas","total","data_contrato","liberado_em","assinado_em","arquivo_url","observacao_interna","tipo","assinatura","assinatura_info"];
const STATUS = {AGUARDANDO:"aguardando_valor", LIBERADO:"liberado", ASSINADO:"assinado_online", IMPRESSO:"vai_entregar_impresso", RECEBIDO:"recebido", CANCELADO:"cancelado"};
const FUSO = "America/Sao_Paulo";
const SITE = "https://murilodannis123-lang.github.io/dannis-tur/";
const PLANILHA_ID = "1luSn0_AEFnz38Q2SQsFvO0ZpnZv75azj107FUIKeBlQ";   // planilha "Danni's Tur – Renovações 2027"
function planilha_(){ return SpreadsheetApp.openById(PLANILHA_ID); }

/* ===================== entrada ===================== */
function doGet(){ return json_({ok:true, servico:"Danni's Tur 2027"}); }

function doPost(e){
  let req;
  try { req = JSON.parse(e.postData.contents); } catch(err){ return json_({ok:false, erro:"Pedido inválido"}); }
  try {
    switch (req.acao){
      case "cadastrar":        return json_(cadastrar_(req.dados));
      case "ver":              return json_(ver_(req.token));
      case "enviar_assinado":  return json_(enviarAssinado_(req));
      case "vou_imprimir":     return json_(vouImprimir_(req.token));
      case "admin_login":      admin_(req); return json_({ok:true});
      case "admin_lista":      admin_(req); return json_(lista_());
      case "admin_salvar":     admin_(req); return json_(salvar_(req));
      case "admin_status":     admin_(req); return json_(mudaStatus_(req));
      case "admin_teste_zap":  admin_(req); return json_({ok:true, enviado: avisaDono_("✅ Teste: os avisos da Danni's Tur estão chegando no seu WhatsApp.")});
      default:                 return json_({ok:false, erro:"Ação desconhecida"});
    }
  } catch(err){
    return json_({ok:false, erro: String(err && err.message || err), codigo: err && err.codigo});
  }
}

/* ===================== famílias ===================== */
function cadastrar_(d){
  if (!d || !d.responsavel || !d.cpf || !Array.isArray(d.alunos) || !d.alunos.length) throw erro_("Dados incompletos");
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = aba_();
    const id = proximoId_(sh);
    const token = novoCodigo_(sh);
    const ass = String(d.assinatura || "");
    if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(ass) || ass.length > 49000) throw erro_("Faltou a assinatura. Assine no quadro e toque de novo em enviar.");
    const alunos = d.alunos.slice(0,8).map(a => ({nome:limpa_(a.nome,80), nasc:limpa_(a.nasc,10), escola:limpa_(a.escola,60), periodo:limpa_(a.periodo,20), trajeto:limpa_(a.trajeto,20)}));
    const linha = {
      id, token, criado_em:agora_(), status:STATUS.AGUARDANDO,
      responsavel:limpa_(d.responsavel,100), cpf:limpa_(d.cpf,14), rg:limpa_(d.rg,20), celular:limpa_(d.celular,20),
      fone_casa:limpa_(d.foneCasa,20), outro_fone:limpa_(d.outroFone,40), email:limpa_(d.email,80),
      rua:limpa_(d.rua,120), bairro:limpa_(d.bairro,60), cidade:limpa_(d.cidade,60), cep:limpa_(d.cep,9),
      alunos_texto: alunos.map(a => `${a.nome} (${fmt_(a.nasc)}) – ${a.escola} – ${a.periodo} – ${a.trajeto}`).join("\n"),
      alunos_json: JSON.stringify(alunos), obs:limpa_(d.obs,500), data_cadastro: hoje_(),
      tipo: d.tipo === "novo" ? "novo" : "renovacao",
      assinatura: ass, assinado_em: agora_(), assinatura_info: "Assinado na tela pelo responsável · " + limpa_(d.aparelho, 160)
    };
    sh.appendRow(COLS.map(c => linha[c] == null ? "" : linha[c]));
    avisaDono_(`${linha.tipo === "novo" ? "🆕 *Contrato novo 2027*" : "🚐 *Nova renovação 2027*"} (nº ${id}) ✍️ já assinado\n${linha.responsavel} – ${linha.celular}\n${alunos.map(a=>`• ${a.nome} – ${a.escola}`).join("\n")}\n\n📄 Contrato: ${SITE}contrato?${token}\n👉 Colocar o valor e liberar:\n${SITE}admin.html#f=${id}`);
    return {ok:true, token, id};
  } finally { lock.releaseLock(); }
}

function ver_(token){
  const r = porToken_(token);
  if (!r) throw erro_("Link inválido. Confira o link que a Danni's Tur te mandou.", "token");
  const f = publico_(r.obj);
  const liberado = [STATUS.LIBERADO, STATUS.ASSINADO, STATUS.IMPRESSO, STATUS.RECEBIDO].indexOf(r.obj.status) >= 0;
  if (!liberado){ delete f.valores; }
  return {ok:true, familia:f, liberado};
}

function enviarAssinado_(req){
  const r = porToken_(req.token);
  if (!r) throw erro_("Link inválido.", "token");
  if (r.obj.status === STATUS.AGUARDANDO) throw erro_("O contrato ainda não foi liberado.");
  if (!req.base64 || String(req.base64).length > 14e6) throw erro_("Arquivo muito grande (máximo 10 MB).");
  const tipo = /^(application\/pdf|image\/(jpeg|png|heic|webp))$/.test(req.tipo) ? req.tipo : "application/pdf";
  const blob = Utilities.newBlob(Utilities.base64Decode(req.base64), tipo, `Contrato 2027 - ${r.obj.id} - ${r.obj.responsavel}${tipo==="application/pdf"?".pdf":""}`);
  const arq = pasta_().createFile(blob);
  atualiza_(r.linha, {status:STATUS.ASSINADO, assinado_em:agora_(), arquivo_url:arq.getUrl()});
  avisaDono_(`✍️ *Contrato assinado recebido* (nº ${r.obj.id})\n${r.obj.responsavel}\nO arquivo está na pasta "Danni's Tur – Contratos assinados" do seu Google Drive.`);
  return {ok:true};
}

function vouImprimir_(token){
  const r = porToken_(token);
  if (!r) throw erro_("Link inválido.", "token");
  if (r.obj.status === STATUS.AGUARDANDO) throw erro_("O contrato ainda não foi liberado.");
  if (r.obj.status === STATUS.LIBERADO){
    atualiza_(r.linha, {status:STATUS.IMPRESSO});
    avisaDono_(`🖨️ ${r.obj.responsavel} (nº ${r.obj.id}) vai imprimir, assinar e entregar o contrato na van.`);
  }
  return {ok:true};
}

/* ===================== administração ===================== */
function admin_(req){
  const senha = PropertiesService.getScriptProperties().getProperty("SENHA_ADMIN");
  if (!senha) throw erro_("Senha do administrador não configurada. Rode a função configurar().");
  if (String(req.senha||"") !== senha){ Utilities.sleep(1200); throw erro_("Senha errada.", "senha"); }
}

function lista_(){
  const sh = aba_(), vals = sh.getDataRange().getValues(); vals.shift();
  const familias = vals.filter(l => l[0] !== "").map(l => completo_(obj_(l)));
  return {ok:true, familias, hoje: hoje_()};
}

function salvar_(req){
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const r = porId_(req.id); if (!r) throw erro_("Cadastro não encontrado.");
    const v = req.valores || {};
    const mud = {inicio_idx: v.ini, mensalidade: v.mensalidade, parcelas: v.parcelas, total: v.total, data_contrato: v.dataContrato || hoje_(),
                 observacao_interna: limpa_(v.obsInterna, 500)};
    if (req.liberar){
      if (!(Number(v.mensalidade) > 0) || !(Number(v.parcelas) > 0)) throw erro_("Coloque a mensalidade e o número de parcelas antes de liberar.");
      if (r.obj.status === STATUS.AGUARDANDO) mud.status = r.obj.assinatura ? STATUS.ASSINADO : STATUS.LIBERADO;   // já assinou na tela: libera assinado
      mud.liberado_em = agora_();
    }
    atualiza_(r.linha, mud);
    return {ok:true, familia: completo_(porId_(req.id).obj)};
  } finally { lock.releaseLock(); }
}

function mudaStatus_(req){
  const r = porId_(req.id); if (!r) throw erro_("Cadastro não encontrado.");
  const ok = Object.keys(STATUS).map(k => STATUS[k]); if (ok.indexOf(req.status) < 0) throw erro_("Status inválido.");
  atualiza_(r.linha, {status:req.status});
  return {ok:true, familia: completo_(porId_(req.id).obj)};
}

/* ===================== aniversários (gatilho diário) ===================== */
function avisarAniversariantes(){
  const agora = new Date();
  const hoje = Utilities.formatDate(agora, FUSO, "MM-dd");
  const ano = Number(Utilities.formatDate(agora, FUSO, "yyyy"));
  const vals = aba_().getDataRange().getValues(); vals.shift();
  const hojeL = [];
  vals.filter(l => l[0] !== "").map(obj_).forEach(f => {
    if (f.status === STATUS.CANCELADO) return;
    let alunos = []; try { alunos = JSON.parse(f.alunos_json || "[]"); } catch(e){}
    alunos.forEach(a => {
      if (!a.nasc || a.nasc.slice(5,10) !== hoje) return;
      const anos = ano - Number(a.nasc.slice(0,4));
      hojeL.push(`• *${a.nome}* faz ${anos} ${anos===1?"ano":"anos"} – ${a.escola}\n   Responsável: ${f.responsavel} ${f.celular}`);
    });
  });
  if (!hojeL.length) return;
  avisaDono_(`🎂 *Aniversariantes de hoje*\n${hojeL.join("\n")}\n\nDá pra mandar os parabéns pela Área Danni's.`);
}

/* ===================== avisos ===================== */
function avisaDono_(texto){
  const p = PropertiesService.getScriptProperties();
  const fone = p.getProperty("ZAP_DONO"), chave = p.getProperty("CALLMEBOT_CHAVE");
  let enviado = false;
  if (fone && chave){
    try {
      const url = "https://api.callmebot.com/whatsapp.php?phone=" + encodeURIComponent(fone) + "&text=" + encodeURIComponent(texto) + "&apikey=" + encodeURIComponent(chave);
      const r = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
      enviado = r.getResponseCode() === 200;
    } catch(e){}
  }
  const email = p.getProperty("EMAIL_AVISOS");
  if (email){ try { MailApp.sendEmail(email, "Danni's Tur – aviso", texto.replace(/\*/g,"")); } catch(e){} }
  return enviado;
}

/* ===================== instalação (rodar uma vez) ===================== */
function configurar(){
  const ss = planilha_();
  let sh = ss.getSheetByName(ABA);
  if (!sh){ sh = ss.insertSheet(ABA); }
  if (sh.getLastRow() === 0){
    sh.getRange(1,1,1000,COLS.length).setNumberFormat("@");   // tudo como texto: CPF, telefone, CEP e datas não viram número
    sh.getRange(1,1,1,COLS.length).setValues([COLS]); sh.setFrozenRows(1);
    sh.getRange(1,1,1,COLS.length).setFontWeight("bold").setBackground("#712473").setFontColor("#ffffff");
  }
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty("ZAP_DONO")) p.setProperty("ZAP_DONO", "+5519997781210");
  if (!p.getProperty("EMAIL_AVISOS")) p.setProperty("EMAIL_AVISOS", Session.getEffectiveUser().getEmail());
  if (!p.getProperty("SENHA_ADMIN")) p.setProperty("SENHA_ADMIN", "TROQUE-ESTA-SENHA");
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "avisarAniversariantes").forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("avisarAniversariantes").timeBased().atHour(6).everyDays(1).inTimezone(FUSO).create();
  pasta_();
  return "Pronto. Agora troque a senha em Configurações do projeto › Propriedades do script.";
}

/* apaga TODAS as famílias da planilha (fica só o cabeçalho). Rodar à mão no editor, só pra zerar testes. */
function zerarTestes(){
  const sh = aba_(), n = sh.getLastRow();
  if (n > 1) sh.deleteRows(2, n - 1);
  return "Planilha zerada: " + Math.max(0, n - 1) + " linha(s) de teste apagada(s).";
}

/* ===================== utilidades ===================== */
function aba_(){
  const sh = planilha_().getSheetByName(ABA); if (!sh) throw erro_("Rode configurar() primeiro.");
  if (sh.getLastColumn() < COLS.length){   // coluna nova (ex.: "tipo") ganha título sozinha
    sh.getRange(1,1,1,COLS.length).setValues([COLS]).setFontWeight("bold").setBackground("#712473").setFontColor("#ffffff");
  }
  return sh;
}
function pasta_(){
  const nome = "Danni's Tur – Contratos assinados";
  const it = DriveApp.getFoldersByName(nome);
  return it.hasNext() ? it.next() : DriveApp.createFolder(nome);
}
function proximoId_(sh){ const n = sh.getLastRow(); if (n < 2) return 1; const ids = sh.getRange(2,1,n-1,1).getValues().map(r => Number(r[0])||0); return Math.max.apply(null, ids) + 1; }
function obj_(l){ const o = {}; COLS.forEach((c,i) => o[c] = (l[i] instanceof Date) ? Utilities.formatDate(l[i], FUSO, "yyyy-MM-dd'T'HH:mm:ss") : l[i]); return o; }
function porToken_(t){
  const q = String(t || "").trim();
  if (q.length < 8) { Utilities.sleep(1000); return null; }
  const curto = q.length <= 12, Q = q.toUpperCase();
  const vals = aba_().getDataRange().getValues();
  for (let i = 1; i < vals.length; i++){
    const v = String(vals[i][1]);
    if (v === q || (curto && v.toUpperCase() === Q)) return {linha:i+1, obj:obj_(vals[i])};
  }
  Utilities.sleep(1000);   // atrasa quem tenta adivinhar códigos
  return null;
}
/* código curto do link do contrato: 8 caracteres sem letras que confundem (0/O, 1/I/L) */
function novoCodigo_(sh){
  const ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const n = sh.getLastRow(), usados = n > 1 ? sh.getRange(2,2,n-1,1).getValues().map(r => String(r[0]).toUpperCase()) : [];
  for (let k = 0; k < 20; k++){
    const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid());
    let c = ""; for (let i = 0; i < 8; i++) c += ABC[(b[i] + 256) % ABC.length];
    if (usados.indexOf(c) < 0) return c;
  }
  throw erro_("Não consegui gerar o código do contrato. Tente de novo.");
}
function porId_(id){
  const vals = aba_().getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) if (String(vals[i][0]) === String(id)) return {linha:i+1, obj:obj_(vals[i])};
  return null;
}
function atualiza_(linha, mud){
  const sh = aba_();
  Object.keys(mud).forEach(k => { const c = COLS.indexOf(k); if (c >= 0 && mud[k] !== undefined) sh.getRange(linha, c+1).setValue(mud[k] == null ? "" : mud[k]); });
}
function publico_(o){
  let alunos = []; try { alunos = JSON.parse(o.alunos_json || "[]"); } catch(e){}
  return {
    id:o.id, status:o.status, responsavel:o.responsavel, cpf:o.cpf, rg:o.rg, celular:o.celular, foneCasa:o.fone_casa, outroFone:o.outro_fone, email:o.email,
    rua:o.rua, bairro:o.bairro, cidade:o.cidade, cep:o.cep, alunos, obs:o.obs, dataCadastro:String(o.data_cadastro||"").slice(0,10), tipo:o.tipo || "renovacao",
    assinatura:o.assinatura || "", assinadoEm:o.assinado_em || "",
    valores:{ini:o.inicio_idx, mensalidade:o.mensalidade, parcelas:o.parcelas, total:o.total, dataContrato:String(o.data_contrato||"").slice(0,10)}
  };
}
function completo_(o){ const f = publico_(o); f.token = o.token; f.criadoEm = o.criado_em; f.liberadoEm = o.liberado_em; f.assinadoEm = o.assinado_em; f.arquivo = o.arquivo_url; f.obsInterna = o.observacao_interna; return f; }
function limpa_(v, max){ return String(v == null ? "" : v).replace(/[\u0000-\u001f]/g," ").trim().slice(0, max||200); }
function fmt_(iso){ return iso ? String(iso).split("-").reverse().join("/") : ""; }
function agora_(){ return Utilities.formatDate(new Date(), FUSO, "yyyy-MM-dd'T'HH:mm:ss"); }
function hoje_(){ return Utilities.formatDate(new Date(), FUSO, "yyyy-MM-dd"); }
function erro_(m, codigo){ const e = new Error(m); e.codigo = codigo; return e; }
function json_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
