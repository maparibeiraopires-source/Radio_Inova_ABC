// Rádio INOVA ABC — frontend estático compatível com GitHub Pages.
const audio = document.getElementById("audio");
const trackTitle = document.getElementById("trackTitle");
const trackArtist = document.getElementById("trackArtist");
const musicList = document.getElementById("musicList");
const newsList = document.getElementById("newsList");
const newsStatus = document.getElementById("newsStatus");
const base = new URL(".", window.location.href);
const asset = p => new URL(p, base).href;
let playlist = [];

function esc(value="") {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function safeUrl(value) {
  try { const u = new URL(value, base); return ["http:","https:"].includes(u.protocol) ? u.href : "#"; }
  catch { return "#"; }
}
async function loadMusic() {
  musicList.innerHTML = '<p class="muted">Carregando playlist…</p>';
  try {
    const res = await fetch(asset("musicas/playlist.json"), {cache:"no-store"});
    if (!res.ok) throw new Error("playlist.json não encontrado");
    const data = await res.json();
    playlist = (data.items || []).filter(x => x && x.title && x.file);
    if (!playlist.length) {
      musicList.innerHTML = '<p class="muted">A playlist está vazia. Envie arquivos de áudio para <b>site/musicas/</b> e registre cada arquivo em <b>site/musicas/playlist.json</b>.</p>';
      trackTitle.textContent = "Bem-vindo à Rádio INOVA ABC";
      trackArtist.textContent = "Adicione faixas à playlist para começar";
      return;
    }
    musicList.innerHTML = playlist.map((item, i) => `<div class="music-row"><span>♫ &nbsp;${esc(item.title)}</span><button data-index="${i}" type="button">▶ Ouvir</button></div>`).join("");
    musicList.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => playTrack(Number(btn.dataset.index))));
  } catch(e) {
    musicList.innerHTML = '<p class="muted">Não foi possível carregar playlist.json. Confira se o arquivo está publicado na pasta site/musicas/.</p>';
  }
}
function playTrack(index) {
  if (!playlist.length) return;
  const item = playlist[index];
  const url = safeUrl("musicas/" + item.file);
  if (url === "#") return;
  audio.pause();
  audio.src = url;
  audio.load();
  trackTitle.textContent = item.title;
  trackArtist.textContent = "Playlist da Rádio INOVA ABC";
  audio.play().then(() => {
    musicList.querySelectorAll("button").forEach((b,i) => b.textContent = i === index ? "♫ Tocando" : "▶ Ouvir");
  }).catch(err => {
    trackArtist.textContent = "O navegador bloqueou a reprodução ou o arquivo não está disponível. Clique em Reproduzir e confira o nome do arquivo.";
    console.warn("Falha na reprodução:", err);
  });
}
audio.addEventListener("ended", () => {
  if (playlist.length) {
    const current = playlist.findIndex(x => safeUrl("musicas/" + x.file) === audio.src);
    playTrack((current + 1) % playlist.length);
  }
});
audio.addEventListener("error", () => {
  if (audio.src) trackArtist.textContent = "Erro ao abrir o áudio. Verifique se o arquivo foi publicado e se o formato é compatível.";
});

// RSS no GitHub Pages: feeds Google News via proxy CORS. O navegador não consegue
// ler diretamente muitos feeds por causa da política CORS.
const feeds = [
  {name:"Google Notícias • Ribeirão Pires", url:"https://news.google.com/rss/search?q=Ribeir%C3%A3o+Pires&hl=pt-BR&gl=BR&ceid=BR:pt-419"},
  {name:"Google Notícias • Grande ABC", url:"https://news.google.com/rss/search?q=Grande+ABC+S%C3%A3o+Paulo&hl=pt-BR&gl=BR&ceid=BR:pt-419"},
  {name:"Google Notícias • São Paulo", url:"https://news.google.com/rss/search?q=ABC+Paulista+not%C3%ADcias&hl=pt-BR&gl=BR&ceid=BR:pt-419"}
];
async function fetchFeed(feed) {
  const proxy = "https://api.allorigins.win/raw?url=" + encodeURIComponent(feed.url);
  const res = await fetch(proxy, {cache:"no-store"});
  if (!res.ok) throw new Error("proxy RSS respondeu HTTP " + res.status);
  const xmlText = await res.text();
  const xml = new DOMParser().parseFromString(xmlText, "text/xml");
  if (xml.querySelector("parsererror")) throw new Error("XML RSS inválido");
  return [...xml.querySelectorAll("item")].slice(0,12).map(item => ({
    source: feed.name,
    title: item.querySelector("title")?.textContent?.trim() || "Sem título",
    summary: item.querySelector("description")?.textContent?.trim() || "",
    link: item.querySelector("link")?.textContent?.trim() || feed.url,
    published: item.querySelector("pubDate")?.textContent?.trim() || ""
  }));
}
async function loadNews() {
  const btn = document.getElementById("refreshNews");
  btn.disabled = true;
  newsStatus.textContent = "Consultando fontes de notícias…";
  newsList.innerHTML = "";
  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const items = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
  const errors = results.filter(r => r.status === "rejected").length;
  const seen = new Set();
  const unique = items.filter(x => { const k=x.title+"|"+x.link; if(seen.has(k))return false; seen.add(k); return true; });
  unique.sort((a,b) => (Date.parse(b.published)||0) - (Date.parse(a.published)||0));
  newsStatus.textContent = `${unique.length} notícia(s) carregada(s) • Atualizado em ${new Date().toLocaleString("pt-BR")}${errors ? ` • ${errors} fonte(s) não responderam; tente novamente mais tarde.` : ""}`;
  if (!unique.length) {
    newsList.innerHTML = '<article class="news-card"><h3>Não foi possível carregar o RSS</h3><p>O serviço de proxy pode estar indisponível ou a rede pode bloquear a consulta. Tente novamente mais tarde.</p><a href="https://news.google.com/" target="_blank" rel="noopener noreferrer">Abrir Google Notícias ↗</a></article>';
  } else {
    newsList.innerHTML = unique.slice(0,24).map(item => {
      const desc = item.summary.replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").trim().slice(0,260);
      const date = item.published ? new Date(item.published).toLocaleString("pt-BR") : "Data não informada";
      return `<article class="news-card"><div class="source">${esc(item.source)}</div><h3>${esc(item.title)}</h3><div class="date">${esc(date)}</div><p>${esc(desc)}</p><a href="${esc(safeUrl(item.link))}" target="_blank" rel="noopener noreferrer">Ler na fonte original ↗</a></article>`;
    }).join("");
  }
  btn.disabled = false;
}
document.getElementById("refreshNews").addEventListener("click", loadNews);
document.getElementById("refreshMusic").addEventListener("click", loadMusic);
document.getElementById("connectStream").addEventListener("click", () => {
  const field = document.getElementById("streamUrl");
  const url = safeUrl(field.value.trim());
  if (!field.value.trim() || url === "#") {
    trackArtist.textContent = "Informe um endereço de streaming público começando com http:// ou https://.";
    field.focus(); return;
  }
  audio.pause(); audio.src = url; audio.load();
  trackTitle.textContent = "Rádio INOVA ABC • Ao vivo";
  trackArtist.textContent = "Conectando ao streaming…";
  audio.play().then(() => trackArtist.textContent = "Transmissão ao vivo conectada.")
    .catch(() => trackArtist.textContent = "Não foi possível iniciar. Confira o endereço, o formato do stream e se o servidor permite HTTPS/CORS.");
});
function clock() { document.getElementById("clock").textContent = new Date().toLocaleString("pt-BR", {dateStyle:"short",timeStyle:"short"}); }
clock(); setInterval(clock, 30000);
loadMusic();
loadNews();
