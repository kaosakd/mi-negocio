(() => {
  'use strict';

  const C = window.APP_CONFIG || {};
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => (C.CURRENCY || '') + Number(n || 0).toFixed(2);
  const LOW = Number.isFinite(C.LOW_STOCK_LIMIT) ? C.LOW_STOCK_LIMIT : 5;
  const TZ = C.TIMEZONE || 'America/La_Paz';
  const inputCls = 'w-full border border-slate-300 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const btnCls = 'w-full text-white font-bold text-lg rounded-2xl py-4 active:scale-95 transition disabled:opacity-50';
  const show = (sel, on) => $(sel).classList.toggle('hidden', !on);

  document.title = C.APP_NAME || 'Mi Negocio';

  const configured = C.SUPABASE_URL && C.SUPABASE_ANON_KEY && !/TU-PROYECTO|TU_CLAVE/.test(C.SUPABASE_URL + C.SUPABASE_ANON_KEY);
  if (!configured || !window.supabase) {
    show('#boot', false); show('#setup', true);
    return;
  }

  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

  function toast(msg, ok = true) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'fixed left-1/2 -translate-x-1/2 bottom-6 z-50 px-4 py-3 rounded-xl text-white text-sm shadow-lg max-w-[90vw] ' + (ok ? 'bg-emerald-600' : 'bg-red-600');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.add('hidden'), 3500);
  }

  function errMsg(e) { return (e && e.message) || String(e); }
  function fmtFecha(iso) { return new Date(iso).toLocaleString('es-BO', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); }
  function inicioDeHoyISO() {
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return `${dia}T00:00:00-04:00`;
  }

  function tickClock() { $('#reloj').textContent = new Date().toLocaleString('es-BO', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' }); }
  tickClock(); setInterval(tickClock, 30000);

  let DB = { clientes: [], proveedores: [], productos: [], hoy: { total: 0, n: 0 }, ultimas: [] };
  let carrito = [];

  async function loadState() {
    const [cli, prov, prod, vh, ul] = await Promise.all([
      sb.from('clientes').select('id,nombre,telefono,email,fecha_registro').order('nombre'),
      sb.from('proveedores').select('id,nombre,contacto,telefono,fecha_registro').order('nombre'),
      sb.from('productos').select('id,nombre,descripcion,precio_venta,costo_compra,stock_actual,proveedor_id').order('nombre'),
      sb.from('ventas').select('total').gte('fecha_hora', inicioDeHoyISO()),
      sb.from('vw_movimientos').select('tipo,producto,cantidad,total,fecha_hora').order('fecha_hora', { ascending: false }).limit(5),
    ]);
    DB.clientes = cli.data; DB.proveedores = prov.data; DB.productos = prod.data.map(x => ({ ...x, precio_venta: Number(x.precio_venta), costo_compra: Number(x.costo_compra), stock_actual: Number(x.stock_actual) }));
    DB.hoy = { total: vh.data.reduce((a, v) => a + Number(v.total), 0), n: vh.data.length };
    DB.ultimas = ul.data.map(t => ({ ...t, cantidad: Number(t.cantidad), total: Number(t.total) }));
    renderSummary();
  }

  function renderSummary() {
    $('#vHoy').textContent = money(DB.hoy.total);
    $('#vHoyN').textContent = DB.hoy.n + ' venta(s) hoy';
    const bajo = DB.productos.filter(p => p.stock_actual <= LOW);
    show('#boxBajo', bajo.length > 0);
    $('#listBajo').innerHTML = bajo.map(p => `<li class="flex justify-between"><span>${esc(p.nombre)}</span><b class="${p.stock_actual === 0 ? 'text-red-700' : 'text-amber-600'}">${p.stock_actual} u.</b></li>`).join('');
    $('#listUlt').innerHTML = DB.ultimas.length ? DB.ultimas.map(t => `<li class="py-2 flex items-center gap-3"><span class="text-xl">${t.tipo === 'venta' ? '💰' : t.tipo === 'pago_credito' ? '💵' : '🛒'}</span><div class="flex-1 min-w-0"><div class="truncate">${esc(t.producto)} × ${t.cantidad}</div><div class="text-xs text-slate-400">${fmtFecha(t.fecha_hora)}</div></div><b class="${t.tipo === 'venta' ? 'text-emerald-600' : 'text-amber-600'}">${t.tipo === 'venta' ? '+' : '−'}${money(t.total)}</b></li>`).join('') : '<li class="py-3 text-slate-400">Sin transacciones.</li>';
  }

  function openSheet(title, html) { $('#sheetTitle').textContent = title; $('#sheetBody').innerHTML = html; show('#overlay', true); document.body.style.overflow = 'hidden'; }
  function closeSheet() { show('#overlay', false); document.body.style.overflow = ''; }
  $('#btnClose').onclick = closeSheet;
  $('#overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closeSheet(); });
  $('#btnRefresh').onclick = () => loadState().then(() => toast('Datos actualizados')).catch(e => toast(errMsg(e), false));
  $('#btnLogout').onclick = () => sb.auth.signOut();

  const label = t => `<label class="block text-sm font-medium text-slate-600 mb-1 mt-3">${t}</label>`;
  const options = (rows, fn, ph) => `<option value="">${ph}</option>` + rows.map(fn).join('');

  async function submitForm(form, action, onOk) {
    const btn = form.querySelector('button[type=submit]');
    const old = btn.textContent; btn.disabled = true; btn.textContent = 'Guardando…';
    try { await action(Object.fromEntries(new FormData(form))); await loadState(); toast('✅ Guardado'); onOk(); } 
    catch (e) { toast(errMsg(e), false); } finally { btn.disabled = false; btn.textContent = old; }
  }
  const must = ({ error }) => { if (error) throw error; };

  const acciones = {
    cliente: d => sb.from('clientes').insert({ nombre: d.nombre.trim(), telefono: (d.telefono || '').trim(), email: (d.email || '').trim() }).then(must),
    proveedor: d => sb.from('proveedores').insert({ nombre: d.nombre.trim(), contacto: (d.contacto || '').trim(), telefono: (d.telefono || '').trim() }).then(must),
    producto: d => sb.from('productos').insert({ nombre: d.nombre.trim(), descripcion: (d.descripcion || '').trim(), precio_venta: Number(d.precio_venta), costo_compra: Number(d.costo_compra), stock_actual: parseInt(d.stock_actual, 10) || 0, proveedor_id: d.proveedor_id ? Number(d.proveedor_id) : null }).then(must),
    venta: (cliente_id, metodo_pago, carrito) => sb.rpc('registrar_venta_completa', { 
  p_cliente_id: Number(cliente_id), 
  p_metodo_pago: metodo_pago, 
  p_productos: carrito 
}).then(must),
    compra: d => sb.rpc('registrar_compra', { p_proveedor_id: Number(d.proveedor_id), p_producto_id: Number(d.producto_id), p_cantidad: parseInt(d.cantidad, 10), p_costo_unitario: Number(d.costo_unitario) }).then(must),
  };

  // ── POS VENTA ────────────────────────────────────
  function viewVenta() {
    if (!DB.clientes.length || !DB.productos.length) return toast('Registra clientes y productos primero', false);
    carrito = [];
    openSheet('Nueva Venta (POS)', `
      <div class="space-y-4">
        <div class="bg-slate-50 p-3 rounded-2xl">
          ${label('Cliente')}
          <select id="selCli" class="${inputCls}">${options(DB.clientes, c => `<option value="${c.id}">${esc(c.nombre)}</option>`, 'Selecciona cliente…')}</select>
        </div>
        <div class="grid grid-cols-3 gap-2" id="posGrid">
          ${DB.productos.map(p => `<button onclick="window.addToCart(${p.id})" class="p-3 bg-white border rounded-xl text-xs font-medium shadow-sm active:bg-indigo-100 transition truncate">${esc(p.nombre)}<br><b class="text-indigo-600">${money(p.precio_venta)}</b></button>`).join('')}
        </div>
        <div class="bg-white border rounded-2xl p-3">
          <div class="font-bold mb-2 flex justify-between"><span>🛒 Carrito</span><button onclick="window.clearCart()" class="text-xs text-red-500">Vaciar</button></div>
          <ul id="cartList" class="divide-y text-sm"></ul>
          <div class="mt-3 pt-3 border-t flex justify-between items-center">
            <span class="font-bold">Total:</span><span id="cartTotal" class="text-2xl font-black text-emerald-600">${money(0)}</span>
          </div>
        </div>
        <div class="bg-slate-50 p-3 rounded-2xl">
          ${label('Método de Pago')}
          <select id="metPago" class="${inputCls}">
            <option value="Efectivo">💵 Efectivo</option>
            <option value="QR">📱 QR</option>
            <option value="Crédito">📝 Crédito</option>
          </select>
        </div>
        <button id="btnConfirmVenta" class="${btnCls} bg-emerald-500">Confirmar Venta</button>
      </div>`);
    
    window.addToCart = (id) => {
      const p = DB.productos.find(x => x.id == id);
      const exist = carrito.find(x => x.id == id);
      if (exist) exist.qty++; else carrito.push({ ...p, qty: 1 });
      renderCart();
    };
    window.clearCart = () => { carrito = []; renderCart(); };
    function renderCart() {
      $('#cartList').innerHTML = carrito.map((item, i) => `
        <li class="py-2 flex justify-between items-center">
          <div class="truncate">${esc(item.nombre)}</div>
          <div class="flex items-center gap-2">
            <button onclick="window.updateQty(${i}, -1)" class="w-6 h-6 bg-slate-200 rounded">-</button>
            <span>${item.qty}</span>
            <button onclick="window.updateQty(${i}, 1)" class="w-6 h-6 bg-slate-200 rounded">+</button>
            <b class="ml-2">${money(item.precio_venta * item.qty)}</b>
          </div>
        </li>`).join('');
      $('#cartTotal').textContent = money(carrito.reduce((a, b) => a + (b.precio_venta * b.qty), 0));
    }
    window.updateQty = (i, d) => {
      carrito[i].qty += d;
      if (carrito[i].qty <= 0) carrito.splice(i, 1);
      renderCart();
    };

        $('#btnConfirmVenta').onclick = async () => {
      const cliId = $('#selCli').value;
      const met = $('#metPago').value;
      if (!cliId) return toast('Selecciona un cliente', false);
      if (!carrito.length) return toast('El carrito está vacío', false);
      
      $('#btnConfirmVenta').disabled = true;
      try {
        // Enviamos todo el carrito de una sola vez a la nueva función
        await acciones.venta(cliId, met, carrito);
        
        toast('✅ Venta registrada');
        closeSheet();
        loadState();
      } catch (e) { 
        toast(errMsg(e), false); 
      } finally { 
        $('#btnConfirmVenta').disabled = false; 
      }
    };
  }

  function viewCompra() {
    if (!DB.proveedores.length || !DB.productos.length) return toast('Registra proveedores y productos primero', false);
    openSheet('Registrar Compra', `
      <form id="f" class="pb-2">
        ${label('Proveedor')}<select name="proveedor_id" required class="${inputCls}">${options(DB.proveedores, p => `<option value="${p.id}">${esc(p.nombre)}</option>`, 'Selecciona proveedor…')}</select>
        ${label('Producto')}<select name="producto_id" id="selProd" required class="${inputCls}">${options(DB.productos, p => `<option value="${p.id}">${esc(p.nombre)} (stock ${p.stock_actual})</option>`, 'Selecciona producto…')}</select>
        ${label('Cantidad')}<input name="cantidad" id="qty" type="number" min="1" value="1" required class="${inputCls}">
        ${label('Costo unitario')}<input name="costo_unitario" id="cost" type="number" step="0.01" required class="${inputCls}">
        <div class="mt-5 mb-4 bg-amber-50 rounded-2xl p-4 flex justify-between items-center">
          <span class="text-slate-600">Total</span><b id="total" class="text-3xl text-amber-600">${money(0)}</b>
        </div>
        <button type="submit" class="${btnCls} bg-amber-500">Confirmar compra</button>
      </form>`);
    const calc = () => { $('#total').textContent = money((parseFloat($('#cost').value) || 0) * (parseInt($('#qty').value, 10) || 0)); };
    $('#selProd').onchange = () => { const p = DB.productos.find(x => x.id == $('#selProd').value); if (p) $('#cost').value = p.costo_compra; calc(); };
    $('#qty').oninput = calc; $('#cost').oninput = calc;
    $('#f').onsubmit = e => { e.preventDefault(); submitForm(e.target, acciones.compra, closeSheet); };
  }

  async function viewCreditos() {
    openSheet('Cuentas por Cobrar', '<div class="py-10 text-center text-slate-400">Cargando deudas…</div>');
    const { data: deudas, error } = await sb.from('vw_cuentas_por_cobrar').select('*');
    if (error) return toast(errMsg(error), false);
    const totalDeuda = deudas.reduce((a, b) => a + b.saldo_pendiente, 0);
    $('#sheetBody').innerHTML = `
      <div class="mb-4 bg-red-50 p-3 rounded-xl text-red-700 text-sm font-medium">Total por cobrar: ${money(totalDeuda)}</div>
      <ul class="divide-y">${deudas.map(d => `
        <li class="py-3 flex justify-between items-center">
          <div><div class="font-bold">${esc(d.cliente)}</div><div class="text-xs text-slate-500">${money(d.saldo_pendiente)} pendiente</div></div>
          <button onclick="window.cobrarCredito(${d.venta_id}, ${d.saldo_pendiente})" class="bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-bold">Cobrar</button>
        </li>`).join('') || '<li>No hay deudas pendientes</li>'}</ul>`;
  }

window.cobrarCredito = async (id, monto) => {
  const m = prompt("Método de pago: 1. Efectivo, 2. QR");
  if (m !== '1' && m !== '2') return; 
  const metodo = m === '2' ? 'QR' : 'Efectivo';
  
  try {
    // 1. Llamamos a la función de la base de datos y esperamos su respuesta
    const { error } = await sb.rpc('registrar_pago_credito', { 
      p_venta_id: id, 
      p_monto: monto, 
      p_metodo: metodo 
    });
    
    // Si hay un error en la base de datos, lo lanzamos para que se vea en rojo
    if (error) throw error;
    
    toast('✅ Cobro registrado');
    
    // 2. Esperamos a que la vista de créditos se vuelva a cargar antes de cerrar
    await viewCreditos(); 
    
    // 3. Recargamos los datos del inicio (ventas de hoy, etc.)
    loadState();    
    
  } catch (e) { 
    toast('Error al cobrar: ' + errMsg(e), false); 
  }
};
  async function viewReportes() {
    openSheet('Reportes Financieros', `
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-2">
          <div><label class="text-xs font-bold">Desde</label><input type="date" id="repD" class="${inputCls}"></div>
          <div><label class="text-xs font-bold">Hasta</label><input type="date" id="repH" class="${inputCls}"></div>
        </div>
        <button id="btnFiltrar" class="${btnCls} bg-indigo-600">Generar Reporte</button>
        <div id="res" class="hidden space-y-3">
          <div class="bg-emerald-50 p-4 rounded-2xl flex justify-between"><span>Ventas</span><b id="rv" class="text-emerald-700"></b></div>
          <div class="bg-amber-50 p-4 rounded-2xl flex justify-between"><span>Compras</span><b id="rc" class="text-amber-700"></b></div>
          <div class="bg-slate-100 p-4 rounded-2xl flex justify-between font-bold"><span>Balance</span><b id="rn"></b></div>
        </div>
      </div>`);
    $('#btnFiltrar').onclick = async () => {
      const d = $('#repD').value, h = $('#repH').value;
      if (!d || !h) return toast('Elige fechas', false);
      const { data, error } = await sb.from('vw_movimientos').select('*').gte('fecha_hora', `${d}T00:00:00`).lte('fecha_hora', `${h}T23:59:59`);
      if (error) return toast(errMsg(error), false);
      const v = data.filter(m => m.tipo === 'venta').reduce((a, m) => a + Number(m.total), 0);
      const c = data.filter(m => m.tipo === 'compra').reduce((a, m) => a + Number(m.total), 0);
      $('#rv').textContent = money(v); $('#rc').textContent = money(c); $('#rn').textContent = money(v - c);
      show('#res', true);
    };
  }

  async function viewBackups() {
    openSheet('Respaldo de Datos', `
      <div class="space-y-4">
        <button onclick="window.exportJSON()" class="${btnCls} bg-slate-600">Descargar Backup (.JSON)</button>
        <div class="p-4 bg-indigo-50 rounded-2xl">
          <div class="text-sm font-bold mb-2">Sincronización Google Sheets</div>
          <p class="text-xs text-slate-600 mb-3">Sincroniza tus ventas automáticamente con una hoja de cálculo.</p>
          <input type="text" id="gsUrl" placeholder="URL de Web App de Google" class="${inputCls} mb-2">
          <button onclick="window.syncSheets()" class="w-full bg-indigo-600 text-white py-2 rounded-xl text-sm font-bold">Sincronizar Ahora</button>
        </div>
      </div>`);
  }

  window.exportJSON = async () => {
    const data = { clientes: DB.clientes, productos: DB.productos, proveedores: DB.proveedores, fecha: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `backup_negocio_${new Date().toISOString().split('T')[0]}.json`; a.click();
  };

  window.syncSheets = async () => {
    const url = $('#gsUrl').value; if (!url) return toast('Pega la URL de Google Apps Script', false);
    try {
      const { data: movs } = await sb.from('vw_movimientos').select('*');
      await fetch(url, { method: 'POST', body: JSON.stringify(movs) });
      toast('✅ Sincronizado con Google Sheets');
    } catch (e) { toast('Error al sincronizar', false); }
  };

  function viewProductos() {
    const list = DB.productos.map(p => `<li class="py-3 flex justify-between gap-3"><div><div class="font-medium truncate">${esc(p.nombre)}</div><div class="text-xs text-slate-500 truncate">${esc(p.descripcion)}</div></div><div class="text-right shrink-0"><div>${money(p.precio_venta)}</div><div class="text-xs ${p.stock_actual <= LOW ? 'text-red-600 font-bold' : 'text-slate-500'}">stock ${p.stock_actual}</div></div></li>`).join('') || '<li>Sin productos.</li>';
    openSheet('Productos', `<details class="mb-3 bg-indigo-50 rounded-2xl p-3" ${DB.productos.length ? '' : 'open'}><summary class="font-semibold text-indigo-700 cursor-pointer">＋ Nuevo producto</summary><form id="f">${label('Nombre')}<input name="nombre" required class="${inputCls}">${label('Descripción')}<input name="descripcion" class="${inputCls}"><div class="grid grid-cols-2 gap-3"><div>${label('Precio venta')}<input name="precio_venta" type="number" step="0.01" required class="${inputCls}"></div><div>${label('Costo compra')}<input name="costo_compra" type="number" step="0.01" required class="${inputCls}"></div></div>${label('Stock inicial')}<input name="stock_actual" type="number" value="0" class="${inputCls}">${label('Proveedor')}<select name="proveedor_id" class="${inputCls}">${options(DB.proveedores, p => `<option value="${p.id}">${esc(p.nombre)}</option>`, '— Ninguno —')}</select><button type="submit" class="${btnCls} bg-indigo-600 mt-4">Guardar</button></form></details><ul class="divide-y">${list}</ul>`);
    $('#f').onsubmit = e => { e.preventDefault(); submitForm(e.target, acciones.producto, viewProductos); };
  }

  function viewClientes() {
    const list = DB.clientes.map(c => `<li class="py-3"><div>${esc(c.nombre)}</div><div class="text-xs text-slate-500">${esc(c.telefono)}</div></li>`).join('') || '<li>Sin clientes.</li>';
    openSheet('Clientes', `<details class="mb-3 bg-indigo-50 rounded-2xl p-3" ${DB.clientes.length ? '' : 'open'}><summary class="font-semibold text-indigo-700 cursor-pointer">＋ Nuevo cliente</summary><form id="f">${label('Nombre')}<input name="nombre" required class="${inputCls}">${label('Teléfono')}<input name="telefono" type="tel" class="${inputCls}">${label('Email')}<input name="email" type="email" class="${inputCls}"><button type="submit" class="${btnCls} bg-indigo-600 mt-4">Guardar</button></form></details><ul class="divide-y">${list}</ul>`);
    $('#f').onsubmit = e => { e.preventDefault(); submitForm(e.target, acciones.cliente, viewClientes); };
  }

  function viewProveedores() {
    const list = DB.proveedores.map(p => `<li class="py-3"><div>${esc(p.nombre)}</div><div class="text-xs text-slate-500">${esc(p.contacto)}</div></li>`).join('') || '<li>Sin proveedores.</li>';
    openSheet('Proveedores', `<details class="mb-3 bg-indigo-50 rounded-2xl p-3" ${DB.proveedores.length ? '' : 'open'}><summary class="font-semibold text-indigo-700 cursor-pointer">＋ Nuevo proveedor</summary><form id="f">${label('Nombre')}<input name="nombre" required class="${inputCls}">${label('Persona de contacto')}<input name="contacto" class="${inputCls}">${label('Teléfono')}<input name="telefono" type="tel" class="${inputCls}"><button type="submit" class="${btnCls} bg-indigo-600 mt-4">Guardar</button></form></details><ul class="divide-y">${list}</ul>`);
    $('#f').onsubmit = e => { e.preventDefault(); submitForm(e.target, acciones.proveedor, viewProveedores); };
  }

  async function viewMovimientos() {
    openSheet('Movimientos', '<div class="py-10 text-center text-slate-400">Cargando…</div>');
    const { data, error } = await sb.from('vw_movimientos').select('*').order('fecha_hora', { ascending: false }).limit(120);
    if (error) return toast(errMsg(error), false);
    $('#sheetBody').innerHTML = `<ul class="divide-y">${data.map(m => `<li class="py-3 flex justify-between"><div><div class="font-medium">${esc(m.producto)} x ${m.cantidad}</div><div class="text-xs text-slate-400">${fmtFecha(m.fecha_hora)}</div></div><b class="${m.tipo === 'venta' ? 'text-emerald-600' : 'text-amber-600'}">${m.tipo === 'venta' ? '+' : '−'}${money(m.total)}</b></li>`).join('')}</ul>`;
  }

  const VIEWS = { venta: viewVenta, compra: viewCompra, productos: viewProductos, clientes: viewClientes, proveedores: viewProveedores, movimientos: viewMovimientos, creditos: viewCreditos, reportes: viewReportes, backups: viewBackups };
  document.querySelectorAll('[data-open]').forEach(b => { b.onclick = () => VIEWS[b.dataset.open](); });

  let loginMode = 'in';
  function renderLogin(note = '', noteOk = false) {
    const up = loginMode === 'up';
    $('#login').innerHTML = `<div class="text-6xl mb-4">🏪</div><h1 class="text-3xl font-bold text-white">${esc(C.APP_NAME || 'Mi Negocio')}</h1><p class="text-indigo-100 mt-2 mb-6 max-w-xs">Inventario, compras y ventas POS.</p><form id="lf" class="w-full max-w-xs text-left"><input name="email" type="email" required placeholder="Correo" class="${inputCls} mb-3"><input name="password" type="password" required minlength="6" placeholder="Contraseña" class="${inputCls} mb-3"><div id="lnote" class="${note ? '' : 'hidden'} text-sm rounded-xl px-3 py-2 mb-3 ${noteOk ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}">${esc(note)}</div><button type="submit" class="${btnCls} bg-emerald-500">${up ? 'Crear cuenta' : 'Entrar'}</button></form><button id="ltoggle" type="button" class="mt-4 text-indigo-100 underline text-sm">${up ? 'Ya tengo cuenta: entrar' : 'No tengo cuenta: crear una'}</button>`;
    $('#ltoggle').onclick = () => { loginMode = up ? 'in' : 'up'; renderLogin(); };
    $('#lf').onsubmit = async e => {
      e.preventDefault(); const f = e.target; const btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        if (up) { await sb.auth.signUp({ email: f.email.value, password: f.password.value }); loginMode = 'in'; renderLogin('Cuenta creada. Confirma tu correo.', true); } 
        else { await sb.auth.signInWithPassword({ email: f.email.value, password: f.password.value }); }
      } catch (err) { renderLogin(errMsg(err)); } finally { btn.disabled = false; }
    };
  }

  let shown = null;
  function showLogin() { shown = 'login'; closeSheet(); show('#boot', false); show('#app', false); show('#login', true); renderLogin(); }
  async function showApp(user) {
    shown = 'app'; show('#boot', false); show('#login', false); show('#app', true);
    $('#uEmail').textContent = user.email || '';
    $('#uAvatar').innerHTML = user.user_metadata?.avatar_url ? `<img src="${user.user_metadata.avatar_url}" class="w-full h-full object-cover">` : user.email?.charAt(0).toUpperCase();
    try { await loadState(); } catch (e) { toast(errMsg(e), false); }
  }

  function route(session) { if (session?.user) showApp(session.user); else if (shown !== 'login') showLogin(); }
  sb.auth.onAuthStateChange((_event, session) => setTimeout(() => route(session), 0));
  sb.auth.getSession().then(({ data }) => route(data.session));
})();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

