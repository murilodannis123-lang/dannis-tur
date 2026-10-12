/* Danni's Tur · funções comuns (renovação, contrato do cliente e área Danni's) */
(function(){
  "use strict";

  /* Endereço do servidor (Apps Script). Fica vazio até a planilha ser configurada. */
  const API = "https://script.google.com/macros/s/AKfycbyHx9esXdbXC2xlKoavjhv3neJMw7M59cO9pm-rglWzvLLa5tPJrIEy3n4SOAsYFNuvIw/exec";
  const ZAP_DANNIS = "5519997781210";

  const CONTRATADO = {
    razao:"DANIEL ALVES GESUALDO – ME", fantasia:"DANNI'S TUR", cnpj:"18.366.932/0001-18",
    sede:"Rua Virginia Viel Campos Dall Horto, 39 – Vila Yolanda – Sumaré/SP"
  };

  /* escolas: nome + cor do cartão (clara = texto escuro) */
  const ESCOLAS = [
    {id:"educativa",    nome:"Educativa",              cor:"#2f5bd3"},
    {id:"alkimim",      nome:"Alkimim",                cor:"#e0690f"},
    {id:"candido",      nome:"Cândido",                cor:"#ffc61a", clara:true},
    {id:"borboletinha", nome:"Borboletinha Azul",      cor:"#1aa0e6"},
    {id:"crescendo",    nome:"Crescendo e Aprendendo", cor:"#24884a"},
    {id:"network",      nome:"Network",                cor:"#5b3fc4"},
    {id:"franceschini", nome:"João Franceschini",      cor:"#712473"},
    {id:"sonho",        nome:"Sonho Dourado",          cor:"#d9a400", clara:true},
    {id:"algodao",      nome:"Algodão Doce",           cor:"#e84c8b"},
    {id:"objetivo",     nome:"Objetivo",               cor:"#c2332b"},
    {id:"fam",          nome:"Faculdade FAM",          cor:"#2b2630"}
  ];

  const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const INI = 2027*12+1, FIM = 2028*12+0;            // fevereiro/2027 → janeiro/2028
  const nomeMes = idx => `${MESES[idx%12]} de ${Math.floor(idx/12)}`;

  const esc = s => String(s==null?"":s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const fmtData = d => d ? String(d).slice(0,10).split("-").reverse().join("/") : "";
  const brl = n => (isFinite(n) && n>0) ? Number(n).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "";
  const num = v => typeof v==="number" ? v : (parseFloat(String(v||"").replace(/\./g,"").replace(",",".")) || 0);
  function hojeISO(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
  function vigencia(isoCadastro, inicioIdx){
    let st = (inicioIdx!=null && inicioIdx!=="") ? +inicioIdx : null;
    if (st == null || isNaN(st)){
      const [y,m] = (isoCadastro||hojeISO()).split("-").map(Number);
      st = Math.max(INI, y*12+(m-1));
    }
    st = Math.min(Math.max(st, INI), FIM);
    return {ini:st, meses:FIM-st+1, de:nomeMes(st), ate:nomeMes(FIM)};
  }
  function dataExtenso(iso){
    if (!iso) return `Sumaré, <span class="branco" style="min-width:40px">&nbsp;</span> de <span class="branco" style="min-width:110px">&nbsp;</span> de <span class="branco" style="min-width:50px">&nbsp;</span>.`;
    const [y,m,d] = String(iso).slice(0,10).split("-");
    return `Sumaré, ${+d} de ${MESES[+m-1]} de ${y}.`;
  }
  function idade(nasc, ref){
    if (!nasc) return "";
    const [y,m,d] = nasc.split("-").map(Number); const r = ref || new Date();
    let a = r.getFullYear()-y; if (r.getMonth()+1 < m || (r.getMonth()+1===m && r.getDate()<d)) a--; return a;
  }
  function maskCpf(v){ v=v.replace(/\D/g,"").slice(0,11); return v.replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2"); }
  function maskTel(v){ v=v.replace(/\D/g,"").slice(0,11); if(v.length<=2) return v.length?"("+v:v; if(v.length<=6) return `(${v.slice(0,2)}) ${v.slice(2)}`; if(v.length<=10) return `(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`; return `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`; }
  function cpfValido(c){
    c = String(c).replace(/\D/g,"");
    if (c.length!==11 || /^(\d)\1+$/.test(c)) return false;
    let s=0; for(let i=0;i<9;i++) s+= +c[i]*(10-i);
    let d1=(s*10)%11; if(d1===10) d1=0; if(d1!==+c[9]) return false;
    s=0; for(let i=0;i<10;i++) s+= +c[i]*(11-i);
    let d2=(s*10)%11; if(d2===10) d2=0; return d2===+c[10];
  }
  const soDigitos = t => String(t||"").replace(/\D/g,"");
  const zapLink = (tel, texto) => { let n = soDigitos(tel); if (n.length<=11) n = "55"+n; return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`; };

  /* ---------- contrato (um por família, todos os irmãos) ---------- */
  function contratoHTML(f, x){
    x = x || {};
    const alunos = f.alunos || [];
    const v = vigencia(f.dataCadastro, x.ini);
    const varios = alunos.length > 1;
    const B = (val, w) => val ? `<span class="preenchido">${esc(val)}</span>` : `<span class="branco" style="min-width:${w||90}px">&nbsp;</span>`;
    const mk = (t,val) => `(<span class="ct-marca">${t===val?"X":"&nbsp;"}</span>) ${val.toUpperCase()}`;
    const escolas = [...new Set(alunos.map(a=>a.escola))];
    const bloco = (a,i) => `
        <div class="c4"><small>${varios?`Aluno(a) ${i+1}`:"Aluno(a)"}</small>${esc(a.nome)}</div>
        <div class="c2"><small>Data de nasc.</small>${fmtData(a.nasc)}</div>
        <div class="c4"><small>Faculdade / colégio</small>${esc(a.escola)}</div>
        <div class="c2"><small>Período</small>${esc(a.periodo)}</div>
        <div class="c6">${mk(a.trajeto||"Ida e volta","Ida e volta")} &nbsp; ${mk(a.trajeto||"Ida e volta","Só volta")} &nbsp; ${mk(a.trajeto||"Ida e volta","Só ida")}</div>`;
    const cl01 = varios
      ? `O transportador se compromete a transportar os alunos indicados na ficha acima (${alunos.map(a=>`<span class="preenchido">${esc(a.nome)}</span>`).join(", ")}) de sua residência ao${escolas.length>1?"s respectivos colégios/faculdades":" colégio/faculdade"} <span class="preenchido">${escolas.map(esc).join(" e ")}</span>, dentro do horário pré-estabelecido e no ano letivo de 2027.`
      : `O transportador se compromete a transportar o aluno de sua residência ao colégio/faculdade <span class="preenchido">${esc((alunos[0]||{}).escola)}</span>, dentro do horário pré-estabelecido e no ano letivo de 2027.`;
    return `<article class="contrato">
      <div class="ct-topo"><img src="logo.png" alt="Danni's Tur"><div>${CONTRATADO.razao}<br>CNPJ ${CONTRATADO.cnpj}<br>${CONTRATADO.sede}</div></div>
      <div class="ct-ficha">
        ${alunos.map(bloco).join("")}
        <div class="c6"><small>Endereço</small>${esc(f.rua)}</div>
        <div class="c2"><small>Bairro</small>${esc(f.bairro)}</div>
        <div class="c2"><small>Cidade</small>${esc(f.cidade)}</div>
        <div class="c2"><small>CEP</small>${esc(f.cep)}</div>
        <div class="c2"><small>Fone celular</small>${esc(f.celular)}</div>
        <div class="c2"><small>Fone casa</small>${esc(f.foneCasa)}</div>
        <div class="c2"><small>Outros</small>${esc(f.outroFone)}</div>
        <div class="c6"><small>Ano letivo</small>2027</div>
      </div>
      <h4>CONTRATO DE PRESTAÇÃO DE SERVIÇO</h4>
      <p>Pelo presente instrumento particular de contrato de prestação de serviços, de um lado, como <b>CONTRATANTE</b>, <span class="preenchido">${esc(f.responsavel)}</span>, CPF <span class="preenchido">${esc(f.cpf)}</span>, RG <span class="preenchido">${esc(f.rg)}</span>, neste ato representado pelo responsável legal, e, como <b>CONTRATADO</b>, ${CONTRATADO.razao} (nome fantasia ${CONTRATADO.fantasia}), CNPJ ${CONTRATADO.cnpj}, com sede à ${CONTRATADO.sede}.</p>
      <h4>CLÁUSULAS CONSTANTES NO CONTRATO</h4>
      <p class="ct-cl"><b>Cláusula 01.</b> ${cl01}</p>
      <p class="ct-cl"><b>Cláusula 02.</b> O presente contrato terá vigência durante <span class="preenchido">${v.meses}</span> meses, de <span class="preenchido">${v.de}</span> a <span class="preenchido">${v.ate}</span>.</p>
      <p class="ct-cl"><b>Cláusula 03.</b> O valor do transporte será de R$ ${B(brl(num(x.total)),90)} à vista ou dividido em ${B(x.parcelas,40)} parcelas de R$ ${B(brl(num(x.mensalidade)),90)}, que poderá ser efetuado do dia 1 ao dia 10 de cada mês. Caso haja atraso, será cobrada multa de 5% sobre o valor da mensalidade, e a possível suspensão da prestação dos serviços após 15 dias de atraso, ou emissão de boleto.</p>
      <p class="ct-cl"><b>Cláusula 04.</b> O contratado efetuará o transporte do aluno(a) de segunda à sexta-feira, nos horários normais de aula, não buscando mais cedo em nenhuma hipótese, não se responsabilizando por eventuais paralisações de funcionários e professores da escola/faculdade.</p>
      <p class="ct-cl"><b>Cláusula 05.</b> O contratante fica obrigado a fazer o uso do cinto de segurança, como exige a legislação de trânsito em vigor, ficando sob total responsabilidade o pagamento da multa que possa ocorrer pela sua desobediência dessa obrigatoriedade.</p>
      <p class="ct-cl"><b>Cláusula 06.</b> O contratado se responsabiliza pela manutenção do veículo, fazendo tudo para mantê-lo nas normas de segurança. Caso haja algum tipo de problema com o veículo, o contratado se responsabiliza em colocar outro no lugar, em perfeitas condições de uso; entretanto, não se obriga a transitar por ruas ou avenidas que não ofereçam condições normais de tráfego, ou itinerários que possam causar danos ao veículo.</p>
      <p class="ct-cl"><b>Cláusula 07.</b> É obrigação dos pais avisar quando o filho não for para a escola, ou quando os pais retirarem os filhos mais cedo na escola. É dever do contratante manter a harmonia dentro do veículo, evitando assim o desrespeito para os demais passageiros. O não cumprimento desta cláusula fica a critério do contratado rescindir o contrato de imediato, cobrando a multa por rescisão do mesmo.</p>
      <p class="ct-cl"><b>Cláusula 08.</b> O valor da mensalidade somente será alterado quando houver aumento dos combustíveis e derivados, aumento de salário ou adoção de nova política econômica.</p>
      <p class="ct-cl"><b>Cláusula 09.</b> O aluno deverá estar pronto no local combinado para que não haja atraso no horário estabelecido pelo contratado, evitando assim prejudicar os demais passageiros, com tolerância de 1 minuto na casa e 5 minutos na saída da escola.</p>
      <p class="ct-cl"><b>Cláusula 10.</b> O cancelamento do transporte implicará em multa de 2 (duas) mensalidades vigentes por parte do contratante; indicando outro aluno, e esse aluno fechar, ficará isento da multa. No caso de a quebra ser por parte do contratado, este irá pagar o valor de uma mensalidade ou terá que disponibilizar outro transporte para o contratante.</p>
      <p class="ct-cl"><b>Cláusula 11.</b> Os meses de férias serão cobrados integralmente conforme as parcelas, independentemente do mês contratado (não trabalhamos em clube de férias).</p>
      <p class="ct-cl"><b>Cláusula 12.</b> Falta do aluno por doenças, viagens, passeios ou motivos particulares não gera desconto na mensalidade, pois a vaga permanecerá reservada e o transporte rodando normalmente.</p>
      <p class="ct-cl"><b>Cláusula 13.</b> Fica eleito o foro da Comarca de Sumaré, com prevalência sobre qualquer outro, por mais privilegiado que seja, para dirimir todas as dúvidas que possam advir de qualquer cláusula deste contrato. E, por estarem assim justos e contratados e de pleno acordo com todas as cláusulas estipuladas, assinam o presente instrumento particular em duas vias de igual teor e forma e sem rasura.</p>
      <p>${dataExtenso(x.dataContrato)}</p>
      <p><b>Ciente e de acordo,</b></p>
      <div class="ct-ass">
        <div>CONTRATANTE<br><b>${esc(f.responsavel)}</b><br>CPF ${esc(f.cpf)}<br>Reconheço e pagarei a dívida representada.</div>
        <div>CONTRATADO<br><b>${CONTRATADO.razao}</b><br>${CONTRATADO.fantasia} · CNPJ ${CONTRATADO.cnpj}</div>
      </div>
      <p class="ct-frase">“A boa reputação vale mais que grandes riquezas.”</p>
    </article>`;
  }

  /* link do contrato: curto pros códigos novos (…/contrato?K7M2PX9Q) */
  function linkContrato(token, base){
    const t = String(token||"");
    const rel = t.length <= 12 ? "contrato?" + t : "contrato.html?c=" + encodeURIComponent(t);
    return new URL(rel, base || location.href).href;
  }

  /* ---------- servidor ---------- */
  async function api(acao, dados){
    if (!API) throw Object.assign(new Error("Servidor ainda não configurado."), {codigo:"sem_api"});
    const r = await fetch(API, {method:"POST", body: JSON.stringify(Object.assign({acao}, dados||{}))});
    const j = await r.json();
    if (!j.ok) throw Object.assign(new Error(j.erro || "Erro no servidor"), {codigo:j.codigo});
    return j;
  }

  /* impressão: só o que estiver em #printArea sai no papel */
  function preparaImpressao(html){
    let pa = document.getElementById("printArea");
    if (!pa){ pa = document.createElement("div"); pa.id = "printArea"; document.body.appendChild(pa); }
    pa.innerHTML = html;
  }

  window.DT = {API, ZAP_DANNIS, CONTRATADO, ESCOLAS, MESES, INI, FIM, nomeMes, esc, fmtData, brl, num, hojeISO, vigencia, idade,
               maskCpf, maskTel, cpfValido, soDigitos, zapLink, contratoHTML, api, preparaImpressao, linkContrato};
})();
