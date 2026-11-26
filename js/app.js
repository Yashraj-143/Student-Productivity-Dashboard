/**
 * Student Productivity Dashboard - Application Logic & LocalStorage Store
 * Uses pure Vanilla JavaScript, Bootstrap 5, and LocalStorage with zero external libraries.
 */

(function () {
  "use strict";

  const STORAGE_KEY = "studyflow_dashboard_v1";

  const MOTIVATIONAL_MESSAGES = [
    "Consistent small blocks of deep work compound faster than late-night cramming.",
    "Focus on completing your highest-priority assignment before checking messages.",
    "One focused 25-minute study block today saves hours of stress tomorrow.",
    "Progress comes from steady daily habits, not perfection."
  ];

  const SECTION_METADATA = {
    dashboard: { title: "Overview" },
    tasks: { title: "Tasks" },
    calendar: { title: "Calendar" },
    timetable: { title: "Timetable" },
    "study-sessions": { title: "Study Sessions" },
    notes: { title: "Notes" },
    goals: { title: "Goals" },
    subjects: { title: "Subjects" },
    analytics: { title: "Analytics" },
    settings: { title: "Settings" }
  };

  const WEEKDAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];

  // Study timer state
  const timerState = {
    defaultSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    running: false,
    intervalId: null
  };

  // Task management filter & sort state
  const taskViewState = {
    filter: "all", // all | today | upcoming | overdue | completed
    priority: "all",
    subject: "all",
    search: "",
    sortBy: "dueDate", // dueDate | priority | createdAt | alphabetical
    pendingDeleteId: null
  };

  const PRIORITY_WEIGHT = {
    Urgent: 4,
    High: 3,
    Medium: 2,
    Low: 1
  };

  // Calendar & Deadline Management state
  const calendarState = {
    viewMode: "month", // month | week
    cursorDate: new Date(),
    selectedDate: null,
    typeFilter: "all",
    deadlineFilter: "all"
  };

  const EVENT_TYPE_CLASS = {
    Assignment: "evt-assignment",
    Exam: "evt-exam",
    Project: "evt-project",
    Personal: "evt-personal",
    "Study Session": "evt-study-session",
    Deadline: "evt-deadline"
  };

  // Timetable view state
  const timetableState = {
    selectedWeekday: new Date().getDay()
  };

  const TIMETABLE_DAYS = [
    { weekday: 1, short: "Mon", full: "Monday" },
    { weekday: 2, short: "Tue", full: "Tuesday" },
    { weekday: 3, short: "Wed", full: "Wednesday" },
    { weekday: 4, short: "Thu", full: "Thursday" },
    { weekday: 5, short: "Fri", full: "Friday" },
    { weekday: 6, short: "Sat", full: "Saturday" },
    { weekday: 0, short: "Sun", full: "Sunday" }
  ];

  // Pomodoro Timer state (timestamp-based to prevent drift)
  const POMO_RING_RADIUS = 96;
  const POMO_RING_CIRCUMFERENCE = 2 * Math.PI * POMO_RING_RADIUS;

  const pomodoroState = {
    mode: "focus", // focus | shortBreak | longBreak
    status: "idle", // idle | running | paused
    remainingMs: 25 * 60 * 1000,
    totalMs: 25 * 60 * 1000,
    targetEndTime: null,
    sessionStartDate: null,
    intervalId: null,
    completedInCycle: 0
  };

  const POMO_MODE_LABELS = {
    focus: "Focus Session",
    shortBreak: "Short Break",
    longBreak: "Long Break"
  };

  const POMO_MODE_TYPES = {
    focus: "Focus",
    shortBreak: "Short Break",
    longBreak: "Long Break"
  };

  // Notes module state
  const notesViewState = {
    search: "",
    subject: "all",
    tag: "all",
    sortBy: "updatedAt" // updatedAt | createdAt
  };

  // Notes attachment & IndexedDB state
  const ATTACHMENTS_DB_NAME = "studyflow_files_db";
  const ATTACHMENTS_DB_VERSION = 1;
  const ATTACHMENTS_STORE = "attachments";
  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
  const MAX_ATTACHMENTS_PER_NOTE = 10;

  const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
    "pdf", "doc", "docx", "ppt", "pptx", "txt", "png", "jpg", "jpeg", "webp", "gif"
  ]);

  const BLOCKED_ATTACHMENT_EXTENSIONS = new Set([
    "exe", "bat", "cmd", "msi", "sh", "ps1", "js", "mjs", "vbs", "scr", "com", "pif", "jar", "app", "dll"
  ]);

  const ALLOWED_ATTACHMENT_MIMES = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif"
  ]);

  const noteAttachmentState = {
    staged: [],
    removedIds: [],
    pendingDeleteNoteId: null,
    objectUrls: [],
    previewObjectUrl: null
  };

  // Subjects module state
  const subjectViewState = {
    selectedSubjectId: null
  };

  // Analytics module state
  const analyticsState = {
    range: "last7", // today | last7 | last30 | thisMonth | custom
    startDate: "",
    endDate: ""
  };

  // Pending validated import payload
  let pendingImportStore = null;

  /* ========================================================================
     Storage & Date Helpers
     ======================================================================== */

  function getDefaultStore() {
    return {
      student: {
        name: "Alex Rivera",
        firstName: "Alex",
        college: "State University",
        course: "B.S. Computer Science",
        semester: "Fall 2026"
      },
      settings: {
        theme: "light", // light | dark | system
        dailyStudyGoalHours: 3,
        weeklyStudyGoalHours: 20,
        notifications: {
          deadlineReminders: true,
          studyTimerNotifications: true,
          dailyGoalReminders: false
        }
      },
      subjects: [],
      subjectRecords: [],
      tasks: [],
      deadlines: [],
      events: [],
      studySessions: [],
      timetable: [],
      notes: [],
      goals: [],
      habits: [],
      timerSettings: {
        focus: 25,
        shortBreak: 5,
        longBreak: 15
      }
    };
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return getDefaultStore();
      }
      const parsed = JSON.parse(raw);
      return { ...getDefaultStore(), ...parsed };
    } catch {
      return getDefaultStore();
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function getTodayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function getStartOfWeekISO() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun..6=Sat
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
    return monday;
  }

  function toISODate(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatTime12h(time24) {
    if (!time24 || !time24.includes(":")) return time24 || "";
    const [hStr, mStr] = time24.split(":");
    let h = parseInt(hStr, 10);
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${mStr} ${suffix}`;
  }

  function formatDuration(totalMinutes) {
    if (!totalMinutes || totalMinutes <= 0) return "0m";
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  }

  function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function formatRelativeDateLabel(isoDate) {
    if (!isoDate || !isoDate.includes("-")) return "";
    const today = getTodayISO();
    if (isoDate === today) return "Today";
    const [y, m, d] = isoDate.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    const [ty, tm, td] = today.split("-").map(Number);
    const nowDate = new Date(ty, tm - 1, td);
    const diffDays = Math.round((target - nowDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return "Tomorrow";
    if (diffDays > 1 && diffDays <= 6) return `In ${diffDays} days`;
    return target.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatTimestamp(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function registerSubjectIfNew(store, subjectName) {
    const clean = subjectName.trim();
    if (!clean) return;
    const exists = store.subjects.some((s) => s.toLowerCase() === clean.toLowerCase());
    if (!exists) {
      store.subjects.push(clean);
    }
  }

  function createEmptyStateHTML(iconClass, title, text, buttonLabel, actionName) {
    return `
      <div class="empty-state">
        <div class="empty-state-cue">
          <i class="bi ${iconClass}" aria-hidden="true"></i>
          <span>${escapeHTML(title)}</span>
        </div>
        <p class="empty-state-text">${escapeHTML(text)}</p>
        ${
          buttonLabel && actionName
            ? `<button type="button" class="btn btn-sm btn-outline-accent" data-action="${actionName}">
                 ${escapeHTML(buttonLabel)}
               </button>`
            : ""
        }
      </div>
    `;
  }

  /* ========================================================================
     UI Feedback & Modals
     ======================================================================== */

  function showToast(message) {
    const container = document.getElementById("toastContainer");
    if (!container || typeof bootstrap === "undefined") return;

    const toastEl = document.createElement("div");
    toastEl.className = "toast align-items-center text-bg-dark border-0";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    toastEl.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${escapeHTML(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;
    container.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl, { delay: 2600 });
    toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
    toast.show();
  }

  function openModalById(modalId) {
    const el = document.getElementById(modalId);
    if (!el || typeof bootstrap === "undefined") return;
    bootstrap.Modal.getOrCreateInstance(el).show();
  }

  function closeModalById(modalId) {
    const el = document.getElementById(modalId);
    if (!el || typeof bootstrap === "undefined") return;
    const instance = bootstrap.Modal.getInstance(el);
    if (instance) instance.hide();
  }

  /* ========================================================================
     Dashboard Section Renderers
     ======================================================================== */

  function getContextualGreetingSubtext(store, todayISO) {
    const todayTasks = (store.tasks || []).filter((t) => t.date === todayISO);
    if (todayTasks.length === 0) {
      return "Nothing planned for today yet. Add a task when you're ready.";
    }
    const pending = todayTasks.filter((t) => !t.completed);
    if (pending.length === 0) {
      return "You're all caught up for today.";
    }
    const hasHighPriority = pending.some((t) => t.priority === "Urgent" || t.priority === "High");
    if (hasHighPriority) {
      return "Start with the most important thing.";
    }
    return "Here's your day. Take it one task at a time.";
  }

  function renderGreetingAndDate(store) {
    const now = new Date();
    const hour = now.getHours();
    const periodGreeting =
      hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    const formattedDate = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric"
    });

    const firstName = store.student?.firstName || "Student";
    const fullName = store.student?.name || "Student";
    const initials = fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "ST";

    document.getElementById("currentDateText").textContent = formattedDate;
    document.getElementById("greetingTitle").textContent = `${periodGreeting}, ${firstName}.`;
    document.getElementById("sidebarStudentName").textContent = fullName;
    document.getElementById("studentAvatar").textContent = initials;
    const topbarAvatar = document.getElementById("topbarAvatar");
    if (topbarAvatar) topbarAvatar.textContent = initials;

    const termEl = document.getElementById("sidebarStudentTerm");
    if (termEl) {
      const course = store.student?.course || "Academic Workspace";
      const semester = store.student?.semester || "Current Term";
      termEl.textContent = `${course} · ${semester}`;
    }

    document.getElementById("motivationalMessage").textContent = getContextualGreetingSubtext(
      store,
      getTodayISO()
    );
  }

  function isFocusStudySession(session) {
    return session.sessionType !== "Short Break" && session.sessionType !== "Long Break";
  }

  function renderTodaySummary(store) {
    const today = getTodayISO();
    const todayTasks = store.tasks.filter((t) => t.date === today);
    const total = todayTasks.length;
    const completed = todayTasks.filter((t) => t.completed).length;
    const pending = total - completed;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    const todaySessions = store.studySessions.filter((s) => s.date === today && isFocusStudySession(s));
    const totalMinutesToday = todaySessions.reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);

    document.getElementById("summaryTotalTasks").textContent = String(total);
    document.getElementById("summaryCompletedTasks").textContent = String(completed);
    document.getElementById("summaryPendingTasks").textContent = String(pending);
    document.getElementById("summaryStudyTime").textContent = formatDuration(totalMinutesToday);
    document.getElementById("summaryCompletionPct").textContent = `${pct}%`;

    document.getElementById("summaryCompletionDot")?.classList.toggle("d-none", total === 0);
    document.getElementById("summaryCompletionWrap")?.classList.toggle("d-none", total === 0);

    // Update sidebar pending badge across all pending tasks
    const allPendingCount = store.tasks.filter((t) => !t.completed).length;
    document.getElementById("sidebarPendingBadge").textContent = String(allPendingCount);
  }

  function renderTodayTasks(store) {
    const container = document.getElementById("todayTasksContainer");
    const today = getTodayISO();
    const todayTasks = store.tasks
      .filter((t) => t.date === today)
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (a.dueTime || "").localeCompare(b.dueTime || "");
      });

    if (todayTasks.length === 0) {
      container.innerHTML = createEmptyStateHTML(
        "bi-check2-square",
        "Nothing on your list yet.",
        "Add something when you're ready.",
        "+ Create your first task",
        "open-task-modal"
      );
      return;
    }

    const itemsHTML = todayTasks
      .map((task) => {
        const isImportant = !task.completed && (task.priority === "Urgent" || task.priority === "High");
        return `
          <div class="planner-row ${task.completed ? "is-completed" : ""}">
            <div class="planner-row-left">
              <button
                type="button"
                class="task-check-btn"
                style="${task.completed ? "background-color: var(--accent-primary); border-color: var(--accent-primary);" : ""}"
                data-action="toggle-task"
                data-task-id="${escapeHTML(task.id)}"
                aria-label="${task.completed ? "Mark task as incomplete" : "Mark task as complete"}"
                aria-pressed="${task.completed}"
              >
                ${task.completed ? '<i class="bi bi-check-lg"></i>' : ""}
              </button>
              <div class="min-width-0">
                <span class="planner-row-title">${escapeHTML(task.title)}</span>
                ${task.subject ? `<span class="planner-row-sub ms-2">${escapeHTML(task.subject)}</span>` : ""}
              </div>
            </div>
            <div class="planner-row-right">
              ${isImportant ? `<span class="priority-dot" title="${escapeHTML(task.priority)} priority"></span>` : ""}
              <span>${escapeHTML(formatTime12h(task.dueTime))}</span>
            </div>
          </div>
        `;
      })
      .join("");

    container.innerHTML = `<div class="surface-card planner-list-card">${itemsHTML}</div>`;
  }

  function renderWeeklyChart(store) {
    const container = document.getElementById("weeklyChartContainer");
    const monday = getStartOfWeekISO();
    const todayISO = getTodayISO();
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const weekDays = dayLabels.map((label, idx) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
      const iso = toISODate(d);
      const minutes = store.studySessions
        .filter((s) => s.date === iso && isFocusStudySession(s))
        .reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);
      return {
        label,
        iso,
        minutes,
        isToday: iso === todayISO
      };
    });

    const totalMinutes = weekDays.reduce((sum, d) => sum + d.minutes, 0);
    document.getElementById("weeklyTotalBadge").textContent = `${formatDuration(totalMinutes)} studied`;

    const maxMinutes = Math.max(60, ...weekDays.map((d) => d.minutes));
    const barsHTML = weekDays
      .map((d) => {
        const pct = d.minutes > 0 ? Math.max(8, Math.round((d.minutes / maxMinutes) * 100)) : 2;
        return `
          <div class="mini-week-col ${d.isToday ? "is-today" : ""}" title="${d.label}: ${formatDuration(d.minutes)}">
            <div class="mini-bar-track">
              <div class="mini-bar-fill" style="height: ${pct}%;"></div>
            </div>
            <span class="mini-week-day">${d.label}</span>
          </div>
        `;
      })
      .join("");

    container.innerHTML = `<div class="mini-week-chart" role="img" aria-label="Weekly study time">${barsHTML}</div>`;
  }

  function getCurrentTimeHHMM() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  function getClassStatus(cls, nowWeekday, nowHHMM) {
    if (Number(cls.weekday) !== nowWeekday) return "scheduled";
    if (cls.startTime <= nowHHMM && cls.endTime >= nowHHMM) return "current";
    if (cls.startTime > nowHHMM) return "upcoming";
    return "done";
  }

  function renderTodayTimetable(store) {
    const container = document.getElementById("todayTimetableContainer");
    const weekdayIdx = new Date().getDay();
    const weekdayName = WEEKDAY_NAMES[weekdayIdx];
    document.getElementById("timetableWeekdayLabel").textContent = weekdayName;

    const todayClasses = store.timetable
      .filter((c) => Number(c.weekday) === weekdayIdx)
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

    if (todayClasses.length === 0) {
      container.innerHTML = createEmptyStateHTML(
        "bi-clock",
        "No classes today.",
        "Add your timetable to see today's schedule here.",
        "Add class",
        "open-class-modal"
      );
      return;
    }

    const html = todayClasses
      .map(
        (cls) => `
          <div class="planner-row">
            <div class="planner-row-left">
              <span class="schedule-row-time">${escapeHTML(cls.startTime)}</span>
              <span class="planner-row-title">${escapeHTML(cls.name)}</span>
            </div>
            <div class="planner-row-right">
              <span>${escapeHTML(cls.location)}</span>
            </div>
          </div>
        `
      )
      .join("");

    container.innerHTML = `<div class="surface-card planner-list-card">${html}</div>`;
  }

  function renderUpcomingDeadlines(store) {
    const container = document.getElementById("upcomingDeadlinesContainer");
    const today = getTodayISO();

    const upcoming = store.deadlines
      .filter((d) => !d.completed && d.dueDate >= today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    if (upcoming.length === 0) {
      container.innerHTML = createEmptyStateHTML(
        "bi-calendar-event",
        "No upcoming deadlines.",
        "Assignments and exams you add will show up here.",
        "Add deadline",
        "open-deadline-modal"
      );
      return;
    }

    const html = upcoming
      .slice(0, 5)
      .map(
        (item) => `
          <div class="planner-row">
            <div class="planner-row-left">
              <span class="planner-row-title">${escapeHTML(item.title)}</span>
              <span class="planner-row-sub">${escapeHTML(item.subject)}</span>
            </div>
            <div class="planner-row-right">
              <span>${escapeHTML(formatRelativeDateLabel(item.dueDate))}</span>
            </div>
          </div>
        `
      )
      .join("");

    container.innerHTML = `<div class="surface-card planner-list-card">${html}</div>`;
  }

  function renderRecentActivity(store) {
    const container = document.getElementById("recentActivityContainer");
    const countBadge = document.getElementById("recentActivityCount");

    const completedTasks = store.tasks
      .filter((t) => t.completed && t.completedAt)
      .map((t) => ({
        title: `Completed ${t.title}`,
        timestamp: t.completedAt
      }));

    const sessions = store.studySessions.map((s) => ({
      title: `Studied ${s.subject} (${formatDuration(s.durationMinutes)})`,
      timestamp: s.createdAt
    }));

    const completedGoals = (store.goals || [])
      .filter((g) => g.completed && g.completedAt)
      .map((g) => ({
        title: `Reached goal: ${g.title}`,
        timestamp: g.completedAt
      }));

    const combined = [...completedTasks, ...sessions, ...completedGoals]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);

    countBadge.textContent = combined.length > 0 ? `${combined.length} recent` : "";

    if (combined.length === 0) {
      container.innerHTML = createEmptyStateHTML(
        "bi-activity",
        "No recent activity yet.",
        "Completed tasks and study sessions will appear here.",
        null,
        null
      );
      return;
    }

    const html = combined
      .map(
        (act) => `
          <div class="planner-row">
            <div class="planner-row-left">
              <span class="planner-row-title">${escapeHTML(act.title)}</span>
            </div>
            <div class="planner-row-right">
              <span>${escapeHTML(formatTimestamp(act.timestamp))}</span>
            </div>
          </div>
        `
      )
      .join("");

    container.innerHTML = `<div class="surface-card planner-list-card">${html}</div>`;
  }

  function renderSubjectSuggestions(store) {
    const datalist = document.getElementById("subjectSuggestions");
    if (!datalist) return;
    const recordNames = (store.subjectRecords || []).flatMap((s) =>
      [s.code, s.name].filter(Boolean)
    );
    const all = Array.from(new Set([...recordNames, ...(store.subjects || [])]));
    datalist.innerHTML = all
      .map((subject) => `<option value="${escapeHTML(subject)}"></option>`)
      .join("");
  }

  function renderDashboard() {
    const store = loadStore();
    renderGreetingAndDate(store);
    renderTodaySummary(store);
    renderTodayTasks(store);
    renderWeeklyChart(store);
    renderTodayTimetable(store);
    renderUpcomingDeadlines(store);
    renderRecentActivity(store);
    renderSubjectSuggestions(store);
  }

  /* ========================================================================
     Task Management Module (My Tasks View)
     ======================================================================== */

  function isTaskOverdue(task, todayISO) {
    return Boolean(!task.completed && task.date && task.date < todayISO);
  }

  function populateTaskSubjectFilter(store) {
    const select = document.getElementById("taskSubjectFilter");
    if (!select) return;
    const currentVal = taskViewState.subject;
    const subjects = Array.from(
      new Set([
        ...store.subjects,
        ...store.tasks.map((t) => t.subject).filter(Boolean)
      ])
    ).sort((a, b) => a.localeCompare(b));

    select.innerHTML = `<option value="all">All Subjects</option>${subjects
      .map((s) => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`)
      .join("")}`;

    if (subjects.includes(currentVal)) {
      select.value = currentVal;
    } else {
      select.value = "all";
      taskViewState.subject = "all";
    }
  }

  function getFilteredAndSortedTasks(tasks, todayISO) {
    const search = taskViewState.search.trim().toLowerCase();

    const filtered = tasks.filter((task) => {
      if (taskViewState.filter === "today" && task.date !== todayISO) return false;
      if (taskViewState.filter === "upcoming" && (task.completed || !task.date || task.date <= todayISO)) return false;
      if (taskViewState.filter === "overdue" && !isTaskOverdue(task, todayISO)) return false;
      if (taskViewState.filter === "completed" && !task.completed) return false;

      if (taskViewState.priority !== "all" && task.priority !== taskViewState.priority) return false;
      if (taskViewState.subject !== "all" && task.subject !== taskViewState.subject) return false;

      if (search) {
        const haystack = `${task.title} ${task.description || ""} ${task.subject} ${task.category || ""}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      switch (taskViewState.sortBy) {
        case "priority": {
          const diff = (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
          if (diff !== 0) return diff;
          return (a.date || "").localeCompare(b.date || "");
        }
        case "createdAt":
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        case "alphabetical":
          return (a.title || "").localeCompare(b.title || "");
        case "dueDate":
        default: {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          const dateCmp = (a.date || "").localeCompare(b.date || "");
          if (dateCmp !== 0) return dateCmp;
          return (a.dueTime || "").localeCompare(b.dueTime || "");
        }
      }
    });
  }

  function renderTasksView() {
    const store = loadStore();
    const todayISO = getTodayISO();
    const tasks = store.tasks;

    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const pending = total - completed;
    const overdue = tasks.filter((t) => isTaskOverdue(t, todayISO)).length;
    const todayCount = tasks.filter((t) => t.date === todayISO).length;
    const upcomingCount = tasks.filter((t) => !t.completed && t.date && t.date > todayISO).length;

    document.getElementById("tasksStatTotal").textContent = String(total);
    document.getElementById("tasksStatPending").textContent = String(pending);
    document.getElementById("tasksStatOverdue").textContent = String(overdue);
    document.getElementById("tasksStatCompleted").textContent = String(completed);

    document.getElementById("countFilterAll").textContent = String(total);
    document.getElementById("countFilterToday").textContent = String(todayCount);
    document.getElementById("countFilterUpcoming").textContent = String(upcomingCount);
    document.getElementById("countFilterOverdue").textContent = String(overdue);
    document.getElementById("countFilterCompleted").textContent = String(completed);

    populateTaskSubjectFilter(store);

    const container = document.getElementById("tasksListContainer");
    if (total === 0) {
      container.innerHTML = createEmptyStateHTML(
        "bi-check2-square",
        "No tasks yet",
        "Create your first task to organize assignments, exams, and daily study goals.",
        "Add Task",
        "open-task-modal"
      );
      return;
    }

    const visibleTasks = getFilteredAndSortedTasks(tasks, todayISO);
    if (visibleTasks.length === 0) {
      container.innerHTML = createEmptyStateHTML(
        "bi-funnel",
        "No matching tasks",
        "Try adjusting your search or filter criteria to see more tasks.",
        "Clear Filters",
        "reset-task-filters"
      );
      return;
    }

    const html = visibleTasks
      .map((task) => {
        const overdueTask = isTaskOverdue(task, todayISO);
        const isTodayTask = task.date === todayISO && !task.completed;
        const isUrgent = task.priority === "Urgent";
        const priorityClass = `priority-${(task.priority || "medium").toLowerCase()}`;
        const deadlineLabel = overdueTask
          ? `Overdue (${formatRelativeDateLabel(task.date)})`
          : isTodayTask
            ? "Due Today"
            : formatRelativeDateLabel(task.date);
        const deadlineClass = overdueTask ? "is-overdue" : isTodayTask ? "is-today" : "";

        return `
          <div class="task-item task-item-full ${task.completed ? "is-completed" : ""} ${overdueTask ? "is-overdue" : ""} ${isUrgent ? "is-urgent" : ""}">
            <button
              type="button"
              class="task-check-btn"
              data-action="toggle-task"
              data-task-id="${escapeHTML(task.id)}"
              aria-label="${task.completed ? "Reopen task" : "Mark task complete"}"
              aria-pressed="${task.completed}"
            >
              ${task.completed ? '<i class="bi bi-check-lg"></i>' : ""}
            </button>
            <div class="task-content">
              <div class="task-title">${escapeHTML(task.title)}</div>
              ${task.description ? `<div class="task-description">${escapeHTML(task.description)}</div>` : ""}
              <div class="task-badges-row">
                <span class="subject-badge"><i class="bi bi-book"></i>${escapeHTML(task.subject)}</span>
                ${task.category ? `<span class="category-badge">${escapeHTML(task.category)}</span>` : ""}
                <span class="priority-pill ${priorityClass}">${escapeHTML(task.priority)}</span>
                <span class="deadline-badge ${deadlineClass}">
                  <i class="bi bi-calendar-event"></i>${escapeHTML(deadlineLabel)} &middot; ${escapeHTML(formatTime12h(task.dueTime))}
                </span>
                ${task.estimatedMinutes ? `<span class="category-badge"><i class="bi bi-hourglass"></i>${escapeHTML(formatDuration(Number(task.estimatedMinutes)))}</span>` : ""}
              </div>
            </div>
            <div class="task-actions">
              <button
                type="button"
                class="btn-task-action"
                data-action="edit-task"
                data-task-id="${escapeHTML(task.id)}"
                title="Edit task"
                aria-label="Edit task"
              >
                <i class="bi bi-pencil"></i>
              </button>
              <button
                type="button"
                class="btn-task-action btn-task-delete"
                data-action="delete-task"
                data-task-id="${escapeHTML(task.id)}"
                title="Delete task"
                aria-label="Delete task"
              >
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    container.innerHTML = `<div class="task-list">${html}</div>`;
  }

  function renderAllViews() {
    renderDashboard();
    renderTasksView();
    renderCalendarView();
    renderTimetableView();
    renderStudySessionsView();
    renderNotesView();
    renderGoalsView();
    renderSubjectsView();
    renderAnalyticsView();
    renderSettingsView();
  }

  /* ========================================================================
     Settings, Theme & Data Management Module
     ======================================================================== */

  function resolveTheme(preference) {
    if (preference === "dark" || preference === "light") return preference;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(preference) {
    const resolved = resolveTheme(preference);
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-bs-theme", resolved);

    document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.themeChoice === preference);
    });
  }

  function sendBrowserNotification(title, body) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      new Notification(title, { body });
    } catch {
      // Ignore if blocked by browser context
    }
  }

  function updateNotificationPermissionLabel() {
    const el = document.getElementById("notifPermissionStatus");
    if (!el) return;
    if (typeof Notification === "undefined") {
      el.textContent = "Browser notifications are not supported in this browser.";
      return;
    }
    el.textContent = `Browser notification permission: ${Notification.permission}`;
  }

  function exportWorkspaceJSON() {
    const store = loadStore();
    const json = JSON.stringify(store, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studyflow-backup-${getTodayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Backup exported as JSON.");
  }

  function validateImportedStore(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return false;
    const requiredArrays = ["tasks", "studySessions", "notes", "goals"];
    return requiredArrays.every((key) => Array.isArray(data[key]));
  }

  function renderSettingsView() {
    const store = loadStore();
    const student = store.student || {};
    const settings = store.settings || getDefaultStore().settings;
    const timer = store.timerSettings || getDefaultStore().timerSettings;
    const notifs = settings.notifications || {};

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? "";
    };
    const setChecked = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = Boolean(val);
    };

    setVal("settingStudentName", student.name || "Alex Rivera");
    setVal("settingCollege", student.college || "");
    setVal("settingCourse", student.course || "");
    setVal("settingSemester", student.semester || "");

    setVal("settingFocusMins", timer.focus || 25);
    setVal("settingShortBreakMins", timer.shortBreak || 5);
    setVal("settingLongBreakMins", timer.longBreak || 15);
    setVal("settingDailyGoalHrs", settings.dailyStudyGoalHours || 3);
    setVal("settingWeeklyGoalHrs", settings.weeklyStudyGoalHours || 20);

    setChecked("notifDeadlineToggle", notifs.deadlineReminders);
    setChecked("notifTimerToggle", notifs.studyTimerNotifications);
    setChecked("notifGoalToggle", notifs.dailyGoalReminders);

    applyTheme(settings.theme || "light");
    updateNotificationPermissionLabel();
  }

  /* ========================================================================
     Analytics & Insights Module
     ======================================================================== */

  function getAnalyticsDateRange() {
    const now = new Date();
    const todayISO = toISODate(now);
    let startObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    let endObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let label = "the last 7 days";

    if (analyticsState.range === "today") {
      startObj = new Date(endObj);
      label = "today";
    } else if (analyticsState.range === "last30") {
      startObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      label = "the last 30 days";
    } else if (analyticsState.range === "thisMonth") {
      startObj = new Date(now.getFullYear(), now.getMonth(), 1);
      label = "this month";
    } else if (analyticsState.range === "custom") {
      const s = analyticsState.startDate || todayISO;
      const e = analyticsState.endDate || todayISO;
      const [sy, sm, sd] = (s <= e ? s : e).split("-").map(Number);
      const [ey, em, ed] = (s <= e ? e : s).split("-").map(Number);
      startObj = new Date(sy, sm - 1, sd);
      endObj = new Date(ey, em - 1, ed);
      label = `${toISODate(startObj)} to ${toISODate(endObj)}`;
    }

    const dates = [];
    const cursor = new Date(startObj);
    while (cursor <= endObj && dates.length < 180) {
      dates.push(toISODate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      startISO: toISODate(startObj),
      endISO: toISODate(endObj),
      dates,
      label
    };
  }

  function renderSVGTrendChart(container, dates, minutesByDate) {
    const totalMins = dates.reduce((sum, d) => sum + (minutesByDate[d] || 0), 0);
    if (totalMins === 0) {
      container.innerHTML = createEmptyStateHTML(
        "bi-graph-up",
        "Not enough study data for trend",
        "Log study sessions or complete Pomodoro timers within this date range to visualize your study trend.",
        "Start Study Session",
        "open-study-modal"
      );
      return;
    }

    const width = 620;
    const height = 200;
    const padLeft = 36;
    const padRight = 16;
    const padTop = 18;
    const padBottom = 28;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const hoursArr = dates.map((d) => (minutesByDate[d] || 0) / 60);
    const maxHours = Math.max(2, Math.ceil(Math.max(...hoursArr)));

    const points = dates.map((d, idx) => {
      const x = dates.length === 1 ? padLeft + plotW / 2 : padLeft + (idx / (dates.length - 1)) * plotW;
      const y = padTop + plotH - (hoursArr[idx] / maxHours) * plotH;
      return { x, y, date: d, hrs: hoursArr[idx] };
    });

    const polylinePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const areaPoints = `${padLeft},${padTop + plotH} ${polylinePoints} ${points[points.length - 1].x.toFixed(1)},${padTop + plotH}`;

    const gridLines = [0, 0.5, 1]
      .map((ratio) => {
        const y = padTop + plotH - ratio * plotH;
        const val = (ratio * maxHours).toFixed(1).replace(/\.0$/, "");
        return `
          <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#e2e8f0" stroke-dasharray="3 3" />
          <text x="${padLeft - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#64748b">${val}h</text>
        `;
      })
      .join("");

    const step = Math.max(1, Math.ceil(points.length / 7));
    const xLabels = points
      .filter((_, idx) => idx % step === 0 || idx === points.length - 1)
      .map(
        (p) =>
          `<text x="${p.x.toFixed(1)}" y="${height - 6}" text-anchor="middle" font-size="10" fill="#64748b">${p.date.slice(5)}</text>`
      )
      .join("");

    const dots = points
      .map(
        (p) =>
          `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#4f46e5" stroke="#ffffff" stroke-width="1.5"><title>${p.date}: ${p.hrs.toFixed(1)}h</title></circle>`
      )
      .join("");

    container.innerHTML = `
      <div class="svg-trend-wrap">
        <svg class="svg-trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Study hours trend chart">
          ${gridLines}
          <polygon points="${areaPoints}" fill="rgba(79, 70, 229, 0.12)"></polygon>
          <polyline fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${polylinePoints}"></polyline>
          ${dots}
          ${xLabels}
        </svg>
      </div>
    `;
  }

  function renderAnalyticsView() {
    const trendContainer = document.getElementById("anTrendChartContainer");
    if (!trendContainer) return;

    const store = loadStore();
    const todayISO = getTodayISO();
    const mondayISO = toISODate(getStartOfWeekISO());
    const monthStartISO = `${todayISO.slice(0, 7)}-01`;
    const range = getAnalyticsDateRange();

    const focusSessions = (store.studySessions || []).filter(isFocusStudySession);
    const dailyMinutes = focusSessions.filter((s) => s.date === todayISO).reduce((a, s) => a + Number(s.durationMinutes || 0), 0);
    const weeklyMinutes = focusSessions.filter((s) => s.date >= mondayISO && s.date <= todayISO).reduce((a, s) => a + Number(s.durationMinutes || 0), 0);
    const monthlyMinutes = focusSessions.filter((s) => s.date >= monthStartISO && s.date <= todayISO).reduce((a, s) => a + Number(s.durationMinutes || 0), 0);

    const rangeSessions = focusSessions.filter((s) => s.date >= range.startISO && s.date <= range.endISO);
    const rangeTotalMinutes = rangeSessions.reduce((a, s) => a + Number(s.durationMinutes || 0), 0);
    const activeStudyDays = new Set(rangeSessions.map((s) => s.date)).size;
    const avgDailyMinutes = range.dates.length > 0 ? Math.round(rangeTotalMinutes / range.dates.length) : 0;
    const studyStreak = calculateHabitStreak(focusSessions.map((s) => s.date));

    document.getElementById("anDailyStudy").textContent = formatDuration(dailyMinutes);
    document.getElementById("anWeeklyStudy").textContent = formatDuration(weeklyMinutes);
    document.getElementById("anMonthlyStudy").textContent = formatDuration(monthlyMinutes);
    document.getElementById("anStudyStreak").textContent = `${studyStreak}d`;
    document.getElementById("anActiveDays").textContent = `${activeStudyDays} / ${range.dates.length}`;
    document.getElementById("anAvgDaily").textContent = formatDuration(avgDailyMinutes);
    document.getElementById("anRangeTotalBadge").textContent = `${formatDuration(rangeTotalMinutes)} total`;
    document.getElementById("anTrendSubtitle").textContent = `Study hours over ${range.label}`;

    // 1. Productivity Trend (SVG)
    const minutesByDate = {};
    rangeSessions.forEach((s) => {
      minutesByDate[s.date] = (minutesByDate[s.date] || 0) + Number(s.durationMinutes || 0);
    });
    renderSVGTrendChart(trendContainer, range.dates, minutesByDate);

    // 2. Subject Productivity
    const subjectContainer = document.getElementById("anSubjectChartContainer");
    const minutesBySubject = {};
    rangeSessions.forEach((s) => {
      const sub = s.subject || "General";
      minutesBySubject[sub] = (minutesBySubject[sub] || 0) + Number(s.durationMinutes || 0);
    });
    const subjectEntries = Object.entries(minutesBySubject).sort((a, b) => b[1] - a[1]);

    if (subjectEntries.length === 0) {
      subjectContainer.innerHTML = createEmptyStateHTML(
        "bi-book",
        "No subject study data",
        "Log study sessions with a subject to compare study hours across subjects.",
        null,
        null
      );
    } else {
      const maxSubMins = subjectEntries[0][1];
      subjectContainer.innerHTML = `<div class="hbar-list">${subjectEntries
        .map(([sub, mins]) => {
          const pct = maxSubMins > 0 ? Math.round((mins / maxSubMins) * 100) : 0;
          return `
            <div class="hbar-row">
              <div class="hbar-meta">
                <span>${escapeHTML(sub)}</span>
                <span>${escapeHTML(formatDuration(mins))}</span>
              </div>
              <div class="progress slim-progress">
                <div class="progress-bar bg-indigo" style="width: ${pct}%"></div>
              </div>
            </div>
          `;
        })
        .join("")}</div>`;
    }

    // 3. Task Completion & Priority Distribution in Range
    const rangeTasks = (store.tasks || []).filter((t) => t.date >= range.startISO && t.date <= range.endISO);
    const taskCompContainer = document.getElementById("anTaskCompletionContainer");
    const priorityContainer = document.getElementById("anPriorityContainer");

    if (rangeTasks.length === 0) {
      taskCompContainer.innerHTML = createEmptyStateHTML(
        "bi-check2-square",
        "No tasks in this date range",
        "Create tasks with due dates in this period to analyze completion rates.",
        "Add Task",
        "open-task-modal"
      );
      priorityContainer.innerHTML = createEmptyStateHTML(
        "bi-flag",
        "No priority data yet",
        "Add tasks to see how your workload is distributed across priorities.",
        null,
        null
      );
    } else {
      const completedCount = rangeTasks.filter((t) => t.completed).length;
      const overdueCount = rangeTasks.filter((t) => isTaskOverdue(t, todayISO)).length;
      const pendingCount = rangeTasks.length - completedCount - overdueCount;
      const compPct = Math.round((completedCount / rangeTasks.length) * 100);
      const pendPct = Math.round((pendingCount / rangeTasks.length) * 100);
      const overPct = Math.max(0, 100 - compPct - pendPct);

      taskCompContainer.innerHTML = `
        <div class="d-flex justify-content-between align-items-baseline mb-2">
          <span class="h4 fw-bold mb-0">${compPct}% completed</span>
          <span class="small text-muted">${completedCount} of ${rangeTasks.length} tasks</span>
        </div>
        <div class="stacked-bar mb-3">
          <div class="stacked-seg-done" style="width: ${compPct}%"></div>
          <div class="stacked-seg-pending" style="width: ${pendPct}%"></div>
          <div class="stacked-seg-overdue" style="width: ${overPct}%"></div>
        </div>
        <div class="weekly-summary-strip">
          <div class="summary-metric">
            <span class="summary-metric-label">Completed</span>
            <span class="summary-metric-value text-success-custom">${completedCount}</span>
          </div>
          <div class="summary-metric">
            <span class="summary-metric-label">Pending</span>
            <span class="summary-metric-value">${pendingCount}</span>
          </div>
          <div class="summary-metric">
            <span class="summary-metric-label">Overdue</span>
            <span class="summary-metric-value text-danger-custom">${overdueCount}</span>
          </div>
        </div>
      `;

      const priorities = ["Urgent", "High", "Medium", "Low"];
      priorityContainer.innerHTML = `<div class="hbar-list">${priorities
        .map((p) => {
          const count = rangeTasks.filter((t) => t.priority === p).length;
          const pct = Math.round((count / rangeTasks.length) * 100);
          return `
            <div class="hbar-row">
              <div class="hbar-meta">
                <span>${p}</span>
                <span>${count} (${pct}%)</span>
              </div>
              <div class="progress slim-progress">
                <div class="progress-bar bg-indigo" style="width: ${pct}%"></div>
              </div>
            </div>
          `;
        })
        .join("")}</div>`;
    }

    // 4. Weekly Activity (Tasks Completed Each Day This Week)
    const weeklyActContainer = document.getElementById("anWeeklyActivityContainer");
    const monday = getStartOfWeekISO();
    const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const completedThisWeek = weekLabels.map((label, idx) => {
      const iso = toISODate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx));
      const count = (store.tasks || []).filter((t) => {
        if (!t.completed) return false;
        const doneDate = t.completedAt ? toISODate(new Date(t.completedAt)) : t.date;
        return doneDate === iso;
      }).length;
      return { label, iso, count, isToday: iso === todayISO };
    });

    const totalDoneWeek = completedThisWeek.reduce((sum, d) => sum + d.count, 0);
    if (totalDoneWeek === 0) {
      weeklyActContainer.innerHTML = createEmptyStateHTML(
        "bi-bar-chart",
        "No tasks completed this week",
        "Complete tasks to track your daily task completion momentum.",
        null,
        null
      );
    } else {
      const maxCount = Math.max(1, ...completedThisWeek.map((d) => d.count));
      weeklyActContainer.innerHTML = `
        <div class="weekly-chart" style="height: 170px;">
          <div class="chart-bars">
            ${completedThisWeek
              .map((d) => {
                const pct = Math.round((d.count / maxCount) * 100);
                return `
                  <div class="chart-col ${d.isToday ? "is-today" : ""}">
                    <div class="bar-track">
                      <div class="bar-fill ${d.isToday ? "bar-fill-active" : ""}" style="height: ${pct}%;">
                        <span class="bar-tooltip">${d.count}</span>
                      </div>
                    </div>
                    <span class="bar-day">${d.label}</span>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      `;
    }

    // 5. Goal Progress
    const goalProgContainer = document.getElementById("anGoalProgressContainer");
    const goals = store.goals || [];
    if (goals.length === 0) {
      goalProgContainer.innerHTML = createEmptyStateHTML(
        "bi-bullseye",
        "No goals created yet",
        "Create academic goals to monitor active, completed, and average completion.",
        "Add Goal",
        "open-goal-modal"
      );
    } else {
      const activeG = goals.filter((g) => !g.completed).length;
      const doneG = goals.filter((g) => g.completed).length;
      const avgPct = Math.round(
        goals.reduce((sum, g) => {
          if (g.completed) return sum + 100;
          const tv = Math.max(1, Number(g.targetValue || 1));
          const cv = Math.max(0, Number(g.currentValue || 0));
          return sum + Math.min(100, (cv / tv) * 100);
        }, 0) / goals.length
      );

      goalProgContainer.innerHTML = `
        <div class="d-flex justify-content-between align-items-baseline mb-2">
          <span class="h4 fw-bold mb-0">${avgPct}% average</span>
          <span class="small text-muted">${goals.length} total goals</span>
        </div>
        <div class="progress slim-progress mb-3">
          <div class="progress-bar bg-indigo" style="width: ${avgPct}%"></div>
        </div>
        <div class="weekly-summary-strip">
          <div class="summary-metric">
            <span class="summary-metric-label">Active Goals</span>
            <span class="summary-metric-value">${activeG}</span>
          </div>
          <div class="summary-metric">
            <span class="summary-metric-label">Completed</span>
            <span class="summary-metric-value text-success-custom">${doneG}</span>
          </div>
          <div class="summary-metric">
            <span class="summary-metric-label">Completion</span>
            <span class="summary-metric-value">${avgPct}%</span>
          </div>
        </div>
      `;
    }

    // 6. Data-Driven Insights
    const insightsContainer = document.getElementById("anInsightsContainer");
    const insights = [];

    if (rangeTotalMinutes > 0) {
      insights.push(`You studied ${formatDuration(rangeTotalMinutes)} during ${range.label}.`);
    }
    if (subjectEntries.length > 0) {
      const [topSub, topMins] = subjectEntries[0];
      insights.push(`${topSub} received the most study time (${formatDuration(topMins)}).`);
    }
    if (weeklyMinutes > 0) {
      const weekFullNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const weekMinsByDay = weekFullNames.map((name, idx) => {
        const iso = toISODate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx));
        const mins = focusSessions.filter((s) => s.date === iso).reduce((a, s) => a + Number(s.durationMinutes || 0), 0);
        return { name, mins };
      });
      const best = weekMinsByDay.reduce((a, b) => (b.mins > a.mins ? b : a), weekMinsByDay[0]);
      if (best.mins > 0) {
        insights.push(`Your most productive day this week was ${best.name} (${formatDuration(best.mins)}).`);
      }
    }
    if (rangeTasks.length > 0) {
      const done = rangeTasks.filter((t) => t.completed).length;
      const pct = Math.round((done / rangeTasks.length) * 100);
      insights.push(`You completed ${pct}% of your tasks in ${range.label}.`);
    }
    if (studyStreak > 0) {
      insights.push(`You currently have a ${studyStreak}-day study streak.`);
    }

    if (insights.length === 0) {
      insightsContainer.innerHTML = createEmptyStateHTML(
        "bi-lightbulb",
        "Insufficient data for insights",
        "Log study sessions or complete tasks to generate insights from your real activity.",
        null,
        null
      );
    } else {
      insightsContainer.innerHTML = `<div class="insight-list">${insights
        .map((txt) => `<div class="insight-item"><i class="bi bi-stars"></i><span>${escapeHTML(txt)}</span></div>`)
        .join("")}</div>`;
    }
  }

  /* ========================================================================
     Subjects & Academic Progress Module
     ======================================================================== */

  function matchesSubject(itemSubject, subjectObj) {
    if (!itemSubject || !subjectObj) return false;
    const val = itemSubject.trim().toLowerCase();
    const name = (subjectObj.name || "").trim().toLowerCase();
    const code = (subjectObj.code || "").trim().toLowerCase();
    return val === name || (code !== "" && val === code);
  }

  function computeSubjectStats(store, subjectObj) {
    const tasks = (store.tasks || []).filter((t) => matchesSubject(t.subject, subjectObj));
    const completedTasks = tasks.filter((t) => t.completed).length;
    const pendingTasks = tasks.length - completedTasks;
    const taskPct = tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);

    const sessions = (store.studySessions || []).filter(
      (s) => isFocusStudySession(s) && matchesSubject(s.subject, subjectObj)
    );
    const studyMinutes = sessions.reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);

    const notes = (store.notes || []).filter((n) => matchesSubject(n.subject, subjectObj));

    const todayISO = getTodayISO();
    const deadlines = (store.deadlines || [])
      .filter((d) => !d.completed && d.dueDate >= todayISO && matchesSubject(d.subject, subjectObj))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const assessments = subjectObj.assessments || [];
    const totalObtained = assessments.reduce((sum, a) => sum + Number(a.marksObtained || 0), 0);
    const totalMax = assessments.reduce((sum, a) => sum + Number(a.maxMarks || 0), 0);
    const avgMarksPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : null;

    return {
      tasks,
      completedTasks,
      pendingTasks,
      taskPct,
      sessions,
      studyMinutes,
      notes,
      deadlines,
      assessments,
      totalObtained,
      totalMax,
      avgMarksPct
    };
  }

  function renderSubjectsView() {
    const listSection = document.getElementById("subjectsListSection");
    const detailSection = document.getElementById("subjectDetailSection");
    const gridContainer = document.getElementById("subjectsGridContainer");
    if (!listSection || !detailSection || !gridContainer) return;

    const store = loadStore();
    const records = store.subjectRecords || [];

    // Check if detail page is active and subject still exists
    if (subjectViewState.selectedSubjectId) {
      const selected = records.find((s) => s.id === subjectViewState.selectedSubjectId);
      if (selected) {
        listSection.classList.add("d-none");
        detailSection.classList.remove("d-none");
        renderSubjectDetailPage(store, selected);
        return;
      }
      subjectViewState.selectedSubjectId = null;
    }

    listSection.classList.remove("d-none");
    detailSection.classList.add("d-none");

    if (records.length === 0) {
      gridContainer.innerHTML = `<div class="surface-card section-card">${createEmptyStateHTML(
        "bi-book",
        "No subjects added yet",
        "Add your semester courses to track tasks, notes, study hours, deadlines, and assessment marks.",
        "Add Subject",
        "open-subject-modal"
      )}</div>`;
      return;
    }

    const cardsHTML = records
      .map((sub) => {
        const stats = computeSubjectStats(store, sub);
        const color = sub.color || "#4f46e5";
        return `
          <article class="surface-card subject-card" style="border-top-color: ${escapeHTML(color)};">
            <div class="d-flex align-items-start justify-content-between gap-2">
              <div>
                <span class="subject-code-pill">${escapeHTML(sub.code)}</span>
                <h2 class="h6 fw-bold mt-2 mb-1">${escapeHTML(sub.name)}</h2>
                <div class="small text-muted">${escapeHTML(sub.teacher)} &middot; ${escapeHTML(sub.semester)}</div>
              </div>
              <div class="task-actions">
                <button type="button" class="btn-task-action" data-action="edit-subject" data-subject-id="${escapeHTML(sub.id)}" title="Edit subject" aria-label="Edit subject">
                  <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn-task-action btn-task-delete" data-action="delete-subject" data-subject-id="${escapeHTML(sub.id)}" title="Delete subject" aria-label="Delete subject">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>

            <div class="task-badges-row mt-0">
              <span class="category-badge">${escapeHTML(sub.credits)} credits</span>
              <span class="category-badge">Target: ${escapeHTML(sub.targetGrade)}</span>
              <span class="subject-badge">${escapeHTML(formatDuration(stats.studyMinutes))} studied</span>
            </div>

            <div>
              <div class="d-flex justify-content-between small fw-semibold mb-1">
                <span>Tasks (${stats.completedTasks}/${stats.tasks.length})</span>
                <span>${stats.taskPct}%</span>
              </div>
              <div class="progress slim-progress" role="progressbar" aria-valuenow="${stats.taskPct}" aria-valuemin="0" aria-valuemax="100">
                <div class="progress-bar bg-indigo" style="width: ${stats.taskPct}%"></div>
              </div>
            </div>

            <div class="d-flex align-items-center justify-content-between pt-2 border-top">
              <span class="small text-muted">
                ${stats.avgMarksPct !== null ? `Avg. Marks: <strong>${stats.avgMarksPct}%</strong>` : "No assessments yet"}
              </span>
              <button type="button" class="btn btn-sm btn-outline-accent" data-action="view-subject-detail" data-subject-id="${escapeHTML(sub.id)}">
                Details <i class="bi bi-arrow-right"></i>
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    gridContainer.innerHTML = `<div class="subjects-grid">${cardsHTML}</div>`;
  }

  function renderSubjectDetailPage(store, sub) {
    const container = document.getElementById("subjectDetailSection");
    if (!container) return;

    const stats = computeSubjectStats(store, sub);
    const color = sub.color || "#4f46e5";

    const assessmentsHTML =
      stats.assessments.length === 0
        ? createEmptyStateHTML(
            "bi-award",
            "No assessments recorded",
            "Enter exam, quiz, or assignment marks to calculate your real percentage and average.",
            "Add Assessment",
            "open-assessment-modal"
          )
        : `
          <div class="mb-3">
            <div class="d-flex justify-content-between small fw-semibold mb-1">
              <span>Assessment Progress (${stats.totalObtained} / ${stats.totalMax} marks)</span>
              <span>${stats.avgMarksPct}% avg</span>
            </div>
            <div class="progress slim-progress">
              <div class="progress-bar bg-indigo" style="width: ${Math.min(100, stats.avgMarksPct)}%"></div>
            </div>
          </div>
          <div class="d-flex flex-column gap-2">
            ${stats.assessments
              .map((a) => {
                const pct = a.maxMarks > 0 ? Math.round((a.marksObtained / a.maxMarks) * 1000) / 10 : 0;
                return `
                  <div class="assessment-row">
                    <div class="min-width-0">
                      <div class="fw-semibold small">${escapeHTML(a.name)}</div>
                      <div class="small text-muted">${escapeHTML(a.date)} &middot; ${a.marksObtained} / ${a.maxMarks} marks</div>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                      <span class="badge-soft badge-soft-indigo">${pct}%</span>
                      <button
                        type="button"
                        class="btn-task-action btn-task-delete"
                        data-action="delete-assessment"
                        data-subject-id="${escapeHTML(sub.id)}"
                        data-assessment-id="${escapeHTML(a.id)}"
                        title="Delete assessment"
                        aria-label="Delete assessment"
                      >
                        <i class="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        `;

    const tasksHTML =
      stats.tasks.length === 0
        ? '<p class="text-muted small mb-0">No tasks linked to this subject yet.</p>'
        : `<div class="task-list">${stats.tasks
            .map(
              (t) => `
                <div class="task-item ${t.completed ? "is-completed" : ""}">
                  <button
                    type="button"
                    class="task-check-btn"
                    data-action="toggle-task"
                    data-task-id="${escapeHTML(t.id)}"
                    aria-label="Toggle task"
                  >
                    ${t.completed ? '<i class="bi bi-check-lg"></i>' : ""}
                  </button>
                  <div class="task-content">
                    <div class="task-title">${escapeHTML(t.title)}</div>
                    <div class="task-meta">${escapeHTML(t.date)} &middot; ${escapeHTML(t.priority)}</div>
                  </div>
                </div>
              `
            )
            .join("")}</div>`;

    const deadlinesHTML =
      stats.deadlines.length === 0
        ? '<p class="text-muted small mb-0">No upcoming deadlines for this subject.</p>'
        : `<div class="deadline-list">${stats.deadlines
            .map(
              (d) => `
                <div class="deadline-item">
                  <div class="deadline-info">
                    <div class="deadline-title">${escapeHTML(d.title)}</div>
                    <div class="deadline-course">${escapeHTML(d.type)} &middot; ${escapeHTML(d.dueDate)}</div>
                  </div>
                  <span class="priority-pill priority-${(d.priority || "medium").toLowerCase()}">${escapeHTML(formatRelativeDateLabel(d.dueDate))}</span>
                </div>
              `
            )
            .join("")}</div>`;

    const notesHTML =
      stats.notes.length === 0
        ? '<p class="text-muted small mb-0">No notes saved for this subject yet.</p>'
        : `<div class="d-flex flex-column gap-2">${stats.notes
            .map(
              (n) => `
                <div class="assessment-row">
                  <div class="min-width-0">
                    <div class="fw-semibold small">${escapeHTML(n.title)}</div>
                    <div class="small text-muted">Edited ${escapeHTML(formatTimestamp(n.updatedAt || n.createdAt))}</div>
                  </div>
                  <button type="button" class="btn btn-sm btn-outline-accent" data-action="edit-note" data-note-id="${escapeHTML(n.id)}">Open</button>
                </div>
              `
            )
            .join("")}</div>`;

    const sessionsHTML =
      stats.sessions.length === 0
        ? '<p class="text-muted small mb-0">No study sessions logged for this subject yet.</p>'
        : `<div class="d-flex flex-column gap-2">${stats.sessions
            .map(
              (s) => `
                <div class="assessment-row">
                  <div class="min-width-0">
                    <div class="fw-semibold small">${escapeHTML(s.topic || "Study Session")}</div>
                    <div class="small text-muted">${escapeHTML(s.date)} &middot; ${escapeHTML(formatDuration(Number(s.durationMinutes)))}</div>
                  </div>
                </div>
              `
            )
            .join("")}</div>`;

    container.innerHTML = `
      <div class="surface-card tasks-header mb-4" style="border-top: 4px solid ${escapeHTML(color)};">
        <div class="d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <button type="button" class="btn btn-sm btn-outline-accent mb-2" data-action="back-to-subjects">
              <i class="bi bi-arrow-left"></i> All Subjects
            </button>
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="subject-code-pill">${escapeHTML(sub.code)}</span>
              <h1 class="greeting-title mb-0">${escapeHTML(sub.name)}</h1>
            </div>
            <p class="greeting-subtitle mt-1 mb-0">
              ${escapeHTML(sub.teacher)} &middot; ${escapeHTML(sub.semester)} &middot; ${escapeHTML(sub.credits)} Credits &middot; Target Grade: ${escapeHTML(sub.targetGrade)}
            </p>
            ${sub.description ? `<p class="small text-secondary mt-2 mb-0">${escapeHTML(sub.description)}</p>` : ""}
          </div>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-sm btn-outline-accent" data-action="edit-subject" data-subject-id="${escapeHTML(sub.id)}">
              <i class="bi bi-pencil"></i> Edit
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete-subject" data-subject-id="${escapeHTML(sub.id)}">
              <i class="bi bi-trash"></i> Delete
            </button>
          </div>
        </div>

        <div class="task-stats-strip mt-3 pt-3">
          <div class="task-stat-item">
            <span class="task-stat-label">Tasks (Done / Total)</span>
            <span class="task-stat-value">${stats.completedTasks} / ${stats.tasks.length} (${stats.pendingTasks} pending)</span>
          </div>
          <div class="task-stat-item">
            <span class="task-stat-label">Study Hours</span>
            <span class="task-stat-value">${escapeHTML(formatDuration(stats.studyMinutes))}</span>
          </div>
          <div class="task-stat-item">
            <span class="task-stat-label">Task Progress</span>
            <span class="task-stat-value">${stats.taskPct}%</span>
          </div>
          <div class="task-stat-item">
            <span class="task-stat-label">Average Marks</span>
            <span class="task-stat-value">${stats.avgMarksPct !== null ? `${stats.avgMarksPct}%` : "—"}</span>
          </div>
        </div>
      </div>

      <div class="row g-3 g-lg-4">
        <div class="col-12 col-lg-6">
          <article class="surface-card section-card h-100">
            <div class="section-header">
              <div>
                <h2 class="section-title">Academic Progress &amp; Assessments</h2>
                <p class="section-subtitle mb-0">Calculated strictly from entered assessment marks</p>
              </div>
              <button type="button" class="btn btn-sm btn-accent" data-action="open-assessment-modal" data-subject-id="${escapeHTML(sub.id)}">
                <i class="bi bi-plus-lg"></i> Add Assessment
              </button>
            </div>
            <div class="section-body-fill">${assessmentsHTML}</div>
          </article>
        </div>

        <div class="col-12 col-lg-6">
          <article class="surface-card section-card h-100">
            <div class="section-header">
              <div>
                <h2 class="section-title">Subject Tasks</h2>
                <p class="section-subtitle mb-0">${stats.tasks.length} tasks</p>
              </div>
            </div>
            ${tasksHTML}
          </article>
        </div>

        <div class="col-12 col-lg-4">
          <article class="surface-card section-card h-100">
            <div class="section-header">
              <h2 class="section-title mb-0">Upcoming Deadlines</h2>
            </div>
            ${deadlinesHTML}
          </article>
        </div>

        <div class="col-12 col-lg-4">
          <article class="surface-card section-card h-100">
            <div class="section-header">
              <h2 class="section-title mb-0">Subject Notes (${stats.notes.length})</h2>
            </div>
            ${notesHTML}
          </article>
        </div>

        <div class="col-12 col-lg-4">
          <article class="surface-card section-card h-100">
            <div class="section-header">
              <h2 class="section-title mb-0">Study Sessions (${stats.sessions.length})</h2>
            </div>
            ${sessionsHTML}
          </article>
        </div>
      </div>
    `;
  }

  function openSubjectModalForCreate() {
    document.getElementById("subjectForm").reset();
    document.getElementById("subjectId").value = "";
    document.getElementById("subjectModalLabel").textContent = "Add Subject";
    document.getElementById("subjectSubmitBtn").textContent = "Save Subject";
    document.getElementById("subjectCredits").value = "3";
    document.getElementById("subjectColor").value = "#4f46e5";
    openModalById("subjectModal");
  }

  function openSubjectModalForEdit(subjectId) {
    const store = loadStore();
    const sub = (store.subjectRecords || []).find((s) => s.id === subjectId);
    if (!sub) return;

    document.getElementById("subjectId").value = sub.id;
    document.getElementById("subjectModalLabel").textContent = "Edit Subject";
    document.getElementById("subjectSubmitBtn").textContent = "Update Subject";
    document.getElementById("subjectName").value = sub.name || "";
    document.getElementById("subjectCode").value = sub.code || "";
    document.getElementById("subjectTeacher").value = sub.teacher || "";
    document.getElementById("subjectSemester").value = sub.semester || "";
    document.getElementById("subjectCredits").value = String(sub.credits || 3);
    document.getElementById("subjectTargetGrade").value = sub.targetGrade || "";
    document.getElementById("subjectColor").value = sub.color || "#4f46e5";
    document.getElementById("subjectDescription").value = sub.description || "";
    openModalById("subjectModal");
  }

  function openAssessmentModal(subjectId) {
    const idToUse = subjectId || subjectViewState.selectedSubjectId;
    if (!idToUse) return;
    document.getElementById("assessmentForm").reset();
    document.getElementById("assessmentSubjectId").value = idToUse;
    document.getElementById("assessmentDate").value = getTodayISO();
    document.getElementById("assessmentMaxMarks").value = "100";
    openModalById("assessmentModal");
  }

  /* ========================================================================
     Goals & Habit Tracker Module
     ======================================================================== */

  function calculateHabitStreak(completedDates) {
    const set = new Set(completedDates || []);
    if (set.size === 0) return 0;

    const now = new Date();
    const todayISO = toISODate(now);
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterdayISO = toISODate(yesterday);

    let cursor = null;
    if (set.has(todayISO)) {
      cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (set.has(yesterdayISO)) {
      cursor = yesterday;
    } else {
      return 0;
    }

    let streak = 0;
    while (set.has(toISODate(cursor))) {
      streak += 1;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
    }
    return streak;
  }

  function renderGoalsView() {
    const goalsContainer = document.getElementById("goalsListContainer");
    const habitsContainer = document.getElementById("habitsListContainer");
    const calendarContainer = document.getElementById("habitCalendarContainer");
    if (!goalsContainer || !habitsContainer || !calendarContainer) return;

    const store = loadStore();
    const goals = store.goals || [];
    const habits = store.habits || [];
    const todayISO = getTodayISO();

    // Summary strip
    const activeGoals = goals.filter((g) => !g.completed).length;
    const completedGoals = goals.filter((g) => g.completed).length;
    const habitsDoneToday = habits.filter((h) => (h.completedDates || []).includes(todayISO)).length;

    const monday = getStartOfWeekISO();
    const weekDates = Array.from({ length: 7 }, (_, i) =>
      toISODate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))
    );
    const elapsedWeekDates = weekDates.filter((d) => d <= todayISO);
    const totalPossibleChecks = habits.length * elapsedWeekDates.length;
    const actualWeekChecks = habits.reduce(
      (sum, h) => sum + elapsedWeekDates.filter((d) => (h.completedDates || []).includes(d)).length,
      0
    );
    const weeklyHabitRate = totalPossibleChecks === 0 ? 0 : Math.round((actualWeekChecks / totalPossibleChecks) * 100);

    document.getElementById("ghStatActiveGoals").textContent = String(activeGoals);
    document.getElementById("ghStatCompletedGoals").textContent = String(completedGoals);
    document.getElementById("ghStatHabitsToday").textContent = `${habitsDoneToday} / ${habits.length}`;
    document.getElementById("ghStatWeeklyHabitRate").textContent = `${weeklyHabitRate}%`;

    // Render Goals
    if (goals.length === 0) {
      goalsContainer.innerHTML = createEmptyStateHTML(
        "bi-bullseye",
        "No academic goals yet",
        "Set measurable goals for your syllabus, study hours, assignments, or exam prep.",
        "Add Goal",
        "open-goal-modal"
      );
    } else {
      const sortedGoals = [...goals].sort((a, b) => {
        if (Boolean(a.completed) !== Boolean(b.completed)) return a.completed ? 1 : -1;
        return (a.targetDate || "").localeCompare(b.targetDate || "");
      });

      const goalsHTML = sortedGoals
        .map((g) => {
          const targetVal = Math.max(1, Number(g.targetValue || 1));
          const currentVal = Math.max(0, Number(g.currentValue || 0));
          const pct = g.completed ? 100 : Math.min(100, Math.round((currentVal / targetVal) * 100));
          const priority = g.priority || "Medium";
          const priorityClass = `priority-${priority.toLowerCase()}`;
          const countdown = getDeadlineStatusInfo(
            { dueDate: g.targetDate || todayISO, completed: Boolean(g.completed) },
            todayISO
          );

          return `
            <article class="goal-card ${g.completed ? "is-completed" : ""}">
              <div class="d-flex align-items-start justify-content-between gap-2">
                <div>
                  <div class="fw-bold">${escapeHTML(g.title)}</div>
                  ${g.description ? `<div class="small text-secondary mt-1">${escapeHTML(g.description)}</div>` : ""}
                </div>
                <div class="task-actions">
                  <button type="button" class="btn-task-action" data-action="edit-goal" data-goal-id="${escapeHTML(g.id)}" title="Edit goal" aria-label="Edit goal">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button type="button" class="btn-task-action btn-task-delete" data-action="delete-goal" data-goal-id="${escapeHTML(g.id)}" title="Delete goal" aria-label="Delete goal">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>

              <div class="task-badges-row mt-0">
                <span class="subject-badge">${escapeHTML(g.category || "General")}</span>
                <span class="priority-pill ${priorityClass}">${escapeHTML(priority)}</span>
                <span class="priority-pill ${countdown.badgeClass}">${escapeHTML(countdown.label)}</span>
              </div>

              <div>
                <div class="d-flex justify-content-between small fw-semibold mb-1">
                  <span>Progress: ${currentVal} / ${targetVal}</span>
                  <span>${pct}%</span>
                </div>
                <div class="progress slim-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
                  <div class="progress-bar bg-indigo" style="width: ${pct}%"></div>
                </div>
              </div>

              <div class="d-flex flex-wrap gap-2 mt-1">
                ${
                  !g.completed
                    ? `<button type="button" class="btn btn-sm btn-outline-accent" data-action="increment-goal" data-goal-id="${escapeHTML(g.id)}">
                         <i class="bi bi-plus-lg"></i> +1 Progress
                       </button>`
                    : ""
                }
                <button type="button" class="btn btn-sm ${g.completed ? "btn-outline-accent" : "btn-accent"}" data-action="toggle-goal-complete" data-goal-id="${escapeHTML(g.id)}">
                  <i class="bi ${g.completed ? "bi-arrow-counterclockwise" : "bi-check-lg"}"></i>
                  ${g.completed ? "Reopen" : "Mark Completed"}
                </button>
              </div>
            </article>
          `;
        })
        .join("");

      goalsContainer.innerHTML = `<div class="goals-grid">${goalsHTML}</div>`;
    }

    // Render Habits
    const weekShort = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    if (habits.length === 0) {
      habitsContainer.innerHTML = createEmptyStateHTML(
        "bi-repeat",
        "No daily habits tracked yet",
        "Add daily habits like Study daily, Exercise, Read, or Revise to build streaks.",
        "Add Habit",
        "open-habit-modal"
      );
    } else {
      const habitsHTML = habits
        .map((h) => {
          const dates = h.completedDates || [];
          const doneToday = dates.includes(todayISO);
          const streak = calculateHabitStreak(dates);
          const weekDoneCount = weekDates.filter((d) => dates.includes(d)).length;

          const weekPillsHTML = weekDates
            .map((iso, idx) => {
              const isDone = dates.includes(iso);
              const isToday = iso === todayISO;
              return `
                <button
                  type="button"
                  class="habit-day-pill ${isDone ? "is-done" : ""} ${isToday ? "is-today" : ""}"
                  data-action="toggle-habit-date"
                  data-habit-id="${escapeHTML(h.id)}"
                  data-date="${iso}"
                  title="${iso}"
                >
                  ${weekShort[idx]}
                </button>
              `;
            })
            .join("");

          return `
            <div class="habit-card">
              <div class="d-flex align-items-center justify-content-between gap-2">
                <div class="d-flex align-items-center gap-2 min-width-0">
                  <button
                    type="button"
                    class="task-check-btn"
                    style="${doneToday ? "background-color: var(--success); border-color: var(--success);" : ""}"
                    data-action="toggle-habit-date"
                    data-habit-id="${escapeHTML(h.id)}"
                    data-date="${todayISO}"
                    aria-label="Toggle habit for today"
                  >
                    ${doneToday ? '<i class="bi bi-check-lg"></i>' : ""}
                  </button>
                  <div>
                    <div class="fw-bold">${escapeHTML(h.title)}</div>
                    <div class="small text-muted">${escapeHTML(h.category || "Study")} &middot; ${weekDoneCount}/7 this week</div>
                  </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <span class="trend-pill ${streak > 0 ? "trend-success" : "trend-neutral"}">
                    <i class="bi bi-fire me-1"></i>${streak}d streak
                  </span>
                  <button
                    type="button"
                    class="btn-task-action btn-task-delete"
                    data-action="delete-habit"
                    data-habit-id="${escapeHTML(h.id)}"
                    title="Delete habit"
                    aria-label="Delete habit"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
              <div class="habit-week-row">${weekPillsHTML}</div>
            </div>
          `;
        })
        .join("");

      habitsContainer.innerHTML = `<div class="habit-list">${habitsHTML}</div>`;
    }

    // Render 28-Day Habit Calendar
    const totalCheckIns = habits.reduce((sum, h) => sum + (h.completedDates || []).length, 0);
    document.getElementById("habitCalendarTotalBadge").textContent = `${totalCheckIns} check-ins`;

    if (habits.length === 0) {
      calendarContainer.innerHTML = createEmptyStateHTML(
        "bi-calendar-check",
        "No habit history yet",
        "Your 28-day consistency calendar will populate automatically as you complete habits.",
        null,
        null
      );
    } else {
      const now = new Date();
      const cellsHTML = Array.from({ length: 28 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (27 - i));
        const iso = toISODate(d);
        const count = habits.filter((h) => (h.completedDates || []).includes(iso)).length;
        const ratio = habits.length > 0 ? count / habits.length : 0;
        const level =
          count === 0 ? "" : ratio >= 0.8 ? "level-3" : ratio >= 0.4 ? "level-2" : "level-1";

        return `
          <div class="habit-cal-cell ${level} ${iso === todayISO ? "is-today" : ""}" title="${iso}: ${count}/${habits.length} habits">
            <span>${d.getDate()}</span>
          </div>
        `;
      }).join("");

      calendarContainer.innerHTML = `<div class="habit-calendar-grid">${cellsHTML}</div>`;
    }
  }

  function openGoalModalForCreate() {
    document.getElementById("goalForm").reset();
    document.getElementById("goalId").value = "";
    document.getElementById("goalModalLabel").textContent = "Add Academic Goal";
    document.getElementById("goalSubmitBtn").textContent = "Save Goal";
    document.getElementById("goalStartDate").value = getTodayISO();
    document.getElementById("goalTargetDate").value = getTodayISO();
    document.getElementById("goalTargetValue").value = "10";
    document.getElementById("goalCurrentValue").value = "0";
    document.getElementById("goalPriority").value = "Medium";
    openModalById("goalModal");
  }

  function openGoalModalForEdit(goalId) {
    const store = loadStore();
    const goal = (store.goals || []).find((g) => g.id === goalId);
    if (!goal) return;

    document.getElementById("goalId").value = goal.id;
    document.getElementById("goalModalLabel").textContent = "Edit Academic Goal";
    document.getElementById("goalSubmitBtn").textContent = "Update Goal";
    document.getElementById("goalTitle").value = goal.title || "";
    document.getElementById("goalDescription").value = goal.description || "";
    document.getElementById("goalCategory").value = goal.category || "Syllabus";
    document.getElementById("goalPriority").value = goal.priority || "Medium";
    document.getElementById("goalStartDate").value = goal.startDate || getTodayISO();
    document.getElementById("goalTargetDate").value = goal.targetDate || getTodayISO();
    document.getElementById("goalTargetValue").value = String(goal.targetValue || 10);
    document.getElementById("goalCurrentValue").value = String(goal.currentValue || 0);
    openModalById("goalModal");
  }

  /* ========================================================================
     Notes Module & IndexedDB Attachments
     ======================================================================== */

  function openAttachmentsDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB is not supported in this browser."));
        return;
      }
      const req = window.indexedDB.open(ATTACHMENTS_DB_NAME, ATTACHMENTS_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(ATTACHMENTS_STORE)) {
          const store = db.createObjectStore(ATTACHMENTS_STORE, { keyPath: "id" });
          store.createIndex("noteId", "noteId", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Failed to open file storage."));
    });
  }

  async function saveAttachmentToDB(record) {
    const db = await openAttachmentsDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACHMENTS_STORE, "readwrite");
      tx.objectStore(ATTACHMENTS_STORE).put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error("Failed to save file."));
      };
    });
  }

  async function getAttachmentFromDB(attachmentId) {
    const db = await openAttachmentsDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACHMENTS_STORE, "readonly");
      const req = tx.objectStore(ATTACHMENTS_STORE).get(attachmentId);
      req.onsuccess = () => {
        db.close();
        resolve(req.result || null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error || new Error("Failed to read file."));
      };
    });
  }

  async function deleteAttachmentFromDB(attachmentId) {
    const db = await openAttachmentsDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACHMENTS_STORE, "readwrite");
      tx.objectStore(ATTACHMENTS_STORE).delete(attachmentId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error("Failed to delete file."));
      };
    });
  }

  async function deleteAttachmentsForNoteFromDB(noteId) {
    const db = await openAttachmentsDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACHMENTS_STORE, "readwrite");
      const store = tx.objectStore(ATTACHMENTS_STORE);
      const index = store.index("noteId");
      const req = index.getAllKeys(noteId);
      req.onsuccess = () => {
        (req.result || []).forEach((key) => store.delete(key));
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error("Failed to clean up note attachments."));
      };
    });
  }

  async function clearAttachmentsDB() {
    try {
      const db = await openAttachmentsDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(ATTACHMENTS_STORE, "readwrite");
        tx.objectStore(ATTACHMENTS_STORE).clear();
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      });
    } catch {
      // Ignore if IndexedDB is unavailable
    }
  }

  function getFileExtension(filename) {
    const parts = String(filename || "").toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
  }

  function formatFileSize(bytes) {
    const size = Number(bytes || 0);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function isImageAttachment(name, type) {
    if (type && type.startsWith("image/")) return true;
    const ext = getFileExtension(name);
    return ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
  }

  function isPdfAttachment(name, type) {
    return type === "application/pdf" || getFileExtension(name) === "pdf";
  }

  function getAttachmentIconClass(name, type) {
    if (isImageAttachment(name, type)) return "bi-file-earmark-image";
    if (isPdfAttachment(name, type)) return "bi-file-earmark-pdf";
    const ext = getFileExtension(name);
    if (ext === "doc" || ext === "docx") return "bi-file-earmark-word";
    if (ext === "ppt" || ext === "pptx") return "bi-file-earmark-ppt";
    if (ext === "txt") return "bi-file-earmark-text";
    return "bi-file-earmark";
  }

  function validateAttachmentFile(file, existingList) {
    const ext = getFileExtension(file.name);
    if (BLOCKED_ATTACHMENT_EXTENSIONS.has(ext) || !ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) {
      return { ok: false, error: `Unsupported file type: "${file.name}".` };
    }
    if (file.type && !ALLOWED_ATTACHMENT_MIMES.has(file.type)) {
      return { ok: false, error: `Unsupported MIME type for "${file.name}".` };
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: `"${file.name}" exceeds the 10 MB file size limit.` };
    }
    if (existingList.length >= MAX_ATTACHMENTS_PER_NOTE) {
      return { ok: false, error: `Maximum of ${MAX_ATTACHMENTS_PER_NOTE} attachments per note reached.` };
    }
    const isDuplicate = existingList.some(
      (item) => item.name === file.name && Number(item.size) === Number(file.size)
    );
    if (isDuplicate) {
      return { ok: false, error: `"${file.name}" is already attached to this note.` };
    }
    return { ok: true };
  }

  function revokeNoteObjectUrls() {
    noteAttachmentState.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    noteAttachmentState.objectUrls = [];
  }

  function showNoteAttachmentError(message) {
    const el = document.getElementById("noteAttachmentError");
    if (!el) return;
    if (!message) {
      el.classList.add("d-none");
      el.textContent = "";
    } else {
      el.textContent = message;
      el.classList.remove("d-none");
    }
  }

  function renderEditorAttachmentsList() {
    const container = document.getElementById("noteEditorAttachmentsList");
    if (!container) return;

    if (noteAttachmentState.staged.length === 0) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = noteAttachmentState.staged
      .map((att, idx) => {
        const iconClass = getAttachmentIconClass(att.name, att.type);
        const canPreview = isImageAttachment(att.name, att.type) || isPdfAttachment(att.name, att.type);
        return `
          <div class="attachment-row">
            <div class="attachment-info">
              <i class="bi ${iconClass} attachment-icon" aria-hidden="true"></i>
              <div class="attachment-meta">
                <div class="attachment-name">${escapeHTML(att.name)}</div>
                <div class="attachment-size">${escapeHTML(formatFileSize(att.size))}</div>
              </div>
            </div>
            <div class="attachment-actions">
              ${
                canPreview
                  ? `<button type="button" class="btn-task-action" data-action="preview-staged-attachment" data-staged-index="${idx}" title="Preview" aria-label="Preview">
                       <i class="bi bi-eye"></i>
                     </button>`
                  : ""
              }
              <button type="button" class="btn-task-action btn-task-delete" data-action="remove-staged-attachment" data-staged-index="${idx}" title="Remove attachment" aria-label="Remove attachment">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function handleSelectedFiles(fileList) {
    showNoteAttachmentError("");
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const errors = [];
    files.forEach((file) => {
      const check = validateAttachmentFile(file, noteAttachmentState.staged);
      if (!check.ok) {
        errors.push(check.error);
        return;
      }
      noteAttachmentState.staged.push({
        id: generateId("att"),
        name: file.name,
        type: file.type || "",
        size: file.size,
        dateAdded: new Date().toISOString(),
        file,
        isExisting: false
      });
    });

    if (errors.length > 0) {
      showNoteAttachmentError(errors[0]);
    }
    renderEditorAttachmentsList();
  }

  async function hydrateNoteCardThumbnails() {
    const thumbEls = document.querySelectorAll("img[data-attach-thumb-id]");
    for (const img of thumbEls) {
      const attId = img.dataset.attachThumbId;
      if (!attId) continue;
      try {
        const record = await getAttachmentFromDB(attId);
        if (record && record.blob) {
          const url = URL.createObjectURL(record.blob);
          noteAttachmentState.objectUrls.push(url);
          img.src = url;
          img.classList.remove("d-none");
        }
      } catch {
        // Keep fallback icon if thumbnail load fails
      }
    }
  }

  async function triggerAttachmentDownload(attachmentId, stagedIndex) {
    try {
      let blob = null;
      let filename = "attachment";
      if (stagedIndex !== undefined && stagedIndex !== null) {
        const staged = noteAttachmentState.staged[Number(stagedIndex)];
        if (staged?.file) {
          blob = staged.file;
          filename = staged.name;
        }
      }
      if (!blob && attachmentId) {
        const record = await getAttachmentFromDB(attachmentId);
        if (!record || !record.blob) {
          showToast("Attachment file could not be found in storage.");
          return;
        }
        blob = record.blob;
        filename = record.name;
      }
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      showToast("Failed to download attachment.");
    }
  }

  async function openAttachmentPreview(attachmentId, stagedIndex) {
    try {
      let blob = null;
      let name = "Attachment";
      let type = "";

      if (stagedIndex !== undefined && stagedIndex !== null) {
        const staged = noteAttachmentState.staged[Number(stagedIndex)];
        if (staged?.file) {
          blob = staged.file;
          name = staged.name;
          type = staged.type;
        } else if (staged?.id) {
          attachmentId = staged.id;
        }
      }

      if (!blob && attachmentId) {
        const record = await getAttachmentFromDB(attachmentId);
        if (!record || !record.blob) {
          showToast("Attachment file could not be loaded.");
          return;
        }
        blob = record.blob;
        name = record.name;
        type = record.type;
      }

      if (!blob) return;

      if (noteAttachmentState.previewObjectUrl) {
        URL.revokeObjectURL(noteAttachmentState.previewObjectUrl);
        noteAttachmentState.previewObjectUrl = null;
      }

      const url = URL.createObjectURL(blob);
      noteAttachmentState.previewObjectUrl = url;

      const titleEl = document.getElementById("previewModalTitle");
      const bodyEl = document.getElementById("previewModalBody");
      const footerEl = document.getElementById("previewModalFooter");

      titleEl.textContent = name;
      if (isImageAttachment(name, type)) {
        bodyEl.innerHTML = `<img src="${url}" alt="${escapeHTML(name)}" class="attachment-preview-img">`;
      } else if (isPdfAttachment(name, type)) {
        bodyEl.innerHTML = `<iframe src="${url}" title="${escapeHTML(name)}" class="attachment-preview-pdf"></iframe>`;
      } else {
        bodyEl.innerHTML = `<p class="text-muted mb-0">Preview is not supported for this file type. Use Download below.</p>`;
      }

      footerEl.innerHTML = `
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-accent btn-sm">
          Open in New Tab
        </a>
        <a href="${url}" download="${escapeHTML(name)}" class="btn btn-accent btn-sm">
          <i class="bi bi-download"></i> Download
        </a>
      `;

      openModalById("attachmentPreviewModal");
    } catch {
      showToast("Could not preview this attachment.");
    }
  }

  function formatNoteContentHTML(rawText) {
    const escaped = escapeHTML(rawText || "");
    const lines = escaped.split(/\r?\n/);
    const out = [];
    let inList = false;

    const applyInline = (line) =>
      line
        .replace(/__([^_]+)__/g, "<u>$1</u>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/_([^_]+)_/g, "<em>$1</em>");

    lines.forEach((line) => {
      if (line.startsWith("- ")) {
        if (!inList) {
          out.push("<ul>");
          inList = true;
        }
        out.push(`<li>${applyInline(line.slice(2))}</li>`);
      } else {
        if (inList) {
          out.push("</ul>");
          inList = false;
        }
        out.push(applyInline(line));
      }
    });

    if (inList) out.push("</ul>");
    return out.join("<br>").replace(/<ul><br>/g, "<ul>").replace(/<br><\/ul>/g, "</ul>").replace(/<\/li><br>/g, "</li>");
  }

  function applyNoteTextFormat(formatType) {
    const textarea = document.getElementById("noteContent");
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const selected = value.slice(start, end);

    let replacement = selected;
    if (formatType === "bold") {
      replacement = `**${selected || "bold text"}**`;
    } else if (formatType === "italic") {
      replacement = `_${selected || "italic text"}_`;
    } else if (formatType === "underline") {
      replacement = `__${selected || "underlined text"}__`;
    } else if (formatType === "list") {
      const text = selected || "List item";
      replacement = text
        .split(/\r?\n/)
        .map((line) => (line.startsWith("- ") ? line : `- ${line}`))
        .join("\n");
    }

    textarea.value = value.slice(0, start) + replacement + value.slice(end);
    textarea.focus();
    textarea.setSelectionRange(start, start + replacement.length);
  }

  function populateNoteFilters(notes) {
    const subjectSelect = document.getElementById("noteSubjectFilter");
    const tagSelect = document.getElementById("noteTagFilter");
    if (!subjectSelect || !tagSelect) return;

    const subjects = Array.from(new Set(notes.map((n) => n.subject).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
    subjectSelect.innerHTML = `<option value="all">All Subjects</option>${subjects
      .map((s) => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`)
      .join("")}`;
    subjectSelect.value = subjects.includes(notesViewState.subject) ? notesViewState.subject : "all";
    notesViewState.subject = subjectSelect.value;

    const tags = Array.from(new Set(notes.flatMap((n) => n.tags || []).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
    tagSelect.innerHTML = `<option value="all">All Tags</option>${tags
      .map((t) => `<option value="${escapeHTML(t)}">#${escapeHTML(t)}</option>`)
      .join("")}`;
    tagSelect.value = tags.includes(notesViewState.tag) ? notesViewState.tag : "all";
    notesViewState.tag = tagSelect.value;
  }

  function renderNoteCardHTML(note) {
    const tagsHTML = (note.tags || [])
      .map((tag) => `<span class="category-badge">#${escapeHTML(tag)}</span>`)
      .join("");
    const updated = note.updatedAt || note.createdAt;
    const attachments = note.attachments || [];

    const attachmentsHTML =
      attachments.length === 0
        ? ""
        : `<div class="attachment-list mt-1">
            ${attachments
              .map((att) => {
                const isImg = isImageAttachment(att.name, att.type);
                const isPdf = isPdfAttachment(att.name, att.type);
                const iconClass = getAttachmentIconClass(att.name, att.type);
                return `
                  <div class="attachment-row">
                    <div class="attachment-info">
                      ${
                        isImg
                          ? `<img class="attachment-thumb d-none" data-attach-thumb-id="${escapeHTML(att.id)}" alt="${escapeHTML(att.name)}" data-action="preview-attachment" data-attachment-id="${escapeHTML(att.id)}">`
                          : `<i class="bi ${iconClass} attachment-icon" aria-hidden="true"></i>`
                      }
                      <div class="attachment-meta">
                        <div class="attachment-name">${escapeHTML(att.name)}</div>
                        <div class="attachment-size">${escapeHTML(formatFileSize(att.size))}</div>
                      </div>
                    </div>
                    <div class="attachment-actions">
                      ${
                        isImg || isPdf
                          ? `<button type="button" class="btn-task-action" data-action="preview-attachment" data-attachment-id="${escapeHTML(att.id)}" title="Preview" aria-label="Preview">
                               <i class="bi bi-eye"></i>
                             </button>`
                          : ""
                      }
                      <button type="button" class="btn-task-action" data-action="download-attachment" data-attachment-id="${escapeHTML(att.id)}" title="Download" aria-label="Download">
                        <i class="bi bi-download"></i>
                      </button>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>`;

    return `
      <article class="surface-card note-card ${note.pinned ? "is-pinned" : ""}">
        <div class="note-card-header">
          <h3 class="note-card-title mb-0">${escapeHTML(note.title)}</h3>
          <button
            type="button"
            class="note-pin-btn ${note.pinned ? "is-pinned" : ""}"
            data-action="toggle-pin-note"
            data-note-id="${escapeHTML(note.id)}"
            title="${note.pinned ? "Unpin note" : "Pin note"}"
            aria-label="${note.pinned ? "Unpin note" : "Pin note"}"
          >
            <i class="bi ${note.pinned ? "bi-pin-fill" : "bi-pin-angle"}"></i>
          </button>
        </div>

        <div class="task-badges-row mt-0">
          <span class="subject-badge"><i class="bi bi-book"></i>${escapeHTML(note.subject)}</span>
          ${tagsHTML}
        </div>

        <div class="note-card-body">${formatNoteContentHTML(note.content)}</div>
        ${attachmentsHTML}

        <div class="note-card-footer">
          <div class="note-dates">
            <div>Created: ${escapeHTML(formatTimestamp(note.createdAt))}</div>
            <div>Edited: ${escapeHTML(formatTimestamp(updated))}</div>
          </div>
          <div class="task-actions">
            <button
              type="button"
              class="btn-task-action"
              data-action="edit-note"
              data-note-id="${escapeHTML(note.id)}"
              title="Edit note"
              aria-label="Edit note"
            >
              <i class="bi bi-pencil"></i>
            </button>
            <button
              type="button"
              class="btn-task-action btn-task-delete"
              data-action="delete-note"
              data-note-id="${escapeHTML(note.id)}"
              title="Delete note"
              aria-label="Delete note"
            >
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function renderNotesView() {
    const container = document.getElementById("notesContentContainer");
    if (!container) return;

    const store = loadStore();
    const notes = store.notes || [];
    populateNoteFilters(notes);

    if (notes.length === 0) {
      container.innerHTML = `<div class="surface-card section-card">${createEmptyStateHTML(
        "bi-journal-text",
        "No notes saved yet",
        "Create your first note to store lecture summaries, key formulas, and study reminders.",
        "Add Note",
        "open-note-modal"
      )}</div>`;
      return;
    }

    const search = notesViewState.search.trim().toLowerCase();
    const filtered = notes
      .filter((note) => {
        if (notesViewState.subject !== "all" && note.subject !== notesViewState.subject) return false;
        if (notesViewState.tag !== "all" && !(note.tags || []).includes(notesViewState.tag)) return false;
        if (search) {
          const haystack = `${note.title} ${note.content} ${note.subject} ${(note.tags || []).join(" ")}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const key = notesViewState.sortBy === "createdAt" ? "createdAt" : "updatedAt";
        return new Date(b[key] || b.createdAt) - new Date(a[key] || a.createdAt);
      });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="surface-card section-card">${createEmptyStateHTML(
        "bi-funnel",
        "No matching notes",
        "Adjust your search query or filters to find your notes.",
        "Clear Filters",
        "reset-note-filters"
      )}</div>`;
      return;
    }

    const pinnedNotes = filtered.filter((n) => n.pinned);
    const otherNotes = filtered.filter((n) => !n.pinned);

    let html = "";
    if (pinnedNotes.length > 0) {
      html += `
        <div class="mb-4">
          <div class="notes-section-label"><i class="bi bi-pin-fill"></i> Pinned Notes</div>
          <div class="notes-grid">${pinnedNotes.map(renderNoteCardHTML).join("")}</div>
        </div>
      `;
    }

    if (otherNotes.length > 0) {
      html += `
        <div>
          ${pinnedNotes.length > 0 ? '<div class="notes-section-label"><i class="bi bi-journal-text"></i> All Notes</div>' : ""}
          <div class="notes-grid">${otherNotes.map(renderNoteCardHTML).join("")}</div>
        </div>
      `;
    }

    revokeNoteObjectUrls();
    container.innerHTML = html;
    hydrateNoteCardThumbnails();
  }

  function openNoteModalForCreate() {
    document.getElementById("noteForm").reset();
    document.getElementById("noteId").value = "";
    document.getElementById("noteModalLabel").textContent = "Add Note";
    document.getElementById("noteSubmitBtn").textContent = "Save Note";
    noteAttachmentState.staged = [];
    noteAttachmentState.removedIds = [];
    showNoteAttachmentError("");
    renderEditorAttachmentsList();
    openModalById("noteModal");
  }

  function openNoteModalForEdit(noteId) {
    const store = loadStore();
    const note = (store.notes || []).find((n) => n.id === noteId);
    if (!note) return;

    document.getElementById("noteId").value = note.id;
    document.getElementById("noteModalLabel").textContent = "Edit Note";
    document.getElementById("noteSubmitBtn").textContent = "Update Note";
    document.getElementById("noteTitle").value = note.title || "";
    document.getElementById("noteSubject").value = note.subject || "";
    document.getElementById("noteTags").value = (note.tags || []).join(", ");
    document.getElementById("noteContent").value = note.content || "";
    noteAttachmentState.staged = (note.attachments || []).map((att) => ({
      ...att,
      isExisting: true
    }));
    noteAttachmentState.removedIds = [];
    showNoteAttachmentError("");
    renderEditorAttachmentsList();
    openModalById("noteModal");
  }

  /* ========================================================================
     Study Sessions & Pomodoro Timer Module
     ======================================================================== */

  function formatDateToHHMM(dateObj) {
    const d = dateObj || new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function playSessionEndChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Ignore audio errors if blocked by browser autoplay policy
    }
  }

  function getConfiguredModeMinutes(store, mode) {
    const settings = store.timerSettings || { focus: 25, shortBreak: 5, longBreak: 15 };
    return Math.max(1, Number(settings[mode] || 25));
  }

  function updatePomodoroUI() {
    const totalSec = Math.ceil(pomodoroState.remainingMs / 1000);
    const mins = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const secs = String(totalSec % 60).padStart(2, "0");

    const countdownEl = document.getElementById("pomoCountdownDisplay");
    const modeLabelEl = document.getElementById("pomoModeLabel");
    const cycleEl = document.getElementById("pomoCycleIndicator");
    const circleEl = document.getElementById("pomoProgressCircle");
    const startBtn = document.getElementById("pomoStartBtn");
    const pauseBtn = document.getElementById("pomoPauseBtn");
    const pillEl = document.getElementById("activeSessionPill");
    const dotEl = document.querySelector(".semester-pill .status-dot");

    if (countdownEl) countdownEl.textContent = `${mins}:${secs}`;
    if (modeLabelEl) modeLabelEl.textContent = POMO_MODE_LABELS[pomodoroState.mode];
    if (cycleEl) cycleEl.textContent = `Cycle ${(pomodoroState.completedInCycle % 4) + 1} of 4`;

    if (circleEl) {
      circleEl.style.strokeDasharray = String(POMO_RING_CIRCUMFERENCE);
      const ratio = pomodoroState.totalMs > 0 ? pomodoroState.remainingMs / pomodoroState.totalMs : 0;
      const offset = POMO_RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, ratio)));
      circleEl.style.strokeDashoffset = String(offset);
      circleEl.classList.toggle("is-break", pomodoroState.mode !== "focus");
    }

    if (startBtn && pauseBtn) {
      if (pomodoroState.status === "running") {
        startBtn.classList.add("d-none");
        pauseBtn.classList.remove("d-none");
      } else {
        startBtn.classList.remove("d-none");
        pauseBtn.classList.add("d-none");
        startBtn.innerHTML =
          pomodoroState.status === "paused"
            ? '<i class="bi bi-play-fill"></i><span>Resume</span>'
            : '<i class="bi bi-play-fill"></i><span>Start</span>';
      }
    }

    document.querySelectorAll("[data-pomo-mode]").forEach((btn) => {
      const active = btn.dataset.pomoMode === pomodoroState.mode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });

    if (pillEl) {
      pillEl.textContent =
        pomodoroState.status === "running"
          ? `${POMO_MODE_TYPES[pomodoroState.mode]} ${mins}:${secs}`
          : "";
      pillEl.classList.toggle("d-none", pomodoroState.status !== "running");
    }
    if (dotEl) {
      dotEl.classList.toggle("is-running", pomodoroState.status === "running");
    }
  }

  function switchPomodoroMode(mode) {
    clearInterval(pomodoroState.intervalId);
    pomodoroState.intervalId = null;
    pomodoroState.mode = mode;
    pomodoroState.status = "idle";
    pomodoroState.targetEndTime = null;
    pomodoroState.sessionStartDate = null;

    const store = loadStore();
    const mins = getConfiguredModeMinutes(store, mode);
    pomodoroState.totalMs = mins * 60 * 1000;
    pomodoroState.remainingMs = pomodoroState.totalMs;
    updatePomodoroUI();
  }

  function completePomodoroSession() {
    clearInterval(pomodoroState.intervalId);
    pomodoroState.intervalId = null;
    pomodoroState.status = "idle";

    const store = loadStore();
    const durationMinutes = getConfiguredModeMinutes(store, pomodoroState.mode);
    const subjectInput = document.getElementById("pomoSubjectInput");
    const taskSelect = document.getElementById("pomoTaskSelect");
    const selectedTaskId = taskSelect ? taskSelect.value : "";
    const linkedTask = selectedTaskId ? store.tasks.find((t) => t.id === selectedTaskId) : null;
    const subject =
      (subjectInput && subjectInput.value.trim()) ||
      (linkedTask && linkedTask.subject) ||
      "General Study";

    if (subject && subject !== "General Study") {
      registerSubjectIfNew(store, subject);
    }

    const endNow = new Date();
    const startDate = pomodoroState.sessionStartDate || new Date(endNow.getTime() - durationMinutes * 60000);
    const sessionType = POMO_MODE_TYPES[pomodoroState.mode];

    store.studySessions.push({
      id: `session_${Date.now()}`,
      date: getTodayISO(),
      startTime: formatDateToHHMM(startDate),
      endTime: formatDateToHHMM(endNow),
      durationMinutes,
      subject,
      taskId: linkedTask ? linkedTask.id : null,
      taskTitle: linkedTask ? linkedTask.title : "",
      topic: linkedTask ? linkedTask.title : `${sessionType} Timer`,
      sessionType,
      status: "Completed",
      createdAt: endNow.toISOString()
    });

    saveStore(store);
    playSessionEndChime();
    if (store.settings?.notifications?.studyTimerNotifications) {
      sendBrowserNotification(
        `${POMO_MODE_LABELS[pomodoroState.mode]} Complete`,
        `${durationMinutes} minutes logged for ${subject}.`
      );
    }

    // Auto-transition between focus and break
    const finishedMode = pomodoroState.mode;
    if (finishedMode === "focus") {
      pomodoroState.completedInCycle += 1;
      const nextMode = pomodoroState.completedInCycle % 4 === 0 ? "longBreak" : "shortBreak";
      showToast(`Focus session complete! Switching to ${POMO_MODE_LABELS[nextMode]}.`);
      switchPomodoroMode(nextMode);
    } else {
      showToast(`${POMO_MODE_LABELS[finishedMode]} complete! Ready for Focus.`);
      switchPomodoroMode("focus");
    }

    renderAllViews();
  }

  function tickPomodoro() {
    if (pomodoroState.status !== "running" || !pomodoroState.targetEndTime) return;
    const remaining = Math.max(0, pomodoroState.targetEndTime - Date.now());
    pomodoroState.remainingMs = remaining;
    updatePomodoroUI();
    if (remaining <= 0) {
      completePomodoroSession();
    }
  }

  function startOrResumePomodoro() {
    if (pomodoroState.status === "running") return;
    // Prevent multiple timers running simultaneously
    clearInterval(pomodoroState.intervalId);
    if (timerState.running) resetStudyTimer();

    if (pomodoroState.status === "idle") {
      pomodoroState.sessionStartDate = new Date();
    }
    pomodoroState.status = "running";
    pomodoroState.targetEndTime = Date.now() + pomodoroState.remainingMs;
    pomodoroState.intervalId = setInterval(tickPomodoro, 250);
    updatePomodoroUI();
  }

  function pausePomodoro() {
    if (pomodoroState.status !== "running") return;
    clearInterval(pomodoroState.intervalId);
    pomodoroState.intervalId = null;
    pomodoroState.remainingMs = Math.max(0, pomodoroState.targetEndTime - Date.now());
    pomodoroState.targetEndTime = null;
    pomodoroState.status = "paused";
    updatePomodoroUI();
  }

  function skipPomodoroSession() {
    if (pomodoroState.mode === "focus") {
      const nextMode = (pomodoroState.completedInCycle + 1) % 4 === 0 ? "longBreak" : "shortBreak";
      switchPomodoroMode(nextMode);
      showToast(`Skipped to ${POMO_MODE_LABELS[nextMode]}.`);
    } else {
      switchPomodoroMode("focus");
      showToast("Skipped to Focus Session.");
    }
  }

  function renderStudySessionsView() {
    const store = loadStore();
    const todayISO = getTodayISO();
    const monday = getStartOfWeekISO();
    const mondayISO = toISODate(monday);

    const sessions = store.studySessions || [];
    const focusSessions = sessions.filter(isFocusStudySession);

    const dailyMinutes = focusSessions
      .filter((s) => s.date === todayISO)
      .reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);

    const weeklyMinutes = focusSessions
      .filter((s) => s.date >= mondayISO && s.date <= todayISO)
      .reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);

    const completedPomodoros = sessions.filter((s) => s.sessionType === "Focus").length;

    document.getElementById("ssStatDailyTime").textContent = formatDuration(dailyMinutes);
    document.getElementById("ssStatWeeklyTime").textContent = formatDuration(weeklyMinutes);
    document.getElementById("ssStatPomodoros").textContent = String(completedPomodoros);
    document.getElementById("ssStatTotalSessions").textContent = String(sessions.length);

    // Sync duration inputs when idle
    const settings = store.timerSettings || { focus: 25, shortBreak: 5, longBreak: 15 };
    document.getElementById("pomoFocusMins").value = String(settings.focus);
    document.getElementById("pomoShortMins").value = String(settings.shortBreak);
    document.getElementById("pomoLongMins").value = String(settings.longBreak);

    // Populate associated task dropdown
    const taskSelect = document.getElementById("pomoTaskSelect");
    if (taskSelect) {
      const prev = taskSelect.value;
      const pendingTasks = store.tasks.filter((t) => !t.completed);
      taskSelect.innerHTML = `<option value="">None</option>${pendingTasks
        .map((t) => `<option value="${escapeHTML(t.id)}">${escapeHTML(t.title)} (${escapeHTML(t.subject)})</option>`)
        .join("")}`;
      if (pendingTasks.some((t) => t.id === prev)) taskSelect.value = prev;
    }

    // Study history list
    const historyContainer = document.getElementById("studyHistoryContainer");
    const countBadge = document.getElementById("ssHistoryCount");
    countBadge.textContent = `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`;

    if (sessions.length === 0) {
      historyContainer.innerHTML = createEmptyStateHTML(
        "bi-stopwatch",
        "No study sessions recorded yet",
        "Start the Pomodoro timer or log a manual session to build your study history.",
        "Log Manual Session",
        "open-study-modal"
      );
      return;
    }

    const sorted = [...sessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const html = sorted
      .map((s) => {
        const typeLabel = s.sessionType || "Focus";
        const isBreak = !isFocusStudySession(s);
        return `
          <div class="study-history-item">
            <div class="deadline-info">
              <div class="deadline-title">
                ${escapeHTML(s.subject)} &middot; ${escapeHTML(s.topic || typeLabel)}
              </div>
              <div class="task-badges-row">
                <span class="category-badge">${escapeHTML(typeLabel)}</span>
                <span class="subject-badge">${escapeHTML(formatDuration(Number(s.durationMinutes)))}</span>
                ${s.taskTitle ? `<span class="category-badge"><i class="bi bi-check2-square"></i>${escapeHTML(s.taskTitle)}</span>` : ""}
                <span class="category-badge">
                  ${escapeHTML(formatRelativeDateLabel(s.date))}
                  ${s.startTime ? ` (${escapeHTML(formatTime12h(s.startTime))}${s.endTime ? ` – ${escapeHTML(formatTime12h(s.endTime))}` : ""})` : ""}
                </span>
                <span class="priority-pill ${isBreak ? "priority-neutral" : "trend-success"}">${escapeHTML(s.status || "Completed")}</span>
              </div>
            </div>
            <button
              type="button"
              class="btn-task-action btn-task-delete"
              data-action="delete-study-session"
              data-session-id="${escapeHTML(s.id)}"
              title="Delete session"
              aria-label="Delete session"
            >
              <i class="bi bi-trash"></i>
            </button>
          </div>
        `;
      })
      .join("");

    historyContainer.innerHTML = `<div class="study-history-list">${html}</div>`;
  }

  /* ========================================================================
     Weekly Timetable Module
     ======================================================================== */

  function formatHourLabel(hour24) {
    const suffix = hour24 >= 12 ? "PM" : "AM";
    const h = hour24 % 12 || 12;
    return `${h}:00 ${suffix}`;
  }

  function renderTimetableClassActionsHTML(classId) {
    return `
      <div class="tt-class-actions">
        <button type="button" class="tt-mini-btn" data-action="edit-class" data-class-id="${escapeHTML(classId)}" title="Edit class" aria-label="Edit class">
          <i class="bi bi-pencil"></i>
        </button>
        <button type="button" class="tt-mini-btn" data-action="duplicate-class" data-class-id="${escapeHTML(classId)}" title="Duplicate class" aria-label="Duplicate class">
          <i class="bi bi-copy"></i>
        </button>
        <button type="button" class="tt-mini-btn is-delete" data-action="delete-class" data-class-id="${escapeHTML(classId)}" title="Delete class" aria-label="Delete class">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;
  }

  function renderTimetableView() {
    const container = document.getElementById("timetableContentContainer");
    const mobileTabsEl = document.getElementById("ttMobileDayTabs");
    if (!container || !mobileTabsEl) return;

    const store = loadStore();
    const classes = store.timetable || [];
    const nowWeekday = new Date().getDay();
    const nowHHMM = getCurrentTimeHHMM();

    // Update summary metrics
    const todayClasses = classes
      .filter((c) => Number(c.weekday) === nowWeekday)
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

    const ongoing = todayClasses.find((c) => c.startTime <= nowHHMM && c.endTime >= nowHHMM);
    const nextUpcoming = todayClasses.find((c) => c.startTime > nowHHMM);
    const remainingCount = todayClasses.filter((c) => c.endTime > nowHHMM).length;

    document.getElementById("ttStatCurrentDay").textContent = WEEKDAY_NAMES[nowWeekday];
    document.getElementById("ttStatRemaining").textContent = String(remainingCount);
    document.getElementById("ttStatTotalWeek").textContent = String(classes.length);

    const nextEl = document.getElementById("ttStatNextClass");
    if (ongoing) {
      nextEl.textContent = `Now: ${ongoing.name}`;
    } else if (nextUpcoming) {
      nextEl.textContent = `${nextUpcoming.name} (${formatTime12h(nextUpcoming.startTime)})`;
    } else {
      nextEl.textContent = "None remaining";
    }

    // Mobile day tabs
    mobileTabsEl.innerHTML = TIMETABLE_DAYS.map((d) => {
      const isToday = d.weekday === nowWeekday;
      const isSelected = d.weekday === timetableState.selectedWeekday;
      return `
        <button
          type="button"
          class="tt-day-btn ${isToday ? "is-today" : ""} ${isSelected ? "active" : ""}"
          data-action="select-tt-day"
          data-weekday="${d.weekday}"
          role="tab"
          aria-selected="${isSelected}"
        >
          ${d.short}
        </button>
      `;
    }).join("");

    if (classes.length === 0) {
      container.innerHTML = createEmptyStateHTML(
        "bi-clock-history",
        "Your weekly timetable is empty",
        "Add your classes with subject, teacher, room, and time to build your weekly schedule.",
        "Add First Class",
        "open-class-modal"
      );
      return;
    }

    // Compute dynamic hour rows covering all classes (minimum 08:00 - 17:00)
    const startHours = classes.map((c) => parseInt((c.startTime || "08:00").split(":")[0], 10));
    const endHours = classes.map((c) => parseInt((c.endTime || "17:00").split(":")[0], 10));
    const minHour = Math.min(8, ...startHours);
    const maxHour = Math.max(17, ...endHours);

    const headersHTML = `
      <div class="tt-corner-cell">Time</div>
      ${TIMETABLE_DAYS.map((d) => {
        const isToday = d.weekday === nowWeekday;
        return `<div class="tt-day-header ${isToday ? "is-today" : ""}">${d.full}${isToday ? " (Today)" : ""}</div>`;
      }).join("")}
    `;

    const rowsHTML = [];
    for (let h = minHour; h <= maxHour; h += 1) {
      rowsHTML.push(`<div class="tt-time-cell">${formatHourLabel(h)}</div>`);
      TIMETABLE_DAYS.forEach((d) => {
        const isToday = d.weekday === nowWeekday;
        const slotClasses = classes
          .filter((c) => Number(c.weekday) === d.weekday && parseInt((c.startTime || "00:00").split(":")[0], 10) === h)
          .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

        const cardsHTML = slotClasses
          .map((cls) => {
            const status = getClassStatus(cls, nowWeekday, nowHHMM);
            const isNext = nextUpcoming && nextUpcoming.id === cls.id;
            const statusBadge =
              status === "current"
                ? '<span class="priority-pill priority-danger">Now</span>'
                : isNext
                  ? '<span class="priority-pill priority-warning">Next</span>'
                  : "";
            const color = cls.color || "#4f46e5";

            return `
              <div class="tt-class-card ${status === "current" ? "is-current" : ""}" style="border-left-color: ${escapeHTML(color)};">
                <div class="d-flex align-items-start justify-content-between gap-1">
                  <span class="tt-class-title">${escapeHTML(cls.name)}</span>
                  ${statusBadge}
                </div>
                <div class="tt-class-meta">${escapeHTML(formatTime12h(cls.startTime))} – ${escapeHTML(formatTime12h(cls.endTime))}</div>
                <div class="tt-class-meta">${escapeHTML(cls.location)}${cls.teacher ? ` &middot; ${escapeHTML(cls.teacher)}` : ""}</div>
                ${renderTimetableClassActionsHTML(cls.id)}
              </div>
            `;
          })
          .join("");

        rowsHTML.push(`<div class="tt-slot-cell ${isToday ? "is-today" : ""}">${cardsHTML}</div>`);
      });
    }

    const desktopGridHTML = `
      <div class="tt-grid-wrapper d-none d-lg-block">
        <div class="tt-grid">
          ${headersHTML}
          ${rowsHTML.join("")}
        </div>
      </div>
    `;

    // Mobile daily view
    const selectedDayClasses = classes
      .filter((c) => Number(c.weekday) === timetableState.selectedWeekday)
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

    const mobileListHTML =
      selectedDayClasses.length === 0
        ? `<div class="d-lg-none">${createEmptyStateHTML(
            "bi-calendar-x",
            `No classes on ${WEEKDAY_NAMES[timetableState.selectedWeekday]}`,
            "Tap Add Class to schedule a lecture or lab for this day.",
            "Add Class",
            "open-class-modal"
          )}</div>`
        : `<div class="tt-mobile-list d-lg-none">
            ${selectedDayClasses
              .map((cls) => {
                const status = getClassStatus(cls, nowWeekday, nowHHMM);
                const isNext = nextUpcoming && nextUpcoming.id === cls.id;
                const statusBadge =
                  status === "current"
                    ? '<span class="priority-pill priority-danger">Now</span>'
                    : isNext
                      ? '<span class="priority-pill priority-warning">Next</span>'
                      : "";
                const color = cls.color || "#4f46e5";

                return `
                  <div class="tt-mobile-card" style="border-left-color: ${escapeHTML(color)};">
                    <div class="d-flex align-items-center justify-content-between gap-2 mb-1">
                      <span class="schedule-time">${escapeHTML(formatTime12h(cls.startTime))} – ${escapeHTML(formatTime12h(cls.endTime))}</span>
                      ${statusBadge}
                    </div>
                    <div class="fw-bold">${escapeHTML(cls.name)}</div>
                    <div class="small text-muted">
                      ${escapeHTML(cls.location)}${cls.teacher ? ` &middot; ${escapeHTML(cls.teacher)}` : ""}
                    </div>
                    ${renderTimetableClassActionsHTML(cls.id)}
                  </div>
                `;
              })
              .join("")}
          </div>`;

    container.innerHTML = desktopGridHTML + mobileListHTML;
  }

  function openClassModalForCreate() {
    document.getElementById("classForm").reset();
    document.getElementById("classId").value = "";
    document.getElementById("classModalLabel").textContent = "Add Class to Timetable";
    document.getElementById("classSubmitBtn").textContent = "Save Class";
    document.getElementById("classWeekday").value = String(timetableState.selectedWeekday);
    document.getElementById("classColor").value = "#4f46e5";
    document.getElementById("classStartTime").value = "09:00";
    document.getElementById("classEndTime").value = "10:15";
    openModalById("classModal");
  }

  function openClassModalForEditOrDuplicate(classId, isDuplicate) {
    const store = loadStore();
    const cls = (store.timetable || []).find((c) => c.id === classId);
    if (!cls) return;

    document.getElementById("classId").value = isDuplicate ? "" : cls.id;
    document.getElementById("classModalLabel").textContent = isDuplicate ? "Duplicate Class" : "Edit Class";
    document.getElementById("classSubmitBtn").textContent = isDuplicate ? "Save Duplicate" : "Update Class";
    document.getElementById("className").value = cls.name || "";
    document.getElementById("classTeacher").value = cls.teacher || "";
    document.getElementById("classLocation").value = cls.location || "";
    document.getElementById("classWeekday").value = String(cls.weekday);
    document.getElementById("classColor").value = cls.color || "#4f46e5";
    document.getElementById("classStartTime").value = cls.startTime || "09:00";
    document.getElementById("classEndTime").value = cls.endTime || "10:15";
    openModalById("classModal");
  }

  /* ========================================================================
     Calendar & Deadline Management Module
     ======================================================================== */

  function mapTaskCategoryToEventType(category) {
    if (category === "Exam Prep") return "Exam";
    if (category === "Project") return "Project";
    if (category === "Personal") return "Personal";
    return "Assignment";
  }

  function getAllCalendarItems(store) {
    const events = (store.events || []).map((ev) => ({
      id: ev.id,
      source: "event",
      title: ev.title,
      description: ev.description || "",
      type: ev.type || "Personal",
      date: ev.date,
      startTime: ev.startTime || "09:00",
      endTime: ev.endTime || "10:00",
      subject: ev.subject || "General",
      priority: ev.priority || "Medium",
      completed: false
    }));

    const tasks = (store.tasks || [])
      .filter((t) => Boolean(t.date))
      .map((t) => ({
        id: t.id,
        source: "task",
        title: t.title,
        description: t.description || "",
        type: mapTaskCategoryToEventType(t.category),
        date: t.date,
        startTime: t.dueTime || "17:00",
        endTime: "",
        subject: t.subject || "General",
        priority: t.priority || "Medium",
        completed: Boolean(t.completed)
      }));

    const deadlines = (store.deadlines || []).map((d) => ({
      id: d.id,
      source: "deadline",
      title: d.title,
      description: `${d.type} deadline`,
      type: "Deadline",
      date: d.dueDate,
      startTime: "23:59",
      endTime: "",
      subject: d.subject || "General",
      priority: d.priority || "Medium",
      completed: Boolean(d.completed)
    }));

    const sessions = (store.studySessions || []).map((s) => ({
      id: s.id,
      source: "session",
      title: `${s.subject}: ${s.topic}`,
      description: `Focused study session (${formatDuration(s.durationMinutes)})`,
      type: "Study Session",
      date: s.date,
      startTime: "",
      endTime: "",
      subject: s.subject || "General",
      priority: "Low",
      completed: true
    }));

    const combined = [...events, ...tasks, ...deadlines, ...sessions];
    return calendarState.typeFilter === "all"
      ? combined
      : combined.filter((item) => item.type === calendarState.typeFilter);
  }

  function getWeekMonday(baseDate) {
    const day = baseDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + diff);
  }

  function renderEventPillHTML(item) {
    const typeClass = EVENT_TYPE_CLASS[item.type] || "evt-personal";
    const doneStyle = item.completed ? "text-decoration-line-through opacity-75" : "";
    return `
      <button
        type="button"
        class="cal-event-pill ${typeClass} ${doneStyle}"
        data-action="view-calendar-item"
        data-item-source="${escapeHTML(item.source)}"
        data-item-id="${escapeHTML(item.id)}"
        title="${escapeHTML(item.title)}"
      >
        ${escapeHTML(item.title)}
      </button>
    `;
  }

  function renderCalendarGrid(items) {
    const container = document.getElementById("calendarGridContainer");
    const titleEl = document.getElementById("calendarPeriodTitle");
    if (!container || !titleEl) return;

    const todayISO = getTodayISO();
    const cursor = calendarState.cursorDate;

    if (calendarState.viewMode === "week") {
      const monday = getWeekMonday(cursor);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      titleEl.textContent = `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

      const colsHTML = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        const iso = toISODate(d);
        const dayItems = items
          .filter((it) => it.date === iso)
          .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
        const dayName = d.toLocaleDateString("en-US", { weekday: "short" });

        return `
          <div class="calendar-week-col ${iso === todayISO ? "is-today" : ""}" data-action="select-cal-date" data-date="${iso}">
            <div class="week-col-header">
              <span>${dayName}</span>
              <span>${d.getDate()}</span>
            </div>
            <div class="calendar-cell-events">
              ${
                dayItems.length > 0
                  ? dayItems.map(renderEventPillHTML).join("")
                  : '<span class="text-muted small">No events</span>'
              }
            </div>
          </div>
        `;
      }).join("");

      container.innerHTML = `<div class="calendar-week-grid">${colsHTML}</div>`;
      return;
    }

    // Monthly view
    titleEl.textContent = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = getWeekMonday(firstOfMonth);

    const weekdaysHTML = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      .map((w) => `<div class="calendar-weekday">${w}</div>`)
      .join("");

    const cellsHTML = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const iso = toISODate(d);
      const isOutside = d.getMonth() !== cursor.getMonth();
      const isToday = iso === todayISO;
      const isSelected = calendarState.selectedDate === iso;
      const dayItems = items.filter((it) => it.date === iso);
      const visiblePills = dayItems.slice(0, 2).map(renderEventPillHTML).join("");
      const extraCount = dayItems.length > 2 ? `<div class="cal-event-more">+${dayItems.length - 2} more</div>` : "";

      return `
        <div
          class="calendar-cell ${isOutside ? "is-outside" : ""} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}"
          data-action="select-cal-date"
          data-date="${iso}"
        >
          <span class="calendar-day-num">${d.getDate()}</span>
          <div class="calendar-cell-events">
            ${visiblePills}
            ${extraCount}
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div class="calendar-weekdays">${weekdaysHTML}</div>
      <div class="calendar-month-grid">${cellsHTML}</div>
    `;
  }

  function renderUpcomingEventsPanel(items) {
    const container = document.getElementById("upcomingEventsContainer");
    const countBadge = document.getElementById("upcomingEventsCount");
    const heading = document.getElementById("upcomingEventsHeading");
    const sub = document.getElementById("upcomingEventsSub");
    if (!container) return;

    const todayISO = getTodayISO();
    const selected = calendarState.selectedDate;
    const list = selected
      ? items.filter((it) => it.date === selected)
      : items.filter((it) => it.date >= todayISO);

    list.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      return dateCmp !== 0 ? dateCmp : (a.startTime || "").localeCompare(b.startTime || "");
    });

    if (selected) {
      heading.textContent = `Schedule for ${formatRelativeDateLabel(selected)}`;
      sub.textContent = selected;
    } else {
      heading.textContent = "Upcoming Events";
      sub.textContent = "Next scheduled items & tasks";
    }

    countBadge.textContent = `${list.length} ${list.length === 1 ? "item" : "items"}`;

    if (list.length === 0) {
      container.innerHTML = createEmptyStateHTML(
        "bi-calendar3",
        selected ? "No events on this date" : "No upcoming events",
        "Add an event or task to see it scheduled on your calendar.",
        "Add Event",
        "open-event-modal"
      );
      return;
    }

    const html = list
      .slice(0, 8)
      .map((item) => {
        const typeClass = EVENT_TYPE_CLASS[item.type] || "evt-personal";
        return `
          <div class="deadline-item">
            <div class="deadline-info">
              <div class="deadline-title">${escapeHTML(item.title)}</div>
              <div class="deadline-course">
                ${escapeHTML(formatRelativeDateLabel(item.date))}
                ${item.startTime ? ` &middot; ${escapeHTML(formatTime12h(item.startTime))}` : ""}
                &middot; ${escapeHTML(item.subject)}
              </div>
            </div>
            <button
              type="button"
              class="cal-event-pill ${typeClass}"
              data-action="view-calendar-item"
              data-item-source="${escapeHTML(item.source)}"
              data-item-id="${escapeHTML(item.id)}"
            >
              ${escapeHTML(item.type)}
            </button>
          </div>
        `;
      })
      .join("");

    container.innerHTML = `<div class="deadline-list">${html}</div>`;
  }

  function getDeadlineStatusInfo(deadline, todayISO) {
    if (deadline.completed) {
      return { state: "completed", label: "Completed", badgeClass: "trend-success", cardClass: "is-completed" };
    }
    if (!deadline.dueDate || !deadline.dueDate.includes("-")) {
      return { state: "upcoming", label: "No date", badgeClass: "priority-neutral", cardClass: "" };
    }
    const [y, m, d] = deadline.dueDate.split("-").map(Number);
    const [ty, tm, td] = todayISO.split("-").map(Number);
    const diffDays = Math.round((new Date(y, m - 1, d) - new Date(ty, tm - 1, td)) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const absDays = Math.abs(diffDays);
      return {
        state: "overdue",
        label: `${absDays} ${absDays === 1 ? "day" : "days"} overdue`,
        badgeClass: "priority-danger",
        cardClass: "is-overdue"
      };
    }
    if (diffDays === 0) {
      return { state: "today", label: "Due today", badgeClass: "priority-warning", cardClass: "is-today" };
    }
    return {
      state: "upcoming",
      label: `${diffDays} ${diffDays === 1 ? "day" : "days"} left`,
      badgeClass: "priority-neutral",
      cardClass: ""
    };
  }

  function renderDeadlineManagement(store) {
    const container = document.getElementById("deadlineManagementContainer");
    if (!container) return;

    const todayISO = getTodayISO();
    const deadlines = [...(store.deadlines || [])].sort((a, b) => {
      if (Boolean(a.completed) !== Boolean(b.completed)) return a.completed ? 1 : -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

    if (deadlines.length === 0) {
      container.innerHTML = createEmptyStateHTML(
        "bi-flag",
        "No deadlines tracked yet",
        "Add upcoming exams, assignments, and projects to monitor remaining days.",
        "Add Deadline",
        "open-deadline-modal"
      );
      return;
    }

    const filtered = deadlines.filter((d) => {
      if (calendarState.deadlineFilter === "all") return true;
      return getDeadlineStatusInfo(d, todayISO).state === calendarState.deadlineFilter;
    });

    if (filtered.length === 0) {
      container.innerHTML = createEmptyStateHTML(
        "bi-funnel",
        "No deadlines match this filter",
        "Switch the status filter above to view your other deadlines.",
        null,
        null
      );
      return;
    }

    const html = filtered
      .map((d) => {
        const info = getDeadlineStatusInfo(d, todayISO);
        const priority = d.priority || "Medium";
        const priorityClass = `priority-${priority.toLowerCase()}`;
        return `
          <div class="deadline-manage-card ${info.cardClass}">
            <button
              type="button"
              class="task-check-btn ${d.completed ? "is-completed" : ""}"
              style="${d.completed ? "background-color: var(--success); border-color: var(--success);" : ""}"
              data-action="toggle-deadline"
              data-deadline-id="${escapeHTML(d.id)}"
              aria-label="${d.completed ? "Reopen deadline" : "Mark deadline complete"}"
            >
              ${d.completed ? '<i class="bi bi-check-lg"></i>' : ""}
            </button>
            <div class="deadline-info">
              <div class="deadline-title">${escapeHTML(d.title)}</div>
              <div class="task-badges-row">
                <span class="subject-badge">${escapeHTML(d.subject)}</span>
                <span class="category-badge">${escapeHTML(d.type)}</span>
                <span class="priority-pill ${priorityClass}">${escapeHTML(priority)}</span>
                <span class="priority-pill ${info.badgeClass}">${escapeHTML(info.label)}</span>
              </div>
            </div>
            <button
              type="button"
              class="btn-task-action btn-task-delete"
              data-action="delete-deadline"
              data-deadline-id="${escapeHTML(d.id)}"
              title="Delete deadline"
              aria-label="Delete deadline"
            >
              <i class="bi bi-trash"></i>
            </button>
          </div>
        `;
      })
      .join("");

    container.innerHTML = `<div class="deadline-manage-list">${html}</div>`;
  }

  function renderCalendarView() {
    const store = loadStore();
    const items = getAllCalendarItems(store);
    renderCalendarGrid(items);
    renderUpcomingEventsPanel(items);
    renderDeadlineManagement(store);
  }

  function openEventModalForCreate(defaultDate) {
    document.getElementById("eventForm").reset();
    document.getElementById("eventId").value = "";
    document.getElementById("eventModalLabel").textContent = "Add Calendar Event";
    document.getElementById("eventSubmitBtn").textContent = "Save Event";
    document.getElementById("eventDate").value = defaultDate || calendarState.selectedDate || getTodayISO();
    document.getElementById("eventStartTime").value = "10:00";
    document.getElementById("eventEndTime").value = "11:00";
    document.getElementById("eventPriority").value = "Medium";
    openModalById("eventModal");
  }

  function openEventModalForEdit(eventId) {
    const store = loadStore();
    const ev = (store.events || []).find((e) => e.id === eventId);
    if (!ev) return;

    document.getElementById("eventId").value = ev.id;
    document.getElementById("eventModalLabel").textContent = "Edit Calendar Event";
    document.getElementById("eventSubmitBtn").textContent = "Update Event";
    document.getElementById("eventTitle").value = ev.title || "";
    document.getElementById("eventDescription").value = ev.description || "";
    document.getElementById("eventType").value = ev.type || "Assignment";
    document.getElementById("eventSubject").value = ev.subject || "";
    document.getElementById("eventPriority").value = ev.priority || "Medium";
    document.getElementById("eventDate").value = ev.date || getTodayISO();
    document.getElementById("eventStartTime").value = ev.startTime || "10:00";
    document.getElementById("eventEndTime").value = ev.endTime || "11:00";
    openModalById("eventModal");
  }

  function openEventDetailModal(source, itemId) {
    const store = loadStore();
    const items = getAllCalendarItems(store);
    const item = items.find((it) => it.source === source && it.id === itemId);
    if (!item) return;

    const titleEl = document.getElementById("eventDetailTitle");
    const bodyEl = document.getElementById("eventDetailBody");
    const footerEl = document.getElementById("eventDetailFooter");
    const typeClass = EVENT_TYPE_CLASS[item.type] || "evt-personal";
    const priorityClass = `priority-${(item.priority || "medium").toLowerCase()}`;

    titleEl.textContent = item.title;
    bodyEl.innerHTML = `
      <div class="d-flex flex-wrap gap-2 mb-3">
        <span class="cal-event-pill ${typeClass}">${escapeHTML(item.type)}</span>
        <span class="priority-pill ${priorityClass}">${escapeHTML(item.priority)}</span>
        <span class="subject-badge">${escapeHTML(item.subject)}</span>
      </div>
      <div class="small text-secondary mb-2">
        <i class="bi bi-calendar-event me-1"></i><strong>Date:</strong> ${escapeHTML(item.date)}
        ${item.startTime ? ` &middot; ${escapeHTML(formatTime12h(item.startTime))}${item.endTime ? ` – ${escapeHTML(formatTime12h(item.endTime))}` : ""}` : ""}
      </div>
      <p class="mb-0 text-secondary">${item.description ? escapeHTML(item.description) : "No description provided."}</p>
    `;

    if (source === "event") {
      footerEl.innerHTML = `
        <button type="button" class="btn btn-outline-danger btn-sm" data-action="delete-event" data-event-id="${escapeHTML(item.id)}">Delete</button>
        <button type="button" class="btn btn-accent btn-sm" data-action="edit-event" data-event-id="${escapeHTML(item.id)}">Edit Event</button>
      `;
    } else if (source === "task") {
      footerEl.innerHTML = `
        <button type="button" class="btn btn-outline-accent btn-sm" data-bs-dismiss="modal">Close</button>
        <button type="button" class="btn btn-accent btn-sm" data-action="edit-task-from-cal" data-task-id="${escapeHTML(item.id)}">Edit Task</button>
      `;
    } else {
      footerEl.innerHTML = `<button type="button" class="btn btn-outline-accent btn-sm" data-bs-dismiss="modal">Close</button>`;
    }

    openModalById("eventDetailModal");
  }

  function openTaskModalForCreate() {
    const form = document.getElementById("taskForm");
    form.reset();
    document.getElementById("taskId").value = "";
    document.getElementById("taskModalLabel").textContent = "Add New Task";
    document.getElementById("taskSubmitBtn").textContent = "Save Task";
    document.getElementById("taskPriority").value = "Medium";
    document.getElementById("taskStatus").value = "Pending";
    document.getElementById("taskDate").value = getTodayISO();
    document.getElementById("taskDueTime").value = "17:00";
    openModalById("taskModal");
  }

  function openTaskModalForEdit(taskId) {
    const store = loadStore();
    const task = store.tasks.find((t) => t.id === taskId);
    if (!task) return;

    document.getElementById("taskId").value = task.id;
    document.getElementById("taskModalLabel").textContent = "Edit Task";
    document.getElementById("taskSubmitBtn").textContent = "Update Task";
    document.getElementById("taskTitle").value = task.title || "";
    document.getElementById("taskDescription").value = task.description || "";
    document.getElementById("taskSubject").value = task.subject || "";
    document.getElementById("taskCategory").value = task.category || "Assignment";
    document.getElementById("taskPriority").value = task.priority || "Medium";
    document.getElementById("taskStatus").value = task.completed ? "Completed" : (task.status || "Pending");
    document.getElementById("taskEstimatedMinutes").value = task.estimatedMinutes || "";
    document.getElementById("taskDate").value = task.date || getTodayISO();
    document.getElementById("taskDueTime").value = task.dueTime || "17:00";
    openModalById("taskModal");
  }

  /* ========================================================================
     Study Timer Logic
     ======================================================================== */

  function updateTimerDisplay() {
    const mins = String(Math.floor(timerState.remainingSeconds / 60)).padStart(2, "0");
    const secs = String(timerState.remainingSeconds % 60).padStart(2, "0");
    const displayEl = document.getElementById("studyTimerDisplay");
    const statusEl = document.getElementById("studyTimerStatus");
    const btnEl = document.getElementById("timerStartPauseBtn");
    const pillEl = document.getElementById("activeSessionPill");
    const dotEl = document.querySelector(".semester-pill .status-dot");

    if (displayEl) displayEl.textContent = `${mins}:${secs}`;
    if (statusEl) {
      statusEl.textContent = timerState.running ? "Focus timer running..." : "Focus Timer Ready";
    }
    if (btnEl) {
      btnEl.innerHTML = timerState.running
        ? '<i class="bi bi-pause-fill"></i> Pause'
        : '<i class="bi bi-play-fill"></i> Start Timer';
    }
    if (pillEl) {
      pillEl.textContent = timerState.running ? `Focus ${mins}:${secs}` : "";
      pillEl.classList.toggle("d-none", !timerState.running);
    }
    if (dotEl) {
      dotEl.classList.toggle("is-running", timerState.running);
    }
  }

  function toggleStudyTimer() {
    if (timerState.running) {
      clearInterval(timerState.intervalId);
      timerState.running = false;
      updateTimerDisplay();
      return;
    }

    timerState.running = true;
    updateTimerDisplay();

    timerState.intervalId = setInterval(() => {
      if (timerState.remainingSeconds > 0) {
        timerState.remainingSeconds -= 1;
        updateTimerDisplay();
      } else {
        clearInterval(timerState.intervalId);
        timerState.running = false;
        updateTimerDisplay();
        showToast("Focus timer finished! Log your study session below.");
      }
    }, 1000);
  }

  function resetStudyTimer() {
    clearInterval(timerState.intervalId);
    timerState.running = false;
    timerState.remainingSeconds = timerState.defaultSeconds;
    updateTimerDisplay();
  }

  /* ========================================================================
     Navigation Shell
     ======================================================================== */

  function setActiveSection(sectionKey) {
    const metadata = SECTION_METADATA[sectionKey] || SECTION_METADATA.dashboard;
    const navLinks = document.querySelectorAll(".sidebar .nav-link[data-section]");
    const breadcrumbTitle = document.getElementById("currentSectionTitle");
    const dashboardView = document.getElementById("dashboardView");
    const tasksView = document.getElementById("tasksView");
    const placeholderView = document.getElementById("sectionPlaceholder");
    const placeholderTitle = document.getElementById("placeholderTitle");
    const placeholderDesc = document.getElementById("placeholderDescription");

    navLinks.forEach((link) => {
      const isMatch = link.dataset.section === sectionKey;
      link.classList.toggle("active", isMatch);
      if (isMatch) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (breadcrumbTitle) breadcrumbTitle.textContent = metadata.title;

    dashboardView?.classList.add("d-none");
    tasksView?.classList.add("d-none");
    document.getElementById("calendarView")?.classList.add("d-none");
    document.getElementById("timetableView")?.classList.add("d-none");
    document.getElementById("studySessionsView")?.classList.add("d-none");
    document.getElementById("notesView")?.classList.add("d-none");
    document.getElementById("goalsView")?.classList.add("d-none");
    document.getElementById("subjectsView")?.classList.add("d-none");
    document.getElementById("analyticsView")?.classList.add("d-none");
    document.getElementById("settingsView")?.classList.add("d-none");
    placeholderView?.classList.add("d-none");

    if (sectionKey === "dashboard") {
      dashboardView?.classList.remove("d-none");
    } else if (sectionKey === "tasks") {
      tasksView?.classList.remove("d-none");
      renderTasksView();
    } else if (sectionKey === "calendar") {
      document.getElementById("calendarView")?.classList.remove("d-none");
      renderCalendarView();
    } else if (sectionKey === "timetable") {
      document.getElementById("timetableView")?.classList.remove("d-none");
      renderTimetableView();
    } else if (sectionKey === "study-sessions") {
      document.getElementById("studySessionsView")?.classList.remove("d-none");
      renderStudySessionsView();
      updatePomodoroUI();
    } else if (sectionKey === "notes") {
      document.getElementById("notesView")?.classList.remove("d-none");
      renderNotesView();
    } else if (sectionKey === "goals") {
      document.getElementById("goalsView")?.classList.remove("d-none");
      renderGoalsView();
    } else if (sectionKey === "subjects") {
      document.getElementById("subjectsView")?.classList.remove("d-none");
      renderSubjectsView();
    } else if (sectionKey === "analytics") {
      document.getElementById("analyticsView")?.classList.remove("d-none");
      renderAnalyticsView();
    } else if (sectionKey === "settings") {
      document.getElementById("settingsView")?.classList.remove("d-none");
      renderSettingsView();
    } else {
      placeholderView?.classList.remove("d-none");
      if (placeholderTitle) placeholderTitle.textContent = metadata.title;
      if (placeholderDesc) {
        placeholderDesc.textContent = `The ${metadata.title} view is ready in the navigation shell.`;
      }
    }
  }

  function closeMobileSidebarIfOpen() {
    const sidebarEl = document.getElementById("appSidebar");
    if (!sidebarEl || typeof bootstrap === "undefined") return;
    const instance = bootstrap.Offcanvas.getInstance(sidebarEl);
    if (instance) instance.hide();
  }

  /* ========================================================================
     Delegated Events & Form Submissions (Bound Once)
     ======================================================================== */

  function handleActionClick(action, target) {
    switch (action) {
      case "open-task-modal": {
        openTaskModalForCreate();
        break;
      }
      case "edit-task": {
        const taskId = target.dataset.taskId;
        if (taskId) openTaskModalForEdit(taskId);
        break;
      }
      case "delete-task": {
        const taskId = target.dataset.taskId;
        if (!taskId) return;
        const store = loadStore();
        const task = store.tasks.find((t) => t.id === taskId);
        if (!task) return;
        taskViewState.pendingDeleteId = taskId;
        document.getElementById("deleteTaskName").textContent = task.title;
        openModalById("deleteTaskModal");
        break;
      }
      case "reset-task-filters": {
        taskViewState.filter = "all";
        taskViewState.priority = "all";
        taskViewState.subject = "all";
        taskViewState.search = "";
        document.getElementById("taskSearchInput").value = "";
        document.getElementById("taskPriorityFilter").value = "all";
        document.getElementById("taskSubjectFilter").value = "all";
        document.querySelectorAll(".filter-tab[data-task-filter]").forEach((btn) => {
          const isAll = btn.dataset.taskFilter === "all";
          btn.classList.toggle("active", isAll);
          btn.setAttribute("aria-selected", String(isAll));
        });
        renderTasksView();
        break;
      }
      case "open-study-modal": {
        openModalById("studyModal");
        break;
      }
      case "open-deadline-modal": {
        document.getElementById("deadlineDate").value = getTodayISO();
        openModalById("deadlineModal");
        break;
      }
      case "open-class-modal": {
        openClassModalForCreate();
        break;
      }
      case "select-tt-day": {
        timetableState.selectedWeekday = Number(target.dataset.weekday);
        renderTimetableView();
        break;
      }
      case "edit-class": {
        openClassModalForEditOrDuplicate(target.dataset.classId, false);
        break;
      }
      case "duplicate-class": {
        openClassModalForEditOrDuplicate(target.dataset.classId, true);
        break;
      }
      case "delete-class": {
        const classId = target.dataset.classId;
        const store = loadStore();
        store.timetable = (store.timetable || []).filter((c) => c.id !== classId);
        saveStore(store);
        renderAllViews();
        showToast("Class deleted.");
        break;
      }
      case "delete-study-session": {
        const sessionId = target.dataset.sessionId;
        const store = loadStore();
        store.studySessions = (store.studySessions || []).filter((s) => s.id !== sessionId);
        saveStore(store);
        renderAllViews();
        showToast("Study session deleted.");
        break;
      }
      case "open-note-modal": {
        openNoteModalForCreate();
        break;
      }
      case "edit-note": {
        openNoteModalForEdit(target.dataset.noteId);
        break;
      }
      case "delete-note": {
        const noteId = target.dataset.noteId;
        const store = loadStore();
        const note = (store.notes || []).find((n) => n.id === noteId);
        if (!note) return;
        noteAttachmentState.pendingDeleteNoteId = noteId;
        document.getElementById("deleteNoteName").textContent = note.title;
        openModalById("deleteNoteModal");
        break;
      }
      case "remove-staged-attachment": {
        const idx = Number(target.dataset.stagedIndex);
        const removed = noteAttachmentState.staged.splice(idx, 1)[0];
        if (removed && removed.isExisting && removed.id) {
          noteAttachmentState.removedIds.push(removed.id);
        }
        showNoteAttachmentError("");
        renderEditorAttachmentsList();
        break;
      }
      case "preview-staged-attachment": {
        openAttachmentPreview(null, target.dataset.stagedIndex);
        break;
      }
      case "preview-attachment": {
        openAttachmentPreview(target.dataset.attachmentId, null);
        break;
      }
      case "download-attachment": {
        triggerAttachmentDownload(target.dataset.attachmentId, null);
        break;
      }
      case "toggle-pin-note": {
        const noteId = target.dataset.noteId;
        const store = loadStore();
        const note = (store.notes || []).find((n) => n.id === noteId);
        if (!note) return;
        note.pinned = !note.pinned;
        saveStore(store);
        renderNotesView();
        showToast(note.pinned ? "Note pinned." : "Note unpinned.");
        break;
      }
      case "reset-note-filters": {
        notesViewState.search = "";
        notesViewState.subject = "all";
        notesViewState.tag = "all";
        document.getElementById("noteSearchInput").value = "";
        document.getElementById("noteSubjectFilter").value = "all";
        document.getElementById("noteTagFilter").value = "all";
        renderNotesView();
        break;
      }
      case "open-goal-modal": {
        openGoalModalForCreate();
        break;
      }
      case "edit-goal": {
        openGoalModalForEdit(target.dataset.goalId);
        break;
      }
      case "delete-goal": {
        const goalId = target.dataset.goalId;
        const store = loadStore();
        store.goals = (store.goals || []).filter((g) => g.id !== goalId);
        saveStore(store);
        renderAllViews();
        showToast("Goal deleted.");
        break;
      }
      case "increment-goal": {
        const goalId = target.dataset.goalId;
        const store = loadStore();
        const goal = (store.goals || []).find((g) => g.id === goalId);
        if (!goal) return;
        const targetVal = Math.max(1, Number(goal.targetValue || 1));
        goal.currentValue = Math.min(targetVal, Number(goal.currentValue || 0) + 1);
        if (goal.currentValue >= targetVal) {
          goal.completed = true;
          goal.completedAt = new Date().toISOString();
        }
        saveStore(store);
        renderAllViews();
        showToast(goal.completed ? "Goal completed!" : "Goal progress updated.");
        break;
      }
      case "toggle-goal-complete": {
        const goalId = target.dataset.goalId;
        const store = loadStore();
        const goal = (store.goals || []).find((g) => g.id === goalId);
        if (!goal) return;
        goal.completed = !goal.completed;
        goal.completedAt = goal.completed ? new Date().toISOString() : null;
        if (goal.completed) {
          goal.currentValue = Math.max(1, Number(goal.targetValue || 1));
        }
        saveStore(store);
        renderAllViews();
        showToast(goal.completed ? "Goal marked completed." : "Goal reopened.");
        break;
      }
      case "open-habit-modal": {
        document.getElementById("habitForm").reset();
        openModalById("habitModal");
        break;
      }
      case "toggle-habit-date": {
        const habitId = target.dataset.habitId;
        const dateISO = target.dataset.date;
        if (!habitId || !dateISO) return;
        const store = loadStore();
        const habit = (store.habits || []).find((h) => h.id === habitId);
        if (!habit) return;
        if (!Array.isArray(habit.completedDates)) habit.completedDates = [];
        const idx = habit.completedDates.indexOf(dateISO);
        if (idx >= 0) {
          habit.completedDates.splice(idx, 1);
        } else {
          habit.completedDates.push(dateISO);
        }
        saveStore(store);
        renderAllViews();
        break;
      }
      case "delete-habit": {
        const habitId = target.dataset.habitId;
        const store = loadStore();
        store.habits = (store.habits || []).filter((h) => h.id !== habitId);
        saveStore(store);
        renderAllViews();
        showToast("Habit deleted.");
        break;
      }
      case "open-subject-modal": {
        openSubjectModalForCreate();
        break;
      }
      case "edit-subject": {
        openSubjectModalForEdit(target.dataset.subjectId);
        break;
      }
      case "delete-subject": {
        const subjectId = target.dataset.subjectId;
        const store = loadStore();
        store.subjectRecords = (store.subjectRecords || []).filter((s) => s.id !== subjectId);
        if (subjectViewState.selectedSubjectId === subjectId) {
          subjectViewState.selectedSubjectId = null;
        }
        saveStore(store);
        renderAllViews();
        showToast("Subject deleted.");
        break;
      }
      case "view-subject-detail": {
        subjectViewState.selectedSubjectId = target.dataset.subjectId;
        renderSubjectsView();
        break;
      }
      case "back-to-subjects": {
        subjectViewState.selectedSubjectId = null;
        renderSubjectsView();
        break;
      }
      case "open-assessment-modal": {
        openAssessmentModal(target.dataset.subjectId);
        break;
      }
      case "delete-assessment": {
        const subjectId = target.dataset.subjectId;
        const assessmentId = target.dataset.assessmentId;
        const store = loadStore();
        const sub = (store.subjectRecords || []).find((s) => s.id === subjectId);
        if (!sub) return;
        sub.assessments = (sub.assessments || []).filter((a) => a.id !== assessmentId);
        saveStore(store);
        renderAllViews();
        showToast("Assessment deleted.");
        break;
      }
      case "open-event-modal": {
        openEventModalForCreate();
        break;
      }
      case "select-cal-date": {
        const clickedDate = target.dataset.date;
        calendarState.selectedDate = calendarState.selectedDate === clickedDate ? null : clickedDate;
        renderCalendarView();
        break;
      }
      case "view-calendar-item": {
        openEventDetailModal(target.dataset.itemSource, target.dataset.itemId);
        break;
      }
      case "edit-event": {
        closeModalById("eventDetailModal");
        openEventModalForEdit(target.dataset.eventId);
        break;
      }
      case "delete-event": {
        const eventId = target.dataset.eventId;
        if (!eventId) return;
        const store = loadStore();
        store.events = (store.events || []).filter((e) => e.id !== eventId);
        saveStore(store);
        closeModalById("eventDetailModal");
        renderAllViews();
        showToast("Event deleted.");
        break;
      }
      case "edit-task-from-cal": {
        closeModalById("eventDetailModal");
        openTaskModalForEdit(target.dataset.taskId);
        break;
      }
      case "toggle-deadline": {
        const deadlineId = target.dataset.deadlineId;
        const store = loadStore();
        const deadline = (store.deadlines || []).find((d) => d.id === deadlineId);
        if (!deadline) return;
        deadline.completed = !deadline.completed;
        saveStore(store);
        renderAllViews();
        showToast(deadline.completed ? "Deadline completed." : "Deadline reopened.");
        break;
      }
      case "delete-deadline": {
        const deadlineId = target.dataset.deadlineId;
        const store = loadStore();
        store.deadlines = (store.deadlines || []).filter((d) => d.id !== deadlineId);
        saveStore(store);
        renderAllViews();
        showToast("Deadline deleted.");
        break;
      }
      case "toggle-task": {
        const taskId = target.dataset.taskId;
        if (!taskId) return;
        const store = loadStore();
        const task = store.tasks.find((t) => t.id === taskId);
        if (!task) return;
        task.completed = !task.completed;
        task.status = task.completed ? "Completed" : "Pending";
        task.completedAt = task.completed ? new Date().toISOString() : null;
        saveStore(store);
        renderAllViews();
        showToast(task.completed ? "Task marked as completed." : "Task reopened.");
        break;
      }
      default:
        break;
    }
  }

  function bindGlobalEvents() {
    // Delegated click handler prevents duplicate listeners on re-rendered elements
    document.addEventListener("click", (event) => {
      const actionEl = event.target.closest("[data-action]");
      if (actionEl) {
        handleActionClick(actionEl.dataset.action, actionEl);
        return;
      }

      const filterTab = event.target.closest(".filter-tab[data-task-filter]");
      if (filterTab) {
        taskViewState.filter = filterTab.dataset.taskFilter;
        document.querySelectorAll(".filter-tab[data-task-filter]").forEach((btn) => {
          const active = btn === filterTab;
          btn.classList.toggle("active", active);
          btn.setAttribute("aria-selected", String(active));
        });
        renderTasksView();
        return;
      }

      const calViewBtn = event.target.closest("[data-cal-view]");
      if (calViewBtn) {
        calendarState.viewMode = calViewBtn.dataset.calView;
        document.querySelectorAll("[data-cal-view]").forEach((btn) => {
          btn.classList.toggle("active", btn === calViewBtn);
        });
        renderCalendarView();
        return;
      }

      const pomoModeBtn = event.target.closest("[data-pomo-mode]");
      if (pomoModeBtn) {
        switchPomodoroMode(pomoModeBtn.dataset.pomoMode);
        return;
      }

      const formatBtn = event.target.closest("[data-note-format]");
      if (formatBtn) {
        applyNoteTextFormat(formatBtn.dataset.noteFormat);
        return;
      }

      const themeBtn = event.target.closest("[data-theme-choice]");
      if (themeBtn) {
        const store = loadStore();
        if (!store.settings) store.settings = getDefaultStore().settings;
        store.settings.theme = themeBtn.dataset.themeChoice;
        saveStore(store);
        applyTheme(store.settings.theme);
        showToast(`Theme set to ${store.settings.theme}.`);
        return;
      }

      const navLink = event.target.closest(".sidebar .nav-link[data-section]");
      if (navLink) {
        event.preventDefault();
        setActiveSection(navLink.dataset.section);
        closeMobileSidebarIfOpen();
      }
    });

    document.getElementById("taskSearchInput")?.addEventListener("input", (e) => {
      taskViewState.search = e.target.value;
      renderTasksView();
    });

    document.getElementById("taskPriorityFilter")?.addEventListener("change", (e) => {
      taskViewState.priority = e.target.value;
      renderTasksView();
    });

    document.getElementById("taskSubjectFilter")?.addEventListener("change", (e) => {
      taskViewState.subject = e.target.value;
      renderTasksView();
    });

    document.getElementById("taskSortSelect")?.addEventListener("change", (e) => {
      taskViewState.sortBy = e.target.value;
      renderTasksView();
    });

    // Calendar Controls
    document.getElementById("calPrevBtn")?.addEventListener("click", () => {
      const c = calendarState.cursorDate;
      calendarState.cursorDate =
        calendarState.viewMode === "week"
          ? new Date(c.getFullYear(), c.getMonth(), c.getDate() - 7)
          : new Date(c.getFullYear(), c.getMonth() - 1, 1);
      renderCalendarView();
    });

    document.getElementById("calNextBtn")?.addEventListener("click", () => {
      const c = calendarState.cursorDate;
      calendarState.cursorDate =
        calendarState.viewMode === "week"
          ? new Date(c.getFullYear(), c.getMonth(), c.getDate() + 7)
          : new Date(c.getFullYear(), c.getMonth() + 1, 1);
      renderCalendarView();
    });

    document.getElementById("calTodayBtn")?.addEventListener("click", () => {
      calendarState.cursorDate = new Date();
      calendarState.selectedDate = null;
      renderCalendarView();
    });

    document.getElementById("calendarTypeFilter")?.addEventListener("change", (e) => {
      calendarState.typeFilter = e.target.value;
      renderCalendarView();
    });

    document.getElementById("deadlineStatusFilter")?.addEventListener("change", (e) => {
      calendarState.deadlineFilter = e.target.value;
      renderCalendarView();
    });

    document.getElementById("timetableTodayBtn")?.addEventListener("click", () => {
      timetableState.selectedWeekday = new Date().getDay();
      renderTimetableView();
    });

    // Pomodoro Timer Controls
    document.getElementById("pomoStartBtn")?.addEventListener("click", startOrResumePomodoro);
    document.getElementById("pomoPauseBtn")?.addEventListener("click", pausePomodoro);
    document.getElementById("pomoResetBtn")?.addEventListener("click", () => {
      switchPomodoroMode(pomodoroState.mode);
    });
    document.getElementById("pomoSkipBtn")?.addEventListener("click", skipPomodoroSession);

    document.getElementById("savePomoDurationsBtn")?.addEventListener("click", () => {
      const focus = Math.max(1, parseInt(document.getElementById("pomoFocusMins").value, 10) || 25);
      const shortBreak = Math.max(1, parseInt(document.getElementById("pomoShortMins").value, 10) || 5);
      const longBreak = Math.max(1, parseInt(document.getElementById("pomoLongMins").value, 10) || 15);
      const store = loadStore();
      store.timerSettings = { focus, shortBreak, longBreak };
      saveStore(store);
      switchPomodoroMode(pomodoroState.mode);
      showToast("Timer durations updated.");
    });

    function toggleFullscreenFocus(enable) {
      const card = document.getElementById("pomodoroCard");
      const exitBtn = document.getElementById("exitFullscreenFocusBtn");
      if (!card || !exitBtn) return;
      card.classList.toggle("is-fullscreen-focus", enable);
      exitBtn.classList.toggle("d-none", !enable);
    }

    document.getElementById("toggleFullscreenFocusBtn")?.addEventListener("click", () => {
      const card = document.getElementById("pomodoroCard");
      toggleFullscreenFocus(!card?.classList.contains("is-fullscreen-focus"));
    });

    document.getElementById("exitFullscreenFocusBtn")?.addEventListener("click", () => {
      toggleFullscreenFocus(false);
    });

    // Notes Filter & Sort Controls
    document.getElementById("noteSearchInput")?.addEventListener("input", (e) => {
      notesViewState.search = e.target.value;
      renderNotesView();
    });
    document.getElementById("noteSubjectFilter")?.addEventListener("change", (e) => {
      notesViewState.subject = e.target.value;
      renderNotesView();
    });
    document.getElementById("noteTagFilter")?.addEventListener("change", (e) => {
      notesViewState.tag = e.target.value;
      renderNotesView();
    });
    document.getElementById("noteSortSelect")?.addEventListener("change", (e) => {
      notesViewState.sortBy = e.target.value;
      renderNotesView();
    });

    // Analytics Date Range Controls
    document.getElementById("analyticsRangeSelect")?.addEventListener("change", (e) => {
      analyticsState.range = e.target.value;
      const customWrap = document.getElementById("analyticsCustomRangeWrap");
      if (customWrap) {
        customWrap.classList.toggle("d-none", analyticsState.range !== "custom");
      }
      if (analyticsState.range === "custom") {
        const todayISO = getTodayISO();
        if (!analyticsState.startDate) analyticsState.startDate = todayISO;
        if (!analyticsState.endDate) analyticsState.endDate = todayISO;
        document.getElementById("analyticsStartDate").value = analyticsState.startDate;
        document.getElementById("analyticsEndDate").value = analyticsState.endDate;
      }
      renderAnalyticsView();
    });

    document.getElementById("analyticsStartDate")?.addEventListener("change", (e) => {
      analyticsState.startDate = e.target.value;
      renderAnalyticsView();
    });

    document.getElementById("analyticsEndDate")?.addEventListener("change", (e) => {
      analyticsState.endDate = e.target.value;
      renderAnalyticsView();
    });

    // Settings: Profile
    document.getElementById("profileSettingsForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const store = loadStore();
      const fullName = document.getElementById("settingStudentName").value.trim() || "Student";
      store.student = {
        name: fullName,
        firstName: fullName.split(/\s+/)[0] || fullName,
        college: document.getElementById("settingCollege").value.trim(),
        course: document.getElementById("settingCourse").value.trim(),
        semester: document.getElementById("settingSemester").value.trim()
      };
      saveStore(store);
      renderAllViews();
      showToast("Profile settings saved.");
    });

    // Settings: Productivity & Timer
    document.getElementById("productivitySettingsForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const store = loadStore();
      if (!store.settings) store.settings = getDefaultStore().settings;

      store.timerSettings = {
        focus: Math.max(1, parseInt(document.getElementById("settingFocusMins").value, 10) || 25),
        shortBreak: Math.max(1, parseInt(document.getElementById("settingShortBreakMins").value, 10) || 5),
        longBreak: Math.max(1, parseInt(document.getElementById("settingLongBreakMins").value, 10) || 15)
      };
      store.settings.dailyStudyGoalHours = parseFloat(document.getElementById("settingDailyGoalHrs").value) || 3;
      store.settings.weeklyStudyGoalHours = parseFloat(document.getElementById("settingWeeklyGoalHrs").value) || 20;

      saveStore(store);
      if (pomodoroState.status === "idle") {
        switchPomodoroMode(pomodoroState.mode);
      }
      renderAllViews();
      showToast("Productivity settings saved.");
    });

    // Settings: Notifications
    const saveNotifSettings = () => {
      const store = loadStore();
      if (!store.settings) store.settings = getDefaultStore().settings;
      store.settings.notifications = {
        deadlineReminders: document.getElementById("notifDeadlineToggle").checked,
        studyTimerNotifications: document.getElementById("notifTimerToggle").checked,
        dailyGoalReminders: document.getElementById("notifGoalToggle").checked
      };
      saveStore(store);
    };

    document.getElementById("notifDeadlineToggle")?.addEventListener("change", saveNotifSettings);
    document.getElementById("notifTimerToggle")?.addEventListener("change", saveNotifSettings);
    document.getElementById("notifGoalToggle")?.addEventListener("change", saveNotifSettings);

    document.getElementById("requestNotificationPermBtn")?.addEventListener("click", () => {
      if (typeof Notification === "undefined") {
        showToast("Browser notifications are not supported.");
        return;
      }
      Notification.requestPermission().then(() => {
        updateNotificationPermissionLabel();
        showToast(`Notification permission: ${Notification.permission}`);
      });
    });

    // Settings: Data Export, Validated Import & Clear
    document.getElementById("exportDataBtn")?.addEventListener("click", exportWorkspaceJSON);
    document.getElementById("backupBeforeImportBtn")?.addEventListener("click", exportWorkspaceJSON);
    document.getElementById("backupBeforeClearBtn")?.addEventListener("click", exportWorkspaceJSON);

    document.getElementById("importDataInput")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (!validateImportedStore(parsed)) {
            showToast("Invalid backup file structure.");
            return;
          }
          pendingImportStore = { ...getDefaultStore(), ...parsed };
          document.getElementById("importPreviewSummary").innerHTML = `
            <strong>Ready to import:</strong>
            ${pendingImportStore.tasks.length} tasks,
            ${(pendingImportStore.subjectRecords || []).length} subjects,
            ${pendingImportStore.studySessions.length} study sessions,
            ${pendingImportStore.notes.length} notes,
            ${pendingImportStore.goals.length} goals.
          `;
          openModalById("importConfirmModal");
        } catch {
          showToast("Could not parse JSON file.");
        } finally {
          e.target.value = "";
        }
      };
      reader.readAsText(file);
    });

    document.getElementById("confirmImportBtn")?.addEventListener("click", () => {
      if (!pendingImportStore) return;
      saveStore(pendingImportStore);
      pendingImportStore = null;
      closeModalById("importConfirmModal");
      renderAllViews();
      showToast("Data imported successfully.");
    });

    document.getElementById("openClearDataModalBtn")?.addEventListener("click", () => {
      openModalById("clearDataModal");
    });

    document.getElementById("confirmClearDataBtn")?.addEventListener("click", async () => {
      localStorage.removeItem(STORAGE_KEY);
      await clearAttachmentsDB();
      closeModalById("clearDataModal");
      switchPomodoroMode("focus");
      renderAllViews();
      showToast("All application data cleared.");
    });

    // React to OS theme changes when set to 'system'
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        const store = loadStore();
        if (store.settings?.theme === "system") {
          applyTheme("system");
        }
      });
    }

    document.getElementById("confirmDeleteTaskBtn")?.addEventListener("click", () => {
      const taskId = taskViewState.pendingDeleteId;
      if (!taskId) return;
      const store = loadStore();
      store.tasks = store.tasks.filter((t) => t.id !== taskId);
      saveStore(store);
      taskViewState.pendingDeleteId = null;
      closeModalById("deleteTaskModal");
      renderAllViews();
      showToast("Task deleted.");
    });

    document.getElementById("backToDashboardBtn")?.addEventListener("click", () => {
      setActiveSection("dashboard");
    });

    document.getElementById("openStudyQuickBtn")?.addEventListener("click", () => {
      openModalById("studyModal");
    });

    document.getElementById("timerStartPauseBtn")?.addEventListener("click", toggleStudyTimer);
    document.getElementById("timerResetBtn")?.addEventListener("click", resetStudyTimer);

    // Task Form (Create & Edit)
    document.getElementById("taskForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const store = loadStore();
      const editId = document.getElementById("taskId").value;
      const subject = document.getElementById("taskSubject").value.trim();
      const status = document.getElementById("taskStatus").value;
      const estimatedRaw = document.getElementById("taskEstimatedMinutes").value;
      const isCompleted = status === "Completed";
      registerSubjectIfNew(store, subject);

      const payload = {
        title: document.getElementById("taskTitle").value.trim(),
        description: document.getElementById("taskDescription").value.trim(),
        subject,
        category: document.getElementById("taskCategory").value,
        priority: document.getElementById("taskPriority").value,
        status,
        estimatedMinutes: estimatedRaw ? parseInt(estimatedRaw, 10) : null,
        date: document.getElementById("taskDate").value,
        dueTime: document.getElementById("taskDueTime").value,
        completed: isCompleted
      };

      if (editId) {
        const existing = store.tasks.find((t) => t.id === editId);
        if (existing) {
          Object.assign(existing, payload);
          existing.completedAt = isCompleted
            ? (existing.completedAt || new Date().toISOString())
            : null;
        }
      } else {
        store.tasks.push({
          id: `task_${Date.now()}`,
          ...payload,
          createdAt: new Date().toISOString(),
          completedAt: isCompleted ? new Date().toISOString() : null
        });
      }

      saveStore(store);
      e.target.reset();
      document.getElementById("taskId").value = "";
      closeModalById("taskModal");
      renderAllViews();
      showToast(editId ? "Task updated." : "Task added.");
    });

    // Study Session Form
    document.getElementById("studySessionForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const store = loadStore();
      const subject = document.getElementById("studySubject").value.trim();
      const topic = document.getElementById("studyTopic").value.trim();
      const durationMinutes = parseInt(document.getElementById("studyDuration").value, 10) || 25;
      registerSubjectIfNew(store, subject);

      const now = new Date();
      const startDate = new Date(now.getTime() - durationMinutes * 60000);

      store.studySessions.push({
        id: `session_${Date.now()}`,
        date: getTodayISO(),
        startTime: formatDateToHHMM(startDate),
        endTime: formatDateToHHMM(now),
        durationMinutes,
        subject,
        taskId: null,
        taskTitle: "",
        topic,
        sessionType: "Focus",
        status: "Completed",
        createdAt: now.toISOString()
      });

      saveStore(store);
      e.target.reset();
      document.getElementById("studyDuration").value = "25";
      resetStudyTimer();
      closeModalById("studyModal");
      renderAllViews();
      showToast(`Logged ${durationMinutes}m study session.`);
    });

    // Deadline Form
    document.getElementById("deadlineForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const store = loadStore();
      const subject = document.getElementById("deadlineSubject").value.trim();
      registerSubjectIfNew(store, subject);

      store.deadlines.push({
        id: `deadline_${Date.now()}`,
        title: document.getElementById("deadlineTitle").value.trim(),
        type: document.getElementById("deadlineType").value,
        priority: document.getElementById("deadlinePriority").value,
        subject,
        dueDate: document.getElementById("deadlineDate").value,
        completed: false
      });

      saveStore(store);
      e.target.reset();
      closeModalById("deadlineModal");
      renderAllViews();
      showToast("Deadline added.");
    });

    // Calendar Event Form (Create & Edit)
    document.getElementById("eventForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const startTime = document.getElementById("eventStartTime").value;
      const endTime = document.getElementById("eventEndTime").value;
      if (startTime && endTime && endTime < startTime) {
        showToast("Event end time cannot be earlier than start time.");
        return;
      }

      const store = loadStore();
      if (!Array.isArray(store.events)) store.events = [];

      const editId = document.getElementById("eventId").value;
      const subject = document.getElementById("eventSubject").value.trim();
      registerSubjectIfNew(store, subject);

      const payload = {
        title: document.getElementById("eventTitle").value.trim(),
        description: document.getElementById("eventDescription").value.trim(),
        type: document.getElementById("eventType").value,
        subject,
        priority: document.getElementById("eventPriority").value,
        date: document.getElementById("eventDate").value,
        startTime,
        endTime
      };

      if (editId) {
        const existing = store.events.find((ev) => ev.id === editId);
        if (existing) Object.assign(existing, payload);
      } else {
        store.events.push({
          id: generateId("event"),
          ...payload,
          createdAt: new Date().toISOString()
        });
      }

      saveStore(store);
      e.target.reset();
      document.getElementById("eventId").value = "";
      closeModalById("eventModal");
      renderAllViews();
      showToast(editId ? "Event updated." : "Event added.");
    });

    // Timetable Class Form (Create, Edit & Duplicate)
    document.getElementById("classForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const startTime = document.getElementById("classStartTime").value;
      const endTime = document.getElementById("classEndTime").value;
      if (startTime && endTime && endTime <= startTime) {
        showToast("Class end time must be after start time.");
        return;
      }

      const store = loadStore();
      if (!Array.isArray(store.timetable)) store.timetable = [];

      const editId = document.getElementById("classId").value;
      const name = document.getElementById("className").value.trim();
      registerSubjectIfNew(store, name);

      const payload = {
        name,
        teacher: document.getElementById("classTeacher").value.trim(),
        location: document.getElementById("classLocation").value.trim(),
        weekday: Number(document.getElementById("classWeekday").value),
        color: document.getElementById("classColor").value,
        startTime,
        endTime
      };

      if (editId) {
        const existing = store.timetable.find((c) => c.id === editId);
        if (existing) Object.assign(existing, payload);
      } else {
        store.timetable.push({
          id: generateId("class"),
          ...payload
        });
      }

      saveStore(store);
      e.target.reset();
      document.getElementById("classId").value = "";
      closeModalById("classModal");
      renderAllViews();
      showToast(editId ? "Class updated." : "Class saved to timetable.");
    });

    // Note Form (Create & Edit with IndexedDB Attachments)
    document.getElementById("noteForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const store = loadStore();
      if (!Array.isArray(store.notes)) store.notes = [];

      const editId = document.getElementById("noteId").value;
      const noteId = editId || generateId("note");
      const subject = document.getElementById("noteSubject").value.trim();
      const tagsRaw = document.getElementById("noteTags").value;
      const tags = tagsRaw
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean);
      registerSubjectIfNew(store, subject);

      try {
        // Persist newly added files to IndexedDB
        for (const att of noteAttachmentState.staged) {
          if (!att.isExisting && att.file) {
            await saveAttachmentToDB({
              id: att.id,
              noteId,
              name: att.name,
              type: att.type,
              size: att.size,
              dateAdded: att.dateAdded,
              blob: att.file
            });
          }
        }

        // Remove deleted attachments from IndexedDB
        for (const removedId of noteAttachmentState.removedIds) {
          await deleteAttachmentFromDB(removedId);
        }
      } catch (err) {
        const msg =
          err && err.name === "QuotaExceededError"
            ? "Storage quota exceeded. Remove some files before saving."
            : "Failed to save attached files to browser storage.";
        showNoteAttachmentError(msg);
        showToast(msg);
        return;
      }

      const attachmentMetadata = noteAttachmentState.staged.map((att) => ({
        id: att.id,
        noteId,
        name: att.name,
        type: att.type,
        size: att.size,
        dateAdded: att.dateAdded
      }));

      const nowISO = new Date().toISOString();
      const payload = {
        title: document.getElementById("noteTitle").value.trim(),
        subject,
        tags,
        content: document.getElementById("noteContent").value.trim(),
        attachments: attachmentMetadata,
        updatedAt: nowISO
      };

      if (editId) {
        const existing = store.notes.find((n) => n.id === editId);
        if (existing) Object.assign(existing, payload);
      } else {
        store.notes.push({
          id: noteId,
          ...payload,
          pinned: false,
          createdAt: nowISO
        });
      }

      saveStore(store);
      e.target.reset();
      document.getElementById("noteId").value = "";
      noteAttachmentState.staged = [];
      noteAttachmentState.removedIds = [];
      closeModalById("noteModal");
      renderAllViews();
      showToast(editId ? "Note updated." : "Note saved.");
    });

    // Note Delete Confirmation (also removes attachments from IndexedDB)
    document.getElementById("confirmDeleteNoteBtn")?.addEventListener("click", async () => {
      const noteId = noteAttachmentState.pendingDeleteNoteId;
      if (!noteId) return;
      const store = loadStore();
      store.notes = (store.notes || []).filter((n) => n.id !== noteId);
      saveStore(store);
      noteAttachmentState.pendingDeleteNoteId = null;
      try {
        await deleteAttachmentsForNoteFromDB(noteId);
      } catch {
        // Note metadata is already removed; ignore DB cleanup error
      }
      closeModalById("deleteNoteModal");
      renderAllViews();
      showToast("Note and attachments deleted.");
    });

    // Dropzone & File Picker Events
    const dropzone = document.getElementById("noteDropzone");
    const fileInput = document.getElementById("noteFileInput");
    if (dropzone && fileInput) {
      dropzone.addEventListener("click", () => fileInput.click());
      dropzone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fileInput.click();
        }
      });

      fileInput.addEventListener("change", (e) => {
        handleSelectedFiles(e.target.files);
        e.target.value = "";
      });

      ["dragenter", "dragover"].forEach((evtName) => {
        dropzone.addEventListener(evtName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add("is-dragover");
        });
      });

      ["dragleave", "drop"].forEach((evtName) => {
        dropzone.addEventListener(evtName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove("is-dragover");
        });
      });

      dropzone.addEventListener("drop", (e) => {
        if (e.dataTransfer?.files) {
          handleSelectedFiles(e.dataTransfer.files);
        }
      });
    }

    // Revoke preview blob URL when preview modal closes
    document.getElementById("attachmentPreviewModal")?.addEventListener("hidden.bs.modal", () => {
      if (noteAttachmentState.previewObjectUrl) {
        URL.revokeObjectURL(noteAttachmentState.previewObjectUrl);
        noteAttachmentState.previewObjectUrl = null;
      }
      document.getElementById("previewModalBody").innerHTML = "";
    });

    // Goal Form (Create & Edit)
    document.getElementById("goalForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const startDate = document.getElementById("goalStartDate").value;
      const targetDate = document.getElementById("goalTargetDate").value;
      if (startDate && targetDate && targetDate < startDate) {
        showToast("Target date cannot be earlier than start date.");
        return;
      }

      const store = loadStore();
      if (!Array.isArray(store.goals)) store.goals = [];

      const editId = document.getElementById("goalId").value;
      const targetValue = Math.max(1, parseInt(document.getElementById("goalTargetValue").value, 10) || 1);
      const currentValue = Math.max(0, parseInt(document.getElementById("goalCurrentValue").value, 10) || 0);
      const isCompleted = currentValue >= targetValue;

      const payload = {
        title: document.getElementById("goalTitle").value.trim(),
        description: document.getElementById("goalDescription").value.trim(),
        category: document.getElementById("goalCategory").value,
        priority: document.getElementById("goalPriority").value,
        startDate: document.getElementById("goalStartDate").value,
        targetDate: document.getElementById("goalTargetDate").value,
        targetValue,
        currentValue,
        completed: isCompleted
      };

      if (editId) {
        const existing = store.goals.find((g) => g.id === editId);
        if (existing) {
          Object.assign(existing, payload);
          existing.completedAt = isCompleted ? (existing.completedAt || new Date().toISOString()) : null;
        }
      } else {
        store.goals.push({
          id: `goal_${Date.now()}`,
          ...payload,
          createdAt: new Date().toISOString(),
          completedAt: isCompleted ? new Date().toISOString() : null
        });
      }

      saveStore(store);
      e.target.reset();
      document.getElementById("goalId").value = "";
      closeModalById("goalModal");
      renderAllViews();
      showToast(editId ? "Goal updated." : "Goal added.");
    });

    // Habit Form
    document.getElementById("habitForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const store = loadStore();
      if (!Array.isArray(store.habits)) store.habits = [];

      store.habits.push({
        id: `habit_${Date.now()}`,
        title: document.getElementById("habitTitle").value.trim(),
        category: document.getElementById("habitCategory").value,
        completedDates: [],
        createdAt: new Date().toISOString()
      });

      saveStore(store);
      e.target.reset();
      closeModalById("habitModal");
      renderAllViews();
      showToast("Habit added.");
    });

    // Subject Form (Create & Edit)
    document.getElementById("subjectForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const store = loadStore();
      if (!Array.isArray(store.subjectRecords)) store.subjectRecords = [];

      const editId = document.getElementById("subjectId").value;
      const name = document.getElementById("subjectName").value.trim();
      const code = document.getElementById("subjectCode").value.trim();
      registerSubjectIfNew(store, code || name);

      const payload = {
        name,
        code,
        teacher: document.getElementById("subjectTeacher").value.trim(),
        semester: document.getElementById("subjectSemester").value.trim(),
        credits: Math.max(1, parseInt(document.getElementById("subjectCredits").value, 10) || 3),
        targetGrade: document.getElementById("subjectTargetGrade").value.trim(),
        color: document.getElementById("subjectColor").value,
        description: document.getElementById("subjectDescription").value.trim()
      };

      if (editId) {
        const existing = store.subjectRecords.find((s) => s.id === editId);
        if (existing) Object.assign(existing, payload);
      } else {
        store.subjectRecords.push({
          id: `subject_${Date.now()}`,
          ...payload,
          assessments: [],
          createdAt: new Date().toISOString()
        });
      }

      saveStore(store);
      e.target.reset();
      document.getElementById("subjectId").value = "";
      closeModalById("subjectModal");
      renderAllViews();
      showToast(editId ? "Subject updated." : "Subject added.");
    });

    // Assessment Form
    document.getElementById("assessmentForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const store = loadStore();
      const subjectId = document.getElementById("assessmentSubjectId").value;
      const sub = (store.subjectRecords || []).find((s) => s.id === subjectId);
      if (!sub) return;
      if (!Array.isArray(sub.assessments)) sub.assessments = [];

      const maxMarks = Math.max(1, parseFloat(document.getElementById("assessmentMaxMarks").value) || 100);
      const marksObtained = Math.min(
        maxMarks,
        Math.max(0, parseFloat(document.getElementById("assessmentMarksObtained").value) || 0)
      );

      sub.assessments.push({
        id: `assess_${Date.now()}`,
        name: document.getElementById("assessmentName").value.trim(),
        marksObtained,
        maxMarks,
        date: document.getElementById("assessmentDate").value
      });

      saveStore(store);
      e.target.reset();
      closeModalById("assessmentModal");
      renderAllViews();
      showToast("Assessment saved.");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const initialStore = loadStore();
    applyTheme(initialStore.settings?.theme || "light");
    bindGlobalEvents();
    updateTimerDisplay();
    switchPomodoroMode("focus");
    renderAllViews();
    setActiveSection("dashboard");
  });
})();
