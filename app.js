/***********************
 * Admin app.js (GitHub Pages)
 * - GET: fetch JSON from Apps Script (init/admin_get/find)
 * - POST: iframe + postMessage (product_upsert/admin_post)
 ***********************/

const API_BASE = "https://script.google.com/macros/s/AKfycbz1CzsrPjdl8wjE2iReR9XbPVXHtwar7HVwy-UmJp9Ls0qeXKRNi6Egs1wCYxjyuNEA/exec"; 
// ví dụ: https://script.google.com/macros/s/AKfycbxxxx/exec

const USE_MOCK_WHEN_NO_API = false; // true nếu muốn test UI không cần API

// ============ DOM helpers ============
const $ = (id) => document.getElementById(id);

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function setHTML(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ============ Normalization ============
function norm(s) {
  return String(s ?? "").trim().toUpperCase();
}
function normCode(s) {
  return String(s ?? "").trim().toUpperCase().replace(/\s+/g, "");
}
function catKey(s) {
  return String(s ?? "").trim().toLowerCase();
}
function inferCodeTypeFromCategory(category) {
  // same rule as backend: category starts with "lọc" => OEM else SKU
  return catKey(category).startsWith("lọc") ? "OEM" : "SKU";
}

// ============ API GET ============
async function apiGet(action, params = {}) {
  if (!API_BASE || API_BASE.includes("PASTE_YOUR")) {
    if (USE_MOCK_WHEN_NO_API) return mockApiGet(action, params);
    throw new Error("Chưa cấu hình API_BASE");
  }

  const url = new URL(API_BASE);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const r = await fetch(url.toString(), { method: "GET" });
  if (!r.ok) throw new Error("GET API lỗi: " + r.status);
  return await r.json();
}

// ============ API POST (iframe + postMessage) ============
function apiPost(action, payload = {}) {
  if (!API_BASE || API_BASE.includes("PASTE_YOUR")) {
    if (USE_MOCK_WHEN_NO_API) return mockApiPost(action, payload);
    return Promise.reject(new Error("Chưa cấu hình API_BASE"));
  }

  return new Promise((resolve, reject) => {
    const payloadFull = { ...payload, action };

    // 1) create hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.name = "post_iframe_" + Date.now();

    // 2) create form
    const form = document.createElement("form");
    form.method = "POST";
    form.action = API_BASE;
    form.target = iframe.name;

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload_json";
    input.value = JSON.stringify(payloadFull);

    form.appendChild(input);
    document.body.appendChild(iframe);
    document.body.appendChild(form);

    let done = false;

    function cleanup() {
      window.removeEventListener("message", onMessage);
      try { form.remove(); } catch (_) {}
      try { iframe.remove(); } catch (_) {}
    }

    function onMessage(ev) {
      // Apps Script trả postMessage(..., "*") nên origin có thể khác/không ổn định
      // -> chỉ check shape của data
      const data = ev?.data;
      if (!data || typeof data !== "object") return;
      if (done) return;

      // nhận đúng response object có "ok"
      if (Object.prototype.hasOwnProperty.call(data, "ok")) {
        done = true;
        cleanup();
        resolve(data);
      }
    }

    window.addEventListener("message", onMessage);

    // timeout
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error("POST timeout (không nhận được postMessage từ Apps Script)."));
    }, 15000);

    // submit
    try {
      form.submit();
    } catch (err) {
      clearTimeout(t);
      cleanup();
      reject(err);
    }
  });
}

// ============ UI state ============
let CATEGORIES = [];
let SUPPLIERS = [];

// ============ Render ============
function renderSelectOptions(selectId, items, { includeAll = false, allLabel = "Tất cả" } = {}) {
  const el = $(selectId);
  if (!el) return;

  const opts = [];
  if (includeAll) opts.push(`<option value="">${escapeHtml(allLabel)}</option>`);
  for (const it of items) {
    opts.push(`<option value="${escapeHtml(it)}">${escapeHtml(it)}</option>`);
  }
  el.innerHTML = opts.join("");
}

function renderList(listId, items) {
  const el = $(listId);
  if (!el) return;

  if (!items || !items.length) {
    el.innerHTML = `<div class="muted">Chưa có dữ liệu</div>`;
    return;
  }

  el.innerHTML = items
    .map(x => `<div class="item">${escapeHtml(x)}</div>`)
    .join("");
}

// ============ Load init ============
async function loadAdminData() {
  setText("status", "Đang tải dữ liệu...");
  const res = await apiGet("admin_get");
  if (!res?.ok) throw new Error(res?.message || "admin_get failed");

  CATEGORIES = Array.isArray(res.categories) ? res.categories : [];
  SUPPLIERS = Array.isArray(res.suppliers) ? res.suppliers : [];

  renderSelectOptions("cat_select", CATEGORIES, { includeAll: false });
  renderSelectOptions("p_category", CATEGORIES, { includeAll: true, allLabel: "Chọn nhóm hàng..." });

  renderList("cat_list", CATEGORIES);
  renderList("sup_list", SUPPLIERS);

  setText("status", "OK");
}

// ============ Category / Supplier actions ============
async function addCategory() {
  const v = String($("cat_input")?.value || "").trim();
  if (!v) return setText("status", "Nhập tên nhóm hàng trước.");
  setText("status", "Đang thêm nhóm...");

  const res = await apiPost("admin_post", { mode: "add_category", value: v });
  if (!res?.ok) return setText("status", res?.message || "Lỗi thêm nhóm");

  CATEGORIES = res.categories || [];
  renderSelectOptions("cat_select", CATEGORIES);
  renderSelectOptions("p_category", CATEGORIES, { includeAll: true, allLabel: "Chọn nhóm hàng..." });
  renderList("cat_list", CATEGORIES);

  $("cat_input").value = "";
  setText("status", "Đã thêm nhóm.");
}

async function deleteCategory() {
  const v = String($("cat_select")?.value || "").trim();
  if (!v) return setText("status", "Chọn nhóm hàng để xoá.");
  if (!confirm(`Xoá nhóm: "${v}" ?`)) return;

  setText("status", "Đang xoá nhóm...");
  const res = await apiPost("admin_post", { mode: "delete_category", value: v });
  if (!res?.ok) return setText("status", res?.message || "Lỗi xoá nhóm");

  CATEGORIES = res.categories || [];
  renderSelectOptions("cat_select", CATEGORIES);
  renderSelectOptions("p_category", CATEGORIES, { includeAll: true, allLabel: "Chọn nhóm hàng..." });
  renderList("cat_list", CATEGORIES);

  setText("status", "Đã xoá nhóm.");
}

async function addSupplier() {
  const v = String($("sup_input")?.value || "").trim();
  if (!v) return setText("status", "Nhập tên NCC trước.");
  setText("status", "Đang thêm NCC...");

  const res = await apiPost("admin_post", { mode: "add_supplier", value: v });
  if (!res?.ok) return setText("status", res?.message || "Lỗi thêm NCC");

  SUPPLIERS = res.suppliers || [];
  renderList("sup_list", SUPPLIERS);

  $("sup_input").value = "";
  setText("status", "Đã thêm NCC.");
}

async function deleteSupplier() {
  const v = String($("sup_select")?.value || "").trim();
  if (!v) return setText("status", "Chọn NCC để xoá.");
  if (!confirm(`Xoá NCC: "${v}" ?`)) return;

  setText("status", "Đang xoá NCC...");
  const res = await apiPost("admin_post", { mode: "delete_supplier", value: v });
  if (!res?.ok) return setText("status", res?.message || "Lỗi xoá NCC");

  SUPPLIERS = res.suppliers || [];
  renderList("sup_list", SUPPLIERS);

  setText("status", "Đã xoá NCC.");
}

// ============ Product find / update ============
function readProductForm() {
  const category = String($("p_category")?.value || "").trim();
  const code_main = normCode($("p_code_main")?.value || "");

  // fields to update
  const name = String($("p_name")?.value || "").trim();
  const code_alt = String($("p_code_alt")?.value || "").trim();
  const brand_model = String($("p_brand_model")?.value || "").trim();
  const unit = String($("p_unit")?.value || "").trim();
  const shelf = String($("p_shelf")?.value || "").trim();

  const cost_price = $("p_cost_price")?.value ?? "";
  const sale_price = $("p_sale_price")?.value ?? "";
  const min_stock = $("p_min_stock")?.value ?? "";

  return {
    category,
    code_type: inferCodeTypeFromCategory(category),
    code_main,
    name,
    code_alt,
    brand_model,
    unit,
    shelf,
    cost_price,
    sale_price,
    min_stock
  };
}

function fillProductFormFromServer(prod) {
  // prod keys from Code.gs: name, code_alt, brand_model, unit, shelf, cost_price, sale_price, min_stock, category...
  $("p_name").value = prod?.name ?? prod?.["Tags Products"] ?? "";
  $("p_code_alt").value = prod?.code_alt ?? "";
  $("p_brand_model").value = prod?.brand_model ?? "";
  $("p_unit").value = prod?.unit ?? "";
  $("p_shelf").value = prod?.shelf ?? "";
  $("p_cost_price").value = prod?.cost_price ?? "";
  $("p_sale_price").value = prod?.sale_price ?? "";
  $("p_min_stock").value = prod?.min_stock ?? "";

  // category: giữ category đang chọn nếu không có
  if (prod?.category && $("p_category")) $("p_category").value = prod.category;

  // show computed code_type
  const ct = inferCodeTypeFromCategory($("p_category")?.value || "");
  setText("p_code_type_view", ct);
}

async function findProduct() {
  const f = readProductForm();
  if (!f.category) return setText("status", "Chọn nhóm hàng trước (để suy ra OEM/SKU).");
  if (!f.code_main) return setText("status", "Nhập mã chính.");

  // show computed code_type
  setText("p_code_type_view", f.code_type);

  setText("status", "Đang tìm sản phẩm...");
  const res = await apiGet("find", { code_type: f.code_type, code_main: f.code_main });

  if (!res?.ok) return setText("status", res?.message || "Lỗi find");
  if (!res.found) {
    setText("status", "Không tìm thấy sản phẩm (đúng nhóm hàng & mã chưa?).");
    return;
  }

  fillProductFormFromServer(res.product);
  setText("status", "Đã load sản phẩm.");
}

async function updateProduct() {
  const f = readProductForm();
  if (!f.category) return setText("status", "Chọn nhóm hàng.");
  if (!f.code_main) return setText("status", "Nhập mã chính.");
  if (!f.name) return setText("status", "Nhập tên sản phẩm (Tags Products).");

  setText("p_code_type_view", f.code_type);

  // Lưu ý: backend infer code_type từ category.
  // Nếu bạn đổi category làm đổi code_type (SKU <-> OEM) => backend sẽ coi là sản phẩm khác.
  const warn =
    `Bạn đang cập nhật sản phẩm:\n- Nhóm: ${f.category}\n- Loại mã: ${f.code_type}\n- Mã chính: ${f.code_main}\n\nTiếp tục?`;
  if (!confirm(warn)) return;

  setText("status", "Đang cập nhật sản phẩm...");

  const payload = {
    category: f.category,
    code_main: f.code_main,
    name: f.name,            // sẽ map ra "Tags Products" ở API output
    code_alt: f.code_alt,
    brand_model: f.brand_model,
    unit: f.unit,
    shelf: f.shelf,
    cost_price: f.cost_price,
    sale_price: f.sale_price,
    min_stock: f.min_stock
  };

  const res = await apiPost("product_upsert", payload);
  if (!res?.ok) return setText("status", res?.message || "Cập nhật thất bại");

  setText("status", "Đã cập nhật sản phẩm.");
}

// ============ Wire events ============
function bindEvents() {
  // Categories
  $("btn_cat_add")?.addEventListener("click", (e) => { e.preventDefault(); addCategory(); });
  $("btn_cat_del")?.addEventListener("click", (e) => { e.preventDefault(); deleteCategory(); });

  // Suppliers
  $("btn_sup_add")?.addEventListener("click", (e) => { e.preventDefault(); addSupplier(); });
  $("btn_sup_del")?.addEventListener("click", (e) => { e.preventDefault(); deleteSupplier(); });

  // Product
  $("p_category")?.addEventListener("change", () => {
    const ct = inferCodeTypeFromCategory($("p_category")?.value || "");
    setText("p_code_type_view", ct);
  });

  $("btn_p_find")?.addEventListener("click", (e) => { e.preventDefault(); findProduct(); });
  $("btn_p_update")?.addEventListener("click", (e) => { e.preventDefault(); updateProduct(); });
}

// ============ Init ============
async function init() {
  try {
    bindEvents();
    await loadAdminData();

    // build supplier select for delete
    const supSel = $("sup_select");
    if (supSel) {
      supSel.innerHTML =
        `<option value="">Chọn NCC...</option>` +
        SUPPLIERS.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
    }

    // init computed code_type label
    const ct = inferCodeTypeFromCategory($("p_category")?.value || "");
    setText("p_code_type_view", ct);

  } catch (err) {
    console.error(err);
    setText("status", "Lỗi: " + (err?.message || err));
  }
}

document.addEventListener("DOMContentLoaded", init);

// ============ MOCK (optional) ============
function mockApiGet(action, params) {
  if (action === "admin_get") {
    return Promise.resolve({ ok: true, categories: ["Động cơ", "Lọc dầu", "Điện"], suppliers: ["NCC A", "NCC B"] });
  }
  if (action === "find") {
    return Promise.resolve({
      ok: true,
      found: true,
      product: {
        category: "Động cơ",
        code_type: params.code_type,
        code_main: params.code_main,
        name: "Lọc dầu Toyota",
        cost_price: 80000,
        sale_price: 120000,
        unit: "cái",
        shelf: "A1"
      }
    });
  }
  return Promise.resolve({ ok: true });
}

function mockApiPost(action, payload) {
  if (action === "admin_post") {
    return Promise.resolve({ ok: true, message: "OK (mock)", categories: ["Động cơ","Lọc dầu","Điện"], suppliers: ["NCC A","NCC B"] });
  }
  if (action === "product_upsert") {
    return Promise.resolve({ ok: true, message: "Đã cập nhật (mock)" });
  }
  return Promise.resolve({ ok: true });
}

/**
 * ===========================
 * REQUIRED HTML IDs (admin.html)
 * ===========================
 *
 * Status label:
 * - #status
 *
 * Category section:
 * - input:  #cat_input
 * - select: #cat_select
 * - button add: #btn_cat_add
 * - button del: #btn_cat_del
 * - list div: #cat_list
 *
 * Supplier section:
 * - input:  #sup_input
 * - select: #sup_select
 * - button add: #btn_sup_add
 * - button del: #btn_sup_del
 * - list div: #sup_list
 *
 * Product update section:
 * - select category: #p_category
 * - span (readonly) show code_type: #p_code_type_view
 * - input code_main: #p_code_main
 * - input name: #p_name
 * - input code_alt: #p_code_alt
 * - input brand_model: #p_brand_model
 * - input unit: #p_unit
 * - input shelf: #p_shelf
 * - input cost_price: #p_cost_price
 * - input sale_price: #p_sale_price
 * - input min_stock: #p_min_stock
 * - button find: #btn_p_find
 * - button update: #btn_p_update
 */
