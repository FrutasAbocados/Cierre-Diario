'use strict';

// ============================================================
// SUPABASE CLIENT
// ============================================================
const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
let currentUser = null;

// ============================================================
// LOCAL CACHE (IndexedDB) — para uso offline y arranque rápido
// ============================================================
const DB_NAME = 'abocadosCache';
const DB_VER = 1;
const STORES = ['cierres','deudores','proveedores','sueldos','config'];
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      STORES.forEach(s => {
        if (!d.objectStoreNames.contains(s)) {
          d.createObjectStore(s, { keyPath: s === 'cierres' ? 'fecha' : (s === 'config' ? 'key' : 'id') });
        }
      });
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}
function idbPut(store, item) {
  return new Promise((res, rej) => {
    const t = db.transaction(store, 'readwrite');
    t.objectStore(store).put(item);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
function idbGetAll(store) {
  return new Promise((res, rej) => {
    const t = db.transaction(store, 'readonly');
    const req = t.objectStore(store).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
function idbDelete(store, key) {
  return new Promise((res, rej) => {
    const t = db.transaction(store, 'readwrite');
    t.objectStore(store).delete(key);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
function idbClear(store) {
  return new Promise((res, rej) => {
    const t = db.transaction(store, 'readwrite');
    t.objectStore(store).clear();
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}

// ============================================================
// HELPERS
// ============================================================
const $ = id => document.getElementById(id);
function num(id) { const v = parseFloat($(id).value); return isNaN(v) ? 0 : v; }
const fmt = v => (v||0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fmt0 = v => (v||0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';
const fmtPct = v => (v == null || isNaN(v) || !isFinite(v)) ? '—' : (v * 100).toFixed(1) + '%';
const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const DIAS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}
function daysBetween(d1, d2) {
  return Math.floor((new Date(d2) - new Date(d1)) / 86400000);
}
function toast(msg, type='') {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.className = 'toast', 2800);
}
function escapeHtml(s) {
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}
function setSyncStatus(status, text) {
  const dot = $('syncDot');
  dot.className = 'live-dot ' + (status === 'ok' ? '' : status);
  $('syncStatus').textContent = text;
}

// ============================================================
// FIELD MAPPING — Supabase (snake_case) <-> JS (camelCase)
// ============================================================
function cierreFromDB(r) {
  return {
    fecha: r.fecha,
    diaSemana: r.dia_semana,
    semana: r.semana,
    efectivo: Number(r.efectivo)||0,
    tarjeta: Number(r.tarjeta)||0,
    otrosEfectivo: Number(r.otros_efectivo)||0,
    otrosTarjeta: Number(r.otros_tarjeta)||0,
    totalCobrado: Number(r.total_cobrado)||0,
    compras: Number(r.compras)||0,
    vehiculos: Number(r.vehiculos)||0,
    otrasCompras: Number(r.otras_compras)||0,
    otros: Number(r.otros)||0,
    totalGastos: Number(r.total_gastos)||0,
    resultado: Number(r.resultado)||0,
    deudaGenerada: Number(r.deuda_generada)||0,
    deudaCobrada: Number(r.deuda_cobrada)||0,
    deudaAcum: Number(r.deuda_acum)||0,
    pedidos: Number(r.pedidos)||0,
    clientesNuevos: Number(r.clientes_nuevos)||0,
    cajaFisica: Number(r.caja_fisica)||0,
    observaciones: r.observaciones || ''
  };
}
function cierreToDB(c) {
  return {
    fecha: c.fecha,
    user_id: currentUser.id,
    dia_semana: c.diaSemana,
    semana: c.semana,
    efectivo: c.efectivo,
    tarjeta: c.tarjeta,
    otros_efectivo: c.otrosEfectivo,
    otros_tarjeta: c.otrosTarjeta,
    total_cobrado: c.totalCobrado,
    compras: c.compras,
    vehiculos: c.vehiculos,
    otras_compras: c.otrasCompras,
    otros: c.otros,
    total_gastos: c.totalGastos,
    resultado: c.resultado,
    deuda_generada: c.deudaGenerada,
    deuda_cobrada: c.deudaCobrada,
    deuda_acum: c.deudaAcum,
    pedidos: c.pedidos,
    clientes_nuevos: c.clientesNuevos,
    caja_fisica: c.cajaFisica,
    observaciones: c.observaciones,
    updated_at: new Date().toISOString()
  };
}
function deudorFromDB(r) {
  return { id: r.id, cliente: r.cliente, concepto: r.concepto || '', importe: Number(r.importe)||0, fecha: r.fecha, pagado: r.pagado, fechaPago: r.fecha_pago };
}
function deudorToDB(d) {
  return { id: d.id, user_id: currentUser.id, cliente: d.cliente, concepto: d.concepto, importe: d.importe, fecha: d.fecha, pagado: d.pagado, fecha_pago: d.fechaPago };
}
function provFromDB(r) {
  return { id: r.id, nombre: r.nombre, categoria: r.categoria, importe: Number(r.importe)||0, fecha: r.fecha };
}
function provToDB(p) {
  return { id: p.id, user_id: currentUser.id, nombre: p.nombre, categoria: p.categoria, importe: p.importe, fecha: p.fecha };
}
function sueldoFromDB(r) {
  return { id: r.id, empleado: r.empleado, tipo: r.tipo, importe: Number(r.importe)||0, fecha: r.fecha };
}
function sueldoToDB(s) {
  return { id: s.id, user_id: currentUser.id, empleado: s.empleado, tipo: s.tipo, importe: s.importe, fecha: s.fecha };
}

// ============================================================
// DATA LAYER — Cloud (Supabase) + Local Cache
// ============================================================
const data = {
  async listCierres() {
    try {
      const { data: rows, error } = await sb.from('cierres').select('*').order('fecha', { ascending: true });
      if (error) throw error;
      const list = rows.map(cierreFromDB);
      // Update local cache
      await idbClear('cierres');
      for (const c of list) await idbPut('cierres', c);
      return list;
    } catch (e) {
      console.warn('Supabase listCierres failed, using cache:', e);
      setSyncStatus('offline', 'Sin conexión (caché)');
      return idbGetAll('cierres').then(list => list.sort((a,b)=>a.fecha.localeCompare(b.fecha)));
    }
  },
  async saveCierre(c) {
    await idbPut('cierres', c); // optimistic local
    const { error } = await sb.from('cierres').upsert(cierreToDB(c));
    if (error) throw error;
  },
  async deleteCierre(fecha) {
    await idbDelete('cierres', fecha);
    const { error } = await sb.from('cierres').delete().eq('fecha', fecha);
    if (error) throw error;
  },

  async listDeudores() {
    try {
      const { data: rows, error } = await sb.from('deudores').select('*').order('fecha', { ascending: false });
      if (error) throw error;
      const list = rows.map(deudorFromDB);
      await idbClear('deudores');
      for (const d of list) await idbPut('deudores', d);
      return list;
    } catch (e) {
      console.warn('listDeudores from cache:', e);
      return idbGetAll('deudores');
    }
  },
  async saveDeudor(d) {
    await idbPut('deudores', d);
    const { error } = await sb.from('deudores').upsert(deudorToDB(d));
    if (error) throw error;
  },
  async deleteDeudor(id) {
    await idbDelete('deudores', id);
    const { error } = await sb.from('deudores').delete().eq('id', id);
    if (error) throw error;
  },

  async listProv() {
    try {
      const { data: rows, error } = await sb.from('proveedores').select('*').order('fecha', { ascending: false });
      if (error) throw error;
      const list = rows.map(provFromDB);
      await idbClear('proveedores');
      for (const p of list) await idbPut('proveedores', p);
      return list;
    } catch (e) {
      return idbGetAll('proveedores');
    }
  },
  async saveProv(p) {
    await idbPut('proveedores', p);
    const { error } = await sb.from('proveedores').upsert(provToDB(p));
    if (error) throw error;
  },
  async deleteProv(id) {
    await idbDelete('proveedores', id);
    const { error } = await sb.from('proveedores').delete().eq('id', id);
    if (error) throw error;
  },

  async listSueldos() {
    try {
      const { data: rows, error } = await sb.from('sueldos').select('*').order('fecha', { ascending: false });
      if (error) throw error;
      const list = rows.map(sueldoFromDB);
      await idbClear('sueldos');
      for (const s of list) await idbPut('sueldos', s);
      return list;
    } catch (e) {
      return idbGetAll('sueldos');
    }
  },
  async saveSueldo(s) {
    await idbPut('sueldos', s);
    const { error } = await sb.from('sueldos').upsert(sueldoToDB(s));
    if (error) throw error;
  },
  async deleteSueldo(id) {
    await idbDelete('sueldos', id);
    const { error } = await sb.from('sueldos').delete().eq('id', id);
    if (error) throw error;
  },

  async getCfg(key, def=null) {
    try {
      const { data: rows, error } = await sb.from('config').select('value').eq('key', key).limit(1);
      if (error) throw error;
      if (rows && rows.length) {
        await idbPut('config', { key, value: rows[0].value });
        return rows[0].value;
      }
      return def;
    } catch (e) {
      const r = await new Promise((res,rej) => {
        const t = db.transaction('config','readonly');
        const req = t.objectStore('config').get(key);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      return r ? r.value : def;
    }
  },
  async setCfg(key, value) {
    await idbPut('config', { key, value });
    const { error } = await sb.from('config').upsert({ user_id: currentUser.id, key, value });
    if (error) throw error;
  },
  async delCfg(key) {
    await idbDelete('config', key);
    const { error } = await sb.from('config').delete().eq('key', key);
    if (error) throw error;
  },

  async clearStore(store) {
    await idbClear(store);
    const tableName = store; // same name in DB
    const { error } = await sb.from(tableName).delete().neq(store === 'cierres' ? 'fecha' : 'id', store === 'cierres' ? '1900-01-01' : '___never___');
    if (error) throw error;
  }
};

// ============================================================
// STATE
// ============================================================
const CACHE = { cierres: [], deudores: [], proveedores: [], sueldos: [] };
const SETTINGS = { iva: 10, margenAlerta: 20, deudaDias: 30, goalMes: null, goalAnio: null, goalMargen: null, lastBackup: null };
let editMode = { deuda: null, prov: null, sueldo: null };

async function loadAll() {
  setSyncStatus('syncing', 'Sincronizando...');
  try {
    CACHE.cierres = await data.listCierres();
    CACHE.deudores = await data.listDeudores();
    CACHE.proveedores = await data.listProv();
    CACHE.sueldos = await data.listSueldos();
    SETTINGS.iva = await data.getCfg('iva', 10);
    SETTINGS.margenAlerta = await data.getCfg('margenAlerta', 20);
    SETTINGS.deudaDias = await data.getCfg('deudaDias', 30);
    SETTINGS.goalMes = await data.getCfg('goalMes', null);
    SETTINGS.goalAnio = await data.getCfg('goalAnio', null);
    SETTINGS.goalMargen = await data.getCfg('goalMargen', null);
    SETTINGS.lastBackup = await data.getCfg('lastBackup', null);
    setSyncStatus('ok', 'Conectado');
  } catch (e) {
    console.error('loadAll error:', e);
    setSyncStatus('offline', 'Sin conexión (caché)');
  }
}

async function recalcDeudaAcum() {
  let acum = 0;
  for (const c of CACHE.cierres) {
    acum = acum + (c.deudaGenerada||0) - (c.deudaCobrada||0);
    if (c.deudaAcum !== acum) {
      c.deudaAcum = acum;
      try { await data.saveCierre(c); } catch (e) { console.warn(e); }
    }
  }
}

// ============================================================
// CIERRE FORM
// ============================================================
function recalc() {
  const ef = num('f-efectivo'), tc = num('f-tarjeta'), oef = num('f-otros-ef'), otc = num('f-otros-tc');
  const compras = num('f-compras'), veh = num('f-vehiculos'), otras = num('f-otras'), reg = num('f-regalos');
  const dgen = num('f-deuda-gen'), dcob = num('f-deuda-cob');
  const pedidos = num('f-pedidos');

  const totalCob = ef + tc + oef + otc;
  const totalGastos = compras + veh + otras + reg;
  const resultado = totalCob - totalGastos;
  const margen = totalCob > 0 ? resultado / totalCob : null;
  const efPct = totalCob > 0 ? (ef + oef) / totalCob : null;
  const varDeuda = dgen - dcob;
  const ticket = pedidos > 0 ? totalCob / pedidos : null;
  const iva = totalCob * (SETTINGS.iva/100);

  $('c-total').textContent = fmt(totalCob);
  $('c-gastos').textContent = fmt(totalGastos);
  $('c-resultado').textContent = fmt(resultado);
  $('c-resultado').className = 'val ' + (resultado >= 0 ? 'pos' : 'neg');
  $('c-margen').textContent = fmtPct(margen);
  $('c-margen').className = 'val ' + (margen != null && margen*100 >= SETTINGS.margenAlerta ? 'pos' : margen != null ? 'neg' : '');
  $('c-iva').textContent = fmt(iva);
  $('c-efpct').textContent = fmtPct(efPct);
  $('c-vardeuda').textContent = fmt(varDeuda);
  $('c-vardeuda').className = 'val ' + (varDeuda > 0 ? 'neg' : varDeuda < 0 ? 'pos' : '');
  $('c-ticket').textContent = ticket == null ? '—' : fmt(ticket);

  const fechaActual = $('f-fecha').value;
  const previas = CACHE.cierres.filter(c => c.fecha < fechaActual);
  const ultDeuda = previas.length ? (previas[previas.length-1].deudaAcum || 0) : 0;
  $('c-deudaacum').textContent = fmt(ultDeuda + varDeuda);

  const last30 = CACHE.cierres.filter(c => c.fecha < fechaActual && (c.totalCobrado||0) > 0).slice(-30);
  if (last30.length >= 3 && totalCob > 0) {
    const media = last30.reduce((s,c)=>s+c.totalCobrado,0) / last30.length;
    const diff = (totalCob - media) / media;
    $('c-vsmedia').textContent = (diff>=0?'+':'') + (diff*100).toFixed(1) + '% (med ' + fmt0(media) + ')';
    $('c-vsmedia').className = 'val ' + (diff >= 0 ? 'pos' : 'neg');
  } else {
    $('c-vsmedia').textContent = '—';
    $('c-vsmedia').className = 'val';
  }
}

function updateFechaInfo() {
  const f = $('f-fecha').value;
  if (!f) return;
  const d = new Date(f + 'T00:00:00');
  $('f-diasem').value = DIAS[d.getDay()];
  $('f-semana').value = isoWeek(d);
}

async function cargarFecha(fecha) {
  const item = CACHE.cierres.find(c => c.fecha === fecha);
  const fields = ['f-efectivo','f-tarjeta','f-otros-ef','f-otros-tc','f-compras','f-vehiculos',
                  'f-otras','f-regalos','f-deuda-gen','f-deuda-cob','f-pedidos','f-nuevos','f-caja'];
  if (!item) {
    fields.forEach(id => $(id).value = '');
    $('f-obs').value = '';
    $('edit-notice').style.display = 'none';
    $('btn-cancelar-edit').style.display = 'none';
  } else {
    $('f-efectivo').value = item.efectivo || '';
    $('f-tarjeta').value = item.tarjeta || '';
    $('f-otros-ef').value = item.otrosEfectivo || '';
    $('f-otros-tc').value = item.otrosTarjeta || '';
    $('f-compras').value = item.compras || '';
    $('f-vehiculos').value = item.vehiculos || '';
    $('f-otras').value = item.otrasCompras || '';
    $('f-regalos').value = item.otros || '';
    $('f-deuda-gen').value = item.deudaGenerada || '';
    $('f-deuda-cob').value = item.deudaCobrada || '';
    $('f-pedidos').value = item.pedidos || '';
    $('f-nuevos').value = item.clientesNuevos || '';
    $('f-caja').value = item.cajaFisica || '';
    $('f-obs').value = item.observaciones || '';
    $('edit-notice').style.display = 'flex';
    $('edit-fecha').textContent = fecha;
    $('btn-cancelar-edit').style.display = '';
  }
  recalc();
}

async function guardar() {
  const fecha = $('f-fecha').value;
  if (!fecha) { toast('Indica una fecha', 'error'); return; }

  const ef = num('f-efectivo'), tc = num('f-tarjeta'), oef = num('f-otros-ef'), otc = num('f-otros-tc');
  const compras = num('f-compras'), veh = num('f-vehiculos'), otras = num('f-otras'), reg = num('f-regalos');
  const dgen = num('f-deuda-gen'), dcob = num('f-deuda-cob');

  const totalCob = ef + tc + oef + otc;
  const totalGastos = compras + veh + otras + reg;

  if (totalCob === 0 && totalGastos === 0 && dgen === 0 && dcob === 0 && !$('f-obs').value.trim()) {
    if (!confirm('Estás guardando un cierre completamente vacío. ¿Seguro?')) return;
  }

  const item = {
    fecha,
    diaSemana: $('f-diasem').value || DIAS[new Date(fecha+'T00:00:00').getDay()],
    semana: parseInt($('f-semana').value) || isoWeek(new Date(fecha+'T00:00:00')),
    efectivo: ef, tarjeta: tc, otrosEfectivo: oef, otrosTarjeta: otc,
    totalCobrado: totalCob,
    compras, vehiculos: veh, otrasCompras: otras, otros: reg,
    totalGastos: totalGastos,
    resultado: totalCob - totalGastos,
    deudaGenerada: dgen, deudaCobrada: dcob,
    deudaAcum: 0, // se calcula luego
    pedidos: num('f-pedidos'), clientesNuevos: num('f-nuevos'),
    cajaFisica: num('f-caja'),
    observaciones: $('f-obs').value
  };

  try {
    setSyncStatus('syncing', 'Guardando...');
    await data.saveCierre(item);
    CACHE.cierres = await data.listCierres();
    await recalcDeudaAcum();
    CACHE.cierres = await data.listCierres();
    setSyncStatus('ok', 'Conectado');
    toast('✅ Cierre guardado y sincronizado');
    await renderAll();
    await cargarFecha(fecha);
  } catch (e) {
    console.error(e);
    toast('Error al guardar: ' + e.message, 'error');
    setSyncStatus('offline', 'Error de sincronización');
  }
}

function limpiar() {
  ['f-efectivo','f-tarjeta','f-otros-ef','f-otros-tc','f-compras','f-vehiculos',
   'f-otras','f-regalos','f-deuda-gen','f-deuda-cob','f-pedidos','f-nuevos','f-caja']
    .forEach(id => $(id).value = '');
  $('f-obs').value = '';
  recalc();
  toast('Formulario limpiado');
}

async function eliminarCierre(fecha) {
  if (!confirm(`¿Eliminar definitivamente el cierre del ${fecha}?`)) return;
  try {
    await data.deleteCierre(fecha);
    CACHE.cierres = await data.listCierres();
    await recalcDeudaAcum();
    CACHE.cierres = await data.listCierres();
    toast('Cierre eliminado');
    if ($('f-fecha').value === fecha) await cargarFecha(fecha);
    await renderAll();
  } catch (e) { toast('Error: '+e.message, 'error'); }
}

// ============================================================
// ALERTS
// ============================================================
function renderAlerts() {
  const alerts = [];
  const all = CACHE.cierres;

  if (all.length === 0) {
    $('alertsBar').innerHTML = '<div class="alert info">👋 Bienvenido. Empieza guardando tu primer cierre del día en la pestaña <b>📝 Cierre del día</b>.</div>';
    return;
  }

  const last = all[all.length-1];
  if (last && last.totalCobrado > 0) {
    const m = (last.resultado/last.totalCobrado)*100;
    if (m < SETTINGS.margenAlerta) {
      alerts.push({ type:'danger', text:`📉 Margen del último cierre (${last.fecha}): ${m.toFixed(1)}% — por debajo del umbral (${SETTINGS.margenAlerta}%)` });
    }
  }

  const deudasAntiguas = CACHE.deudores.filter(d => !d.pagado && daysBetween(d.fecha, todayISO()) > SETTINGS.deudaDias);
  if (deudasAntiguas.length) {
    const total = deudasAntiguas.reduce((s,d)=>s+d.importe,0);
    alerts.push({ type:'warn', text:`💳 ${deudasAntiguas.length} deuda(s) con más de ${SETTINGS.deudaDias} días — total ${fmt(total)}` });
  }

  if (last) {
    const dias = daysBetween(last.fecha, todayISO());
    if (dias > 2 && dias < 365) {
      alerts.push({ type:'info', text:`📅 Han pasado ${dias} días desde el último cierre (${last.fecha})` });
    }
  }

  $('alertsBar').innerHTML = alerts.map(a => `<div class="alert ${a.type}">${a.text}</div>`).join('');
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const all = CACHE.cierres;
  const totalCob = all.reduce((s,c)=>s+(c.totalCobrado||0),0);
  const totalGas = all.reduce((s,c)=>s+(c.totalGastos||0),0);
  const resultado = totalCob - totalGas;
  const margen = totalCob > 0 ? resultado/totalCob : null;
  const totalDgen = all.reduce((s,c)=>s+(c.deudaGenerada||0),0);
  const totalDcob = all.reduce((s,c)=>s+(c.deudaCobrada||0),0);
  const deudaViva = all.length ? (all[all.length-1].deudaAcum || 0) : 0;
  const recup = totalDgen > 0 ? totalDcob/totalDgen : null;
  const diasOp = all.filter(c => (c.totalCobrado||0) > 0).length;
  const cobMedio = diasOp > 0 ? totalCob/diasOp : 0;
  const totPedidos = all.reduce((s,c)=>s+(c.pedidos||0),0);
  const ticketMedio = totPedidos > 0 ? totalCob/totPedidos : 0;

  const mesActual = todayISO().slice(0,7);
  const cierresMes = all.filter(c => c.fecha.slice(0,7) === mesActual);
  const cobMes = cierresMes.reduce((s,c)=>s+(c.totalCobrado||0),0);

  const kpis = [
    { label: '💰 Caja Total', value: fmt0(totalCob), featured: true },
    { label: 'Resultado Neto', value: fmt0(resultado), cls: resultado>=0?'pos':'neg', featured: true },
    { label: 'Margen Neto', value: fmtPct(margen), featured: true },
    { label: 'Deuda Viva', value: fmt0(deudaViva), cls: deudaViva>0?'neg':'pos', featured: true },
    { label: 'Compras Totales', value: fmt0(totalGas) },
    { label: '% Recuperación deuda', value: fmtPct(recup) },
    { label: 'Días Operados', value: diasOp },
    { label: 'Cobro Diario Prom.', value: fmt0(cobMedio) },
    { label: 'Mes actual', value: fmt0(cobMes), sub: cierresMes.length + ' cierres' },
    { label: 'Pedidos totales', value: totPedidos.toLocaleString('es-ES') },
    { label: 'Ticket medio', value: ticketMedio>0 ? fmt(ticketMedio) : '—' },
    { label: 'Mejor día', value: fmt0(Math.max(0,...all.map(c=>c.totalCobrado||0))) }
  ];
  $('kpis-top').innerHTML = kpis.map(k =>
    `<div class="card kpi ${k.featured?'featured':''}">
       <div class="label">${k.label}</div>
       <div class="value ${k.cls||''}">${k.value}</div>
       ${k.sub?`<div class="sub">${k.sub}</div>`:''}
     </div>`
  ).join('');

  const last30 = all.slice(-30);
  drawBarChart('chart-1', last30.map(c=>c.fecha.slice(5)), [
    { label:'Cobros', data: last30.map(c=>c.totalCobrado||0), color:'#10b981' },
    { label:'Gastos', data: last30.map(c=>c.totalGastos||0), color:'#ef4444' }
  ]);
  drawLineChart('chart-2', all.slice(-60).map(c=>c.fecha.slice(5)), all.slice(-60).map(c=>c.deudaAcum||0), '#a855f7');

  const totEf = all.reduce((s,c)=>s+(c.efectivo||0)+(c.otrosEfectivo||0),0);
  const totTC = all.reduce((s,c)=>s+(c.tarjeta||0)+(c.otrosTarjeta||0),0);
  drawPieChart('chart-3', ['Efectivo','Tarjeta'], [totEf, totTC], ['#10b981','#3b82f6']);

  const porDia = [0,0,0,0,0,0,0], cuentaDia = [0,0,0,0,0,0,0];
  all.forEach(c => {
    if ((c.totalCobrado||0) > 0) {
      const d = new Date(c.fecha+'T00:00:00').getDay();
      porDia[d] += c.totalCobrado;
      cuentaDia[d]++;
    }
  });
  const promDia = porDia.map((v,i) => cuentaDia[i] > 0 ? v/cuentaDia[i] : 0);
  const orden = [1,2,3,4,5,6,0];
  drawBarChart('chart-4', orden.map(i=>DIAS_SHORT[i]),
    [{ label:'Promedio', data: orden.map(i=>promDia[i]), color:'#06b6d4' }]);

  const last30valid = last30.filter(c => (c.totalCobrado||0) > 0);
  if (last30valid.length) {
    const best = [...last30valid].sort((a,b)=>b.totalCobrado-a.totalCobrado)[0];
    const worst = [...last30valid].sort((a,b)=>a.totalCobrado-b.totalCobrado)[0];
    $('best-worst').innerHTML = `
      <div class="calc-box"><span class="lbl">🏆 Mejor</span><span class="val pos">${best.fecha}<br>${fmt(best.totalCobrado)}</span></div>
      <div class="calc-box"><span class="lbl">📉 Peor</span><span class="val neg">${worst.fecha}<br>${fmt(worst.totalCobrado)}</span></div>
      <div class="calc-box"><span class="lbl">Diferencia</span><span class="val">${fmt(best.totalCobrado-worst.totalCobrado)}</span></div>
    `;
  } else {
    $('best-worst').innerHTML = '<p class="empty">Sin datos suficientes</p>';
  }
}

// ============================================================
// FORECAST
// ============================================================
function renderForecast() {
  const all = CACHE.cierres.filter(c => (c.totalCobrado||0) > 0);
  if (all.length < 5) {
    $('forecast-kpis').innerHTML = '<div class="card" style="grid-column:1/-1"><p class="empty">Necesitas al menos 5 días con cobros para generar pronósticos</p></div>';
    $('forecast-mes').innerHTML = '<p class="empty">—</p>';
    $('forecast-anual').innerHTML = '<p class="empty">—</p>';
    return;
  }

  const recent = all.slice(-60);
  const porDia = [[],[],[],[],[],[],[]];
  recent.forEach(c => {
    const d = new Date(c.fecha+'T00:00:00').getDay();
    porDia[d].push(c.totalCobrado);
  });
  const promDia = porDia.map(arr => arr.length ? arr.reduce((s,v)=>s+v,0)/arr.length : 0);
  const promGastoPct = recent.reduce((s,c)=>s+(c.totalGastos/c.totalCobrado),0)/recent.length;

  const proyeccion = [];
  const start = new Date();
  for (let i=0; i<30; i++) {
    const d = new Date(start);
    d.setDate(d.getDate()+i);
    const dow = d.getDay();
    proyeccion.push({
      fecha: d.toISOString().slice(0,10),
      cobro: promDia[dow] || 0,
      gasto: (promDia[dow] || 0) * promGastoPct
    });
  }

  const totalProyCob = proyeccion.reduce((s,p)=>s+p.cobro,0);
  const totalProyGas = proyeccion.reduce((s,p)=>s+p.gasto,0);
  const diaProm = totalProyCob/30;

  $('forecast-kpis').innerHTML = `
    <div class="card kpi featured"><div class="label">Cobros 30d (estim)</div><div class="value">${fmt0(totalProyCob)}</div></div>
    <div class="card kpi featured"><div class="label">Gastos 30d (estim)</div><div class="value">${fmt0(totalProyGas)}</div></div>
    <div class="card kpi featured"><div class="label">Resultado neto estim.</div><div class="value pos">${fmt0(totalProyCob-totalProyGas)}</div></div>
    <div class="card kpi featured"><div class="label">Promedio diario</div><div class="value">${fmt0(diaProm)}</div></div>
  `;

  drawBarChart('chart-forecast', proyeccion.map(p=>p.fecha.slice(5)), [
    { label:'Cobro est.', data: proyeccion.map(p=>p.cobro), color:'#10b981' },
    { label:'Gasto est.', data: proyeccion.map(p=>p.gasto), color:'#ef4444' }
  ]);

  const hoy = new Date();
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0);
  const diasRestantes = finMes.getDate() - hoy.getDate();
  const cierresMes = CACHE.cierres.filter(c => c.fecha.slice(0,7) === todayISO().slice(0,7));
  const yaCobrado = cierresMes.reduce((s,c)=>s+(c.totalCobrado||0),0);
  let estimRestoMes = 0;
  for (let i=1; i<=diasRestantes; i++) {
    const d = new Date(hoy);
    d.setDate(d.getDate()+i);
    estimRestoMes += promDia[d.getDay()] || 0;
  }
  const totalMesEstim = yaCobrado + estimRestoMes;
  const goalMes = SETTINGS.goalMes;
  const pctGoal = goalMes && goalMes > 0 ? totalMesEstim/goalMes : null;

  $('forecast-mes').innerHTML = `
    <div class="calc-box"><span class="lbl">Ya cobrado este mes</span><span class="val">${fmt(yaCobrado)}</span></div>
    <div class="calc-box"><span class="lbl">Días restantes del mes</span><span class="val">${diasRestantes}</span></div>
    <div class="calc-box"><span class="lbl">Estimación lo que falta</span><span class="val">${fmt(estimRestoMes)}</span></div>
    <div class="calc-box hi"><span class="lbl">Cierre estimado del mes</span><span class="val">${fmt(totalMesEstim)}</span></div>
    ${goalMes ? `
      <div class="calc-box"><span class="lbl">Objetivo mensual</span><span class="val">${fmt(goalMes)}</span></div>
      <div class="calc-box"><span class="lbl">Probabilidad de alcanzar</span><span class="val ${pctGoal>=1?'pos':'neg'}">${fmtPct(pctGoal)}</span></div>
      <div class="progress"><div class="progress-bar ${pctGoal>=1?'green':pctGoal>=0.8?'amber':'red'}" style="width:${Math.min(100,pctGoal*100)}%"></div></div>
    ` : '<p style="font-size:11px;color:var(--muted);margin-top:8px">Define un objetivo mensual en la pestaña Objetivos para ver progreso</p>'}
  `;

  const anualEstim = diaProm * 365;
  const goalAnio = SETTINGS.goalAnio;
  const pctAnio = goalAnio && goalAnio > 0 ? anualEstim/goalAnio : null;
  $('forecast-anual').innerHTML = `
    <div class="calc-box"><span class="lbl">Promedio diario actual</span><span class="val">${fmt(diaProm)}</span></div>
    <div class="calc-box hi"><span class="lbl">Run-rate anual</span><span class="val">${fmt0(anualEstim)}</span></div>
    <div class="calc-box hi"><span class="lbl">Run-rate semestral</span><span class="val">${fmt0(anualEstim/2)}</span></div>
    ${goalAnio ? `
      <div class="calc-box"><span class="lbl">Objetivo anual</span><span class="val">${fmt0(goalAnio)}</span></div>
      <div class="calc-box"><span class="lbl">% del objetivo a este ritmo</span><span class="val ${pctAnio>=1?'pos':'neg'}">${fmtPct(pctAnio)}</span></div>
      <div class="progress"><div class="progress-bar ${pctAnio>=1?'green':pctAnio>=0.8?'amber':'red'}" style="width:${Math.min(100,pctAnio*100)}%"></div></div>
    ` : '<p style="font-size:11px;color:var(--muted);margin-top:8px">Define un objetivo anual en la pestaña Objetivos para ver progreso</p>'}
  `;
}

// ============================================================
// OBJETIVOS
// ============================================================
function renderObjetivos() {
  $('goal-mes').value = SETTINGS.goalMes != null ? SETTINGS.goalMes : '';
  $('goal-anio').value = SETTINGS.goalAnio != null ? SETTINGS.goalAnio : '';
  $('goal-margen').value = SETTINGS.goalMargen != null ? SETTINGS.goalMargen : '';

  const all = CACHE.cierres;
  const mesActual = todayISO().slice(0,7);
  const cierresMes = all.filter(c => c.fecha.slice(0,7) === mesActual);
  const cobMes = cierresMes.reduce((s,c)=>s+(c.totalCobrado||0),0);
  const resMes = cierresMes.reduce((s,c)=>s+(c.resultado||0),0);
  const margenMes = cobMes>0 ? resMes/cobMes : 0;

  const anioActual = todayISO().slice(0,4);
  const cierresAnio = all.filter(c => c.fecha.slice(0,4) === anioActual);
  const cobAnio = cierresAnio.reduce((s,c)=>s+(c.totalCobrado||0),0);

  const cards = [];
  if (SETTINGS.goalMes && SETTINGS.goalMes > 0) {
    const pct = cobMes/SETTINGS.goalMes;
    cards.push(`<div class="card goal-card">
      <button class="clear-btn" data-clear="goalMes">✕ Eliminar</button>
      <h3>🎯 Mes — ${MESES[parseInt(mesActual.slice(5,7))-1]}</h3>
      <div class="kpi"><div class="value">${fmt0(cobMes)}</div><div class="sub">de ${fmt0(SETTINGS.goalMes)}</div></div>
      <div class="progress" style="margin-top:10px"><div class="progress-bar ${pct>=1?'green':pct>=0.8?'amber':'red'}" style="width:${Math.min(100,pct*100)}%"></div></div>
      <p style="margin-top:8px;font-size:12px;color:var(--muted)">${(pct*100).toFixed(1)}% completado · ${SETTINGS.goalMes>cobMes?'Faltan '+fmt0(SETTINGS.goalMes-cobMes):'¡Objetivo superado!'}</p>
    </div>`);
  }
  if (SETTINGS.goalAnio && SETTINGS.goalAnio > 0) {
    const pct = cobAnio/SETTINGS.goalAnio;
    cards.push(`<div class="card goal-card">
      <button class="clear-btn" data-clear="goalAnio">✕ Eliminar</button>
      <h3>🎯 Año ${anioActual}</h3>
      <div class="kpi"><div class="value">${fmt0(cobAnio)}</div><div class="sub">de ${fmt0(SETTINGS.goalAnio)}</div></div>
      <div class="progress" style="margin-top:10px"><div class="progress-bar ${pct>=1?'green':pct>=0.8?'amber':'red'}" style="width:${Math.min(100,pct*100)}%"></div></div>
      <p style="margin-top:8px;font-size:12px;color:var(--muted)">${(pct*100).toFixed(1)}% completado · ${SETTINGS.goalAnio>cobAnio?'Faltan '+fmt0(SETTINGS.goalAnio-cobAnio):'¡Objetivo superado!'}</p>
    </div>`);
  }
  if (SETTINGS.goalMargen && SETTINGS.goalMargen > 0) {
    const pct = (margenMes*100)/SETTINGS.goalMargen;
    cards.push(`<div class="card goal-card">
      <button class="clear-btn" data-clear="goalMargen">✕ Eliminar</button>
      <h3>🎯 Margen del mes</h3>
      <div class="kpi"><div class="value">${(margenMes*100).toFixed(1)}%</div><div class="sub">objetivo ${SETTINGS.goalMargen}%</div></div>
      <div class="progress" style="margin-top:10px"><div class="progress-bar ${pct>=1?'green':pct>=0.8?'amber':'red'}" style="width:${Math.min(100,pct*100)}%"></div></div>
    </div>`);
  }
  $('goals-progress').innerHTML = cards.join('') || '<div class="card"><p class="empty">Define objetivos arriba para ver el progreso aquí</p></div>';

  $('goals-progress').querySelectorAll('.clear-btn').forEach(b => {
    b.addEventListener('click', async () => {
      const k = b.dataset.clear;
      SETTINGS[k] = null;
      try {
        await data.delCfg(k);
        toast('Objetivo eliminado');
      } catch (e) { toast('Error: '+e.message, 'error'); }
      renderObjetivos();
      renderForecast();
    });
  });
}

async function saveGoals() {
  const m = $('goal-mes').value.trim();
  const a = $('goal-anio').value.trim();
  const mg = $('goal-margen').value.trim();
  try {
    if (m === '') { SETTINGS.goalMes = null; await data.delCfg('goalMes'); }
    else { SETTINGS.goalMes = parseFloat(m) || 0; await data.setCfg('goalMes', SETTINGS.goalMes); }
    if (a === '') { SETTINGS.goalAnio = null; await data.delCfg('goalAnio'); }
    else { SETTINGS.goalAnio = parseFloat(a) || 0; await data.setCfg('goalAnio', SETTINGS.goalAnio); }
    if (mg === '') { SETTINGS.goalMargen = null; await data.delCfg('goalMargen'); }
    else { SETTINGS.goalMargen = parseFloat(mg) || 0; await data.setCfg('goalMargen', SETTINGS.goalMargen); }
    toast('✅ Objetivos guardados');
    renderObjetivos();
    renderForecast();
  } catch (e) { toast('Error: '+e.message, 'error'); }
}

async function clearAllGoals() {
  if (!confirm('¿Eliminar TODOS los objetivos?')) return;
  SETTINGS.goalMes = null; SETTINGS.goalAnio = null; SETTINGS.goalMargen = null;
  try {
    await data.delCfg('goalMes'); await data.delCfg('goalAnio'); await data.delCfg('goalMargen');
    toast('Objetivos eliminados');
    renderObjetivos();
    renderForecast();
  } catch (e) { toast('Error: '+e.message, 'error'); }
}

// ============================================================
// HISTORIAL
// ============================================================
function renderHistorial() {
  const all = [...CACHE.cierres].sort((a,b)=>b.fecha.localeCompare(a.fecha));

  const meses = [...new Set(all.map(c => c.fecha.slice(0,7)))].sort().reverse();
  const sel = $('hist-month');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todos los meses</option>' +
    meses.map(m => {
      const [y,mn] = m.split('-');
      return `<option value="${m}" ${cur===m?'selected':''}>${MESES[parseInt(mn)-1]} ${y}</option>`;
    }).join('');

  const search = ($('hist-search').value||'').toLowerCase();
  const monthFilter = sel.value;
  const filtered = all.filter(c => {
    if (monthFilter && c.fecha.slice(0,7) !== monthFilter) return false;
    if (search) {
      const blob = (c.fecha + ' ' + (c.diaSemana||'') + ' ' + (c.observaciones||'')).toLowerCase();
      if (!blob.includes(search)) return false;
    }
    return true;
  });

  $('hist-count').textContent = `${filtered.length} cierre${filtered.length===1?'':'s'}`;

  const tb = $('tbl-historial').querySelector('tbody');
  if (!filtered.length) {
    tb.innerHTML = '<tr><td colspan="12" class="empty">No hay cierres que coincidan</td></tr>';
    return;
  }
  tb.innerHTML = filtered.map(c => {
    const margen = c.totalCobrado>0 ? (c.resultado/c.totalCobrado)*100 : 0;
    return `<tr>
      <td>${c.fecha}</td>
      <td>${c.diaSemana||''}</td>
      <td class="num">${fmt(c.efectivo)}</td>
      <td class="num">${fmt(c.tarjeta)}</td>
      <td class="num"><b>${fmt(c.totalCobrado)}</b></td>
      <td class="num">${fmt(c.totalGastos)}</td>
      <td class="num ${c.resultado>=0?'pos':'neg'}">${fmt(c.resultado)}</td>
      <td class="num ${margen>=SETTINGS.margenAlerta?'pos':'neg'}">${margen.toFixed(1)}%</td>
      <td class="num">${fmt(c.deudaGenerada)}</td>
      <td class="num">${fmt(c.deudaCobrada)}</td>
      <td class="num">${c.pedidos||0}</td>
      <td class="row-actions">
        <button class="secondary sm" data-edit="${c.fecha}">✏️</button>
        <button class="danger sm" data-del="${c.fecha}">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  tb.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', async () => {
      const f = b.dataset.edit;
      $('f-fecha').value = f;
      updateFechaInfo();
      await cargarFecha(f);
      switchTab('cierre');
    }));
  tb.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => eliminarCierre(b.dataset.del)));
}

// ============================================================
// SEMANAL & MENSUAL
// ============================================================
function renderSemanal() {
  const all = CACHE.cierres;
  const grupos = {};
  all.forEach(c => {
    const k = `${c.fecha.slice(0,4)}-W${String(c.semana).padStart(2,'0')}`;
    if (!grupos[k]) grupos[k] = { sem: c.semana, year: c.fecha.slice(0,4), items: [] };
    grupos[k].items.push(c);
  });
  const computed = Object.entries(grupos).sort().map(([k,g]) => {
    const cob = g.items.reduce((s,c)=>s+(c.totalCobrado||0),0);
    const gas = g.items.reduce((s,c)=>s+(c.totalGastos||0),0);
    const dg = g.items.reduce((s,c)=>s+(c.deudaGenerada||0),0);
    const dc = g.items.reduce((s,c)=>s+(c.deudaCobrada||0),0);
    const dop = g.items.filter(c=>(c.totalCobrado||0)>0).length;
    const pedidos = g.items.reduce((s,c)=>s+(c.pedidos||0),0);
    return { k, year: g.year, sem: g.sem, cob, gas, res: cob-gas, dg, dc, dop, pedidos };
  });
  const rows = computed.slice().reverse().map(r => {
    const margen = r.cob > 0 ? r.res/r.cob : null;
    const cobDia = r.dop > 0 ? r.cob/r.dop : 0;
    const idxOrig = computed.findIndex(x => x.k === r.k);
    const prev = idxOrig > 0 ? computed[idxOrig-1] : null;
    let varSem = '—';
    if (prev && prev.cob > 0) {
      const v = (r.cob - prev.cob)/prev.cob;
      varSem = `<span class="${v>=0?'pos':'neg'}">${(v>=0?'+':'')+(v*100).toFixed(1)}%</span>`;
    }
    return `<tr>
      <td>${r.year} S${r.sem}</td>
      <td class="num"><b>${fmt(r.cob)}</b></td>
      <td class="num">${fmt(r.gas)}</td>
      <td class="num ${r.res>=0?'pos':'neg'}">${fmt(r.res)}</td>
      <td class="num">${fmtPct(margen)}</td>
      <td class="num">${fmt(r.dg)}</td>
      <td class="num">${fmt(r.dc)}</td>
      <td class="num ${(r.dg-r.dc)>0?'neg':'pos'}">${fmt(r.dg-r.dc)}</td>
      <td class="num">${fmt(cobDia)}</td>
      <td class="num">${varSem}</td>
      <td class="num">${r.pedidos}</td>
    </tr>`;
  }).join('');
  $('tbl-semanal').querySelector('tbody').innerHTML = rows || '<tr><td colspan="11" class="empty">Sin datos</td></tr>';
}

function renderMensual() {
  const all = CACHE.cierres;
  const grupos = {};
  all.forEach(c => {
    const k = c.fecha.slice(0,7);
    if (!grupos[k]) grupos[k] = [];
    grupos[k].push(c);
  });
  const computed = Object.entries(grupos).sort().map(([k, items]) => {
    const cob = items.reduce((s,c)=>s+(c.totalCobrado||0),0);
    const gas = items.reduce((s,c)=>s+(c.totalGastos||0),0);
    const dg = items.reduce((s,c)=>s+(c.deudaGenerada||0),0);
    const dc = items.reduce((s,c)=>s+(c.deudaCobrada||0),0);
    const dop = items.filter(c=>(c.totalCobrado||0)>0).length;
    const pedidos = items.reduce((s,c)=>s+(c.pedidos||0),0);
    return { k, cob, gas, dg, dc, dop, pedidos, res: cob-gas };
  });
  const rows = computed.slice().reverse().map(r => {
    const [y,m] = r.k.split('-');
    const margen = r.cob > 0 ? r.res/r.cob : null;
    const idxOrig = computed.findIndex(x => x.k === r.k);
    const prev = idxOrig > 0 ? computed[idxOrig-1] : null;
    let varMes = '—';
    if (prev && prev.cob > 0) {
      const v = (r.cob - prev.cob)/prev.cob;
      varMes = `<span class="${v>=0?'pos':'neg'}">${(v>=0?'+':'')+(v*100).toFixed(1)}%</span>`;
    }
    return `<tr>
      <td>${MESES[parseInt(m)-1]} ${y}</td>
      <td class="num"><b>${fmt(r.cob)}</b></td>
      <td class="num">${fmt(r.gas)}</td>
      <td class="num ${r.res>=0?'pos':'neg'}">${fmt(r.res)}</td>
      <td class="num">${fmtPct(margen)}</td>
      <td class="num">${fmt(r.dg)}</td>
      <td class="num">${fmt(r.dc)}</td>
      <td class="num ${(r.dg-r.dc)>0?'neg':'pos'}">${fmt(r.dg-r.dc)}</td>
      <td class="num">${r.dop}</td>
      <td class="num">${r.pedidos}</td>
      <td class="num">${varMes}</td>
    </tr>`;
  }).join('');
  $('tbl-mensual').querySelector('tbody').innerHTML = rows || '<tr><td colspan="11" class="empty">Sin datos</td></tr>';

  const porAnio = {};
  computed.forEach(r => {
    const [y,m] = r.k.split('-');
    if (!porAnio[y]) porAnio[y] = new Array(12).fill(0);
    porAnio[y][parseInt(m)-1] = r.cob;
  });
  const anios = Object.keys(porAnio).sort();
  const colors = ['#3b82f6','#10b981','#f59e0b','#a855f7','#ef4444'];
  if (anios.length) {
    drawBarChart('chart-yoy', MESES.map(m=>m.slice(0,3)), anios.map((y,i) => ({
      label: y, data: porAnio[y], color: colors[i % colors.length]
    })));
  }
}

// ============================================================
// DEUDORES
// ============================================================
function clearDeudaForm() {
  $('d-cliente').value = ''; $('d-concepto').value = ''; $('d-importe').value = '';
  $('d-fecha').value = todayISO();
  editMode.deuda = null;
  $('d-form-title').textContent = '💳 Añadir deuda de cliente';
  $('btn-add-deuda').textContent = '➕ Añadir deuda';
  $('btn-cancel-deuda').style.display = 'none';
}

async function saveDeuda() {
  const cliente = $('d-cliente').value.trim();
  const concepto = $('d-concepto').value.trim();
  const importe = parseFloat($('d-importe').value);
  const fecha = $('d-fecha').value || todayISO();
  if (!cliente) { toast('Cliente obligatorio','error'); return; }
  if (!importe || importe <= 0) { toast('Importe debe ser mayor que 0','error'); return; }

  try {
    if (editMode.deuda) {
      const existing = CACHE.deudores.find(d => d.id === editMode.deuda);
      if (existing) {
        Object.assign(existing, { cliente, concepto, importe, fecha });
        await data.saveDeudor(existing);
        toast('Deuda actualizada');
      }
    } else {
      const item = { id: uid(), cliente, concepto, importe, fecha, pagado: false, fechaPago: null };
      await data.saveDeudor(item);
      toast('Deuda añadida');
    }
    CACHE.deudores = await data.listDeudores();
    clearDeudaForm();
    renderDeudores();
    renderAlerts();
  } catch (e) { toast('Error: '+e.message, 'error'); }
}

function editDeuda(id) {
  const d = CACHE.deudores.find(x => x.id === id);
  if (!d) return;
  $('d-cliente').value = d.cliente;
  $('d-concepto').value = d.concepto || '';
  $('d-importe').value = d.importe;
  $('d-fecha').value = d.fecha;
  editMode.deuda = id;
  $('d-form-title').textContent = '✏️ Editando deuda';
  $('btn-add-deuda').textContent = '💾 Guardar cambios';
  $('btn-cancel-deuda').style.display = '';
  window.scrollTo({top:0, behavior:'smooth'});
}

async function toggleDeuda(id) {
  const d = CACHE.deudores.find(x => x.id === id);
  if (!d) return;
  d.pagado = !d.pagado;
  d.fechaPago = d.pagado ? todayISO() : null;
  try {
    await data.saveDeudor(d);
    CACHE.deudores = await data.listDeudores();
    toast(d.pagado ? 'Marcada como cobrada' : 'Marcada como pendiente');
    renderDeudores();
    renderAlerts();
  } catch (e) { toast('Error: '+e.message, 'error'); }
}

async function deleteDeuda(id) {
  if (!confirm('¿Eliminar este registro de deuda?')) return;
  try {
    await data.deleteDeudor(id);
    CACHE.deudores = await data.listDeudores();
    toast('Deuda eliminada');
    renderDeudores();
    renderAlerts();
  } catch (e) { toast('Error: '+e.message, 'error'); }
}

function renderDeudores() {
  const all = [...CACHE.deudores].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const pendientes = all.filter(d => !d.pagado);
  const totalPend = pendientes.reduce((s,d)=>s+d.importe,0);
  const cobradas = all.filter(d => d.pagado);
  const totalCob = cobradas.reduce((s,d)=>s+d.importe,0);
  const antiguas = pendientes.filter(d => daysBetween(d.fecha, todayISO()) > SETTINGS.deudaDias);
  const totalAnt = antiguas.reduce((s,d)=>s+d.importe,0);

  $('deudores-kpis').innerHTML = `
    <div class="card kpi featured"><div class="label">Deuda pendiente</div><div class="value neg">${fmt(totalPend)}</div><div class="sub">${pendientes.length} registros</div></div>
    <div class="card kpi featured"><div class="label">Deuda cobrada (histórico)</div><div class="value pos">${fmt(totalCob)}</div><div class="sub">${cobradas.length} registros</div></div>
    <div class="card kpi featured"><div class="label">Deudas antiguas (>${SETTINGS.deudaDias}d)</div><div class="value ${totalAnt>0?'neg':''}">${fmt(totalAnt)}</div><div class="sub">${antiguas.length} registros</div></div>
  `;

  const filtro = $('d-filtro').value;
  let list = all;
  if (filtro === 'pendientes') list = all.filter(d => !d.pagado);
  else if (filtro === 'cobradas') list = all.filter(d => d.pagado);
  else if (filtro === 'antiguas') list = all.filter(d => !d.pagado && daysBetween(d.fecha, todayISO()) > SETTINGS.deudaDias);

  const tb = $('tbl-deudores').querySelector('tbody');
  if (!list.length) { tb.innerHTML = '<tr><td colspan="7" class="empty">Sin registros</td></tr>'; return; }
  tb.innerHTML = list.map(d => {
    const dias = daysBetween(d.fecha, todayISO());
    const antiguedad = dias < 1 ? 'Hoy' : dias + 'd';
    let estado;
    if (d.pagado) estado = '<span class="badge green">Cobrada</span>';
    else if (dias > SETTINGS.deudaDias) estado = '<span class="badge red">Antigua</span>';
    else estado = '<span class="badge amber">Pendiente</span>';
    return `<tr>
      <td><b>${escapeHtml(d.cliente)}</b></td>
      <td>${escapeHtml(d.concepto||'')}</td>
      <td>${d.fecha}</td>
      <td class="num"><b>${fmt(d.importe)}</b></td>
      <td>${antiguedad}</td>
      <td>${estado}</td>
      <td class="row-actions">
        <button class="${d.pagado?'secondary':'success'} sm" data-toggle="${d.id}">${d.pagado?'↩️':'✅'}</button>
        <button class="secondary sm" data-edit="${d.id}">✏️</button>
        <button class="danger sm" data-del="${d.id}">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  tb.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => toggleDeuda(b.dataset.toggle)));
  tb.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editDeuda(b.dataset.edit)));
  tb.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteDeuda(b.dataset.del)));
}

// ============================================================
// PROVEEDORES
// ============================================================
function clearProvForm() {
  $('p-nombre').value = ''; $('p-importe').value = '';
  $('p-fecha').value = todayISO();
  $('p-cat').value = 'Compras';
  editMode.prov = null;
  $('p-form-title').textContent = '🏪 Registrar gasto / proveedor';
  $('btn-add-prov').textContent = '➕ Registrar gasto';
  $('btn-cancel-prov').style.display = 'none';
}

async function saveProv() {
  const nombre = $('p-nombre').value.trim();
  const cat = $('p-cat').value;
  const importe = parseFloat($('p-importe').value);
  const fecha = $('p-fecha').value || todayISO();
  if (!nombre) { toast('Nombre obligatorio','error'); return; }
  if (!importe || importe <= 0) { toast('Importe debe ser mayor que 0','error'); return; }

  try {
    if (editMode.prov) {
      const existing = CACHE.proveedores.find(p => p.id === editMode.prov);
      if (existing) {
        Object.assign(existing, { nombre, categoria: cat, importe, fecha });
        await data.saveProv(existing);
        toast('Gasto actualizado');
      }
    } else {
      await data.saveProv({ id: uid(), nombre, categoria: cat, importe, fecha });
      toast('Gasto registrado');
    }
    CACHE.proveedores = await data.listProv();
    clearProvForm();
    renderProveedores();
  } catch (e) { toast('Error: '+e.message, 'error'); }
}

function editProv(id) {
  const p = CACHE.proveedores.find(x => x.id === id);
  if (!p) return;
  $('p-nombre').value = p.nombre;
  $('p-cat').value = p.categoria;
  $('p-importe').value = p.importe;
  $('p-fecha').value = p.fecha;
  editMode.prov = id;
  $('p-form-title').textContent = '✏️ Editando gasto';
  $('btn-add-prov').textContent = '💾 Guardar cambios';
  $('btn-cancel-prov').style.display = '';
  window.scrollTo({top:0, behavior:'smooth'});
}

async function deleteProv(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  try {
    await data.deleteProv(id);
    CACHE.proveedores = await data.listProv();
    toast('Gasto eliminado');
    renderProveedores();
  } catch (e) { toast('Error: '+e.message, 'error'); }
}

function renderProveedores() {
  const all = [...CACHE.proveedores].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const inicioMes = todayISO().slice(0,7) + '-01';
  const mesActual = all.filter(p => p.fecha >= inicioMes);

  const porProv = {};
  mesActual.forEach(p => { porProv[p.nombre] = (porProv[p.nombre]||0) + p.importe; });
  const top = Object.entries(porProv).sort((a,b)=>b[1]-a[1]).slice(0,10);
  $('top-prov').innerHTML = top.length
    ? top.map(([n,v]) => `<div class="calc-box"><span class="lbl">${escapeHtml(n)}</span><span class="val">${fmt(v)}</span></div>`).join('')
    : '<p class="empty">Sin gastos este mes</p>';

  const porCat = {};
  mesActual.forEach(p => { porCat[p.categoria] = (porCat[p.categoria]||0) + p.importe; });
  const cats = Object.keys(porCat);
  const colors = ['#3b82f6','#10b981','#f59e0b','#a855f7','#ef4444','#06b6d4','#ec4899'];
  drawPieChart('chart-cat', cats, cats.map(c=>porCat[c]), cats.map((_,i)=>colors[i%colors.length]));

  const tb = $('tbl-prov').querySelector('tbody');
  if (!all.length) { tb.innerHTML = '<tr><td colspan="5" class="empty">Sin gastos registrados</td></tr>'; return; }
  tb.innerHTML = all.map(p => `<tr>
    <td>${p.fecha}</td>
    <td><b>${escapeHtml(p.nombre)}</b></td>
    <td><span class="tag">${p.categoria}</span></td>
    <td class="num"><b>${fmt(p.importe)}</b></td>
    <td class="row-actions">
      <button class="secondary sm" data-edit="${p.id}">✏️</button>
      <button class="danger sm" data-del="${p.id}">🗑️</button>
    </td>
  </tr>`).join('');

  tb.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editProv(b.dataset.edit)));
  tb.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteProv(b.dataset.del)));
}

// ============================================================
// SUELDOS
// ============================================================
function clearSueldoForm() {
  $('s-emp').value = ''; $('s-importe').value = '';
  $('s-fecha').value = todayISO();
  $('s-tipo').value = 'nomina';
  editMode.sueldo = null;
  $('s-form-title').textContent = '💼 Registrar movimiento de sueldo';
  $('btn-add-sueldo').textContent = '➕ Añadir';
  $('btn-cancel-sueldo').style.display = 'none';
}

async function saveSueldo() {
  const emp = $('s-emp').value.trim();
  const tipo = $('s-tipo').value;
  const importeRaw = parseFloat($('s-importe').value);
  const fecha = $('s-fecha').value || todayISO();
  if (!emp) { toast('Empleado obligatorio','error'); return; }
  if (!importeRaw || importeRaw <= 0) { toast('Importe debe ser mayor que 0','error'); return; }
  const signo = (tipo === 'descuento' || tipo === 'anticipo') ? -1 : 1;
  const importe = importeRaw * signo;

  try {
    if (editMode.sueldo) {
      const existing = CACHE.sueldos.find(s => s.id === editMode.sueldo);
      if (existing) {
        Object.assign(existing, { empleado: emp, tipo, importe, fecha });
        await data.saveSueldo(existing);
        toast('Movimiento actualizado');
      }
    } else {
      await data.saveSueldo({ id: uid(), empleado: emp, tipo, importe, fecha });
      toast('Movimiento añadido');
    }
    CACHE.sueldos = await data.listSueldos();
    clearSueldoForm();
    renderSueldos();
  } catch (e) { toast('Error: '+e.message, 'error'); }
}

function editSueldo(id) {
  const s = CACHE.sueldos.find(x => x.id === id);
  if (!s) return;
  $('s-emp').value = s.empleado;
  $('s-tipo').value = s.tipo;
  $('s-importe').value = Math.abs(s.importe);
  $('s-fecha').value = s.fecha;
  editMode.sueldo = id;
  $('s-form-title').textContent = '✏️ Editando movimiento';
  $('btn-add-sueldo').textContent = '💾 Guardar';
  $('btn-cancel-sueldo').style.display = '';
  window.scrollTo({top:0, behavior:'smooth'});
}

async function deleteSueldo(id) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  try {
    await data.deleteSueldo(id);
    CACHE.sueldos = await data.listSueldos();
    toast('Movimiento eliminado');
    renderSueldos();
  } catch (e) { toast('Error: '+e.message, 'error'); }
}

function renderSueldos() {
  const all = [...CACHE.sueldos].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const inicioMes = todayISO().slice(0,7) + '-01';
  const mes = all.filter(s => s.fecha >= inicioMes);
  const porEmp = {};
  mes.forEach(s => { porEmp[s.empleado] = (porEmp[s.empleado]||0) + s.importe; });
  const total = Object.values(porEmp).reduce((s,v)=>s+v,0);
  $('sueldos-resumen').innerHTML = Object.keys(porEmp).length
    ? Object.entries(porEmp).map(([e,v]) =>
        `<div class="calc-box"><span class="lbl">${escapeHtml(e)}</span><span class="val ${v>=0?'pos':'neg'}">${fmt(v)}</span></div>`
      ).join('') + `<div class="calc-box hi"><span class="lbl">TOTAL MES</span><span class="val">${fmt(total)}</span></div>`
    : '<p class="empty">Sin movimientos este mes</p>';

  const tb = $('tbl-sueldos').querySelector('tbody');
  if (!all.length) { tb.innerHTML = '<tr><td colspan="5" class="empty">Sin movimientos</td></tr>'; return; }
  tb.innerHTML = all.map(s => `<tr>
    <td>${s.fecha}</td>
    <td><b>${escapeHtml(s.empleado)}</b></td>
    <td><span class="tag">${s.tipo}</span></td>
    <td class="num ${s.importe>=0?'pos':'neg'}"><b>${fmt(s.importe)}</b></td>
    <td class="row-actions">
      <button class="secondary sm" data-edit="${s.id}">✏️</button>
      <button class="danger sm" data-del="${s.id}">🗑️</button>
    </td>
  </tr>`).join('');

  tb.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editSueldo(b.dataset.edit)));
  tb.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteSueldo(b.dataset.del)));
}

// ============================================================
// AJUSTES
// ============================================================
function renderDatos() {
  $('stat-count').textContent = CACHE.cierres.length;
  $('stat-deudas').textContent = CACHE.deudores.filter(d=>!d.pagado).length;
  $('stat-prov').textContent = CACHE.proveedores.length;
  $('stat-sueldos').textContent = CACHE.sueldos.length;
  if (CACHE.cierres.length) {
    $('stat-first').textContent = CACHE.cierres[0].fecha;
    $('stat-last').textContent = CACHE.cierres[CACHE.cierres.length-1].fecha;
  } else {
    $('stat-first').textContent = '—';
    $('stat-last').textContent = '—';
  }
  $('stat-backup').textContent = SETTINGS.lastBackup || 'Nunca';
  $('lastBackup').textContent = SETTINGS.lastBackup ? '💾 Backup: ' + SETTINGS.lastBackup : '';
  $('set-iva').value = SETTINGS.iva;
  $('set-margen-alerta').value = SETTINGS.margenAlerta;
  $('set-deuda-dias').value = SETTINGS.deudaDias;
}

// ============================================================
// EXPORT / IMPORT
// ============================================================
async function exportJSON() {
  const dataExport = {
    version: 4,
    exportedAt: new Date().toISOString(),
    cierres: CACHE.cierres,
    deudores: CACHE.deudores,
    proveedores: CACHE.proveedores,
    sueldos: CACHE.sueldos,
    settings: { ...SETTINGS }
  };
  const blob = new Blob([JSON.stringify(dataExport,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `abocados_backup_${todayISO()}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  try {
    await data.setCfg('lastBackup', todayISO());
    SETTINGS.lastBackup = todayISO();
  } catch(e) {}
  toast('✅ Backup descargado');
  renderDatos();
}

async function exportCSV() {
  const all = CACHE.cierres;
  if (!all.length) { toast('No hay cierres para exportar','error'); return; }
  const headers = ['fecha','diaSemana','semana','efectivo','tarjeta','otrosEfectivo','otrosTarjeta','totalCobrado','compras','vehiculos','otrasCompras','otros','totalGastos','resultado','deudaGenerada','deudaCobrada','deudaAcum','pedidos','clientesNuevos','cajaFisica','observaciones'];
  const rows = [headers.join(';')].concat(all.map(c => headers.map(h => {
    let v = c[h] ?? '';
    if (typeof v === 'string' && (v.includes(';') || v.includes('"') || v.includes('\n'))) v = '"'+v.replace(/"/g,'""')+'"';
    return v;
  }).join(';')));
  const blob = new Blob(['\ufeff'+rows.join('\n')], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `cierres_abocados_${todayISO()}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('CSV descargado');
}

async function importJSON(file) {
  try {
    const text = await file.text();
    const obj = JSON.parse(text);
    const counts = `${(obj.cierres||[]).length} cierres, ${(obj.deudores||[]).length} deudas, ${(obj.proveedores||[]).length} gastos, ${(obj.sueldos||[]).length} sueldos`;
    if (!confirm(`¿Importar datos a la nube?\n\n${counts}\n\nLos registros con misma clave serán sobrescritos.`)) return;
    setSyncStatus('syncing','Importando...');
    for (const c of (obj.cierres||[])) await data.saveCierre(c);
    for (const d of (obj.deudores||[])) await data.saveDeudor(d);
    for (const p of (obj.proveedores||[])) await data.saveProv(p);
    for (const s of (obj.sueldos||[])) await data.saveSueldo(s);
    if (obj.settings) {
      for (const k of Object.keys(obj.settings)) {
        if (obj.settings[k] != null) await data.setCfg(k, obj.settings[k]);
      }
    }
    await loadAll();
    await recalcDeudaAcum();
    await loadAll();
    toast('✅ Datos importados a la nube');
    await renderAll();
  } catch (e) {
    console.error(e);
    toast('Error al importar: '+e.message, 'error');
    setSyncStatus('ok','Conectado');
  }
}

// ============================================================
// BORRADO
// ============================================================
async function borrarStore(store, label) {
  if (!confirm(`⚠️ ¿Borrar TODOS los ${label}? Esta acción es IRREVERSIBLE y afecta a TODOS los dispositivos.`)) return;
  if (!confirm(`Última confirmación: vas a perder ${label} para siempre. ¿Continuar?`)) return;
  try {
    setSyncStatus('syncing','Borrando...');
    await data.clearStore(store);
    await loadAll();
    toast(`${label} borrados`, 'warn');
    await renderAll();
  } catch (e) { toast('Error: '+e.message, 'error'); }
}

async function borrarTodo() {
  if (!confirm('⚠️ Vas a borrar ABSOLUTAMENTE TODO de la nube: cierres, deudas, proveedores, sueldos, objetivos y ajustes. ¿Continuar?')) return;
  if (!confirm('Última confirmación. Esta acción NO se puede deshacer y afecta a todos tus dispositivos. ¿Borrar todo?')) return;
  try {
    setSyncStatus('syncing','Borrando...');
    await data.clearStore('cierres');
    await data.clearStore('deudores');
    await data.clearStore('proveedores');
    await data.clearStore('sueldos');
    // config: borrar todas las claves
    await sb.from('config').delete().neq('key','___never___');
    await idbClear('config');
    SETTINGS.iva = 10; SETTINGS.margenAlerta = 20; SETTINGS.deudaDias = 30;
    SETTINGS.goalMes = null; SETTINGS.goalAnio = null; SETTINGS.goalMargen = null; SETTINGS.lastBackup = null;
    CACHE.cierres = []; CACHE.deudores = []; CACHE.proveedores = []; CACHE.sueldos = [];
    limpiar(); clearDeudaForm(); clearProvForm(); clearSueldoForm();
    toast('✅ Todos los datos borrados', 'warn');
    await renderAll();
  } catch (e) { toast('Error: '+e.message, 'error'); }
}

// ============================================================
// CHARTS
// ============================================================
function setupCanvas(c, h) {
  const dpr = window.devicePixelRatio || 1;
  const w = c.offsetWidth || 400;
  c.width = w * dpr; c.height = h * dpr;
  c.style.height = h + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w, h };
}
function drawBarChart(canvasId, labels, series) {
  const c = $(canvasId); if (!c) return;
  const { ctx, w, h } = setupCanvas(c, parseInt(c.getAttribute('height')) || 200);
  ctx.clearRect(0,0,w,h);
  if (!labels.length) { ctx.fillStyle='#8a98ac'; ctx.font='12px sans-serif'; ctx.fillText('Sin datos',10,30); return; }
  const pad = { l:50, r:10, t:14, b:36 };
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const max = Math.max(1, ...series.flatMap(s=>s.data));
  const groupW = cw / labels.length, barW = groupW / (series.length + 0.5);
  ctx.strokeStyle = '#2a3441'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(pad.l,pad.t); ctx.lineTo(pad.l,pad.t+ch); ctx.lineTo(pad.l+cw,pad.t+ch); ctx.stroke();
  ctx.fillStyle='#8a98ac'; ctx.font='10px ui-monospace,monospace';
  for (let i=0;i<=4;i++){
    const y=pad.t+ch*(1-i/4);
    const v = max*i/4;
    const txt = v >= 1000 ? Math.round(v/1000)+'k' : Math.round(v);
    ctx.fillText(txt, 4, y+3);
    ctx.strokeStyle='#1e2733'; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cw,y); ctx.stroke();
  }
  labels.forEach((lbl,i)=>{
    series.forEach((s,si)=>{
      const x = pad.l + groupW*i + barW*si + (groupW - barW*series.length)/2;
      const bh = Math.max(0,(s.data[i]/max)*ch);
      const grad = ctx.createLinearGradient(0, pad.t+ch-bh, 0, pad.t+ch);
      grad.addColorStop(0, s.color);
      grad.addColorStop(1, s.color + '88');
      ctx.fillStyle = grad;
      ctx.fillRect(x, pad.t+ch-bh, barW*0.85, bh);
    });
    ctx.fillStyle='#8a98ac'; ctx.font='9px sans-serif';
    if (i % Math.max(1,Math.floor(labels.length/8))===0) {
      const tx = pad.l+groupW*i + groupW/2;
      ctx.save(); ctx.translate(tx, h-18); ctx.rotate(-0.5);
      ctx.fillText(lbl, -10, 0); ctx.restore();
    }
  });
  ctx.font = '10px sans-serif';
  series.forEach((s,i) => {
    const x = pad.l + i*80;
    ctx.fillStyle = s.color; ctx.fillRect(x, 2, 10, 10);
    ctx.fillStyle = '#e8eef5'; ctx.fillText(s.label, x+14, 11);
  });
}
function drawLineChart(canvasId, labels, datax, color) {
  const c = $(canvasId); if (!c) return;
  const { ctx, w, h } = setupCanvas(c, parseInt(c.getAttribute('height')) || 200);
  ctx.clearRect(0,0,w,h);
  if (!datax.length) { ctx.fillStyle='#8a98ac'; ctx.font='12px sans-serif'; ctx.fillText('Sin datos',10,30); return; }
  const pad = { l:60, r:10, t:14, b:30 };
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const max = Math.max(1, ...datax), min = Math.min(0, ...datax);
  const range = max - min || 1;
  ctx.strokeStyle='#2a3441';
  ctx.beginPath(); ctx.moveTo(pad.l,pad.t); ctx.lineTo(pad.l,pad.t+ch); ctx.lineTo(pad.l+cw,pad.t+ch); ctx.stroke();
  ctx.fillStyle='#8a98ac'; ctx.font='10px ui-monospace,monospace';
  for (let i=0;i<=4;i++){
    const y=pad.t+ch*(1-i/4);
    const v = min+range*i/4;
    const txt = Math.abs(v) >= 1000 ? Math.round(v/1000)+'k' : Math.round(v);
    ctx.fillText(txt,4,y+3);
    ctx.strokeStyle='#1e2733'; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cw,y); ctx.stroke();
  }
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
  datax.forEach((v,i)=>{
    const x = pad.l + (cw/Math.max(1,datax.length-1))*i;
    const y = pad.t + ch*(1 - (v-min)/range);
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
  ctx.lineTo(pad.l+cw, pad.t+ch); ctx.lineTo(pad.l, pad.t+ch); ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t+ch);
  grad.addColorStop(0, color+'44'); grad.addColorStop(1, color+'00');
  ctx.fillStyle = grad; ctx.fill();
}
function drawPieChart(canvasId, labels, datax, colors) {
  const c = $(canvasId); if (!c) return;
  const { ctx, w, h } = setupCanvas(c, parseInt(c.getAttribute('height')) || 200);
  ctx.clearRect(0,0,w,h);
  const total = datax.reduce((s,v)=>s+v,0);
  if (!total) { ctx.fillStyle='#8a98ac'; ctx.font='12px sans-serif'; ctx.fillText('Sin datos',10,30); return; }
  const cx = h/2 + 10, cy = h/2, r = h/2 - 14;
  let start = -Math.PI/2;
  datax.forEach((v,i)=>{
    const ang = (v/total)*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,start+ang); ctx.closePath();
    ctx.fillStyle = colors[i]; ctx.fill();
    ctx.strokeStyle = '#161d27'; ctx.lineWidth=2; ctx.stroke();
    start += ang;
  });
  ctx.beginPath(); ctx.arc(cx,cy,r*0.55,0,Math.PI*2); ctx.fillStyle='#161d27'; ctx.fill();
  labels.forEach((lbl,i)=>{
    const lx = h + 30, ly = 20 + i*22;
    ctx.fillStyle = colors[i]; ctx.fillRect(lx, ly, 12, 12);
    ctx.fillStyle = '#e8eef5'; ctx.font='11px sans-serif';
    const pct = ((datax[i]/total)*100).toFixed(1);
    ctx.fillText(`${lbl}  ${pct}%`, lx+18, ly+10);
  });
}

// ============================================================
// RENDER ALL
// ============================================================
async function renderAll() {
  recalc();
  renderAlerts();
  renderDashboard();
  renderForecast();
  renderObjetivos();
  renderHistorial();
  renderSemanal();
  renderMensual();
  renderDeudores();
  renderProveedores();
  renderSueldos();
  renderDatos();
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-'+name));
  requestAnimationFrame(() => {
    if (name === 'dashboard') renderDashboard();
    if (name === 'forecast') renderForecast();
    if (name === 'mensual') renderMensual();
    if (name === 'proveedores') renderProveedores();
  });
}

// ============================================================
// AUTH
// ============================================================
async function doLogin() {
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  if (!email || !password) { $('loginMsg').textContent = 'Email y contraseña requeridos'; $('loginMsg').style.color = 'var(--red)'; return; }
  $('btnLogin').disabled = true;
  $('loginMsg').textContent = 'Entrando...';
  $('loginMsg').style.color = 'var(--muted)';
  const { data: res, error } = await sb.auth.signInWithPassword({ email, password });
  $('btnLogin').disabled = false;
  if (error) { $('loginMsg').textContent = error.message; $('loginMsg').style.color = 'var(--red)'; return; }
  await onLoggedIn(res.user);
}

async function doSignup() {
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  if (!email || !password) { $('loginMsg').textContent = 'Email y contraseña requeridos'; $('loginMsg').style.color = 'var(--red)'; return; }
  if (password.length < 6) { $('loginMsg').textContent = 'Contraseña mínimo 6 caracteres'; $('loginMsg').style.color = 'var(--red)'; return; }
  $('btnSignup').disabled = true;
  $('loginMsg').textContent = 'Registrando...';
  $('loginMsg').style.color = 'var(--muted)';
  const { data: res, error } = await sb.auth.signUp({ email, password });
  $('btnSignup').disabled = false;
  if (error) { $('loginMsg').textContent = error.message; $('loginMsg').style.color = 'var(--red)'; return; }
  if (res.user && res.session) {
    await onLoggedIn(res.user);
  } else {
    $('loginMsg').textContent = 'Registro creado. Revisa tu email para confirmar la cuenta y luego entra.';
    $('loginMsg').style.color = 'var(--green)';
  }
}

async function doLogout() {
  await sb.auth.signOut();
  currentUser = null;
  // Limpiar caché local al cerrar sesión por seguridad
  for (const s of STORES) await idbClear(s);
  CACHE.cierres = []; CACHE.deudores = []; CACHE.proveedores = []; CACHE.sueldos = [];
  $('app').style.display = 'none';
  $('loginScreen').style.display = 'flex';
  $('loginEmail').value = ''; $('loginPassword').value = '';
}

let realtimeChannels = [];
function subscribeRealtime() {
  // Limpiar suscripciones previas
  realtimeChannels.forEach(ch => sb.removeChannel(ch));
  realtimeChannels = [];
  const tables = ['cierres','deudores','proveedores','sueldos','config'];
  tables.forEach(t => {
    const ch = sb.channel('rt-'+t)
      .on('postgres_changes', { event: '*', schema: 'public', table: t }, async () => {
        // Otro dispositivo cambió algo → recargar
        await loadAll();
        await renderAll();
        toast('🔄 Sincronizado desde otro dispositivo');
      })
      .subscribe();
    realtimeChannels.push(ch);
  });
}

async function onLoggedIn(user) {
  currentUser = user;
  $('loginScreen').style.display = 'none';
  $('app').style.display = '';
  $('userBadge').textContent = '👤 ' + user.email;
  await loadAll();
  $('f-fecha').value = todayISO();
  updateFechaInfo();
  await cargarFecha(todayISO());
  ['d-fecha','p-fecha','s-fecha'].forEach(id => { if (!$(id).value) $(id).value = todayISO(); });
  await renderAll();
  subscribeRealtime();
}

// ============================================================
// EVENT WIRING
// ============================================================
function wireEvents() {
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => switchTab(t.dataset.view));
  });

  ['f-efectivo','f-tarjeta','f-otros-ef','f-otros-tc','f-compras','f-vehiculos','f-otras','f-regalos','f-deuda-gen','f-deuda-cob','f-pedidos'].forEach(id => {
    $(id).addEventListener('input', recalc);
  });
  $('f-fecha').addEventListener('change', async () => {
    updateFechaInfo();
    await cargarFecha($('f-fecha').value);
  });
  $('btn-guardar').addEventListener('click', guardar);
  $('btn-limpiar').addEventListener('click', limpiar);
  $('btn-cancelar-edit').addEventListener('click', () => {
    $('f-fecha').value = todayISO();
    updateFechaInfo();
    cargarFecha(todayISO());
  });

  $('btn-save-goals').addEventListener('click', saveGoals);
  $('btn-clear-goals').addEventListener('click', clearAllGoals);

  $('hist-search').addEventListener('input', renderHistorial);
  $('hist-month').addEventListener('change', renderHistorial);

  $('btn-add-deuda').addEventListener('click', saveDeuda);
  $('btn-cancel-deuda').addEventListener('click', clearDeudaForm);
  $('d-filtro').addEventListener('change', renderDeudores);

  $('btn-add-prov').addEventListener('click', saveProv);
  $('btn-cancel-prov').addEventListener('click', clearProvForm);

  $('btn-add-sueldo').addEventListener('click', saveSueldo);
  $('btn-cancel-sueldo').addEventListener('click', clearSueldoForm);

  $('btn-save-settings').addEventListener('click', async () => {
    SETTINGS.iva = parseFloat($('set-iva').value) || 10;
    SETTINGS.margenAlerta = parseFloat($('set-margen-alerta').value) || 20;
    SETTINGS.deudaDias = parseInt($('set-deuda-dias').value) || 30;
    try {
      await data.setCfg('iva', SETTINGS.iva);
      await data.setCfg('margenAlerta', SETTINGS.margenAlerta);
      await data.setCfg('deudaDias', SETTINGS.deudaDias);
      toast('Ajustes guardados');
      recalc(); renderAlerts(); renderDeudores();
    } catch (e) { toast('Error: '+e.message, 'error'); }
  });

  $('btn-export-json').addEventListener('click', exportJSON);
  $('btn-export-csv').addEventListener('click', exportCSV);
  $('btn-import').addEventListener('click', () => $('file-import').click());
  $('file-import').addEventListener('change', e => {
    if (e.target.files[0]) { importJSON(e.target.files[0]); e.target.value = ''; }
  });
  $('btn-print').addEventListener('click', () => window.print());
  $('btn-resync').addEventListener('click', async () => {
    setSyncStatus('syncing','Resincronizando...');
    await loadAll();
    await renderAll();
    toast('✅ Resincronizado desde la nube');
  });

  $('btn-borrar-cierres').addEventListener('click', () => borrarStore('cierres', 'cierres'));
  $('btn-borrar-deudas').addEventListener('click', () => borrarStore('deudores', 'deudas'));
  $('btn-borrar-prov').addEventListener('click', () => borrarStore('proveedores', 'proveedores'));
  $('btn-borrar-sueldos').addEventListener('click', () => borrarStore('sueldos', 'sueldos'));
  $('btn-borrar-todo').addEventListener('click', borrarTodo);

  // Auth
  $('btnLogin').addEventListener('click', doLogin);
  $('btnSignup').addEventListener('click', doSignup);
  $('btnLogout').addEventListener('click', doLogout);
  $('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

// ============================================================
// INIT
// ============================================================
(async () => {
  try {
    if (!window.SUPABASE_URL || window.SUPABASE_URL.startsWith('PEGA_')) {
      document.body.innerHTML = '<div style="padding:40px;text-align:center;color:#e8eef5;font-family:sans-serif"><h2>⚠️ Configuración pendiente</h2><p>Edita el archivo <code>config.js</code> y pega tu Project URL y anon key de Supabase.</p></div>';
      return;
    }
    await openDB();
    wireEvents();
    // Check existing session
    const { data: session } = await sb.auth.getSession();
    if (session && session.session && session.session.user) {
      await onLoggedIn(session.session.user);
    } else {
      $('loginScreen').style.display = 'flex';
    }
  } catch (e) {
    console.error(e);
    alert('Error al iniciar la app: ' + e.message);
  }
})();
