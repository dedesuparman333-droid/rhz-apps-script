/**
 * SMART POULTRY FARM MANAGEMENT SYSTEM
 * Backend - Google Apps Script
 * ==========================================================
 * Ganti SPREADSHEET_ID dengan ID Google Spreadsheet Anda.
 * Dapatkan ID dari URL: https://docs.google.com/spreadsheets/d/[ID_ADA_DISINI]/edit
 */
const SPREADSHEET_ID = "1gvuG4TgIvnlrXdfp3pmFJgi1YjMQdGmSvMIk9Mpi3kM";

/**
 * PINTU MASUK API (Untuk Vercel / Domain Luar)
 * Menangani permintaan POST dan mengizinkan CORS
 */
function doPost(e) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const payload = requestData.payload;
    const userId = requestData.userId;

    let result;

    // Routing berdasarkan 'action' yang dikirim dari Frontend
    switch (action) {
      case 'doLogin':
        result = doLogin(payload.username, payload.password);
        break;
      case 'saveBroilerExtended':
        result = saveBroilerExtended(payload.data, userId);
        break;
      case 'getBroilerExtended':
        result = getBroilerExtended(userId, payload.role);
        break;
      case 'saveKampungExtended':
        result = saveKampungExtended(payload.data, userId);
        break;
      case 'getKampungExtended':
        result = getKampungExtended(userId, payload.role);
        break;
      case 'savePetelurExtended':
        result = savePetelurExtended(payload.data, userId);
        break;
      case 'getPetelurExtended':
        result = getPetelurExtended(userId, payload.role);
        break;
      case 'getDashboardDataExtended':
        result = getDashboardDataExtended(userId, payload.role);
        break;
      case 'deleteModuleData':
        result = deleteModuleData(payload.mod, payload.id);
        break;
      default:
        result = JSON.stringify({ success: false, message: "Action tidak ditemukan" });
    }

    return ContentService.createTextOutput(result)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Menangani permintaan OPTIONS (Pre-flight request) dari Vercel/Domain Luar
 */
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .addHeader("Access-Control-Allow-Origin", "*")
    .addHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    .addHeader("Access-Control-Allow-Headers", "Content-Type");
}

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Rahaza Farm - Smart Poultry')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    let headers = [];
    if (name === 'broiler' || name === 'kampung' || name === 'petelur') {
      headers = ['ID', 'Waktu', 'UserID', 'Tanggal', 'Jenis', 'Populasi', 'Mati', 'Biaya', 'Pendapatan', 'HPP_Saat_Ini', 'Keterangan'];
    } else if (name === 'users') {
      headers = ['ID', 'Waktu', 'Username', 'Password', 'Role'];
      sheet.appendRow(headers);
      sheet.appendRow(['USR-1', new Date(), 'admin', 'admin123', 'admin']);
      return sheet;
    }
    
    if (headers.length > 0) {
      sheet.appendRow(headers);
    }
  }
  return sheet;
}

function doLogin(u, p) {
  const data = getSheet('users').getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] == u && data[i][3] == p) {
      return JSON.stringify({ success: true, user: { id: data[i][0], username: data[i][2], role: data[i][4] } });
    }
  }
  return JSON.stringify({ success: false, message: "Akses Ditolak" });
}

// FUNGSI GENERIK UNTUK SIMPAN DATA (Broiler, Kampung, Petelur)
function saveDataGeneric(sheetName, obj, userId) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  
  let totalCost = 0;
  let totalPop = 0;
  
  for(let i=1; i<data.length; i++) {
    if(data[i][2] === userId) {
      totalCost += (Number(data[i][7]) || 0);
      totalPop += (Number(data[i][5]) || 0);
      totalPop -= (Number(data[i][6]) || 0);
    }
  }

  const jenisMap = {
    'modal': 'MODAL',
    'operasional': 'OPERASIONAL',
    'kematian': 'KEMATIAN',
    'panen': 'PANEN'
  };

  const jenis = jenisMap[obj.type] || obj.type;
  const biaya = Number(obj.biaya) || 0;
  const populasi = Number(obj.populasi) || 0;
  const mati = Number(obj.mati) || 0;
  const pop_minus = Number(obj.populasi_minus) || 0;

  totalCost += biaya;
  totalPop += populasi;
  totalPop -= mati;
  totalPop -= pop_minus;

  const hpp = totalPop > 0 ? totalCost / totalPop : 0;

  sheet.appendRow([
    sheetName.toUpperCase().substring(0,2) + '-' + Utilities.getUuid(),
    new Date(),
    userId,
    obj.tanggal,
    jenis,
    populasi || (pop_minus ? -pop_minus : ''),
    mati || '',
    biaya || '',
    obj.pendapatan || '',
    Math.round(hpp),
    obj.keterangan || ''
  ]);
  
  return JSON.stringify({ success: true });
}

// Wrapper Functions
function saveBroilerExtended(obj, userId) { return saveDataGeneric('broiler', obj, userId); }
function saveKampungExtended(obj, userId) { return saveDataGeneric('kampung', obj, userId); }
function savePetelurExtended(obj, userId) { return saveDataGeneric('petelur', obj, userId); }

function getDataGeneric(sheetName, userId, role) {
  const data = getSheet(sheetName).getDataRange().getValues();
  if (data.length <= 1) return JSON.stringify([]);
  
  const headers = data[0];
  const res = [];
  for(let i=1; i<data.length; i++) {
    if(role === 'admin' || data[i][2] === userId) {
      let row = {};
      headers.forEach((h, idx) => {
        let val = data[i][idx];
        if(val instanceof Date) val = Utilities.formatDate(val, "GMT+7", "yyyy-MM-dd");
        row[h.toLowerCase()] = val;
      });
      res.push(row);
    }
  }
  return JSON.stringify(res.reverse());
}

function getBroilerExtended(userId, role) { return getDataGeneric('broiler', userId, role); }
function getKampungExtended(userId, role) { return getDataGeneric('kampung', userId, role); }
function getPetelurExtended(userId, role) { return getDataGeneric('petelur', userId, role); }

function getDashboardDataExtended(userId, role) {
  const modules = ['broiler', 'kampung', 'petelur'];
  const result = {};

  modules.forEach(mod => {
    const data = getSheet(mod).getDataRange().getValues();
    let pop = 0, cost = 0, hpp = 0;
    
    if (data.length > 1) {
      for(let i=1; i<data.length; i++) {
        if(role === 'admin' || data[i][2] === userId) {
          cost += (Number(data[i][7]) || 0);
          pop += (Number(data[i][5]) || 0);
          pop -= (Number(data[i][6]) || 0);
          hpp = data[i][9]; 
        }
      }
    }
    result[mod] = { populasi: pop, cost: cost, hpp: hpp };
  });
  
  return JSON.stringify(result);
}

function deleteModuleData(mod, id) {
  const sheet = getSheet(mod);
  const data = sheet.getDataRange().getValues();
  for(let i=data.length-1; i>0; i--) {
    if(data[i][0] === id) {
      sheet.deleteRow(i+1);
      break;
    }
  }
  return JSON.stringify({success: true});
}