const DATA_URL = "ntust_courses_1151.json";
const SCHEDULE_URL = "class_schedule_2B0EE3.json";
const STORAGE_KEY = "ntust-course-selection-1151";

const dayMap = {
  M: "星期一",
  T: "星期二",
  W: "星期三",
  R: "星期四",
  F: "星期五",
  S: "星期六",
};

const periodLabels = {
  1: "第 1 節",
  2: "第 2 節",
  3: "第 3 節",
  4: "第 4 節",
  5: "第 5 節",
  6: "第 6 節",
  7: "第 7 節",
  8: "第 8 節",
  9: "第 9 節",
  10: "第 10 節",
  A: "A 節",
  B: "B 節",
  C: "C 節",
};

const state = {
  courses: [],
  selected: new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")),
  query: "",
  department: "",
  day: "",
  require: "",
  grade: "3",
  classSelect: "",
  studentLast2: "",
  conflict: "",
  classSchedule: [],
  classMap: {},
};

const el = {
  searchInput: document.querySelector("#searchInput"),
  searchInputCard: document.querySelector("#searchInputCard"),
  departmentFilter: document.querySelector("#departmentFilter"),
  dayFilter: document.querySelector("#dayFilter"),
  gradeFilter: document.querySelector("#gradeFilter"),
  classSelect: document.querySelector("#classSelect"),
  studentIdLast2: document.querySelector("#studentIdLast2"),
  applySplitBtn: document.querySelector("#applySplitBtn"),
  requireFilter: document.querySelector("#requireFilter"),
  conflictFilter: document.querySelector("#conflictFilter"),
  courseList: document.querySelector("#courseList"),
  resultCount: document.querySelector("#resultCount"),
  selectedCount: document.querySelector("#selectedCount"),
  creditCount: document.querySelector("#creditCount"),
  hoursCount: document.querySelector("#hoursCount"),
  conflictCount: document.querySelector("#conflictCount"),
  scheduleGrid: document.querySelector("#scheduleGrid"),
  chosenList: document.querySelector("#chosenList"),
  chosenHint: document.querySelector("#chosenHint"),
  clearSelectionBtn: document.querySelector("#clearSelectionBtn"),
  printBtn: document.querySelector("#printBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  exportDialog: document.querySelector("#exportDialog"),
  exportText: document.querySelector("#exportText"),
  copyExportBtn: document.querySelector("#copyExportBtn"),
};

init();

async function init() {
  renderSchedule();
  bindEvents();

  try {
    const rawCourses = await loadCourseData();
    state.courses = rawCourses.map(normalizeCourse);
    await loadClassSchedule();
    fillDepartmentFilter();
    fillClassSelect();
    render();
  } catch (error) {
    el.courseList.innerHTML = `
      <div class="error-state">
        無法載入課程資料。請確認已在伺服器環境開啟此頁，或使用本機伺服器，例如在 Courses 資料夾執行
        <strong>python -m http.server 8000</strong>，再前往 http://localhost:8000。
      </div>
    `;
    el.resultCount.textContent = "載入失敗";
    console.error(error);
  }
}

async function loadClassSchedule() {
  try {
    const resp = await fetch(SCHEDULE_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const schedule = await resp.json();
    // build map: CourseNo -> schedule entry
    state.classSchedule = schedule || [];
    state.classMap = state.classSchedule.reduce((m, item) => {
      if (item.CourseNo) m[item.CourseNo] = item;
      return m;
    }, {});
  } catch (err) {
    console.warn('無法載入班表:', err);
    state.classSchedule = [];
    state.classMap = {};
  }
}

function fillClassSelect() {
  const select = document.querySelector('#classSelect');
  if (!select || !state.classSchedule) return;
  const classes = new Set();
  state.classSchedule.forEach((c) => {
    if (c.OpenClass) {
      // split combined like 甲乙 -> add 甲 and 乙
      const parts = String(c.OpenClass).split('').filter(Boolean);
      parts.forEach((p) => classes.add(p));
    }
  });
  const opts = Array.from(classes).sort();
  opts.forEach((opt) => {
    const elOpt = document.createElement('option');
    elOpt.value = opt;
    elOpt.textContent = opt;
    select.appendChild(elOpt);
  });
}

function parseStudentRule(contents = '') {
  // returns {mod,rem} if pattern like 學號除3餘1 or 學號除5整除 etc.
  const m = String(contents).match(/學號除(\d+)餘(\d+)/);
  if (m) return { mod: Number(m[1]), rem: Number(m[2]) };
  const m2 = String(contents).match(/學號除(\d+)整除/);
  if (m2) return { mod: Number(m2[1]), rem: 0 };
  return null;
}

function isEligibleByStudentId(contents, last2) {
  if (!last2) return true; // no id provided -> allowed
  const rule = parseStudentRule(contents || '');
  if (!rule) return true;
  const num = Number(last2) % rule.mod;
  return num === rule.rem % rule.mod;
}

async function loadCourseData() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (fetchError) {
    if (typeof COURSE_DATA !== "undefined" && Array.isArray(COURSE_DATA)) {
      return COURSE_DATA;
    }
    throw fetchError;
  }
}

function bindEvents() {
  el.searchInput.addEventListener("input", () => {
    state.query = el.searchInput.value.trim().toLowerCase();
    if (el.searchInputCard) el.searchInputCard.value = el.searchInput.value;
    renderCourseList();
  });

  if (el.searchInputCard) {
    el.searchInputCard.addEventListener("input", () => {
      state.query = el.searchInputCard.value.trim().toLowerCase();
      if (el.searchInput) el.searchInput.value = el.searchInputCard.value;
      renderCourseList();
    });
  }

  el.departmentFilter.addEventListener("change", () => {
    state.department = el.departmentFilter.value;
    renderCourseList();
  });

  el.dayFilter.addEventListener("change", () => {
    state.day = el.dayFilter.value;
    renderCourseList();
  });

  el.requireFilter.addEventListener("change", () => {
    state.require = el.requireFilter.value;
    renderCourseList();
  });

  if (el.gradeFilter) {
    el.gradeFilter.addEventListener('change', () => {
      state.grade = el.gradeFilter.value;
      renderCourseList();
    });
  }

  if (el.classSelect) {
    el.classSelect.addEventListener('change', () => {
      state.classSelect = el.classSelect.value;
      renderCourseList();
    });
  }

  if (el.applySplitBtn) {
    el.applySplitBtn.addEventListener('click', () => {
      state.studentLast2 = (el.studentIdLast2.value || '').replace(/\D/g, '').slice(-2);
      addEligibleCoursesToSchedule();
      render();
    });
  }

  el.conflictFilter.addEventListener("change", () => {
    state.conflict = el.conflictFilter.value;
    renderCourseList();
  });

  el.courseList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const courseNo = button.dataset.courseNo;
    if (button.dataset.action === "toggle") toggleCourse(courseNo);
  });

  el.chosenList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='remove']");
    if (button) toggleCourse(button.dataset.courseNo);
  });

  // unchosen sidebar removed

  el.clearSelectionBtn.addEventListener("click", () => {
    state.selected.clear();
    saveSelection();
    render();
  });

  el.printBtn.addEventListener("click", () => window.print());

  el.exportBtn.addEventListener("click", () => {
    const selectedCourses = getSelectedCourses().map((course) => course.raw);
    el.exportText.value = JSON.stringify(selectedCourses, null, 2);
    el.exportDialog.showModal();
  });

  el.copyExportBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(el.exportText.value);
    el.copyExportBtn.textContent = "已複製";
    setTimeout(() => (el.copyExportBtn.textContent = "複製"), 1200);
  });
}

function getEligibleScheduleCourses() {
  const selectedClass = state.classSelect;
  const last2 = state.studentLast2;
  return state.classSchedule.filter((schedule) => {
    if (!schedule.CourseNo) return false;
    const openClass = String(schedule.OpenClass || '');
    if (selectedClass && !openClass.includes(selectedClass)) return false;
    if (!last2) return true;
    if (String(schedule.CourseNo) === 'EE2402701' || String(schedule.CourseName).includes('數位系統設計')) {
      return true;
    }
    const rule = parseStudentRule(schedule.Contents || '');
    if (!rule) return true;
    const num = Number(last2) % rule.mod;
    return num === ((rule.rem % rule.mod) + rule.mod) % rule.mod;
  });
}

function addEligibleCoursesToSchedule() {
  const courses = getEligibleScheduleCourses();
  courses.forEach((schedule) => {
    if (schedule.CourseNo) {
      state.selected.add(schedule.CourseNo);
    }
  });
  saveSelection();
}

function normalizeCourse(course) {
  const nodes = parseNodes(course.Node);
  const courseNo = course.CourseNo || "";
  return {
    raw: course,
    semester: course.Semester || "",
    id: courseNo,
    department: courseNo.slice(0, 2),
    name: course.CourseName || "未命名課程",
    teacher: course.CourseTeacher || "未標示教師",
    credit: Number(course.CreditPoint || 0),
    require: course.RequireOption || "",
    dimension: course.Dimension || "",
    capacity: Number(course.Restrict2 || course.Restrict1 || 0),
    chosen: Number(course.ChooseStudent || course.AllStudent || 0),
    room: course.ClassRoomNo || "",
    contents: course.Contents || "",
    nodes,
    nodeText: formatNodes(nodes),
    searchable: [
      courseNo,
      course.CourseName,
      course.CourseTeacher,
      course.Node,
      course.Contents,
      course.Dimension,
    ].join(" ").toLowerCase(),
  };
}

function parseNodes(nodeText) {
  if (!nodeText) return [];
  return String(nodeText)
    .split(",")
    .map((node) => node.trim().match(/^([A-Z])(.+)$/))
    .filter(Boolean)
    .map((match) => ({ day: match[1], period: match[2] }))
    .filter((node) => dayMap[node.day] && periodLabels[node.period]);
}

function formatNodes(nodes) {
  if (!nodes.length) return "未排定";
  const grouped = nodes.reduce((acc, node) => {
    acc[node.day] ||= [];
    acc[node.day].push(node.period);
    return acc;
  }, {});
  return Object.entries(grouped)
    .map(([day, periods]) => `${dayMap[day]} ${periods.join(",")}`)
    .join("、");
}

function fillDepartmentFilter() {
  const departments = [...new Set(state.courses.map((course) => course.department).filter(Boolean))].sort();
  el.departmentFilter.insertAdjacentHTML(
    "beforeend",
    departments.map((department) => `<option value="${escapeHtml(department)}">${escapeHtml(department)}</option>`).join("")
  );
}

function render() {
  renderStats();
  renderSchedule();
  renderChosenList();
  renderCourseList();
}

// getVisibleCourses removed (unused after UI simplification)

function renderCourseList() {
  const selectedCourses = getSelectedCourses();
  const visible = state.courses
    .filter((course) => {
      const conflict = getCourseConflicts(course, selectedCourses);
      if (state.query && !course.searchable.includes(state.query)) return false;
      if (state.department && course.department !== state.department) return false;
      if (state.day && !course.nodes.some((node) => node.day === state.day)) return false;
      if (state.require && course.require !== state.require) return false;
      // class select filter: use classMap to determine which OpenClass this course belongs to
      if (state.classSelect) {
        const sched = (state.classMap && state.classMap[course.id]) || null;
        if (!sched) return false;
        const open = String(sched.OpenClass || '');
        if (!open.includes(state.classSelect)) return false;
      }
      // student id split: check eligibility from schedule contents or course contents
      if (state.studentLast2) {
        const sched = (state.classMap && state.classMap[course.id]) || null;
        const contentsToCheck = sched ? sched.Contents || '' : course.contents || '';
        if (!isEligibleByStudentId(contentsToCheck, state.studentLast2)) return false;
      }
      if (state.conflict === "available" && conflict.length && !state.selected.has(course.id)) return false;
      if (state.conflict === "conflict" && (!conflict.length || state.selected.has(course.id))) return false;
      return true;
    })
    .slice(0, 250);

  el.resultCount.textContent = `${visible.length} / ${state.courses.length}`;

  if (!visible.length) {
    el.courseList.innerHTML = `<div class="empty-state">沒有符合條件的課程。</div>`;
    return;
  }

  el.courseList.innerHTML = visible.map((course) => {
    const isSelected = state.selected.has(course.id);
    const conflicts = getCourseConflicts(course, selectedCourses);
    const canShowConflict = conflicts.length && !isSelected;
    return `
      <article class="course-card ${isSelected ? "is-selected" : ""} ${canShowConflict ? "has-conflict" : ""}">
        <div class="course-top">
          <div class="course-title">
            <span class="course-code">${escapeHtml(course.id)}</span>
            <strong>${escapeHtml(course.name)}</strong>
          </div>
          <button class="button ${isSelected ? "danger" : "primary"}" type="button" data-action="toggle" data-course-no="${escapeHtml(course.id)}">
            ${isSelected ? "移除" : "加入"}
          </button>
        </div>
        <div class="meta-row">
          <span class="pill">${escapeHtml(course.teacher)}</span>
          <span class="pill">${course.credit} 學分</span>
          <span class="pill ${course.require === "R" ? "required" : ""}">${course.require === "R" ? "必修" : "選修"}</span>
          <span class="pill">${escapeHtml(course.nodeText)}</span>
          ${course.dimension ? `<span class="pill">向度 ${escapeHtml(course.dimension)}</span>` : ""}
          ${canShowConflict ? `<span class="pill conflict">衝堂：${escapeHtml(conflicts.map((item) => item.name).join("、"))}</span>` : ""}
        </div>
        ${course.contents ? `<div class="course-code">${escapeHtml(course.contents)}</div>` : ""}
      </article>
    `;
  }).join("");
}

function renderSchedule() {
  const days = Object.keys(dayMap);
  const periods = Object.keys(periodLabels);
  const selectedCourses = getSelectedCourses();
  const occupancy = buildOccupancy(selectedCourses);

  const cells = [`<div class="grid-cell header">節次</div>`];
  days.forEach((day) => cells.push(`<div class="grid-cell header">${dayMap[day]}</div>`));

  periods.forEach((period) => {
    cells.push(`<div class="grid-cell period">${periodLabels[period]}</div>`);
    days.forEach((day) => {
      const key = `${day}${period}`;
      const courses = occupancy.get(key) || [];
      cells.push(`
        <div class="grid-cell ${courses.length > 1 ? "conflict-cell" : ""}">
          <div class="slot-stack">
            ${courses.map((course) => `
              <div class="schedule-item ${courses.length > 1 ? "conflict" : ""}">
                <strong>${escapeHtml(course.name)}</strong>
                <span>${escapeHtml(course.teacher)}</span>
                <span>${escapeHtml(course.id)}</span>
              </div>
            `).join("")}
          </div>
        </div>
      `);
    });
  });

  el.scheduleGrid.innerHTML = cells.join("");
}

function renderChosenList() {
  const selectedCourses = getSelectedCourses();
  const hintText = selectedCourses.length ? `${selectedCourses.length} 門已加入` : "尚未加入課程";
  el.chosenHint.textContent = hintText;

  if (!selectedCourses.length) {
    const emptyHtml = `<div class="empty-state">從課程列表加入課程後，這裡會顯示清單，課表也會即時更新。</div>`;
    el.chosenList.innerHTML = emptyHtml;
    return;
  }

  const selectedHtml = selectedCourses.map((course) => `
    <article class="chosen-card">
      <div class="course-top">
        <div class="course-title">
          <span class="course-code">${escapeHtml(course.id)}</span>
          <strong>${escapeHtml(course.name)}</strong>
        </div>
        <button class="icon-button danger" type="button" title="移除課程" aria-label="移除課程" data-action="remove" data-course-no="${escapeHtml(course.id)}">×</button>
      </div>
      <div class="meta-row">
        <span class="pill">${escapeHtml(course.teacher)}</span>
        <span class="pill">${course.credit} 學分</span>
        <span class="pill">${escapeHtml(course.nodeText)}</span>
      </div>
    </article>
  `).join("");

  el.chosenList.innerHTML = selectedHtml;
}

function renderStats() {
  const selectedCourses = getSelectedCourses();
  const occupancy = buildOccupancy(selectedCourses);
  const conflictCells = [...occupancy.values()].filter((courses) => courses.length > 1).length;
  const credits = selectedCourses.reduce((sum, course) => sum + course.credit, 0);
  const hours = selectedCourses.reduce((sum, course) => {
    const courseHours = (course.nodes || []).reduce((hs, node) => {
      const matches = String(node.period).match(/[0-9A-Z]/g);
      return hs + (matches ? matches.length : 0);
    }, 0);
    return sum + courseHours;
  }, 0);
  el.selectedCount.textContent = selectedCourses.length;
  el.creditCount.textContent = credits;
  if (el.hoursCount) el.hoursCount.textContent = hours;
  el.conflictCount.textContent = conflictCells;
}

function toggleCourse(courseNo) {
  if (state.selected.has(courseNo)) {
    state.selected.delete(courseNo);
  } else {
    state.selected.add(courseNo);
  }
  saveSelection();
  render();
}

function saveSelection() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.selected]));
}

function getSelectedCourses() {
  return state.courses.filter((course) => state.selected.has(course.id));
}

// getUnselectedCourses and renderUnchosenList removed (list moved to main view)

// unchosen list rendering removed

function buildOccupancy(courses) {
  const map = new Map();
  courses.forEach((course) => {
    course.nodes.forEach((node) => {
      const key = `${node.day}${node.period}`;
      const slot = map.get(key) || [];
      slot.push(course);
      map.set(key, slot);
    });
  });
  return map;
}

function getCourseConflicts(course, selectedCourses) {
  if (!course.nodes.length) return [];
  const courseSlots = new Set(course.nodes.map((node) => `${node.day}${node.period}`));
  return selectedCourses.filter((selectedCourse) => (
    selectedCourse.id !== course.id &&
    selectedCourse.nodes.some((node) => courseSlots.has(`${node.day}${node.period}`))
  ));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
