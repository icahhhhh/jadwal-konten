// Tempel di Google Sheets: Ekstensi > Apps Script. Lalu Deploy > Web app.
// Sheet "Users", "Sesi", dan "Konten" dibuat otomatis saat pertama dipakai.
const HEAD = {
  Users: ["email", "nama", "salt", "hash", "dibuat", "gagal", "kunci_sampai", "kode", "kode_sampai"],
  Sesi: ["token", "email", "kedaluwarsa"],
  Konten: ["email", "id", "judul", "platform", "tahap", "deadline", "catatan", "sow"]
};

function sheet_(n) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(n);
  if (!s) {
    s = ss.insertSheet(n);
    s.getRange(1, 1, s.getMaxRows(), HEAD[n].length).setNumberFormat("@"); // semua teks, cegah rumus
    s.getRange(1, 1, 1, HEAD[n].length).setValues([HEAD[n]]);
    s.setFrozenRows(1);
  }
  return s;
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function c_(v, n) { return String(v == null ? "" : v).substring(0, n); }
function norm_(s) { return String(s || "").trim().toLowerCase(); }
function hash_(pw, salt) {
  let h = salt + pw;
  for (let i = 0; i < 1000; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + h));
  }
  return h;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (x) { return out_({ ok: false, error: "Server sibuk, coba lagi." }); }
  try {
    const d = JSON.parse(e.postData.contents);
    switch (d.action) {
      case "register": return out_(register_(d));
      case "login": return out_(login_(d));
      case "load": return out_(load_(d));
      case "save": return out_(save_(d));
      case "logout": return out_(logout_(d));
      case "forgot": return out_(forgot_(d));
      case "reset": return out_(reset_(d));
    }
    return out_({ ok: false, error: "Aksi tidak dikenal" });
  } catch (err) {
    return out_({ ok: false, error: "Terjadi kesalahan" });
  } finally {
    lock.releaseLock();
  }
}

function findUser_(email) {
  const s = sheet_("Users"), v = s.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (v[i][0] === email) return { row: i + 1, v: v[i], s: s };
  return null;
}
function newSession_(email) {
  const t = Utilities.getUuid() + Utilities.getUuid();
  sheet_("Sesi").appendRow([t, email, String(Date.now() + 30 * 864e5)]);
  return t;
}
function sessionEmail_(token) {
  const s = sheet_("Sesi"), v = s.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] === token) {
      if (Number(v[i][2]) > Date.now()) return v[i][1];
      s.deleteRow(i + 1);
      return null;
    }
  }
  return null;
}
function tasks_(email) {
  const v = sheet_("Konten").getDataRange().getValues().slice(1);
  return v.filter(r => r[0] === email).map(r => ({
    id: r[1], title: r[2], platform: r[3], stage: r[4], due: r[5], note: r[6], sow: r[7]
  }));
}

function register_(d) {
  const email = norm_(d.email), pw = String(d.password || "");
  if (!/^[a-z0-9][^\s@]*@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Email tidak valid" };
  if (pw.length < 6) return { ok: false, error: "Kata sandi minimal 6 karakter" };
  if (findUser_(email)) return { ok: false, error: "Email sudah terdaftar" };
  const name = c_(d.name, 60).trim() || email.split("@")[0];
  const salt = Utilities.getUuid();
  sheet_("Users").appendRow([email, name, salt, hash_(pw, salt), new Date().toISOString(), "0", "0"]);
  return { ok: true, token: newSession_(email), email: email, name: name, tasks: [] };
}
function login_(d) {
  const email = norm_(d.email), u = findUser_(email);
  const bad = { ok: false, error: "Email atau kata sandi salah" };
  if (!u) return bad;
  if (Number(u.v[6]) > Date.now()) return { ok: false, error: "Terlalu banyak percobaan. Coba lagi 10 menit lagi." };
  if (hash_(String(d.password || ""), u.v[2]) !== u.v[3]) {
    let f = Number(u.v[5]) + 1, k = 0;
    if (f >= 5) { k = Date.now() + 600000; f = 0; }
    u.s.getRange(u.row, 6, 1, 2).setValues([[String(f), String(k)]]);
    return bad;
  }
  u.s.getRange(u.row, 6, 1, 2).setValues([["0", "0"]]);
  return { ok: true, token: newSession_(email), email: email, name: u.v[1], tasks: tasks_(email) };
}
function load_(d) {
  const email = sessionEmail_(d.token);
  if (!email) return { ok: false, expired: true, error: "Sesi berakhir" };
  const u = findUser_(email);
  return { ok: true, token: d.token, email: email, name: u ? u.v[1] : email, tasks: tasks_(email) };
}
function save_(d) {
  const email = sessionEmail_(d.token);
  if (!email) return { ok: false, expired: true, error: "Sesi berakhir" };
  const s = sheet_("Konten"), v = s.getDataRange().getValues().slice(1);
  const keep = v.filter(r => r[0] !== email);
  const add = (Array.isArray(d.tasks) ? d.tasks : []).slice(0, 500).map(t => [
    email, c_(t.id, 40), c_(t.title, 120), c_(t.platform, 30), c_(t.stage, 20), c_(t.due, 10), c_(t.note, 300), c_(t.sow, 1500)
  ]);
  const all = keep.concat(add);
  if (s.getMaxRows() > 1) s.getRange(2, 1, s.getMaxRows() - 1, 8).clearContent();
  if (all.length) {
    if (s.getMaxRows() < all.length + 1) s.insertRowsAfter(s.getMaxRows(), all.length + 1 - s.getMaxRows());
    const r = s.getRange(2, 1, all.length, 8);
    r.setNumberFormat("@");
    r.setValues(all);
  }
  return { ok: true };
}
function logout_(d) {
  const s = sheet_("Sesi"), v = s.getDataRange().getValues();
  for (let i = v.length - 1; i >= 1; i--) if (v[i][0] === d.token) s.deleteRow(i + 1);
  return { ok: true };
}

function logoutAll_(email) {
  const s = sheet_("Sesi"), v = s.getDataRange().getValues();
  for (let i = v.length - 1; i >= 1; i--) if (v[i][1] === email) s.deleteRow(i + 1);
}
// Lupa kata sandi: kirim kode 6 angka ke email (berlaku 15 menit)
function forgot_(d) {
  const email = norm_(d.email), u = findUser_(email);
  const msg = "Jika email terdaftar, kode 6 angka sudah dikirim (berlaku 15 menit). Cek juga folder spam.";
  if (!u) return { ok: true, message: msg }; // sama persis, agar email terdaftar tidak bisa ditebak
  if (Number(u.v[8] || 0) - 14 * 60000 > Date.now()) return { ok: true, message: msg }; // baru dikirim <1 menit lalu
  const code = String(100000 + (parseInt(Utilities.getUuid().replace(/-/g, "").substring(0, 8), 16) % 900000));
  try {
    MailApp.sendEmail(email, "Kode reset kata sandi Jadwal Konten",
      "Kode untuk mengatur ulang kata sandimu: " + code + "\n\nKode berlaku 15 menit. Jika bukan kamu yang meminta, abaikan email ini.");
  } catch (err) {
    return { ok: false, error: "Tidak bisa mengirim email sekarang. Coba lagi nanti." };
  }
  u.s.getRange(1, 8, 1, 2).setValues([["kode", "kode_sampai"]]);
  const r = u.s.getRange(u.row, 8, 1, 2);
  r.setNumberFormat("@");
  r.setValues([[hash_(code, u.v[2]), String(Date.now() + 15 * 60000)]]);
  return { ok: true, message: msg };
}
function reset_(d) {
  const email = norm_(d.email), u = findUser_(email), pw = String(d.password || "");
  const bad = { ok: false, error: "Kode salah atau sudah kedaluwarsa" };
  if (pw.length < 6) return { ok: false, error: "Kata sandi minimal 6 karakter" };
  if (!u || !u.v[7] || Number(u.v[8]) < Date.now()) return bad;
  if (Number(u.v[6]) > Date.now()) return { ok: false, error: "Terlalu banyak percobaan. Coba lagi 10 menit lagi." };
  if (hash_(String(d.code || "").trim(), u.v[2]) !== u.v[7]) {
    let f = Number(u.v[5]) + 1, k = 0;
    if (f >= 5) { k = Date.now() + 600000; f = 0; }
    u.s.getRange(u.row, 6, 1, 2).setValues([[String(f), String(k)]]);
    if (k) u.s.getRange(u.row, 8, 1, 2).setValues([["", ""]]); // kode dihanguskan setelah 5x salah
    return bad;
  }
  const salt = Utilities.getUuid();
  u.s.getRange(u.row, 3, 1, 2).setValues([[salt, hash_(pw, salt)]]);
  u.s.getRange(u.row, 6, 1, 4).setValues([["0", "0", "", ""]]);
  logoutAll_(email); // semua sesi lama otomatis keluar
  return { ok: true, token: newSession_(email), email: email, name: u.v[1], tasks: tasks_(email) };
}
