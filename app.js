/**
 * Trackendance - College Attendance Tracker
 * Complete Implementation: Phases 1 through 11 (Feature Complete & Zero-Lag)
 * 
 * Features:
 * - Phase 1: Clean responsive UI, Dashboard metrics, LocalStorage data persistence
 * - Phase 2: Official baseline configuration & Subject management
 * - Phase 3: Daily attendance logging (No fixed timetable, multi-subject, quick steppers)
 * - Phase 4: Mathematically correct automatic calculations (Subject-wise & Overall ratio)
 * - Phase 5: Attendance history with Daily, Weekly, and Monthly grouping, plus Edit/Delete
 * - Phase 6: Attendance Analytics with native SVG Donut, Weekly Bar Chart, and Comparison Bars
 * - Phase 7: Mathematically exact Attendance Prediction (Target Recovery & Buffer margin) + What-If Simulator
 * - Phase 8: Weekly Official Sync with snapshot archiving and double-counting prevention
 * - Phase 9: Official Spreadsheet Import (Excel .xlsx, .xls, .csv & table paste) with mapping preview
 * - Phase 10: PWA installability & Service Worker offline caching
 * - Phase 11: Optional daily attendance reminders with configurable schedule & test trigger
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. CONSTANTS & STORAGE KEYS
  // =========================================================================
  const STORAGE_KEYS = {
    SETTINGS: 'trackendance_settings',
    SUBJECTS: 'trackendance_subjects',
    BASELINE: 'trackendance_baseline',
    RECORDS: 'trackendance_records',
    SYNC_HISTORY: 'trackendance_sync_history'
  };

  const DEFAULT_SETTINGS = {
    targetPercentage: 75,
    collegeName: '',
    notificationsEnabled: false,
    notificationTime: '17:00',
    lastNotificationDate: ''
  };

  // Seed data matching user prompt examples (DSD 21/22, Network 18/20, VLSI 15/18)
  const SEED_DATA = {
    settings: {
      targetPercentage: 75,
      collegeName: 'Electronics & Communication Eng - Sem 5',
      notificationsEnabled: false,
      notificationTime: '17:00',
      lastNotificationDate: ''
    },
    subjects: [
      { id: 'dsd', name: 'Digital System Design', code: 'DSD' },
      { id: 'ns', name: 'Network & Systems', code: 'NS' },
      { id: 'vlsi', name: 'VLSI Design', code: 'VLSI' }
    ],
    baseline: {
      lastSyncedDate: getRelativeDateString(-7), // 1 week ago
      data: {
        dsd: { attended: 21, conducted: 22 },
        ns: { attended: 18, conducted: 20 },
        vlsi: { attended: 15, conducted: 18 }
      }
    },
    records: [
      {
        id: 'rec_1',
        date: getRelativeDateString(-2),
        subjectId: 'dsd',
        attended: 2,
        conducted: 2,
        note: 'Sequential logic circuits'
      },
      {
        id: 'rec_2',
        date: getRelativeDateString(-2),
        subjectId: 'ns',
        attended: 1,
        conducted: 1,
        note: 'Two-port parameters'
      },
      {
        id: 'rec_3',
        date: getRelativeDateString(-2),
        subjectId: 'vlsi',
        attended: 0,
        conducted: 1,
        note: 'CMOS fabrication'
      },
      {
        id: 'rec_4',
        date: getRelativeDateString(-1),
        subjectId: 'dsd',
        attended: 1,
        conducted: 2,
        note: 'Lab test & viva'
      },
      {
        id: 'rec_5',
        date: getRelativeDateString(-1),
        subjectId: 'ns',
        attended: 1,
        conducted: 1,
        note: 'Filter design'
      }
    ],
    syncHistory: [
      {
        id: 'sync_init',
        syncDate: getRelativeDateString(-7),
        timestamp: new Date(Date.now() - 7 * 86400000).toISOString(),
        note: 'Initial official college baseline sync',
        data: {
          dsd: { attended: 21, conducted: 22 },
          ns: { attended: 18, conducted: 20 },
          vlsi: { attended: 15, conducted: 18 }
        }
      }
    ]
  };

  // =========================================================================
  // 2. APPLICATION STATE
  // =========================================================================
  let state = {
    settings: { ...DEFAULT_SETTINGS },
    subjects: [],
    baseline: { lastSyncedDate: '', data: {} },
    records: [],
    syncHistory: [],
    currentTab: 'dashboard',
    currentSyncSubview: 'sync-weekly',
    historyGrouping: 'daily',
    historySubjectFilter: 'all',
    dailySelectedDate: getTodayDateString(),
    parsedExcelRows: [],
    whatIfSimulations: {}
  };

  let deferredInstallPrompt = null;
  let swRegistration = null;

  // =========================================================================
  // 3. DATE UTILITIES
  // =========================================================================
  function getTodayDateString() {
    const today = new Date();
    return formatIsoDate(today);
  }

  function getRelativeDateString(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return formatIsoDate(d);
  }

  function formatIsoDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDisplayDate(isoDateString) {
    if (!isoDateString) return 'N/A';
    try {
      const parts = isoDateString.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        const todayStr = getTodayDateString();
        const yesterdayStr = getRelativeDateString(-1);

        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        const formatted = d.toLocaleDateString(undefined, options);

        if (isoDateString === todayStr) return `Today (${formatted})`;
        if (isoDateString === yesterdayStr) return `Yesterday (${formatted})`;
        return formatted;
      }
    } catch (e) {
      console.error('Date parse error', e);
    }
    return isoDateString;
  }

  function getWeekIdentifier(isoDateString) {
    const d = new Date(isoDateString);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const monStr = monday.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const sunStr = sunday.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    return `Week (${monStr} – ${sunStr})`;
  }

  function getMonthIdentifier(isoDateString) {
    const parts = isoDateString.split('-');
    if (parts.length >= 2) {
      const d = new Date(parts[0], parts[1] - 1, 1);
      return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    return isoDateString;
  }

  // =========================================================================
  // 4. STORAGE MANAGER
  // =========================================================================
  function loadState() {
    try {
      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const storedSubjects = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
      const storedBaseline = localStorage.getItem(STORAGE_KEYS.BASELINE);
      const storedRecords = localStorage.getItem(STORAGE_KEYS.RECORDS);
      const storedSyncHistory = localStorage.getItem(STORAGE_KEYS.SYNC_HISTORY);

      if (storedSubjects && storedBaseline) {
        state.settings = storedSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) } : { ...DEFAULT_SETTINGS };
        state.subjects = JSON.parse(storedSubjects);
        state.baseline = JSON.parse(storedBaseline);
        state.records = storedRecords ? JSON.parse(storedRecords) : [];
        state.syncHistory = storedSyncHistory ? JSON.parse(storedSyncHistory) : [];
      } else {
        loadSeedData();
      }
    } catch (err) {
      console.error('Error loading data from localStorage, falling back to seed:', err);
      loadSeedData();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(state.subjects));
      localStorage.setItem(STORAGE_KEYS.BASELINE, JSON.stringify(state.baseline));
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(state.records));
      localStorage.setItem(STORAGE_KEYS.SYNC_HISTORY, JSON.stringify(state.syncHistory));
    } catch (err) {
      console.error('Error saving state to localStorage:', err);
      showToast('Error saving data to local storage');
    }
  }

  function loadSeedData() {
    state.settings = JSON.parse(JSON.stringify(SEED_DATA.settings));
    state.subjects = JSON.parse(JSON.stringify(SEED_DATA.subjects));
    state.baseline = JSON.parse(JSON.stringify(SEED_DATA.baseline));
    state.records = JSON.parse(JSON.stringify(SEED_DATA.records));
    state.syncHistory = JSON.parse(JSON.stringify(SEED_DATA.syncHistory));
    saveState();
  }

  function clearAllStorage() {
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.SUBJECTS);
    localStorage.removeItem(STORAGE_KEYS.BASELINE);
    localStorage.removeItem(STORAGE_KEYS.RECORDS);
    localStorage.removeItem(STORAGE_KEYS.SYNC_HISTORY);
    state.settings = { ...DEFAULT_SETTINGS };
    state.subjects = [];
    state.baseline = { lastSyncedDate: getTodayDateString(), data: {} };
    state.records = [];
    state.syncHistory = [];
  }

  // =========================================================================
  // 5. CALCULATION ENGINE (Phases 4, 7, 8)
  // =========================================================================
  function calculateMetrics() {
    let overallAttended = 0;
    let overallConducted = 0;
    const subjectMetrics = {};
    const cutoff = state.baseline.lastSyncedDate;

    // Daily records strictly after baseline cutoff date
    const activeRecords = cutoff 
      ? state.records.filter(r => r.date > cutoff) 
      : state.records;

    state.subjects.forEach(sub => {
      const base = (state.baseline.data && state.baseline.data[sub.id]) || { attended: 0, conducted: 0 };
      const subRecords = activeRecords.filter(r => r.subjectId === sub.id);

      const dailyAttended = subRecords.reduce((sum, r) => sum + Number(r.attended || 0), 0);
      const dailyConducted = subRecords.reduce((sum, r) => sum + Number(r.conducted || 0), 0);

      const totalAttended = Number(base.attended || 0) + dailyAttended;
      const totalConducted = Number(base.conducted || 0) + dailyConducted;
      const missed = totalConducted - totalAttended;

      const percentage = totalConducted > 0 
        ? Math.round((totalAttended / totalConducted) * 10000) / 100 
        : 100;

      subjectMetrics[sub.id] = {
        subject: sub,
        baseAttended: Number(base.attended || 0),
        baseConducted: Number(base.conducted || 0),
        dailyAttended,
        dailyConducted,
        totalAttended,
        totalConducted,
        missed: Math.max(0, missed),
        percentage
      };

      overallAttended += totalAttended;
      overallConducted += totalConducted;
    });

    const overallPercentage = overallConducted > 0
      ? Math.round((overallAttended / overallConducted) * 10000) / 100
      : 100;
    const overallMissed = Math.max(0, overallConducted - overallAttended);

    return {
      overallAttended,
      overallConducted,
      overallMissed,
      overallPercentage,
      subjectMetrics,
      targetPercentage: state.settings.targetPercentage || 75
    };
  }

  function getStatusClass(percentage, target) {
    if (percentage >= target) return 'safe';
    if (percentage >= target - 5) return 'warning';
    return 'danger';
  }

  function getStatusBadgeText(percentage, target) {
    if (percentage >= target) {
      return `Safe (${percentage.toFixed(1)}% ≥ ${target}%)`;
    } else if (percentage >= target - 5) {
      const diff = (target - percentage).toFixed(1);
      return `Borderline (-${diff}% off)`;
    } else {
      const diff = (target - percentage).toFixed(1);
      return `Below Target (-${diff}%)`;
    }
  }

  // =========================================================================
  // 6. VIEW NAVIGATION ROUTER (Zero-Lag)
  // =========================================================================
  function switchTab(tabName) {
    state.currentTab = tabName;

    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('.main-content .view').forEach(view => {
      if (view.id === `view-${tabName}`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    const scrollContainer = document.getElementById('mainContentScroll');
    if (scrollContainer) scrollContainer.scrollTop = 0;

    if (tabName === 'dashboard') {
      renderDashboard();
    } else if (tabName === 'daily') {
      renderDailyAttendanceForm();
    } else if (tabName === 'analytics') {
      renderAnalyticsView();
    } else if (tabName === 'prediction') {
      renderPredictionView();
    } else if (tabName === 'history') {
      renderHistoryView();
    } else if (tabName === 'sync') {
      renderSyncView();
    } else if (tabName === 'settings') {
      renderSettingsView();
    }
  }

  function switchSyncSubview(subviewId) {
    state.currentSyncSubview = subviewId;
    document.querySelectorAll('.sub-nav-tabs .sub-nav-btn').forEach(btn => {
      if (btn.dataset.subview === subviewId) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    document.querySelectorAll('.sync-subview').forEach(view => {
      if (view.id === `subview-${subviewId}`) view.classList.add('active');
      else view.classList.remove('active');
    });

    if (subviewId === 'sync-weekly') {
      renderWeeklySyncForm();
    } else if (subviewId === 'sync-baseline') {
      renderBaselineView();
    } else if (subviewId === 'sync-history') {
      renderSyncHistoryList();
    }
  }

  // =========================================================================
  // 7. DASHBOARD RENDERER (Phases 1 & 4)
  // =========================================================================
  function renderDashboard() {
    const metrics = calculateMetrics();
    const target = metrics.targetPercentage;

    const headerTargetVal = document.getElementById('headerTargetVal');
    if (headerTargetVal) headerTargetVal.textContent = `${target}%`;

    const topSubtitle = document.getElementById('topSubtitle');
    if (topSubtitle && state.settings.collegeName) {
      topSubtitle.textContent = state.settings.collegeName;
    }

    const heroPctElem = document.getElementById('heroOverallPercentage');
    const heroStatusTag = document.getElementById('heroStatusTag');
    const heroSummaryText = document.getElementById('heroSummaryText');
    const circleStroke = document.getElementById('heroCircleStroke');

    const pct = metrics.overallPercentage;
    heroPctElem.textContent = `${pct.toFixed(1)}%`;

    const status = getStatusClass(pct, target);
    heroStatusTag.className = `hero-status-tag tag-${status}`;
    if (status === 'safe') {
      heroStatusTag.textContent = 'On Track';
    } else if (status === 'warning') {
      heroStatusTag.textContent = 'Near Warning';
    } else {
      heroStatusTag.textContent = 'Action Required';
    }

    heroSummaryText.textContent = `${metrics.overallAttended} attended of ${metrics.overallConducted} total classes across all subjects.`;

    if (circleStroke) {
      const strokeVal = Math.min(100, Math.max(0, pct));
      circleStroke.setAttribute('stroke-dasharray', `${strokeVal}, 100`);
      circleStroke.setAttribute('class', `circle-stroke stroke-${status}`);
    }

    const statAtt = document.getElementById('statAttended');
    if (statAtt) statAtt.textContent = metrics.overallAttended;
    const statCond = document.getElementById('statConducted');
    if (statCond) statCond.textContent = metrics.overallConducted;
    const statMiss = document.getElementById('statMissed');
    if (statMiss) statMiss.textContent = metrics.overallMissed;
    const statSubs = document.getElementById('statSubjectsCount');
    if (statSubs) statSubs.textContent = state.subjects.length;

    const container = document.getElementById('subjectCardsList');
    container.innerHTML = '';

    if (state.subjects.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <p>No subjects added yet.</p>
          <button class="btn btn-primary btn-sm" style="margin-top: 10px;" id="btnDashboardAddSub">
            Add Your First Subject
          </button>
        </div>
      `;
      document.getElementById('btnDashboardAddSub')?.addEventListener('click', () => {
        openSubjectModal();
      });
      return;
    }

    state.subjects.forEach(sub => {
      const subMetric = metrics.subjectMetrics[sub.id];
      const subPct = subMetric ? subMetric.percentage : 100;
      const subStatus = getStatusClass(subPct, target);
      const subAttended = subMetric ? subMetric.totalAttended : 0;
      const subConducted = subMetric ? subMetric.totalConducted : 0;

      const card = document.createElement('div');
      card.className = 'subject-card';
      card.innerHTML = `
        <div class="subject-card-top">
          <div>
            <span class="subject-code-tag">${escapeHtml(sub.code)}</span>
            <h3 class="subject-name">${escapeHtml(sub.name)}</h3>
          </div>
          <div class="subject-percentage-badge">
            <span class="subject-pct status-${subStatus}">${subPct.toFixed(1)}%</span>
            <span class="subject-fraction">${subAttended} / ${subConducted}</span>
          </div>
        </div>

        <div class="progress-bar-container">
          <div class="progress-bar-fill progress-${subStatus}" style="width: ${Math.min(100, subPct)}%;"></div>
        </div>

        <div class="subject-card-footer">
          <span class="badge-status status-${subStatus}">
            ${getStatusBadgeText(subPct, target)}
          </span>
          <span class="subject-details-hint">
            ${subMetric.missed > 0 ? `${subMetric.missed} missed` : 'Zero missed'}
          </span>
        </div>
      `;

      container.appendChild(card);
    });
  }

  // =========================================================================
  // 8. DAILY ATTENDANCE FORM (Phase 3)
  // =========================================================================
  function renderDailyAttendanceForm() {
    const dateInput = document.getElementById('dailyDateInput');
    dateInput.value = state.dailySelectedDate;

    const dateStatusHint = document.getElementById('dateStatusHint');
    const existingForDate = state.records.filter(r => r.date === state.dailySelectedDate);

    if (existingForDate.length > 0) {
      dateStatusHint.textContent = `⚡ Updating attendance already logged for ${formatDisplayDate(state.dailySelectedDate)}.`;
      dateStatusHint.classList.add('visible');
    } else {
      dateStatusHint.textContent = '';
      dateStatusHint.classList.remove('visible');
    }

    const container = document.getElementById('dailyEntriesContainer');
    container.innerHTML = '';

    if (state.subjects.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <p>Please add subjects before logging daily attendance.</p>
          <button class="btn btn-primary btn-sm" style="margin-top: 10px;" id="btnGoToSyncFromDaily">
            Go to Baseline Setup
          </button>
        </div>
      `;
      document.getElementById('btnGoToSyncFromDaily')?.addEventListener('click', () => {
        switchTab('sync');
        switchSyncSubview('sync-baseline');
      });
      return;
    }

    state.subjects.forEach(sub => {
      const existing = existingForDate.find(r => r.subjectId === sub.id);
      const initConducted = existing ? existing.conducted : 0;
      const initAttended = existing ? existing.attended : 0;
      const initNote = existing ? (existing.note || '') : '';

      const card = document.createElement('div');
      card.className = 'daily-entry-card';
      card.dataset.subjectId = sub.id;

      card.innerHTML = `
        <div class="daily-entry-header">
          <div class="daily-entry-title-wrap">
            <span class="daily-subject-code">${escapeHtml(sub.code)}</span>
            <span class="daily-subject-name">${escapeHtml(sub.name)}</span>
          </div>
          <div class="daily-quick-buttons">
            <button type="button" class="btn-pill" data-action="set" data-attended="1" data-conducted="1">1/1</button>
            <button type="button" class="btn-pill" data-action="set" data-attended="2" data-conducted="2">2/2</button>
            <button type="button" class="btn-pill pill-danger" data-action="set" data-attended="0" data-conducted="1">0/1</button>
            <button type="button" class="btn-pill" data-action="clear">Clear</button>
          </div>
        </div>

        <div class="daily-counters-grid">
          <div class="counter-box">
            <label class="counter-label">Classes Conducted</label>
            <div class="counter-controls">
              <button type="button" class="btn-counter btn-conducted-dec">−</button>
              <input type="number" class="counter-input input-conducted" value="${initConducted}" min="0" max="10">
              <button type="button" class="btn-counter btn-conducted-inc">+</button>
            </div>
          </div>

          <div class="counter-box">
            <label class="counter-label">Classes Attended</label>
            <div class="counter-controls">
              <button type="button" class="btn-counter btn-attended-dec">−</button>
              <input type="number" class="counter-input input-attended" value="${initAttended}" min="0" max="10">
              <button type="button" class="btn-counter btn-attended-inc">+</button>
            </div>
          </div>
        </div>

        <input type="text" class="daily-note-input input-note" placeholder="Optional short note (e.g. Lab, Extra Class)" value="${escapeHtml(initNote)}">
      `;

      const conductedInput = card.querySelector('.input-conducted');
      const attendedInput = card.querySelector('.input-attended');
      const noteInput = card.querySelector('.input-note');

      card.querySelector('.btn-conducted-dec').addEventListener('click', () => {
        let val = Math.max(0, parseInt(conductedInput.value || 0, 10) - 1);
        conductedInput.value = val;
        if (parseInt(attendedInput.value, 10) > val) {
          attendedInput.value = val;
        }
      });

      card.querySelector('.btn-conducted-inc').addEventListener('click', () => {
        let val = parseInt(conductedInput.value || 0, 10) + 1;
        conductedInput.value = val;
      });

      card.querySelector('.btn-attended-dec').addEventListener('click', () => {
        let val = Math.max(0, parseInt(attendedInput.value || 0, 10) - 1);
        attendedInput.value = val;
      });

      card.querySelector('.btn-attended-inc').addEventListener('click', () => {
        let val = parseInt(attendedInput.value || 0, 10) + 1;
        const condVal = parseInt(conductedInput.value || 0, 10);
        if (val > condVal) {
          conductedInput.value = val;
        }
        attendedInput.value = val;
      });

      card.querySelectorAll('.btn-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.action === 'set') {
            conductedInput.value = btn.dataset.conducted;
            attendedInput.value = btn.dataset.attended;
          } else if (btn.dataset.action === 'clear') {
            conductedInput.value = 0;
            attendedInput.value = 0;
            noteInput.value = '';
          }
        });
      });

      container.appendChild(card);
    });
  }

  function saveDailyAttendance() {
    const selectedDate = state.dailySelectedDate;
    if (!selectedDate) {
      showToast('Please select a date.');
      return;
    }

    const cards = document.querySelectorAll('#dailyEntriesContainer .daily-entry-card');
    if (cards.length === 0) return;

    cards.forEach(card => {
      const subjectId = card.dataset.subjectId;
      const conducted = parseInt(card.querySelector('.input-conducted').value || 0, 10);
      const attended = parseInt(card.querySelector('.input-attended').value || 0, 10);
      const note = card.querySelector('.input-note').value.trim();

      const existingIdx = state.records.findIndex(r => r.date === selectedDate && r.subjectId === subjectId);

      if (conducted > 0) {
        const recordObj = {
          id: existingIdx >= 0 ? state.records[existingIdx].id : `rec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          date: selectedDate,
          subjectId: subjectId,
          conducted: Math.max(0, conducted),
          attended: Math.min(conducted, Math.max(0, attended)),
          note: note
        };

        if (existingIdx >= 0) {
          state.records[existingIdx] = recordObj;
        } else {
          state.records.push(recordObj);
        }
      } else {
        if (existingIdx >= 0) {
          state.records.splice(existingIdx, 1);
        }
      }
    });

    saveState();
    showToast(`Saved attendance for ${formatDisplayDate(selectedDate)}!`);

    setTimeout(() => {
      switchTab('dashboard');
    }, 200);
  }

  // =========================================================================
  // 9. ANALYTICS & GRAPHS (Phase 6 - Native SVG Charts)
  // =========================================================================
  function renderAnalyticsView() {
    const metrics = calculateMetrics();
    const target = metrics.targetPercentage;

    // 1. Overall Ratio Donut Chart
    const donutContainer = document.getElementById('analyticsDonutChartContainer');
    const legendContainer = document.getElementById('analyticsDonutLegend');

    const total = metrics.overallConducted;
    const attended = metrics.overallAttended;
    const missed = metrics.overallMissed;

    if (total === 0) {
      donutContainer.innerHTML = '<div class="empty-state"><p>No class data recorded yet.</p></div>';
      legendContainer.innerHTML = '';
    } else {
      const attendedPct = ((attended / total) * 100).toFixed(1);
      const missedPct = ((missed / total) * 100).toFixed(1);

      const C = 251.327; // 2 * PI * 40
      const attOffset = (attended / total) * C;

      donutContainer.innerHTML = `
        <svg width="180" height="180" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="40" fill="none" stroke="#ef4444" stroke-width="18" />
          <circle cx="60" cy="60" r="40" fill="none" stroke="#10b981" stroke-width="18"
            stroke-dasharray="${attOffset} ${C}"
            transform="rotate(-90 60 60)" />
          <g text-anchor="middle" dominant-baseline="middle">
            <text x="60" y="55" font-size="16" font-weight="800" fill="#0f172a">${metrics.overallPercentage.toFixed(1)}%</text>
            <text x="60" y="72" font-size="7" font-weight="600" fill="#64748b">OVERALL ATTENDANCE</text>
          </g>
        </svg>
      `;

      legendContainer.innerHTML = `
        <div class="legend-item">
          <span class="legend-color-dot dot-attended"></span>
          <span>Attended: <strong>${attended}</strong> (${attendedPct}%)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color-dot dot-missed"></span>
          <span>Missed: <strong>${missed}</strong> (${missedPct}%)</span>
        </div>
      `;
    }

    // 2. Weekly Bar Chart (Past 7 Days)
    const weeklyContainer = document.getElementById('analyticsWeeklyChartContainer');
    const past7Days = [];
    for (let i = 6; i >= 0; i--) {
      const dStr = getRelativeDateString(-i);
      const dObj = new Date();
      dObj.setDate(dObj.getDate() - i);
      const dayLabel = dObj.toLocaleDateString(undefined, { weekday: 'short' });
      
      const dayRecords = state.records.filter(r => r.date === dStr);
      const dayCond = dayRecords.reduce((sum, r) => sum + r.conducted, 0);
      const dayAtt = dayRecords.reduce((sum, r) => sum + r.attended, 0);

      past7Days.push({
        date: dStr,
        label: dayLabel,
        conducted: dayCond,
        attended: dayAtt
      });
    }

    const maxDayCond = Math.max(4, ...past7Days.map(d => d.conducted));
    const svgWidth = 320;
    const svgHeight = 150;
    const chartBottom = 120;
    const chartHeight = 90;
    const colWidth = svgWidth / 7;

    let barsSvg = '';
    past7Days.forEach((day, idx) => {
      const x = idx * colWidth + colWidth / 2;
      const condHeight = (day.conducted / maxDayCond) * chartHeight;
      const attHeight = (day.attended / maxDayCond) * chartHeight;

      const condY = chartBottom - condHeight;
      const attY = chartBottom - attHeight;

      barsSvg += `
        <rect x="${x - 14}" y="${condY}" width="12" height="${condHeight}" rx="3" fill="#cbd5e1" />
        <rect x="${x}" y="${attY}" width="12" height="${attHeight}" rx="3" fill="#10b981" />
        <text x="${x - 1}" y="${chartBottom + 16}" font-size="10" font-weight="600" fill="#64748b" text-anchor="middle">${day.label}</text>
        ${day.conducted > 0 ? `<text x="${x - 1}" y="${condY - 4}" font-size="8" font-weight="700" fill="#334155" text-anchor="middle">${day.attended}/${day.conducted}</text>` : ''}
      `;
    });

    weeklyContainer.innerHTML = `
      <svg width="100%" height="160" viewBox="0 0 ${svgWidth} ${svgHeight}">
        <line x1="10" y1="${chartBottom}" x2="${svgWidth - 10}" y2="${chartBottom}" stroke="#e2e8f0" stroke-width="1"/>
        <line x1="10" y1="${chartBottom - chartHeight/2}" x2="${svgWidth - 10}" y2="${chartBottom - chartHeight/2}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3,3"/>
        <line x1="10" y1="${chartBottom - chartHeight}" x2="${svgWidth - 10}" y2="${chartBottom - chartHeight}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3,3"/>
        ${barsSvg}
      </svg>
      <div style="display:flex; justify-content:center; gap:16px; font-size:0.75rem; color:#64748b; margin-top:4px;">
        <span><span style="display:inline-block;width:10px;height:10px;background:#cbd5e1;border-radius:2px;margin-right:4px;"></span>Conducted</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#10b981;border-radius:2px;margin-right:4px;"></span>Attended</span>
      </div>
    `;

    // 3. Subject-Wise Comparison Horizontal Bars
    const subjectBarsContainer = document.getElementById('analyticsSubjectBarsContainer');
    subjectBarsContainer.innerHTML = '';

    if (state.subjects.length === 0) {
      subjectBarsContainer.innerHTML = '<div class="empty-state"><p>No subjects added.</p></div>';
      return;
    }

    state.subjects.forEach(sub => {
      const metric = metrics.subjectMetrics[sub.id];
      const p = metric ? metric.percentage : 100;
      const status = getStatusClass(p, target);

      const row = document.createElement('div');
      row.className = 'subject-bar-row';
      row.innerHTML = `
        <div class="subject-bar-meta">
          <span>${escapeHtml(sub.code)} - ${escapeHtml(sub.name)}</span>
          <span class="status-${status}">${p.toFixed(1)}% (${metric ? `${metric.totalAttended}/${metric.totalConducted}` : '0/0'})</span>
        </div>
        <div class="subject-bar-track">
          <div class="subject-bar-fill-seg progress-${status}" style="width: ${Math.min(100, p)}%;"></div>
          <div class="target-reference-line" style="left: ${target}%;" title="Target: ${target}%"></div>
        </div>
      `;
      subjectBarsContainer.appendChild(row);
    });
  }

  // =========================================================================
  // 10. ATTENDANCE PREDICTION (Phase 7 - Exact Math)
  // =========================================================================
  function renderPredictionView() {
    const metrics = calculateMetrics();
    const target = metrics.targetPercentage;
    const T = target / 100;

    document.getElementById('predTargetLabel').textContent = `${target}%`;

    const overallCard = document.getElementById('overallPredictionCard');
    const ovA = metrics.overallAttended;
    const ovC = metrics.overallConducted;
    const ovP = metrics.overallPercentage;

    let overallForecastHtml = '';
    if (ovC === 0) {
      overallForecastHtml = '<p class="pred-hero-text">No attendance records yet to forecast.</p>';
    } else if (ovP >= target) {
      const allowedMiss = Math.max(0, Math.floor((ovA / T) - ovC));
      overallForecastHtml = `
        <div class="pred-hero-header">
          <span class="pred-hero-title">Overall Status</span>
          <span class="pred-stat-pill tag-safe">${ovP.toFixed(1)}% (Above Target)</span>
        </div>
        <p class="pred-hero-text">
          🎉 <strong>Safe Zone!</strong> You can safely miss the next <strong>${allowedMiss}</strong> classes across your subjects while keeping your overall attendance above <strong>${target}%</strong>.
        </p>
      `;
    } else {
      const neededAttend = Math.max(1, Math.ceil((T * ovC - ovA) / (1 - T)));
      overallForecastHtml = `
        <div class="pred-hero-header">
          <span class="pred-hero-title">Overall Status</span>
          <span class="pred-stat-pill tag-danger">${ovP.toFixed(1)}% (Below Target)</span>
        </div>
        <p class="pred-hero-text">
          ⚠️ <strong>Action Needed:</strong> You need to attend the next <strong>${neededAttend}</strong> classes consecutively without missing to pull your overall attendance up to <strong>${target}%</strong>.
        </p>
      `;
    }
    overallCard.innerHTML = overallForecastHtml;

    const container = document.getElementById('predictionSubjectsList');
    container.innerHTML = '';

    if (state.subjects.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No subjects to predict.</p></div>';
      return;
    }

    state.subjects.forEach(sub => {
      const metric = metrics.subjectMetrics[sub.id];
      const A = metric ? metric.totalAttended : 0;
      const C = metric ? metric.totalConducted : 0;
      const P = metric ? metric.percentage : 100;
      const status = getStatusClass(P, target);

      let adviceHtml = '';
      if (C === 0) {
        adviceHtml = '<div class="pred-callout-box pred-box-safe">No classes conducted yet. 100% attendance.</div>';
      } else if (P >= target) {
        const canMiss = Math.max(0, Math.floor((A / T) - C));
        adviceHtml = `
          <div class="pred-callout-box pred-box-safe">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>You can safely miss the next <strong>${canMiss}</strong> classes while staying ≥ ${target}%.</span>
          </div>
        `;
      } else {
        const mustAttend = Math.max(1, Math.ceil((T * C - A) / (1 - T)));
        adviceHtml = `
          <div class="pred-callout-box pred-box-danger">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Need to attend next <strong>${mustAttend}</strong> classes consecutively to reach ${target}%.</span>
          </div>
        `;
      }

      if (!state.whatIfSimulations[sub.id]) {
        state.whatIfSimulations[sub.id] = { moreAttend: 3, moreMiss: 1 };
      }
      const sim = state.whatIfSimulations[sub.id];

      const simAttendNewA = A + sim.moreAttend;
      const simAttendNewC = C + sim.moreAttend;
      const simAttendPct = simAttendNewC > 0 ? ((simAttendNewA / simAttendNewC) * 100).toFixed(1) : '100.0';

      const simMissNewA = A;
      const simMissNewC = C + sim.moreMiss;
      const simMissPct = simMissNewC > 0 ? ((simMissNewA / simMissNewC) * 100).toFixed(1) : '100.0';

      const card = document.createElement('div');
      card.className = 'prediction-card';
      card.innerHTML = `
        <div class="prediction-card-top">
          <div class="pred-sub-info">
            <span class="subject-code-tag">${escapeHtml(sub.code)}</span>
            <h4>${escapeHtml(sub.name)}</h4>
          </div>
          <div class="subject-percentage-badge">
            <span class="subject-pct status-${status}">${P.toFixed(1)}%</span>
            <span class="subject-fraction">${A} / ${C} classes</span>
          </div>
        </div>

        ${adviceHtml}

        <div class="what-if-panel">
          <div class="what-if-title">Interactive "What-If" Simulator</div>
          
          <div class="what-if-row">
            <span>If I attend the next</span>
            <div class="what-if-controls">
              <input type="number" min="1" max="50" value="${sim.moreAttend}" class="counter-input sim-attend-input" style="border:1px solid #cbd5e1; border-radius:4px; width:46px; padding:2px 4px; background:white;">
              <span>classes:</span>
            </div>
            <span class="what-if-result status-${getStatusClass(parseFloat(simAttendPct), target)}">${simAttendPct}%</span>
          </div>

          <div class="what-if-row">
            <span>If I miss the next</span>
            <div class="what-if-controls">
              <input type="number" min="1" max="50" value="${sim.moreMiss}" class="counter-input sim-miss-input" style="border:1px solid #cbd5e1; border-radius:4px; width:46px; padding:2px 4px; background:white;">
              <span>classes:</span>
            </div>
            <span class="what-if-result status-${getStatusClass(parseFloat(simMissPct), target)}">${simMissPct}%</span>
          </div>
        </div>
      `;

      const attendInput = card.querySelector('.sim-attend-input');
      const missInput = card.querySelector('.sim-miss-input');

      attendInput.addEventListener('input', (e) => {
        sim.moreAttend = Math.max(0, parseInt(e.target.value || 0, 10));
        renderPredictionView();
      });

      missInput.addEventListener('input', (e) => {
        sim.moreMiss = Math.max(0, parseInt(e.target.value || 0, 10));
        renderPredictionView();
      });

      container.appendChild(card);
    });
  }

  // =========================================================================
  // 11. OFFICIAL SYNC & EXCEL IMPORT (Phases 2, 8, 9)
  // =========================================================================
  function renderSyncView() {
    switchSyncSubview(state.currentSyncSubview);
  }

  function renderWeeklySyncForm() {
    const cutoffInput = document.getElementById('syncEffectiveDateInput');
    cutoffInput.value = state.baseline.lastSyncedDate || getTodayDateString();

    const container = document.getElementById('weeklySyncList');
    container.innerHTML = '';

    if (state.subjects.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No subjects added. Add subjects in the Baseline tab.</p></div>';
      return;
    }

    state.subjects.forEach(sub => {
      const base = (state.baseline.data && state.baseline.data[sub.id]) || { attended: 0, conducted: 0 };
      const currentPct = base.conducted > 0 ? (base.attended / base.conducted) * 100 : 100;

      const card = document.createElement('div');
      card.className = 'baseline-item-card';
      card.dataset.subjectId = sub.id;

      card.innerHTML = `
        <div class="baseline-item-top">
          <div class="baseline-subject-info">
            <span class="subject-code-tag">${escapeHtml(sub.code)}</span>
            <h4>${escapeHtml(sub.name)}</h4>
          </div>
          <div class="baseline-percentage-preview">
            <span class="sync-pct-preview">${currentPct.toFixed(1)}%</span>
          </div>
        </div>

        <div class="baseline-inputs-grid">
          <div class="baseline-field">
            <label>Official Attended</label>
            <input type="number" class="form-input sync-input-attended" value="${base.attended}" min="0">
          </div>
          <div class="baseline-field">
            <label>Official Conducted</label>
            <input type="number" class="form-input sync-input-conducted" value="${base.conducted}" min="0">
          </div>
        </div>
      `;

      const attInput = card.querySelector('.sync-input-attended');
      const condInput = card.querySelector('.sync-input-conducted');
      const preview = card.querySelector('.sync-pct-preview');

      function updatePct() {
        const a = parseInt(attInput.value || 0, 10);
        const c = parseInt(condInput.value || 0, 10);
        const p = c > 0 ? (a / c) * 100 : 100;
        preview.textContent = `${p.toFixed(1)}%`;
      }

      attInput.addEventListener('input', updatePct);
      condInput.addEventListener('input', updatePct);

      container.appendChild(card);
    });
  }

  function confirmOfficialSync() {
    const cutoffDate = document.getElementById('syncEffectiveDateInput').value || getTodayDateString();
    const cards = document.querySelectorAll('#weeklySyncList .baseline-item-card');

    if (cards.length === 0) return;

    const oldBaselineSnapshot = JSON.parse(JSON.stringify(state.baseline));
    const newBaselineData = {};

    cards.forEach(card => {
      const subjectId = card.dataset.subjectId;
      const attended = parseInt(card.querySelector('.sync-input-attended').value || 0, 10);
      const conducted = parseInt(card.querySelector('.sync-input-conducted').value || 0, 10);

      newBaselineData[subjectId] = {
        attended: Math.max(0, attended),
        conducted: Math.max(attended, Math.max(0, conducted))
      };
    });

    state.baseline = {
      lastSyncedDate: cutoffDate,
      data: newBaselineData
    };

    state.syncHistory.unshift({
      id: `sync_${Date.now()}`,
      syncDate: cutoffDate,
      timestamp: new Date().toISOString(),
      note: `Official weekly synchronization as of ${cutoffDate}`,
      previousSnapshot: oldBaselineSnapshot,
      newBaseline: newBaselineData
    });

    saveState();
    showToast(`Official attendance synced as of ${formatDisplayDate(cutoffDate)}!`);

    setTimeout(() => {
      switchTab('dashboard');
    }, 200);
  }

  function renderSyncHistoryList() {
    const container = document.getElementById('syncHistoryList');
    container.innerHTML = '';

    if (state.syncHistory.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No official synchronization history recorded yet.</p></div>';
      return;
    }

    state.syncHistory.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';
      const d = new Date(item.timestamp);
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let breakdownRows = '';
      if (item.newBaseline) {
        Object.keys(item.newBaseline).forEach(subId => {
          const sub = state.subjects.find(s => s.id === subId) || { name: 'Subject', code: subId };
          const data = item.newBaseline[subId];
          const pct = data.conducted > 0 ? ((data.attended / data.conducted) * 100).toFixed(1) : '100';
          breakdownRows += `<div style="font-size:0.75rem; color:#475569; margin-top:2px;">• ${sub.code}: <strong>${data.attended}/${data.conducted}</strong> (${pct}%)</div>`;
        });
      }

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <h4 style="font-size:0.9rem; font-weight:700; color:#1e293b;">Synced on ${formatDisplayDate(item.syncDate)}</h4>
          <span style="font-size:0.72rem; color:#64748b;">${timeStr}</span>
        </div>
        <p style="font-size:0.76rem; color:#64748b; margin-bottom:8px;">${escapeHtml(item.note || '')}</p>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 10px;">
          ${breakdownRows}
        </div>
      `;
      container.appendChild(card);
    });
  }

  function renderBaselineView() {
    const container = document.getElementById('baselineSubjectsList');
    container.innerHTML = '';

    if (state.subjects.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <p>No subjects configured yet. Click "Add Subject" above to start.</p>
        </div>
      `;
      return;
    }

    state.subjects.forEach(sub => {
      const base = (state.baseline.data && state.baseline.data[sub.id]) || { attended: 0, conducted: 0 };
      const basePct = base.conducted > 0 ? (base.attended / base.conducted) * 100 : 100;

      const card = document.createElement('div');
      card.className = 'baseline-item-card';
      card.dataset.subjectId = sub.id;

      card.innerHTML = `
        <div class="baseline-item-top">
          <div class="baseline-subject-info">
            <span class="subject-code-tag">${escapeHtml(sub.code)}</span>
            <h4>${escapeHtml(sub.name)}</h4>
          </div>
          <div class="baseline-item-actions">
            <button class="btn-icon-sm btn-edit-sub" title="Edit Subject Name / Code">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn-icon-sm delete btn-delete-sub" title="Delete Subject">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="baseline-inputs-grid">
          <div class="baseline-field">
            <label>Baseline Attended</label>
            <input type="number" class="form-input base-input-attended" value="${base.attended}" min="0">
          </div>
          <div class="baseline-field">
            <label>Baseline Conducted</label>
            <input type="number" class="form-input base-input-conducted" value="${base.conducted}" min="0">
          </div>
          <div class="baseline-percentage-preview">
            <span class="pct-val">${basePct.toFixed(1)}%</span>
          </div>
        </div>
      `;

      const attInput = card.querySelector('.base-input-attended');
      const condInput = card.querySelector('.base-input-conducted');
      const pctPreview = card.querySelector('.pct-val');

      function updatePreview() {
        const a = parseInt(attInput.value || 0, 10);
        const c = parseInt(condInput.value || 0, 10);
        const p = c > 0 ? (a / c) * 100 : 100;
        pctPreview.textContent = `${p.toFixed(1)}%`;
      }

      attInput.addEventListener('input', updatePreview);
      condInput.addEventListener('input', updatePreview);

      card.querySelector('.btn-edit-sub').addEventListener('click', () => {
        openSubjectModal(sub);
      });

      card.querySelector('.btn-delete-sub').addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete "${sub.name}" (${sub.code})? All associated daily logs will also be removed.`)) {
          deleteSubject(sub.id);
        }
      });

      container.appendChild(card);
    });
  }

  function saveBaselineChanges() {
    const items = document.querySelectorAll('#baselineSubjectsList .baseline-item-card');
    items.forEach(item => {
      const subjectId = item.dataset.subjectId;
      const attended = parseInt(item.querySelector('.base-input-attended').value || 0, 10);
      const conducted = parseInt(item.querySelector('.base-input-conducted').value || 0, 10);

      if (!state.baseline.data) state.baseline.data = {};
      state.baseline.data[subjectId] = {
        attended: Math.max(0, attended),
        conducted: Math.max(attended, Math.max(0, conducted))
      };
    });

    saveState();
    showToast('Official baseline updated successfully!');
    renderBaselineView();
  }

  function openSubjectModal(subjectToEdit = null) {
    const modal = document.getElementById('subjectModal');
    const title = document.getElementById('subjectModalTitle');
    const idInput = document.getElementById('modalSubjectId');
    const nameInput = document.getElementById('modalSubjectName');
    const codeInput = document.getElementById('modalSubjectCode');
    const attInput = document.getElementById('modalSubjectBaselineAttended');
    const condInput = document.getElementById('modalSubjectBaselineConducted');

    if (subjectToEdit) {
      title.textContent = 'Edit Subject';
      idInput.value = subjectToEdit.id;
      nameInput.value = subjectToEdit.name;
      codeInput.value = subjectToEdit.code;
      const b = (state.baseline.data && state.baseline.data[subjectToEdit.id]) || { attended: 0, conducted: 0 };
      attInput.value = b.attended;
      condInput.value = b.conducted;
    } else {
      title.textContent = 'Add New Subject';
      idInput.value = '';
      nameInput.value = '';
      codeInput.value = '';
      attInput.value = '0';
      condInput.value = '0';
    }

    modal.classList.remove('hidden');
    nameInput.focus();
  }

  function closeSubjectModal() {
    document.getElementById('subjectModal').classList.add('hidden');
  }

  function handleSubjectModalSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('modalSubjectId').value.trim();
    const name = document.getElementById('modalSubjectName').value.trim();
    const code = document.getElementById('modalSubjectCode').value.trim();
    const attended = parseInt(document.getElementById('modalSubjectBaselineAttended').value || 0, 10);
    const conducted = parseInt(document.getElementById('modalSubjectBaselineConducted').value || 0, 10);

    if (!name || !code) {
      showToast('Please provide both name and short code.');
      return;
    }

    if (id) {
      const sub = state.subjects.find(s => s.id === id);
      if (sub) {
        sub.name = name;
        sub.code = code;
      }
      if (!state.baseline.data) state.baseline.data = {};
      state.baseline.data[id] = { attended, conducted };
      showToast('Subject updated.');
    } else {
      const newId = 'sub_' + Date.now().toString(36);
      state.subjects.push({ id: newId, name, code });
      if (!state.baseline.data) state.baseline.data = {};
      state.baseline.data[newId] = { attended, conducted };
      showToast('New subject added!');
    }

    saveState();
    closeSubjectModal();
    renderBaselineView();
    renderDashboard();
  }

  function deleteSubject(subjectId) {
    state.subjects = state.subjects.filter(s => s.id !== subjectId);
    if (state.baseline.data) {
      delete state.baseline.data[subjectId];
    }
    state.records = state.records.filter(r => r.subjectId !== subjectId);
    saveState();
    showToast('Subject deleted.');
    renderBaselineView();
    renderDashboard();
  }

  // =========================================================================
  // 12. EXCEL & CSV IMPORT ENGINE (Phase 9 - Offline with SheetJS)
  // =========================================================================
  function handleExcelFileInput(file) {
    if (!file) return;
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        if (typeof XLSX === 'undefined') {
          showToast('Spreadsheet parser library not loaded. Use table text paste below.');
          return;
        }

        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        parseRowsToDetectedAttendance(jsonRows);
      } catch (err) {
        console.error('Excel parse error:', err);
        showToast('Could not parse Excel file. Try copying and pasting table text.');
      }
    };

    reader.readAsArrayBuffer(file);
  }

  function handleTablePasteInput() {
    const rawText = document.getElementById('excelPasteInput').value.trim();
    if (!rawText) {
      showToast('Please paste table text first.');
      return;
    }

    const lines = rawText.split(/\r?\n/);
    const rows = lines.map(line => {
      if (line.includes('\t')) return line.split('\t').map(c => c.trim());
      if (line.includes(',')) return line.split(',').map(c => c.trim());
      return line.trim().split(/\s{2,}/);
    }).filter(r => r.length > 0 && r[0]);

    parseRowsToDetectedAttendance(rows);
  }

  function parseRowsToDetectedAttendance(rows) {
    state.parsedExcelRows = [];
    if (!rows || rows.length === 0) {
      showToast('No data rows detected.');
      return;
    }

    rows.forEach((row) => {
      if (row.length < 2) return;

      let subjectName = '';
      let attended = null;
      let conducted = null;

      row.forEach((cell) => {
        const cellStr = String(cell || '').trim();
        const slashMatch = cellStr.match(/^(\d+)\s*\/\s*(\d+)$/);
        if (slashMatch) {
          attended = parseInt(slashMatch[1], 10);
          conducted = parseInt(slashMatch[2], 10);
        }
      });

      if (attended === null || conducted === null) {
        const nums = [];
        row.forEach((cell, cellIdx) => {
          const n = Number(String(cell || '').trim());
          if (!isNaN(n) && String(cell).trim() !== '' && n >= 0 && n <= 500) {
            nums.push({ val: n, col: cellIdx });
          }
        });

        if (nums.length >= 2) {
          if (nums[0].val <= nums[1].val) {
            attended = nums[0].val;
            conducted = nums[1].val;
          } else {
            conducted = nums[0].val;
            attended = nums[1].val;
          }
        }
      }

      for (let i = 0; i < row.length; i++) {
        const str = String(row[i] || '').trim();
        if (str && isNaN(Number(str)) && !str.match(/^(\d+)\s*\/\s*(\d+)$/)) {
          if (!['subject', 'course name', 'course code', 's.no', 'serial'].includes(str.toLowerCase())) {
            subjectName = str;
            break;
          }
        }
      }

      if (subjectName && attended !== null && conducted !== null && conducted > 0) {
        let matchedSubId = '';
        const lowerName = subjectName.toLowerCase();
        const found = state.subjects.find(s => 
          lowerName.includes(s.code.toLowerCase()) || 
          lowerName.includes(s.name.toLowerCase()) ||
          s.name.toLowerCase().includes(lowerName)
        );
        if (found) matchedSubId = found.id;

        state.parsedExcelRows.push({
          rawSubject: subjectName,
          attended,
          conducted,
          matchedSubId: matchedSubId || 'NEW',
          include: true
        });
      }
    });

    if (state.parsedExcelRows.length === 0) {
      showToast('Could not automatically identify subjects and attendance numbers. Check format.');
      return;
    }

    renderExcelMappingPreview();
  }

  function renderExcelMappingPreview() {
    const previewSection = document.getElementById('excelPreviewSection');
    const tableBody = document.getElementById('excelPreviewTableBody');
    tableBody.innerHTML = '';

    state.parsedExcelRows.forEach((row, idx) => {
      const tr = document.createElement('tr');

      let optionsHtml = `<option value="NEW" ${row.matchedSubId === 'NEW' ? 'selected' : ''}>+ Create New Subject</option>`;
      state.subjects.forEach(sub => {
        optionsHtml += `<option value="${sub.id}" ${row.matchedSubId === sub.id ? 'selected' : ''}>${sub.code} - ${sub.name}</option>`;
      });

      tr.innerHTML = `
        <td><input type="checkbox" class="excel-row-check" data-idx="${idx}" ${row.include ? 'checked' : ''}></td>
        <td><strong>${escapeHtml(row.rawSubject)}</strong></td>
        <td><input type="number" class="form-input form-input-sm excel-att" data-idx="${idx}" value="${row.attended}" style="width:60px;"></td>
        <td><input type="number" class="form-input form-input-sm excel-cond" data-idx="${idx}" value="${row.conducted}" style="width:60px;"></td>
        <td>
          <select class="form-select form-input-sm excel-match-select" data-idx="${idx}">
            ${optionsHtml}
          </select>
        </td>
      `;

      tr.querySelector('.excel-row-check').addEventListener('change', (e) => {
        state.parsedExcelRows[idx].include = e.target.checked;
      });

      tr.querySelector('.excel-att').addEventListener('input', (e) => {
        state.parsedExcelRows[idx].attended = parseInt(e.target.value || 0, 10);
      });

      tr.querySelector('.excel-cond').addEventListener('input', (e) => {
        state.parsedExcelRows[idx].conducted = parseInt(e.target.value || 0, 10);
      });

      tr.querySelector('.excel-match-select').addEventListener('change', (e) => {
        state.parsedExcelRows[idx].matchedSubId = e.target.value;
      });

      tableBody.appendChild(tr);
    });

    previewSection.classList.remove('hidden');
    previewSection.scrollIntoView({ behavior: 'smooth' });
    showToast(`Detected ${state.parsedExcelRows.length} subject attendance records!`);
  }

  function applyExcelImport() {
    const validRows = state.parsedExcelRows.filter(r => r.include);
    if (validRows.length === 0) {
      showToast('No rows selected to import.');
      return;
    }

    if (!state.baseline.data) state.baseline.data = {};
    let importedCount = 0;

    validRows.forEach(row => {
      let targetSubjectId = row.matchedSubId;

      if (targetSubjectId === 'NEW' || !targetSubjectId) {
        const code = row.rawSubject.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 6) || 'SUB';
        targetSubjectId = 'sub_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 2);
        state.subjects.push({
          id: targetSubjectId,
          name: row.rawSubject,
          code: code
        });
      }

      state.baseline.data[targetSubjectId] = {
        attended: Math.max(0, row.attended),
        conducted: Math.max(row.attended, Math.max(0, row.conducted))
      };
      importedCount++;
    });

    state.baseline.lastSyncedDate = getTodayDateString();

    state.syncHistory.unshift({
      id: `sync_excel_${Date.now()}`,
      syncDate: getTodayDateString(),
      timestamp: new Date().toISOString(),
      note: `Imported ${importedCount} subjects from official spreadsheet`,
      newBaseline: JSON.parse(JSON.stringify(state.baseline.data))
    });

    saveState();
    showToast(`Successfully imported ${importedCount} subjects into official baseline!`);

    setTimeout(() => {
      switchTab('dashboard');
    }, 200);
  }

  // =========================================================================
  // 13. ATTENDANCE HISTORY VIEW (Phase 5)
  // =========================================================================
  function renderHistoryView() {
    const filterSelect = document.getElementById('historySubjectFilter');
    const curVal = state.historySubjectFilter;
    filterSelect.innerHTML = '<option value="all">All Subjects</option>';
    state.subjects.forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub.id;
      opt.textContent = `${sub.code} - ${sub.name}`;
      if (sub.id === curVal) opt.selected = true;
      filterSelect.appendChild(opt);
    });

    document.querySelectorAll('.segment-tabs .seg-btn').forEach(btn => {
      if (btn.dataset.historyMode === state.historyGrouping) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const container = document.getElementById('historyEntriesList');
    container.innerHTML = '';

    let recordsToDisplay = [...state.records];
    if (state.historySubjectFilter !== 'all') {
      recordsToDisplay = recordsToDisplay.filter(r => r.subjectId === state.historySubjectFilter);
    }

    recordsToDisplay.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

    if (recordsToDisplay.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <p>No daily attendance records found.</p>
          <button class="btn btn-primary btn-sm" style="margin-top: 10px;" id="btnGoToDailyFromHistory">
            Log Attendance
          </button>
        </div>
      `;
      document.getElementById('btnGoToDailyFromHistory')?.addEventListener('click', () => switchTab('daily'));
      return;
    }

    const groups = {};
    recordsToDisplay.forEach(rec => {
      let groupKey = '';
      if (state.historyGrouping === 'daily') {
        groupKey = rec.date;
      } else if (state.historyGrouping === 'weekly') {
        groupKey = getWeekIdentifier(rec.date);
      } else if (state.historyGrouping === 'monthly') {
        groupKey = getMonthIdentifier(rec.date);
      }
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(rec);
    });

    Object.keys(groups).forEach(key => {
      const recs = groups[key];
      const totalAtt = recs.reduce((sum, r) => sum + r.attended, 0);
      const totalCond = recs.reduce((sum, r) => sum + r.conducted, 0);
      const groupPct = totalCond > 0 ? ((totalAtt / totalCond) * 100).toFixed(1) : '100';

      const groupCard = document.createElement('div');
      groupCard.className = 'history-group-card';

      let headerTitle = key;
      if (state.historyGrouping === 'daily') {
        headerTitle = formatDisplayDate(key);
      }

      groupCard.innerHTML = `
        <div class="history-group-header">
          <span class="group-date-text">${headerTitle}</span>
          <span class="group-stat-badge">${totalAtt} / ${totalCond} (${groupPct}%)</span>
        </div>
        <div class="history-records-list"></div>
      `;

      const listContainer = groupCard.querySelector('.history-records-list');

      recs.forEach(rec => {
        const sub = state.subjects.find(s => s.id === rec.subjectId) || { name: 'Unknown', code: '?' };
        const row = document.createElement('div');
        row.className = 'history-record-row';

        let ratioClass = 'ratio-partial';
        if (rec.attended === rec.conducted) ratioClass = 'ratio-full';
        else if (rec.attended === 0) ratioClass = 'ratio-zero';

        const isSynced = state.baseline.lastSyncedDate && rec.date <= state.baseline.lastSyncedDate;

        row.innerHTML = `
          <div class="rec-left">
            <span class="rec-subject-title">
              ${escapeHtml(sub.name)} (${escapeHtml(sub.code)})
              ${isSynced ? '<span style="font-size:0.65rem; color:#6b7280; background:#f3f4f6; padding:1px 5px; border-radius:4px; margin-left:4px;">In Baseline</span>' : ''}
            </span>
            ${state.historyGrouping !== 'daily' ? `<span class="rec-note">${formatDisplayDate(rec.date)}</span>` : ''}
            ${rec.note ? `<span class="rec-note">"${escapeHtml(rec.note)}"</span>` : ''}
          </div>
          <div class="rec-right">
            <span class="rec-ratio-pill ${ratioClass}">${rec.attended} / ${rec.conducted}</span>
            <div class="rec-actions">
              <button class="btn-icon-sm btn-edit-rec" title="Edit this record">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="btn-icon-sm delete btn-delete-rec" title="Delete this record">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        `;

        row.querySelector('.btn-edit-rec').addEventListener('click', () => {
          openHistoryEditModal(rec);
        });

        row.querySelector('.btn-delete-rec').addEventListener('click', () => {
          if (confirm(`Delete attendance record for ${sub.code} on ${rec.date}?`)) {
            deleteHistoryRecord(rec.id);
          }
        });

        listContainer.appendChild(row);
      });

      container.appendChild(groupCard);
    });
  }

  function openHistoryEditModal(record) {
    const modal = document.getElementById('historyEditModal');
    const sub = state.subjects.find(s => s.id === record.subjectId) || { name: 'Unknown', code: '?' };

    document.getElementById('editRecordId').value = record.id;
    document.getElementById('editRecordSubjectName').value = `${sub.name} (${sub.code})`;
    document.getElementById('editRecordDate').value = record.date;
    document.getElementById('editRecordAttended').value = record.attended;
    document.getElementById('editRecordConducted').value = record.conducted;
    document.getElementById('editRecordNote').value = record.note || '';

    modal.classList.remove('hidden');
  }

  function closeHistoryEditModal() {
    document.getElementById('historyEditModal').classList.add('hidden');
  }

  function handleHistoryEditSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('editRecordId').value;
    const date = document.getElementById('editRecordDate').value;
    const attended = parseInt(document.getElementById('editRecordAttended').value || 0, 10);
    const conducted = parseInt(document.getElementById('editRecordConducted').value || 0, 10);
    const note = document.getElementById('editRecordNote').value.trim();

    const record = state.records.find(r => r.id === id);
    if (record) {
      record.date = date;
      record.conducted = conducted;
      record.attended = Math.min(conducted, attended);
      record.note = note;
      saveState();
      showToast('Record updated successfully.');
      closeHistoryEditModal();
      renderHistoryView();
      renderDashboard();
    }
  }

  function deleteHistoryRecord(recordId) {
    state.records = state.records.filter(r => r.id !== recordId);
    saveState();
    showToast('Record deleted.');
    renderHistoryView();
    renderDashboard();
  }

  // =========================================================================
  // 14. NOTIFICATIONS (Phase 11 - Optional Attendance Reminders)
  // =========================================================================
  function initNotifications() {
    // Periodic reminder check every 60 seconds
    setInterval(checkAttendanceReminder, 60000);
    // Check on startup
    checkAttendanceReminder();
  }

  function sendNotification(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      if (swRegistration && 'showNotification' in swRegistration) {
        swRegistration.showNotification(title, {
          body: body,
          icon: 'icon-192.png',
          badge: 'icon-192.png',
          vibrate: [200, 100, 200]
        });
      } else {
        new Notification(title, {
          body: body,
          icon: 'icon-192.png'
        });
      }
    } catch (e) {
      console.log('Notification dispatch fallback:', e);
    }
  }

  function checkAttendanceReminder() {
    if (!state.settings.notificationsEnabled) return;
    const now = new Date();
    const curHours = String(now.getHours()).padStart(2, '0');
    const curMinutes = String(now.getMinutes()).padStart(2, '0');
    const curTime = `${curHours}:${curMinutes}`;
    const targetTime = state.settings.notificationTime || '17:00';

    const todayStr = getTodayDateString();
    if (curTime >= targetTime && state.settings.lastNotificationDate !== todayStr) {
      // Check if user has logged attendance for today
      const loggedToday = state.records.filter(r => r.date === todayStr);
      if (loggedToday.length === 0) {
        sendNotification(
          'Trackendance Reminder 🎓',
          'Have you had classes today? Tap to record your attended and conducted classes.'
        );
        state.settings.lastNotificationDate = todayStr;
        saveState();
      }
    }
  }

  // =========================================================================
  // 15. SETTINGS VIEW (Phases 1, 10, 11)
  // =========================================================================
  function renderSettingsView() {
    const targetRange = document.getElementById('settingTargetRange');
    const targetDisplay = document.getElementById('settingTargetDisplay');
    const collegeNameInput = document.getElementById('settingCollegeName');

    targetRange.value = state.settings.targetPercentage || 75;
    targetDisplay.textContent = `${targetRange.value}%`;
    collegeNameInput.value = state.settings.collegeName || '';

    // Notification settings
    const notifToggle = document.getElementById('settingNotificationToggle');
    const notifDetails = document.getElementById('notificationSettingsDetails');
    const notifTimeInput = document.getElementById('settingNotificationTime');
    const notifStatusMsg = document.getElementById('notificationStatusMsg');

    notifToggle.checked = !!state.settings.notificationsEnabled;
    notifTimeInput.value = state.settings.notificationTime || '17:00';

    if (state.settings.notificationsEnabled) {
      notifDetails.classList.remove('hidden');
    } else {
      notifDetails.classList.add('hidden');
    }

    if (!('Notification' in window)) {
      notifStatusMsg.textContent = 'Browser does not support notifications.';
      notifToggle.disabled = true;
    } else if (Notification.permission === 'denied') {
      notifStatusMsg.textContent = 'Notifications blocked in browser settings. Please enable them to receive reminders.';
      notifToggle.checked = false;
      state.settings.notificationsEnabled = false;
    } else {
      notifStatusMsg.textContent = `Reminders check daily at ${state.settings.notificationTime || '17:00'}.`;
    }

    // PWA banner state
    const pwaCard = document.getElementById('pwaInstallCard');
    if (window.matchMedia('(display-mode: standalone)').matches) {
      pwaCard.style.display = 'none';
    }
  }

  // =========================================================================
  // 16. TOAST NOTIFICATIONS & HELPERS
  // =========================================================================
  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2400);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // =========================================================================
  // 17. PWA & SERVICE WORKER SETUP (Phase 10)
  // =========================================================================
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
          .then(reg => {
            swRegistration = reg;
            console.log('Service Worker registered successfully:', reg.scope);
          })
          .catch(err => console.log('Service Worker registration skipped/failed:', err));
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const btnInstall = document.getElementById('btnInstallPwa');
      if (btnInstall) btnInstall.style.display = 'inline-flex';
    });

    document.getElementById('btnInstallPwa')?.addEventListener('click', () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            showToast('Thank you for installing Trackendance!');
          }
          deferredInstallPrompt = null;
        });
      } else {
        showToast('To install, tap "Add to Home Screen" in your browser menu.');
      }
    });
  }

  // =========================================================================
  // 18. EVENT LISTENERS INITIALIZATION
  // =========================================================================
  function setupEventListeners() {
    // Bottom Navigation Bar
    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
      });
    });

    document.getElementById('btnHeaderSettings')?.addEventListener('click', () => {
      switchTab('settings');
    });

    document.getElementById('btnQuickLog')?.addEventListener('click', () => {
      state.dailySelectedDate = getTodayDateString();
      switchTab('daily');
    });

    document.getElementById('btnDashboardSync')?.addEventListener('click', () => {
      switchTab('sync');
    });

    // Daily View Date Selectors
    const dateInput = document.getElementById('dailyDateInput');
    dateInput?.addEventListener('change', (e) => {
      state.dailySelectedDate = e.target.value || getTodayDateString();
      renderDailyAttendanceForm();
    });

    document.getElementById('btnDateToday')?.addEventListener('click', () => {
      state.dailySelectedDate = getTodayDateString();
      renderDailyAttendanceForm();
    });

    document.getElementById('btnDateYesterday')?.addEventListener('click', () => {
      state.dailySelectedDate = getRelativeDateString(-1);
      renderDailyAttendanceForm();
    });

    document.getElementById('btnSaveDailyAttendance')?.addEventListener('click', () => {
      saveDailyAttendance();
    });

    // Official Sync Sub-navigation
    document.querySelectorAll('.sub-nav-tabs .sub-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchSyncSubview(btn.dataset.subview);
      });
    });

    document.getElementById('btnConfirmOfficialSync')?.addEventListener('click', () => {
      confirmOfficialSync();
    });

    document.getElementById('btnOpenAddSubjectModal')?.addEventListener('click', () => {
      openSubjectModal();
    });

    document.getElementById('btnSaveBaseline')?.addEventListener('click', () => {
      saveBaselineChanges();
    });

    // Subject Modal
    document.getElementById('btnCloseSubjectModal')?.addEventListener('click', closeSubjectModal);
    document.getElementById('btnCancelSubjectModal')?.addEventListener('click', closeSubjectModal);
    document.getElementById('subjectModalForm')?.addEventListener('submit', handleSubjectModalSubmit);

    // History Filters & Segment Buttons
    document.getElementById('historySubjectFilter')?.addEventListener('change', (e) => {
      state.historySubjectFilter = e.target.value;
      renderHistoryView();
    });

    document.querySelectorAll('.segment-tabs .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.historyGrouping = btn.dataset.historyMode;
        renderHistoryView();
      });
    });

    // History Edit Modal
    document.getElementById('btnCloseHistoryEditModal')?.addEventListener('click', closeHistoryEditModal);
    document.getElementById('btnCancelHistoryEditModal')?.addEventListener('click', closeHistoryEditModal);
    document.getElementById('historyEditForm')?.addEventListener('submit', handleHistoryEditSubmit);

    // Excel / CSV File Drop & Parse
    const fileInput = document.getElementById('excelFileInput');
    const dropZone = document.getElementById('fileDropZone');

    fileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleExcelFileInput(e.target.files[0]);
      }
    });

    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleExcelFileInput(e.dataTransfer.files[0]);
      }
    });

    document.getElementById('btnParseSpreadsheet')?.addEventListener('click', () => {
      handleTablePasteInput();
    });

    document.getElementById('btnApplyExcelImport')?.addEventListener('click', () => {
      applyExcelImport();
    });

    // Settings Controls
    const targetRange = document.getElementById('settingTargetRange');
    const targetDisplay = document.getElementById('settingTargetDisplay');

    targetRange?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      targetDisplay.textContent = `${val}%`;
      state.settings.targetPercentage = val;
      saveState();
      renderDashboard();
    });

    document.getElementById('settingCollegeName')?.addEventListener('input', (e) => {
      state.settings.collegeName = e.target.value.trim();
      saveState();
      renderDashboard();
    });

    // Phase 11 Notification Controls
    const notifToggle = document.getElementById('settingNotificationToggle');
    const notifDetails = document.getElementById('notificationSettingsDetails');
    const notifTimeInput = document.getElementById('settingNotificationTime');

    notifToggle?.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (!('Notification' in window)) {
          showToast('Notifications are not supported by this browser.');
          e.target.checked = false;
          return;
        }

        if (Notification.permission === 'granted') {
          state.settings.notificationsEnabled = true;
          notifDetails.classList.remove('hidden');
          saveState();
          showToast('Daily reminders enabled!');
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              state.settings.notificationsEnabled = true;
              notifDetails.classList.remove('hidden');
              saveState();
              showToast('Daily reminders enabled!');
            } else {
              e.target.checked = false;
              state.settings.notificationsEnabled = false;
              notifDetails.classList.add('hidden');
              showToast('Notification permission was not granted.');
            }
          });
        } else {
          e.target.checked = false;
          showToast('Notifications are blocked in your browser site settings.');
        }
      } else {
        state.settings.notificationsEnabled = false;
        notifDetails.classList.add('hidden');
        saveState();
        showToast('Daily reminders disabled.');
      }
    });

    notifTimeInput?.addEventListener('change', (e) => {
      state.settings.notificationTime = e.target.value || '17:00';
      saveState();
      showToast(`Reminder time set to ${state.settings.notificationTime}`);
      renderSettingsView();
    });

    document.getElementById('btnTestNotification')?.addEventListener('click', () => {
      sendNotification(
        'Trackendance Reminder 🎓',
        'Test successful! Trackendance will remind you to log your classes.'
      );
      showToast('Dispatched test reminder!');
    });

    document.getElementById('btnLoadDemoData')?.addEventListener('click', () => {
      if (confirm('Load sample college demo data? This will replace current local data with sample records.')) {
        loadSeedData();
        showToast('Loaded sample college data!');
        renderDashboard();
      }
    });

    document.getElementById('btnClearAllData')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear ALL college attendance data? This cannot be undone.')) {
        clearAllStorage();
        showToast('All local attendance data cleared.');
        renderDashboard();
      }
    });
  }

  // =========================================================================
  // 19. APP BOOTSTRAP
  // =========================================================================
  function init() {
    loadState();
    setupEventListeners();
    registerServiceWorker();
    initNotifications();
    renderDashboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
