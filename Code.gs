/**
 * SMART POULTRY FARM MANAGEMENT SYSTEM
 * Backend - Google Apps Script
 * ==========================================================
 * Ganti SPREADSHEET_ID dengan ID Google Spreadsheet Anda.
 * Dapatkan ID dari URL: https://docs.google.com/spreadsheets/d/[ID_ADA_DISINI]/edit
 */
const SPREADSHEET_ID = "1gvuG4TgIvnlrXdfp3pmFJgi1YjMQdGmSvMIk9Mpi3kM";

// Fungsi wajib untuk menjalankan Web App
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Smart Poultry Farm')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    let headers = [];
    if (name === 'broiler') {
      headers = ['ID', 'Waktu', 'UserID', 'Tanggal', 'Jenis', 'Populasi', 'Mati', 'Biaya', 'Pendapatan', 'HPP_Saat_Ini', 'Keterangan'];
    } else if (name === 'users') {
      headers = ['ID', 'Waktu', 'Username', 'Password', 'Role'];
      sheet.appendRow(headers);
      sheet.appendRow(['USR-1', new Date(), 'admin', 'admin123', 'admin']);
      return sheet;
    }
    
    // Perbaikan: Hanya appendRow jika headers tidak kosong
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

/**
 * Fitur Spesifik Broiler: Menyimpan berbagai jenis input
 */
function saveBroilerExtended(obj, userId) {
  const sheet = getSheet('broiler');
  const data = sheet.getDataRange().getValues();
  
  // Hitung akumulasi saat ini untuk HPP
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

  const jenis = jenisMap[obj.type];
  const biaya = Number(obj.biaya) || 0;
  const populasi = Number(obj.populasi) || 0;
  const mati = Number(obj.mati) || 0;
  const pop_minus = Number(obj.populasi_minus) || 0;

  // Update akumulasi dengan input baru
  totalCost += biaya;
  totalPop += populasi;
  totalPop -= mati;
  totalPop -= pop_minus;

  const hpp = totalPop > 0 ? totalCost / totalPop : 0;

  sheet.appendRow([
    'BR-' + Utilities.getUuid(),
    new Date(),
    userId,
    obj.tanggal,
    jenis,
    populasi || (pop_minus ? -pop_minus : ''),
    mati || '',
    biaya || '',
    obj.pendapatan || '',
    Math.round(hpp),
    obj.keterangan || (jenis === 'MODAL' ? 'Pemasukan DOC' : '')
  ]);
  
  return JSON.stringify({ success: true });
}

function getBroilerExtended(userId, role) {
  const data = getSheet('broiler').getDataRange().getValues();
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
  return JSON.stringify(res);
}

function getDashboardDataExtended(userId, role) {
  const data = getSheet('broiler').getDataRange().getValues();
  let pop = 0, cost = 0, hpp = 0;
  
  if (data.length > 1) {
    for(let i=1; i<data.length; i++) {
      if(role === 'admin' || data[i][2] === userId) {
        cost += (Number(data[i][7]) || 0);
        pop += (Number(data[i][5]) || 0);
        pop -= (Number(data[i][6]) || 0);
        hpp = data[i][9]; // Ambil HPP baris terakhir yang diproses
      }
    }
  }
  
  return JSON.stringify({
    broiler: { populasi: pop, cost: cost, hpp: hpp }
  });
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