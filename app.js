export const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwYflf8KUT0APaU_6NcXEeXucyZe3yDRbWTsE9WMa-S0YCBeX_2kipbY7irN0fB0VQ/exec";
export const API_KEY = ""; // nếu backend có set APP.API_KEY thì điền giống

export function jsonp(action, params = {}) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const qs = new URLSearchParams({
      action,
      callback: cb,
      ...(API_KEY ? { key: API_KEY } : {}),
      ...params
    });

    const script = document.createElement("script");
    script.src = `${WEBAPP_URL}?${qs.toString()}`;

    window[cb] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error("JSONP load failed")); };

    function cleanup(){ delete window[cb]; script.remove(); }
    document.body.appendChild(script);
  });
}

export function postViaIframe(payloadObj) {
  return new Promise((resolve) => {
    const iframeName = "if_" + Math.random().toString(36).slice(2);

    const iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    const form = document.createElement("form");
    form.method = "POST";
    form.enctype = "application/x-www-form-urlencoded";
    form.action = API_KEY ? `${WEBAPP_URL}?key=${encodeURIComponent(API_KEY)}` : WEBAPP_URL;
    form.target = iframeName;

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload_json";
    input.value = JSON.stringify(payloadObj);

    form.appendChild(input);
    document.body.appendChild(form);

    function onMsg(ev){
      window.removeEventListener("message", onMsg);
      form.remove();
      iframe.remove();
      resolve(ev.data);
    }
    window.addEventListener("message", onMsg);
    form.submit();
  });
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => {
      const s = String(rd.result || "");
      resolve(s.split(",")[1] || "");
    };
    rd.onerror = reject;
    rd.readAsDataURL(file);
  });
}

export function inferCodeType(category) {
  const c = String(category || "").trim().toUpperCase();
  return c.startsWith("LỌC") ? "OEM" : "SKU";
}

export function normCode(s){ return String(s||"").trim().toUpperCase().replace(/\s+/g,''); }
export function normalizeAlt(s){
  const parts = String(s||"").split(",").map(x=>normCode(x)).filter(Boolean);
  return [...new Set(parts)].join(", ");
}

// Convert old Drive links -> direct image
export function driveToDirect(url){
  const s = String(url||'').trim();
  let m = s.match(/\/d\/([a-zA-Z0-9_-]{10,})\//);
  if (m && m[1]) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  m = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m && m[1]) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  return s;
}
export function firstImage(urls){
  const list = String(urls||'').split(',').map(x=>x.trim()).filter(Boolean);
  return list[0] ? driveToDirect(list[0]) : '';
}

export function uiHeader(active){
  return `
  <header class="hdr">
    <div class="wrap">
      <div class="hdr-row">
        <div class="brand">
          <div class="truck">
            <svg viewBox="0 0 128 128" width="40" height="40">
              <defs>
                <linearGradient id="g" x1="0" x2="1">
                  <stop offset="0" stop-color="#1a73e8"/>
                  <stop offset="1" stop-color="#7dd3fc"/>
                </linearGradient>
              </defs>
              <rect x="8" y="22" width="68" height="42" rx="10" fill="url(#g)"/>
              <rect x="76" y="36" width="30" height="28" rx="8" fill="#e8f0fe" stroke="#bcd3ff" stroke-width="2"/>
              <rect x="84" y="42" width="14" height="10" rx="3" fill="#fff" stroke="#bcd3ff" stroke-width="2"/>
              <rect x="10" y="64" width="98" height="10" rx="5" fill="#0b57d0" opacity="0.9"/>
              <circle cx="28" cy="84" r="12" fill="#202124"/><circle cx="28" cy="84" r="6" fill="#e8f0fe"/>
              <circle cx="88" cy="84" r="12" fill="#202124"/><circle cx="88" cy="84" r="6" fill="#e8f0fe"/>
            </svg>
          </div>
          <div>
            <div class="title">Thanh hải - phụ tùng</div>
            <div class="sub">GitHub UI • Apps Script lưu Sheet + Drive</div>
            <nav class="nav">
              <a class="${active==='index'?'on':''}" href="./index.html">Index</a>
              <a class="${active==='products'?'on':''}" href="./products.html">Products</a>
              <a class="${active==='admin'?'on':''}" href="./admin.html">Admin</a>
            </nav>
          </div>
        </div>
        <div class="pill">OK</div>
      </div>
    </div>
  </header>`;
}

export function uiFooter(){
  return `
  <footer class="footer">
    <div class="footer-pill">
      <div class="marquee">
        <div class="marquee__inner">
          <span>@2026 Thanh hải - phụ tùng</span>
          <span>@2026 Thanh hải - phụ tùng</span>
          <span>@2026 Thanh hải - phụ tùng</span>
          <span>@2026 Thanh hải - phụ tùng</span>
        </div>
      </div>
    </div>
  </footer>`;
}
