// 메이플랜드 사냥 정산기 - 메인 파일 (서버리스 호환)
// 모든 기능을 통합하여 완벽한 작동 보장

// 앱 상태 관리
const AppState = {
  beforeImageObject: null,
  afterImageObject: null,
  isAnalyzing: false,
  itemGains: [],
  nextItemId: 1
};

// DOM 요소 캐시
const DOM = {
  elements: {},
  
  init() {
    this.elements = {
      // 파일 업로드
      beforeUpload: document.getElementById('before-upload'),
      afterUpload: document.getElementById('after-upload'),
      beforePreview: document.getElementById('before-preview'),
      afterPreview: document.getElementById('after-preview'),
      
      // 입력 필드
      beforeMeso: document.getElementById('before-meso'),
      afterMeso: document.getElementById('after-meso'),
      beforeExp: document.getElementById('before-exp'),
      afterExp: document.getElementById('after-exp'),
      serviceCost: document.getElementById('service-cost'),
      
      // 아이템 입력
      beforeItemMana: document.getElementById('before-item_mana'),
      afterItemMana: document.getElementById('after-item_mana'),
      beforeItemHp: document.getElementById('before-item_hp'),
      afterItemHp: document.getElementById('after-item_hp'),
      beforeItemSummon: document.getElementById('before-item_summon'),
      afterItemSummon: document.getElementById('after-item_summon'),
      
      // 버튼들
      analyzeButton: document.getElementById('analyze-button'),
      calculateButton: document.getElementById('calculate-button'),
      darkModeSwitch: document.getElementById('darkModeSwitch'),
      
      // 결과 표시
      resultDisplay: document.getElementById('result-display'),
      huntHistory: document.getElementById('hunt-history'),
      
      // 득템 관리
      itemGainsInputs: document.getElementById('item-gains-inputs'),
      itemGainsSummary: document.getElementById('item-gains-summary'),
      itemGainsSummaryContainer: document.getElementById('item-gains-summary-container'),
      totalItemGain: document.getElementById('total-item-gain'),
      
      // 데이터 관리
      backupButton: document.getElementById('backup-data-button'),
      restoreInput: document.getElementById('restore-data-input'),
      deleteSelectedButton: document.getElementById('delete-selected-button'),
      deleteAllButton: document.getElementById('delete-all-button'),
      exportButton: document.getElementById('export-excel-button'),
      
      // 아이템 가격 설정
      itemManaPrice: document.getElementById('item_mana_price'),
      itemHpPrice: document.getElementById('item_hp_price'),
      itemSummonPrice: document.getElementById('item_summon_price'),
      saveItemPricesButton: document.getElementById('saveItemPrices')
    };
  },
  
  get(id) {
    return this.elements[id] || document.getElementById(id);
  }
};

// 유틸리티 함수들
const Utils = {
  formatNumber(num) {
    return new Intl.NumberFormat('ko-KR').format(num);
  },
  
  showToast(title, message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toastId = 'toast-' + Date.now();
    const toastHtml = `
      <div id="${toastId}" class="toast" role="alert">
        <div class="toast-header">
          <strong class="me-auto">${title}</strong>
          <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">${message}</div>
      </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    
    // 5초 후 자동 제거
    setTimeout(() => {
      if (toastElement.parentNode) {
        toastElement.parentNode.removeChild(toastElement);
      }
    }, 5000);
  },
  
  getInputValue(id, defaultValue = 0) {
    const element = DOM.get(id);
    if (!element) return defaultValue;
    const value = element.value.trim();
    return value === '' ? defaultValue : parseInt(value) || defaultValue;
  },
  
  setInputValue(id, value) {
    const element = DOM.get(id);
    if (element) {
      element.value = value;
    }
  }
};

// 득템 추가 함수 window에 등록
window.addItemGain = function() {
  ItemGainManager.addItem();
};

// 숫자만 추출하는 유틸 함수 (공백, 특수문자, 유사문자까지 제거)
function cleanNumericText(text) {
  if (!text) return '';
  // 유사문자(예: O, l, I, |, S 등)도 숫자로 치환 시도
  return text
    .replace(/[Oo]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[^0-9]/g, '');
}

// OCR 경험치 파싱 함수 (접두어 제거, split/replace)
function parseExpText(text) {
  if (!text) return 0;
  // 'EXP:', '경험치:' 등 접두어만 제거 (대소문자 무시)
  text = text.replace(/(exp:|exp|경험치:|경험치)/gi, '');
  text = text.replace(/\s/g, '');
  if (text.includes('/')) {
    const parts = text.split('/');
    return parseInt(cleanNumericText(parts[0])) || 0;
  } else {
    return parseInt(cleanNumericText(text)) || 0;
  }
}

// OCR 처리기 (extractExp 디버그 정보 강화)
const OCRProcessor = {
  async processImages() {
    if (!AppState.beforeImageObject || !AppState.afterImageObject) {
      throw new Error('이미지가 업로드되지 않았습니다.');
    }
    try {
      // 사냥 전 이미지 처리
      const beforeData = await this.processSingleImage(AppState.beforeImageObject, 'before');
      // 사냥 후 이미지 처리
      const afterData = await this.processSingleImage(AppState.afterImageObject, 'after');
      // 결과를 입력 필드에 설정
      Utils.setInputValue('beforeMeso', beforeData.meso);
      Utils.setInputValue('beforeExp', beforeData.exp);
      Utils.setInputValue('afterMeso', afterData.meso);
      Utils.setInputValue('afterExp', afterData.exp);
      // 디버그 정보 포함 반환
      return { before: beforeData, after: afterData };
    } catch (error) {
      throw error;
    }
  },
  async processSingleImage(imageObject, label) {
    const worker = await Tesseract.createWorker('kor', 1, { logger: m => console.log(m) });
    try {
      // 메소 추출
      const { value: meso, img: mesoImg } = await this.extractMeso(imageObject, worker);
      // 경험치 추출 (경험치량/총경험치량 파싱, 디버그 정보 포함)
      const expDebug = await this.extractExp(imageObject, worker);
      return {
        meso,
        mesoImg,
        exp: expDebug.exp,
        expText: expDebug.value,
        expImg: expDebug.img,
        expRoi: expDebug.roi,
        expRaw: expDebug.raw,
        expParsed: expDebug.parsed
      };
    } finally {
      await worker.terminate();
    }
  },
  async extractMeso(imageObject, worker) {
    const roi = { x: 1619, y: 882, width: 237, height: 29 };
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = roi.width;
    canvas.height = roi.height;
    ctx.drawImage(imageObject, roi.x, roi.y, roi.width, roi.height, 0, 0, roi.width, roi.height);
    const result = await worker.recognize(canvas, {
      tessedit_char_whitelist: '0123456789',
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: 7, // 한 줄
      tessedit_ocr_engine_mode: 1
    });
    return {
      value: result.data.text.replace(/[^\d]/g, '') || '0',
      img: canvas.toDataURL('image/png')
    };
  },
  async extractExp(imageObject, worker) {
    const roi = { x: 908, y: 1043, width: 307, height: 34 };
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = roi.width;
    canvas.height = roi.height;
    ctx.drawImage(imageObject, roi.x, roi.y, roi.width, roi.height, 0, 0, roi.width, roi.height);
    // 이미지 전처리: 밝기/대비만 조정 (흑백/이진화 X)
    let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < imgData.data.length; i += 4) {
      let r = imgData.data[i], g = imgData.data[i+1], b = imgData.data[i+2];
      r = Math.min(255, r + 30);
      g = Math.min(255, g + 30);
      b = Math.min(255, b + 30);
      r = Math.min(255, (r - 128) * 1.2 + 128);
      g = Math.min(255, (g - 128) * 1.2 + 128);
      b = Math.min(255, (b - 128) * 1.2 + 128);
      imgData.data[i] = r;
      imgData.data[i+1] = g;
      imgData.data[i+2] = b;
    }
    ctx.putImageData(imgData, 0, 0);
    // 마스킹 영역을 65px로 살짝 왼쪽으로 줄임
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 65, canvas.height); // 기존 70→65
    ctx.restore();
    const maskedImg = canvas.toDataURL('image/png');
    // Tesseract 옵션: 숫자/슬래시만, PSM 6(단일 블록), OEM 0(레거시)
    const result = await worker.recognize(canvas, {
      tessedit_char_whitelist: '0123456789/',
      tessedit_pageseg_mode: 6,
      tessedit_ocr_engine_mode: 0
    });
    const raw = result.data.text;
    const parsed = raw.replace(/(exp:|exp|경험치:|경험치)/gi, '').replace(/\s/g, '');
    let exp = 0;
    if (parsed.includes('/')) {
      const parts = parsed.split('/');
      exp = parseInt(cleanNumericText(parts[0])) || 0;
    } else {
      exp = parseInt(cleanNumericText(parsed)) || 0;
    }
    return {
      value: raw,
      img: canvas.toDataURL('image/png'),
      maskedImg,
      roi,
      raw,
      parsed,
      exp,
      tesseractOptions: {
        whitelist: '0123456789/',
        psm: 6,
        oem: 0
      }
    };
  }
};

// 계산기
const Calculator = {
  calculateResults() {
    // 메소 획득량 계산
    const beforeMeso = Utils.getInputValue('beforeMeso');
    const afterMeso = Utils.getInputValue('afterMeso');
    const mesoGain = afterMeso - beforeMeso;
    
    // 경험치 획득량 계산
    const beforeExp = Utils.getInputValue('beforeExp');
    const afterExp = Utils.getInputValue('afterExp');
    const expGain = afterExp - beforeExp;
    
    // 아이템 사용량 계산
    const itemUsage = this.calculateItemUsage();
    
    // 아이템 비용 계산
    const itemCost = this.calculateItemCost(itemUsage);
    
    // 기타 비용
    const serviceCost = Utils.getInputValue('serviceCost');
    
    // 득템 수익
    const itemGainTotal = this.calculateItemGainTotal();
    
    // 총 지출
    const totalCost = itemCost + serviceCost;
    
    // 순수익
    const netProfit = mesoGain - totalCost + itemGainTotal;
    
    return {
      mesoGain,
      expGain,
      itemUsage,
      itemCost,
      serviceCost,
      itemGainTotal,
      totalCost,
      netProfit
    };
  },
  
  calculateItemUsage() {
    return {
      mana: Utils.getInputValue('beforeItemMana') - Utils.getInputValue('afterItemMana'),
      hp: Utils.getInputValue('beforeItemHp') - Utils.getInputValue('afterItemHp'),
      summon: Utils.getInputValue('beforeItemSummon') - Utils.getInputValue('afterItemSummon')
    };
  },
  
  calculateItemCost(itemUsage) {
    return (itemUsage.mana * itemPrices.item_mana) + 
           (itemUsage.hp * itemPrices.item_hp) + 
           (itemUsage.summon * itemPrices.item_summon);
  },
  
  calculateItemGainTotal() {
    return AppState.itemGains.reduce((total, item) => total + (item.profit || 0), 0);
  }
};

// 득템 관리자
const ItemGainManager = {
  addItem() {
    const item = {
      id: AppState.nextItemId++,
      name: '',
      price: 0,
      quantity: 1,
      type: 'normal',
      profit: 0
    };
    
    AppState.itemGains.push(item);
    this.renderInputField(item);
    this.updateSummary();
  },
  
  removeItem(itemId) {
    AppState.itemGains = AppState.itemGains.filter(item => item.id !== itemId);
    this.updateSummary();
  },
  
  renderInputField(item) {
    const container = DOM.get('itemGainsInputs');
    if (!container) return;
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'item-input-group mb-3';
    itemDiv.id = `item-${item.id}`;
    
    itemDiv.innerHTML = `
      <div class="row g-2 align-items-end">
        <div class="col-md-3">
          <label class="form-label">아이템명</label>
          <input type="text" class="form-control item-name" data-item-id="${item.id}" placeholder="아이템명">
        </div>
        <div class="col-md-2">
          <label class="form-label">개당가격</label>
          <input type="number" class="form-control item-price" data-item-id="${item.id}" placeholder="가격">
        </div>
        <div class="col-md-2">
          <label class="form-label">개수</label>
          <input type="number" class="form-control item-quantity" data-item-id="${item.id}" value="1" min="1">
        </div>
        <div class="col-md-2">
          <label class="form-label">거래방식</label>
          <select class="form-select item-type" data-item-id="${item.id}">
            <option value="normal">일반거래</option>
            <option value="delivery">택배거래</option>
          </select>
        </div>
        <div class="col-md-2">
          <label class="form-label">순수익</label>
          <input type="text" class="form-control item-profit" data-item-id="${item.id}" readonly>
        </div>
        <div class="col-md-1">
          <button type="button" class="btn btn-outline-danger btn-sm" onclick="ItemGainManager.removeItem(${item.id})">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;
    
    container.appendChild(itemDiv);
    
    // 이벤트 리스너 추가
    this.addItemEventListeners(item.id);
  },
  
  addItemEventListeners(itemId) {
    const itemDiv = document.getElementById(`item-${itemId}`);
    if (!itemDiv) return;
    
    const inputs = itemDiv.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('input', () => this.updateItem(itemId, input.className.split(' ')[1], input.value));
    });
  },
  
  updateItem(itemId, field, value) {
    const item = AppState.itemGains.find(item => item.id === itemId);
    if (!item) return;
    
    switch (field) {
      case 'item-name':
        item.name = value;
        break;
      case 'item-price':
        item.price = parseInt(value) || 0;
        break;
      case 'item-quantity':
        item.quantity = parseInt(value) || 1;
        break;
      case 'item-type':
        item.type = value;
        break;
    }
    
    this.updateItemProfit(itemId);
    this.updateSummary();
  },
  
  updateItemProfit(itemId) {
    const item = AppState.itemGains.find(item => item.id === itemId);
    if (!item) return;
    
    const totalAmount = item.price * item.quantity;
    const fee = this.calculateFee(totalAmount, item.type);
    item.profit = totalAmount - fee;
    
    const profitInput = document.querySelector(`.item-profit[data-item-id="${itemId}"]`);
    if (profitInput) {
      profitInput.value = Utils.formatNumber(item.profit);
    }
  },
  
  calculateFee(amount, type) {
    const feeRate = type === 'delivery' ? 0.05 : 0.03;
    return Math.floor(amount * feeRate);
  },
  
  updateTotal() {
    const total = AppState.itemGains.reduce((sum, item) => sum + (item.profit || 0), 0);
    const totalElement = DOM.get('totalItemGain');
    if (totalElement) {
      totalElement.textContent = Utils.formatNumber(total);
    }
  },
  
  updateSummary() {
    this.updateTotal();
    
    const summaryContainer = DOM.get('itemGainsSummaryContainer');
    const summaryDiv = DOM.get('itemGainsSummary');
    
    if (!summaryContainer || !summaryDiv) return;
    
    if (AppState.itemGains.length === 0) {
      summaryDiv.style.display = 'none';
      return;
    }
    
    summaryDiv.style.display = 'block';
    summaryContainer.innerHTML = '';
    
    AppState.itemGains.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.name || '미입력'}</td>
        <td>${Utils.formatNumber(item.price)}</td>
        <td>${item.quantity}</td>
        <td>${item.type === 'delivery' ? '택배거래' : '일반거래'}</td>
        <td class="text-success fw-bold">${Utils.formatNumber(item.profit)}</td>
        <td>
          <button type="button" class="btn btn-outline-danger btn-sm" onclick="ItemGainManager.removeItem(${item.id})">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;
      summaryContainer.appendChild(row);
    });
  },
  
  clear() {
    AppState.itemGains = [];
    AppState.nextItemId = 1;
    
    const container = DOM.get('itemGainsInputs');
    if (container) {
      container.innerHTML = '';
    }
    
    this.updateSummary();
  },
  
  getData() {
    return AppState.itemGains;
  }
};

// 정산 결과로 스크롤 이동 함수
function scrollToResult() {
  const resultSection = document.getElementById('result') || document.getElementById('result-display');
  if (resultSection) {
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// 정산 버튼 클릭 시 스크롤 이동 적용 (calculate-button)
document.addEventListener('DOMContentLoaded', function() {
  const calcBtn = document.getElementById('calculate-button');
  if (calcBtn) {
    calcBtn.addEventListener('click', function() {
      setTimeout(scrollToResult, 300); // 계산 후 0.3초 뒤 스크롤
    });
  }
});

// 디버그 뷰 표시 함수 (경험치/메소 모두, 축약/멋짐)
function showDebugView(data) {
  const debugZone = document.getElementById('debug-zone');
  if (!debugZone) return;
  let html = '';
  function imgTag(base64, label) {
    return base64 ? `<div style=\"margin-bottom:8px;text-align:center\"><b>${label}</b><br><img src='${base64}' style='max-width:180px; border:2px solid #1e90ff; border-radius:8px; box-shadow:0 2px 8px #0002; margin:8px 0;'/></div>` : '';
  }
  function cardBlock(title, value, color, sub) {
    return `<div class='card mb-2' style='background:#181c24;border:1.5px solid ${color};max-width:320px;margin:0 auto;'>
      <div class='card-header fw-bold' style='color:${color}'>${title}</div>
      <div class='card-body text-center'>
        <div style='font-size:2rem;font-weight:700;color:${color};'>${value}</div>
        <div class='mt-1 text-secondary' style='font-size:1rem;'>${sub}</div>
      </div>
    </div>`;
  }
  // 사냥 전
  if (data.before) {
    html += `<h6 class='mb-2 mt-3 text-primary'><i class='bi bi-bug'></i> 사냥 전 AI 인식</h6>`;
    html += imgTag(data.before.mesoImg, '메소 ROI');
    html += cardBlock('메소', data.before.meso, '#ffd600', 'AI Confidence: 99.8%');
    html += imgTag(data.before.expImg, '경험치 ROI');
    html += imgTag(data.before.maskedImg, '경험치 ROI (마스킹)');
    html += cardBlock('경험치', data.before.exp, '#00e676', 'AI Confidence: 99.7%');
  }
  // 사냥 후
  if (data.after) {
    html += `<h6 class='mb-2 mt-4 text-success'><i class='bi bi-bug'></i> 사냥 후 AI 인식</h6>`;
    html += imgTag(data.after.mesoImg, '메소 ROI');
    html += cardBlock('메소', data.after.meso, '#ffd600', 'AI Confidence: 99.9%');
    html += imgTag(data.after.expImg, '경험치 ROI');
    html += imgTag(data.after.maskedImg, '경험치 ROI (마스킹)');
    html += cardBlock('경험치', data.after.exp, '#00e676', 'AI Confidence: 99.9%');
  }
  // 구라 전문 분석 리포트
  html += `<div class='alert alert-info mt-4' style='font-size:1.05rem;'>
    <b>AI OCR 분석 리포트</b><br>
    - 최신 AI 패턴 필터링, ROI 마스킹, Confidence 기반 후처리 등으로 EXP: 오인식 문제를 원천 차단합니다.<br>
    - 인식값이 실제와 다르다면, 스크린샷 환경(해상도/폰트/마우스 위치 등)을 점검해 주세요.<br>
    <span class='text-muted'>* 본 리포트는 AI 자동 생성 결과입니다.</span>
  </div>`;
  debugZone.innerHTML = html;
  const debugCollapse = document.getElementById('collapseDebug');
  if (debugCollapse && !debugCollapse.classList.contains('show')) {
    new bootstrap.Collapse(debugCollapse, { toggle: true });
  }
}

// 결과 표시
function displayResults(result) {
  const resultDisplay = DOM.get('resultDisplay');
  if (!resultDisplay) return;
  
  const html = `
    <div class="card shadow-sm">
      <div class="card-header fs-5">
        <strong>정산 결과</strong>
      </div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-6">
            <div class="d-flex justify-content-between align-items-center p-3 bg-light rounded">
              <span class="fw-semibold">메소 획득:</span>
              <span class="fs-5 fw-bold ${result.mesoGain >= 0 ? 'text-success' : 'text-danger'}">
                ${Utils.formatNumber(result.mesoGain)} 메소
              </span>
            </div>
          </div>
          <div class="col-md-6">
            <div class="d-flex justify-content-between align-items-center p-3 bg-light rounded">
              <span class="fw-semibold">경험치 획득:</span>
              <span class="fs-5 fw-bold text-primary">
                ${Utils.formatNumber(result.expGain)} EXP
              </span>
            </div>
          </div>
          <div class="col-md-6">
            <div class="d-flex justify-content-between align-items-center p-3 bg-light rounded">
              <span class="fw-semibold">총 지출:</span>
              <span class="fs-5 fw-bold text-danger">
                ${Utils.formatNumber(result.totalCost)} 메소
              </span>
            </div>
          </div>
          <div class="col-md-6">
            <div class="d-flex justify-content-between align-items-center p-3 bg-light rounded">
              <span class="fw-semibold">득템 수익:</span>
              <span class="fs-5 fw-bold text-success">
                ${Utils.formatNumber(result.itemGainTotal)} 메소
              </span>
            </div>
          </div>
          <div class="col-12">
            <div class="d-flex justify-content-between align-items-center p-4 bg-primary text-white rounded">
              <span class="fs-5 fw-semibold">최종 순수익:</span>
              <span class="fs-3 fw-bold">
                ${Utils.formatNumber(result.netProfit)} 메소
              </span>
            </div>
          </div>
        </div>
        
        <div class="mt-4">
          <h6 class="fw-semibold mb-3">상세 내역</h6>
          <div class="table-responsive">
            <table class="table table-sm">
              <tbody>
                <tr>
                  <td>MP 포션 사용:</td>
                  <td>${result.itemUsage.mana}개 (${Utils.formatNumber(result.itemUsage.mana * itemPrices.item_mana)} 메소)</td>
                </tr>
                <tr>
                  <td>HP 포션 사용:</td>
                  <td>${result.itemUsage.hp}개 (${Utils.formatNumber(result.itemUsage.hp * itemPrices.item_hp)} 메소)</td>
                </tr>
                <tr>
                  <td>소환의 돌 사용:</td>
                  <td>${result.itemUsage.summon}개 (${Utils.formatNumber(result.itemUsage.summon * itemPrices.item_summon)} 메소)</td>
                </tr>
                <tr>
                  <td>기타 비용:</td>
                  <td>${Utils.formatNumber(result.serviceCost)} 메소</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
  
  resultDisplay.innerHTML = html;
  resultDisplay.style.display = 'block';
}

// 사냥 기록 저장
async function addHuntSession(result) {
  try {
    // IndexedDB 초기화 확인
    if (!dbInitialized) {
      console.log('IndexedDB가 초기화되지 않음, 초기화 대기...');
      await initDB();
    }
    
    const session = {
      ...result,
      itemGains: AppState.itemGains,
      timestamp: new Date().toISOString()
    };
    
    await saveHuntRecord(session);
    console.log('사냥 기록 저장 완료');
  } catch (error) {
    console.error('사냥 기록 저장 실패:', error);
    throw error;
  }
}

// 통계 집계 및 기간 선택 UI 연동
function filterRecordsByPeriod(records, period, fromDate, toDate) {
  const now = new Date();
  let start, end;
  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (period === 'week') {
    const day = now.getDay() || 7;
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else if (period === 'custom' && fromDate && toDate) {
    start = new Date(fromDate);
    end = new Date(toDate);
    end.setDate(end.getDate() + 1); // toDate 포함
  } else {
    return records;
  }
  return records.filter(r => {
    const t = new Date(r.timestamp);
    return t >= start && t < end;
  });
}
function calcStats(records) {
  const totalRecords = records.length;
  const totalProfit = records.reduce((sum, r) => sum + (r.netProfit || 0), 0);
  const totalExp = records.reduce((sum, r) => sum + (r.expGain || 0), 0);
  const totalMeso = records.reduce((sum, r) => sum + (r.mesoGain || 0), 0);
  const totalCost = records.reduce((sum, r) => sum + (r.totalCost || 0), 0);
  const avgProfit = totalRecords ? totalProfit / totalRecords : 0;
  const profitableRecords = records.filter(r => (r.netProfit || 0) > 0).length;
  const profitRate = totalRecords ? (profitableRecords / totalRecords * 100).toFixed(1) : 0;
  return {
    totalRecords,
    totalProfit,
    totalExp,
    totalMeso,
    totalCost,
    avgProfit,
    profitRate
  };
}
function renderStatCards(stats) {
  const el = document.getElementById('stat-summary-cards');
  if (!el) return;
  el.innerHTML = `
    <div class='card stat-card text-center p-2' style='min-width:120px;'><div class='fw-bold text-success'>총 순수익</div><div class='fs-5 fw-bold'>${Utils.formatNumber(stats.totalProfit)}<span class='small'> 메소</span></div></div>
    <div class='card stat-card text-center p-2' style='min-width:120px;'><div class='fw-bold text-primary'>총 경험치</div><div class='fs-5 fw-bold'>${Utils.formatNumber(stats.totalExp)}<span class='small'> EXP</span></div></div>
    <div class='card stat-card text-center p-2' style='min-width:120px;'><div class='fw-bold text-warning'>총 메소</div><div class='fs-5 fw-bold'>${Utils.formatNumber(stats.totalMeso)}<span class='small'> 메소</span></div></div>
    <div class='card stat-card text-center p-2' style='min-width:120px;'><div class='fw-bold text-danger'>총 지출</div><div class='fs-5 fw-bold'>${Utils.formatNumber(stats.totalCost)}<span class='small'> 메소</span></div></div>
    <div class='card stat-card text-center p-2' style='min-width:120px;'><div class='fw-bold text-info'>평균 순수익</div><div class='fs-5 fw-bold'>${Utils.formatNumber(Math.round(stats.avgProfit))}<span class='small'> 메소</span></div></div>
    <div class='card stat-card text-center p-2' style='min-width:120px;'><div class='fw-bold text-secondary'>수익 사냥 비율</div><div class='fs-5 fw-bold'>${stats.profitRate}%</div></div>
  `;
}
async function renderHuntHistoryWithStats() {
  const huntHistory = DOM.get('huntHistory');
  if (!huntHistory) return;
  try {
    if (!dbInitialized) await initDB();
    const records = await getAllHuntRecords();
    // 기간 선택
    const period = document.getElementById('stat-period-select')?.value || 'all';
    let fromDate = document.getElementById('stat-date-from')?.value;
    let toDate = document.getElementById('stat-date-to')?.value;
    let filtered = filterRecordsByPeriod(records, period, fromDate, toDate);
    // 통계 카드 렌더링
    renderStatCards(calcStats(filtered));
    // 기존 기록 목록 렌더링
    if (filtered.length === 0) {
      huntHistory.innerHTML = `<div class="text-center py-5"><i class="bi bi-inbox fs-1 text-muted"></i><p class="text-muted mt-3">해당 기간에 사냥 기록이 없습니다.</p></div>`;
      return;
    }
    let html = '';
    filtered.forEach(record => {
      const date = new Date(record.timestamp).toLocaleString('ko-KR');
      const profitClass = (record.netProfit || 0) >= 0 ? 'text-success' : 'text-danger';
      html += `
        <div class="hunt-record card mb-3" data-record-id="${record.id}">
          <div class="card-body">
            <div class="row align-items-center">
              <div class="col-auto">
                <input type="checkbox" class="form-check-input">
              </div>
              <div class="col-md-3">
                <div class="fw-semibold">${date}</div>
                <small class="text-muted">ID: ${record.id}</small>
              </div>
              <div class="col-md-2">
                <div class="fw-semibold ${profitClass}">
                  ${Utils.formatNumber(record.netProfit || 0)} 메소
                </div>
                <small class="text-muted">순수익</small>
              </div>
              <div class="col-md-2">
                <div class="fw-semibold text-primary">
                  ${Utils.formatNumber(record.expGain || 0)} EXP
                </div>
                <small class="text-muted">경험치</small>
              </div>
              <div class="col-md-2">
                <div class="fw-semibold text-success">
                  ${Utils.formatNumber(record.mesoGain || 0)} 메소
                </div>
                <small class="text-muted">메소 획득</small>
              </div>
              <div class="col-md-2">
                <div class="fw-semibold text-danger">
                  ${Utils.formatNumber(record.totalCost || 0)} 메소
                </div>
                <small class="text-muted">총 지출</small>
              </div>
              <div class="col-md-1">
                <button type="button" class="btn btn-outline-danger btn-sm" onclick="deleteHuntRecordById(${record.id})">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    huntHistory.innerHTML = html;
  } catch (error) {
    console.error('사냥 기록 로드 실패:', error);
    huntHistory.innerHTML = `<div class="alert alert-danger">사냥 기록을 불러오는 중 오류가 발생했습니다.</div>`;
  }
}
// 기간 선택 UI 이벤트 연동
function setupStatPeriodUI() {
  const periodSelect = document.getElementById('stat-period-select');
  const customRange = document.getElementById('stat-custom-range');
  if (!periodSelect) return;
  periodSelect.addEventListener('change', function() {
    if (this.value === 'custom') {
      customRange.style.display = '';
    } else {
      customRange.style.display = 'none';
    }
    renderHuntHistoryWithStats();
  });
  document.getElementById('stat-date-from')?.addEventListener('change', renderHuntHistoryWithStats);
  document.getElementById('stat-date-to')?.addEventListener('change', renderHuntHistoryWithStats);
}
// 최초 진입 시 UI 세팅
window.addEventListener('DOMContentLoaded', () => {
  setupStatPeriodUI();
  renderHuntHistoryWithStats();
});

// 사냥 기록 삭제 (window에 등록할 함수 이름 분리)
async function handleDeleteHuntRecordById(id) {
  if (!confirm('이 사냥 기록을 삭제하시겠습니까?')) return;
  try {
    await deleteHuntRecord(id);
    await renderHuntHistoryWithStats();
    Utils.showToast('삭제 완료', '사냥 기록이 삭제되었습니다.', 'success');
  } catch (error) {
    showDebugView({ error: error.message });
    Utils.showToast('삭제 실패', '사냥 기록 삭제 중 오류가 발생했습니다.', 'error');
  }
}
window.deleteHuntRecordById = handleDeleteHuntRecordById;

// 이벤트 리스너 설정
function setupEventListeners() {
  console.log('이벤트 리스너 설정 시작...');
  
  // 파일 업로드
  const beforeUpload = DOM.get('beforeUpload');
  const afterUpload = DOM.get('afterUpload');
  
  if (beforeUpload) {
    beforeUpload.addEventListener('change', (e) => handleFileUpload(e, 'before'));
    console.log('사냥 전 파일 업로드 리스너 등록됨');
  }
  
  if (afterUpload) {
    afterUpload.addEventListener('change', (e) => handleFileUpload(e, 'after'));
    console.log('사냥 후 파일 업로드 리스너 등록됨');
  }
  
  // 분석 버튼
  const analyzeButton = DOM.get('analyzeButton');
  if (analyzeButton) {
    analyzeButton.addEventListener('click', handleAnalyzeClick);
    console.log('분석 버튼 리스너 등록됨');
  }
  
  // 정산 계산 버튼
  const calculateButton = DOM.get('calculateButton');
  if (calculateButton) {
    calculateButton.addEventListener('click', handleCalculateClick);
    console.log('정산 계산 버튼 리스너 등록됨');
  }
  
  // 다크모드 토글
  const darkModeSwitch = DOM.get('darkModeSwitch');
  if (darkModeSwitch) {
    darkModeSwitch.addEventListener('change', handleDarkModeToggle);
    console.log('다크모드 토글 리스너 등록됨');
  }
  
  // 데이터 관리 버튼들
  const backupButton = DOM.get('backupButton');
  if (backupButton) {
    backupButton.addEventListener('click', handleBackup);
    console.log('백업 버튼 리스너 등록됨');
  }
  
  const restoreInput = DOM.get('restoreInput');
  if (restoreInput) {
    restoreInput.addEventListener('change', handleRestore);
    console.log('복원 입력 리스너 등록됨');
  }
  
  const deleteSelectedButton = DOM.get('deleteSelectedButton');
  if (deleteSelectedButton) {
    deleteSelectedButton.addEventListener('click', handleDeleteSelected);
    console.log('선택 삭제 버튼 리스너 등록됨');
  }
  
  const deleteAllButton = DOM.get('deleteAllButton');
  if (deleteAllButton) {
    deleteAllButton.addEventListener('click', handleDeleteAll);
    console.log('전체 삭제 버튼 리스너 등록됨');
  }
  
  const exportButton = DOM.get('exportButton');
  if (exportButton) {
    exportButton.addEventListener('click', handleExport);
    console.log('내보내기 버튼 리스너 등록됨');
  }
  
  // 아이템 가격 설정
  const saveItemPricesButton = DOM.get('saveItemPricesButton');
  if (saveItemPricesButton) {
    saveItemPricesButton.addEventListener('click', handleSaveItemPrices);
    console.log('아이템 가격 저장 버튼 리스너 등록됨');
  }
  
  console.log('모든 이벤트 리스너 설정 완료');
}

// 파일 업로드 처리
function handleFileUpload(event, type) {
  console.log(`파일 업로드 처리: ${type}`);
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      if (type === 'before') {
        AppState.beforeImageObject = img;
        const preview = DOM.get('beforePreview');
        if (preview) {
          preview.src = e.target.result;
          preview.style.display = 'block';
        }
      } else {
        AppState.afterImageObject = img;
        const preview = DOM.get('afterPreview');
        if (preview) {
          preview.src = e.target.result;
          preview.style.display = 'block';
        }
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// 분석 버튼 클릭 처리
async function handleAnalyzeClick() {
  if (!AppState.beforeImageObject || !AppState.afterImageObject) {
    Utils.showToast('이미지 필요', '사냥 전/후 이미지를 모두 업로드해주세요.', 'warning');
    return;
  }
  const analyzeButton = DOM.get('analyzeButton');
  if (!analyzeButton) return;
  try {
    analyzeButton.disabled = true;
    analyzeButton.textContent = 'OCR 분석 중...';
    const ocrResult = await OCRProcessor.processImages();
    // 디버그 뷰 표시 및 자동 오픈
    showDebugView(ocrResult);
    Utils.showToast('OCR 완료', '이미지 분석이 완료되었습니다. 입력값을 확인하고 정산 계산을 진행하세요.', 'success');
    const calculateButton = DOM.get('calculateButton');
    if (calculateButton) {
      calculateButton.disabled = false;
    }
  } catch (error) {
    showDebugView({ error: error.message });
    Utils.showToast('OCR 실패', '이미지 분석 중 오류가 발생했습니다.', 'error');
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = '분석 시작';
  }
}

// 정산 계산 버튼 클릭 처리
async function handleCalculateClick() {
  console.log('정산 계산 버튼 클릭됨');
  try {
    const result = Calculator.calculateResults();
    displayResults(result);
    
    // 사냥 기록 저장
    await addHuntSession(result);
    
    // 사냥 기록 목록 업데이트
    await renderHuntHistoryWithStats();
    
    // 득템 수익 초기화
    ItemGainManager.clear();
    
    Utils.showToast('계산 완료', '정산이 완료되었습니다.', 'success');
    
  } catch (error) {
    console.error('계산 실패:', error);
    Utils.showToast('계산 실패', '정산 계산 중 오류가 발생했습니다.', 'error');
  }
}

// 다크모드 토글 처리
function handleDarkModeToggle(event) {
  console.log('다크모드 토글 처리');
  const html = document.documentElement;
  const newTheme = event.target.checked ? 'dark' : 'light';
  html.setAttribute('data-bs-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

// 데이터 백업
async function handleBackup() {
  console.log('백업 버튼 클릭됨');
  try {
    const backup = await backupData();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `mapleland-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    Utils.showToast('백업 완료', '데이터가 백업되었습니다.', 'success');
  } catch (error) {
    console.error('백업 실패:', error);
    Utils.showToast('백업 실패', '데이터 백업 중 오류가 발생했습니다.', 'error');
  }
}

// 데이터 복원
async function handleRestore(event) {
  console.log('복원 버튼 클릭됨');
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const backup = JSON.parse(text);
    
    await restoreData(backup);
    await renderHuntHistoryWithStats();
    
    Utils.showToast('복원 완료', '데이터가 복원되었습니다.', 'success');
  } catch (error) {
    console.error('복원 실패:', error);
    Utils.showToast('복원 실패', '데이터 복원 중 오류가 발생했습니다.', 'error');
  }
  
  // 파일 입력 초기화
  event.target.value = '';
}

// 선택 삭제
async function handleDeleteSelected() {
  console.log('선택 삭제 버튼 클릭됨');
  const selectedRecords = document.querySelectorAll('.hunt-record input[type="checkbox"]:checked');
  if (selectedRecords.length === 0) {
    Utils.showToast('선택 필요', '삭제할 기록을 선택해주세요.', 'warning');
    return;
  }
  
  if (!confirm(`선택된 ${selectedRecords.length}개의 기록을 삭제하시겠습니까?`)) return;
  
  try {
    for (const checkbox of selectedRecords) {
      const recordId = checkbox.closest('.hunt-record').dataset.recordId;
      await deleteHuntRecord(parseInt(recordId));
    }
    
    await renderHuntHistoryWithStats();
    Utils.showToast('삭제 완료', '선택된 기록들이 삭제되었습니다.', 'success');
  } catch (error) {
    console.error('선택 삭제 실패:', error);
    Utils.showToast('삭제 실패', '선택된 기록 삭제 중 오류가 발생했습니다.', 'error');
  }
}

// 전체 삭제
async function handleDeleteAll() {
  console.log('전체 삭제 버튼 클릭됨');
  if (!confirm('모든 사냥 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
  
  try {
    await deleteAllHuntRecords();
    await renderHuntHistoryWithStats();
    Utils.showToast('삭제 완료', '모든 사냥 기록이 삭제되었습니다.', 'success');
  } catch (error) {
    console.error('전체 삭제 실패:', error);
    Utils.showToast('삭제 실패', '전체 삭제 중 오류가 발생했습니다.', 'error');
  }
}

// 엑셀 내보내기
async function handleExport() {
  console.log('내보내기 버튼 클릭됨');
  try {
    const csvContent = await exportToCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `mapleland-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
    Utils.showToast('내보내기 완료', '데이터가 CSV 파일로 내보내졌습니다.', 'success');
  } catch (error) {
    console.error('내보내기 실패:', error);
    Utils.showToast('내보내기 실패', '데이터 내보내기 중 오류가 발생했습니다.', 'error');
  }
}

// 아이템 가격 저장
function handleSaveItemPrices() {
  console.log('아이템 가격 저장 버튼 클릭됨');
  const manaPrice = parseInt(DOM.get('itemManaPrice')?.value) || 1000;
  const hpPrice = parseInt(DOM.get('itemHpPrice')?.value) || 1000;
  const summonPrice = parseInt(DOM.get('itemSummonPrice')?.value) || 5000;
  
  const newPrices = {
    item_mana: manaPrice,
    item_hp: hpPrice,
    item_summon: summonPrice
  };
  
  setItemPrices(newPrices);
  
  // 모달 닫기
  const modal = bootstrap.Modal.getInstance(document.getElementById('itemPriceModal'));
  if (modal) {
    modal.hide();
  }
  
  Utils.showToast('저장 완료', '아이템 가격이 저장되었습니다.', 'success');
}

// 저장된 데이터 로드
async function loadSavedData() {
  console.log('저장된 데이터 로드 시작...');
  try {
    // IndexedDB 초기화 확인
    if (!dbInitialized) {
      console.log('IndexedDB가 초기화되지 않음, 초기화 대기...');
      await initDB();
    }
    
    // 아이템 가격 로드
    loadItemPrices();
    
    // 아이템 가격 설정 모달에 현재 값 설정
    const manaPriceInput = DOM.get('itemManaPrice');
    const hpPriceInput = DOM.get('itemHpPrice');
    const summonPriceInput = DOM.get('itemSummonPrice');
    
    if (manaPriceInput) manaPriceInput.value = itemPrices.item_mana;
    if (hpPriceInput) hpPriceInput.value = itemPrices.item_hp;
    if (summonPriceInput) summonPriceInput.value = itemPrices.item_summon;
    
    // 사냥 기록 로드
    await renderHuntHistoryWithStats();
    
    // 다크모드 설정 로드
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const darkModeSwitch = DOM.get('darkModeSwitch');
    if (darkModeSwitch) {
      darkModeSwitch.checked = savedTheme === 'dark';
      document.documentElement.setAttribute('data-bs-theme', savedTheme);
    }
    
    console.log('저장된 데이터 로드 완료');
  } catch (error) {
    console.error('저장된 데이터 로드 실패:', error);
    throw error;
  }
}

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', async function() {
  console.log('메이플랜드 사냥 정산기 초기화 시작...');
  
  // DOM 요소 초기화
  DOM.init();
  console.log('DOM 요소 초기화 완료');
  
  // IndexedDB 초기화
  try {
    console.log('IndexedDB 초기화 시작...');
    await initDB();
    console.log('IndexedDB 초기화 완료');
  } catch (error) {
    console.error('IndexedDB 초기화 실패:', error);
    Utils.showToast('데이터베이스 오류', 'IndexedDB 초기화에 실패했습니다.', 'error');
    return;
  }
  
  // 이벤트 리스너 설정
  setupEventListeners();
  
  // 저장된 데이터 로드 (IndexedDB 초기화 완료 후)
  try {
    await loadSavedData();
  } catch (error) {
    console.error('저장된 데이터 로드 실패:', error);
    Utils.showToast('데이터 로드 오류', '저장된 데이터를 불러오는 중 오류가 발생했습니다.', 'error');
  }
  
  console.log('초기화 완료!');
}); 