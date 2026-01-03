// ===== CONFIG =====
const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyLE-2J3X5oNLmgUqdUu8qpAN5WOTbbfHd98fhpCAOzsuMDbH9pwRrbYlH1c-QR-Gg8/exec"; // https://script.google.com/macros/s/.../exec
const API_KEY = ""; // nếu backend APP.API_KEY có set thì điền y chang ở đây

// ===== JSONP helper (no CORS) =====
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

    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("JSONP load failed"));
    };

    function cleanup() {
      delete window[cb];
      script.remove();
    }

    document.body.appendChild(script);
  });
}

// ===== POST via hidden iframe form (no CORS) =====
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

    function onMsg(ev) {
      // backend returns postMessage(..., "*") so we accept any origin
      window.removeEventListener("message", onMsg);
      form.remove();
      iframe.remove();
      resolve(ev.data);
    }

    window.addEventListener("message", onMsg);
    form.submit();
  });
}

// ===== file -> base64 =====
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

export function normCode(s){
  return String(s||"").trim().toUpperCase().replace(/\s+/g,'');
}

export function normalizeAlt(s){
  const parts = String(s||"").split(",").map(x=>normCode(x)).filter(Boolean);
  return [...new Set(parts)].join(", ");
}
