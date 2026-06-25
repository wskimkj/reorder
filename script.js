const API_URL = '여기에_Apps_Script_웹앱_exec_URL_넣기';

const productNameInput = document.getElementById('productName');
const productCodeInput = document.getElementById('productCode');
const colorInput = document.getElementById('color');

const searchButton = document.getElementById('searchButton');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const resultInfoEl = document.getElementById('resultInfo');
const lastUpdatedEl = document.getElementById('lastUpdated');
const toastEl = document.getElementById('toast');

let latestResults = [];
let currentStatusFilter = 'all';

searchButton.addEventListener('click', searchRestock);

document.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    searchRestock();
  }
});

document.querySelectorAll('.type-pill').forEach(function(pill) {
  pill.addEventListener('click', function() {
    document.querySelectorAll('.type-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');

    const input = pill.querySelector('input');
    if (input) {
      input.checked = true;
      currentStatusFilter = input.value;
    }

    renderResults(latestResults);
  });
});

document.querySelectorAll('.clear-btn').forEach(function(button) {
  button.addEventListener('click', function() {
    const targetId = button.dataset.clear;
    const target = document.getElementById(targetId);

    if (target) {
      target.value = '';
      target.focus();
      button.style.display = 'none';
    }
  });
});

[productNameInput, productCodeInput, colorInput].forEach(function(input) {
  input.addEventListener('input', function() {
    const clearButton = document.querySelector(`.clear-btn[data-clear="${input.id}"]`);
    if (clearButton) {
      clearButton.style.display = input.value.trim() ? 'block' : 'none';
    }
  });
});

async function searchRestock() {
  const productName = productNameInput.value.trim();
  const productCode = productCodeInput.value.trim();
  const color = colorInput.value.trim();

  if (!productName && !productCode && !color) {
    statusEl.textContent = '상품명, 상품코드 또는 컬러를 입력해주세요.';
    resultEl.innerHTML = '<div class="no-result">검색어가 없습니다.</div>';
    resultInfoEl.textContent = '0건';
    latestResults = [];
    return;
  }

  const params = new URLSearchParams({
    productName,
    productCode,
    color
  });

  searchButton.disabled = true;
  searchButton.textContent = '조회 중';
  statusEl.textContent = '생산팀 원본 시트에서 최신 데이터를 조회하고 있습니다...';
  resultEl.innerHTML = '<div class="no-result">조회 중...</div>';
  resultInfoEl.textContent = '-';
  lastUpdatedEl.textContent = '조회 중...';

  try {
    const response = await fetch(`${API_URL}?${params.toString()}`, {
      method: 'GET'
    });

    const data = await response.json();

    if (!data.success) {
      statusEl.textContent = data.message || '조회에 실패했습니다.';
      resultEl.innerHTML = '<div class="no-result">조회 결과가 없습니다.</div>';
      resultInfoEl.textContent = '0건';
      latestResults = [];
      return;
    }

    latestResults = data.results || [];

    statusEl.innerHTML = `<strong>${latestResults.length}건</strong> 조회 완료`;
    lastUpdatedEl.textContent = data.searchedAt ? `마지막 조회: ${data.searchedAt}` : '조회 완료';

    renderResults(latestResults);

  } catch (error) {
    console.error(error);
    statusEl.textContent = '오류가 발생했습니다. Apps Script 배포 URL 또는 권한 설정을 확인해주세요.';
    resultEl.innerHTML = '<div class="no-result">오류가 발생했습니다.</div>';
    resultInfoEl.textContent = '0건';
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = '조회';
  }
}

function renderResults(items) {
  const filtered = filterByStatus(items || []);

  resultInfoEl.textContent = `${filtered.length}건`;

  if (!filtered.length) {
    resultEl.innerHTML = '<div class="no-result">검색 결과가 없습니다.</div>';
    return;
  }

  resultEl.innerHTML = `
    <div class="result-table-wrap">
      <div class="result-scroll">
        <table>
          <thead>
            <tr>
              <th>상태</th>
              <th>대표 재입고일</th>
              <th>상품명</th>
              <th>상품코드</th>
              <th>컬러</th>
              <th>입고처</th>
              <th class="text-right">총 오더</th>
              <th class="text-right">1차</th>
              <th class="text-right">2차</th>
              <th class="text-right">3차</th>
              <th class="text-right">잔여</th>
              <th>JS공장</th>
              <th>주희물류</th>
              <th>원본시트</th>
              <th>원본</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(item => renderRow(item)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderRow(item) {
  const keyword = [
    productNameInput.value.trim(),
    productCodeInput.value.trim(),
    colorInput.value.trim()
  ].filter(Boolean).join('|');

  return `
    <tr>
      <td>${renderStatus(item.status)}</td>
      <td>${escapeHtml(item.mainRestockDate || '일정미정')}</td>
      <td>${highlightText(item.productName, keyword)}</td>
      <td>${highlightText(item.productCode, keyword)}</td>
      <td>${highlightText(item.color, keyword)}</td>
      <td>${escapeHtml(item.warehouse)}</td>
      <td class="text-right">${escapeHtml(item.totalOrderQty)}</td>
      <td class="text-right">${escapeHtml(item.firstQty)}</td>
      <td class="text-right">${escapeHtml(item.secondQty)}</td>
      <td class="text-right">${escapeHtml(item.thirdQty)}</td>
      <td class="text-right">${escapeHtml(item.remainingQty)}</td>
      <td>${escapeHtml(item.jsDate)}</td>
      <td>${escapeHtml(item.logisticsDate)}</td>
      <td>${escapeHtml(item.sourceSheet)} / ${escapeHtml(item.sourceRow)}행</td>
      <td><a class="source-link" href="${escapeAttribute(item.sourceUrl)}" target="_blank" rel="noopener">원본보기</a></td>
    </tr>
  `;
}

function renderStatus(status) {
  let cls = 'status-pill-unknown';

  if (status === '입고예정') {
    cls = 'status-pill-upcoming';
  } else if (status === '최근입고') {
    cls = 'status-pill-recent';
  }

  return `<span class="status-pill ${cls}">${escapeHtml(status || '확인필요')}</span>`;
}

function filterByStatus(items) {
  if (currentStatusFilter === 'all') return items;

  if (currentStatusFilter === '일정미정') {
    return items.filter(item => item.status === '일정미정' || item.status === '일정확인필요');
  }

  return items.filter(item => item.status === currentStatusFilter);
}

function highlightText(text, keywordPattern) {
  const base = escapeHtml(text || '');
  if (!keywordPattern) return base;

  const keywords = keywordPattern
    .split('|')
    .map(v => v.trim())
    .filter(Boolean);

  if (!keywords.length) return base;

  let highlighted = base;

  keywords.forEach(function(keyword) {
    const safeKeyword = escapeRegExp(escapeHtml(keyword));
    if (!safeKeyword) return;

    const regex = new RegExp(safeKeyword, 'gi');
    highlighted = highlighted.replace(regex, match => `<mark class="kw-mark">${match}</mark>`);
  });

  return highlighted;
}

function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function showToast(message) {
  if (!toastEl) return;

  toastEl.textContent = message;
  toastEl.classList.add('show');

  setTimeout(function() {
    toastEl.classList.remove('show');
  }, 1400);
}
