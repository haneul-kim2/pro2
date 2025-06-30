// js/config.js - 설정 및 데이터베이스 통합 모듈 (서버리스 호환)

// OCR 설정
const rois = {
  meso: { x: 1050, y: 50, width: 200, height: 30 },
  exp: { x: 1050, y: 90, width: 200, height: 30 }
};

// 아이템 가격 설정
let itemPrices = { 
  item_mana: 480, 
  item_hp: 480, 
  item_summon: 150000 
};

// 아이템 표시명
const itemDisplayNames = { 
  item_mana: 'MP 포션', 
  item_hp: 'HP 포션', 
  item_summon: '소환의 돌' 
};

// 아이템 가격 설정 함수
function setItemPrices(newPrices) {
  itemPrices = newPrices;
  localStorage.setItem('mapleland-item-prices', JSON.stringify(itemPrices));
}

// 저장된 아이템 가격 로드
function loadItemPrices() {
  const saved = localStorage.getItem('mapleland-item-prices');
  if (saved) {
    try {
      itemPrices = JSON.parse(saved);
    } catch (e) {
      console.error('아이템 가격 로드 실패:', e);
    }
  }
  return itemPrices;
}

// IndexedDB 설정
const DB_NAME = 'MaplelandHuntDB';
const STORE_NAME = 'hunt_records';
let db = null;
let dbInitialized = false;

/**
 * IndexedDB 초기화
 */
function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInitialized && db) {
      resolve(db);
      return;
    }
    
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = () => {
      console.error('IndexedDB 열기 실패:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      db = request.result;
      dbInitialized = true;
      console.log('IndexedDB 초기화 완료');
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      console.log('IndexedDB 업그레이드 필요');
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        console.log('hunt_records 객체 저장소 생성');
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * DB 상태 확인
 */
function ensureDB() {
  if (!dbInitialized || !db) {
    throw new Error('IndexedDB가 초기화되지 않았습니다. initDB()를 먼저 호출하세요.');
  }
}

/**
 * 사냥 기록 저장
 */
function saveHuntRecord(recordData) {
  return new Promise((resolve, reject) => {
    try {
      ensureDB();
      
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const record = {
        ...recordData,
        timestamp: new Date().toISOString()
      };
      
      const request = store.add(record);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 모든 사냥 기록 조회
 */
function getAllHuntRecords() {
  return new Promise((resolve, reject) => {
    try {
      ensureDB();
      
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const records = request.result;
        records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        resolve(records);
      };
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 특정 사냥 기록 삭제
 */
function deleteHuntRecord(id) {
  return new Promise((resolve, reject) => {
    try {
      ensureDB();
      
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(parseInt(id));
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 모든 사냥 기록 삭제
 */
function deleteAllHuntRecords() {
  return new Promise((resolve, reject) => {
    try {
      ensureDB();
      
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * CSV 파일로 데이터 내보내기
 */
async function exportToCSV() {
  try {
    const records = await getAllHuntRecords();
    
    if (records.length === 0) {
      throw new Error('내보낼 기록이 없습니다.');
    }
    
    // CSV 헤더
    let csvContent = '날짜,순수익,획득 경험치,메소 획득량,총 지출,MP 포션,HP 포션,소환의 돌,기타 비용,득템 수익\n';
    
    // CSV 데이터
    records.forEach(record => {
      const date = new Date(record.timestamp).toLocaleString('ko-KR');
      const row = [
        date,
        record.netProfit || 0,
        record.expGain || 0,
        record.mesoGain || 0,
        record.totalCost || 0,
        record.itemUsage?.mana || 0,
        record.itemUsage?.hp || 0,
        record.itemUsage?.summon || 0,
        record.serviceCost || 0,
        record.itemGainTotal || 0
      ].join(',');
      csvContent += row + '\n';
    });
    
    // 통계 계산
    const totalRecords = records.length;
    const totalProfit = records.reduce((sum, r) => sum + (r.netProfit || 0), 0);
    const totalExp = records.reduce((sum, r) => sum + (r.expGain || 0), 0);
    const avgProfit = totalProfit / totalRecords;
    const profitableRecords = records.filter(r => (r.netProfit || 0) > 0).length;
    const profitRate = (profitableRecords / totalRecords * 100).toFixed(1);
    
    // 통계 CSV 추가
    csvContent += '\n=== 통계 ===\n';
    csvContent += '총 사냥 횟수,총 순수익,총 경험치,평균 순수익,수익 사냥 비율\n';
    csvContent += `${totalRecords},${totalProfit},${totalExp},${Math.round(avgProfit)},${profitRate}%\n`;
    
    return csvContent;
    
  } catch (error) {
    console.error('CSV 내보내기 실패:', error);
    throw error;
  }
}

/**
 * 데이터 백업
 */
function backupData() {
  return getAllHuntRecords().then(records => {
    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      records: records,
      itemPrices: itemPrices
    };
    return backup;
  });
}

/**
 * 데이터 복원
 */
function restoreData(backupData) {
  return new Promise((resolve, reject) => {
    try {
      ensureDB();
      
      if (!backupData.records || !Array.isArray(backupData.records)) {
        reject(new Error('잘못된 백업 데이터 형식입니다.'));
        return;
      }
      
      // 기존 데이터 삭제 후 복원
      deleteAllHuntRecords().then(() => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const promises = backupData.records.map(record => {
          return new Promise((res, rej) => {
            const request = store.add(record);
            request.onsuccess = () => res();
            request.onerror = () => rej(request.error);
          });
        });
        
        Promise.all(promises).then(() => {
          // 아이템 가격도 복원
          if (backupData.itemPrices) {
            setItemPrices(backupData.itemPrices);
          }
          resolve();
        }).catch(reject);
      }).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
}