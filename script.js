const STORAGE_KEY = "focus-study-data";

document.addEventListener("DOMContentLoaded", () => {
  const elements = {
    todayLabel: document.getElementById("todayLabel"),

    statusDot: document.getElementById("statusDot"),
    statusText: document.getElementById("statusText"),

    sessionTimer: document.getElementById("sessionTimer"),
    dailyTotal: document.getElementById("dailyTotal"),
    leaveCount: document.getElementById("leaveCount"),
    continuousTimer: document.getElementById("continuousTimer"),

    visibilityTip: document.getElementById("visibilityTip"),

    startBtn: document.getElementById("startBtn"),
    stopBtn: document.getElementById("stopBtn"),

    openTasksBtn: document.getElementById("openTasksBtn"),
    closeTasksBtn: document.getElementById("closeTasksBtn"),
    tasksModal: document.getElementById("tasksModal"),

    openRecordsBtn: document.getElementById("openRecordsBtn"),
    closeRecordsBtn: document.getElementById("closeRecordsBtn"),
    recordsModal: document.getElementById("recordsModal"),

    taskForm: document.getElementById("taskForm"),
    taskInput: document.getElementById("taskInput"),
    taskList: document.getElementById("taskList"),
    taskEmpty: document.getElementById("taskEmpty"),
    taskProgress: document.getElementById("taskProgress"),

    recordList: document.getElementById("recordList"),
    recordEmpty: document.getElementById("recordEmpty"),
    clearRecordsBtn: document.getElementById("clearRecordsBtn"),

    toast: document.getElementById("toast")
  };

  let timer = null;
  let toastTimer = null;

  let state = createInitialState();

  function createInitialState() {
    return {
      date: getTodayKey(),

      dailyTotalMs: 0,
      leaveCount: 0,

      tasks: [],
      records: [],

      sessionActive: false,
      sessionElapsedMs: 0,
      continuousMs: 0,

      sessionStartedAt: null,
      lastTickAt: null,
      pausedByVisibility: false
    };
  }

  function getTodayKey() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getTodayText() {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "long",
      day: "numeric",
      weekday: "long"
    }).format(new Date());
  }

  function formatDuration(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((number) => String(number).padStart(2, "0"))
      .join(":");
  }

  function formatTime(timestamp) {
    if (!timestamp) {
      return "--:--";
    }

    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date(timestamp));
  }

  function createId() {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch (error) {
      console.error("保存网页数据失败：", error);
    }
  }

  function loadState() {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);

      if (!savedData) {
        return;
      }

      const parsedData = JSON.parse(savedData);

      if (parsedData.date !== getTodayKey()) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      state = {
        ...createInitialState(),
        ...parsedData,

        /*
          刷新或重新打开网页后，不自动继续上一轮学习。
          已经保存的累计时间、任务和记录不会丢失。
        */
        sessionActive: false,
        sessionElapsedMs: 0,
        continuousMs: 0,
        sessionStartedAt: null,
        lastTickAt: null,
        pausedByVisibility: false
      };
    } catch (error) {
      console.error("读取网页数据失败：", error);

      localStorage.removeItem(STORAGE_KEY);
      state = createInitialState();
    }
  }

  function checkNewDay() {
    const today = getTodayKey();

    if (state.date === today) {
      return;
    }

    stopTimer();

    state = createInitialState();

    saveState();
  }

  function updateTime() {
    if (
      !state.sessionActive ||
      document.hidden ||
      state.lastTickAt === null
    ) {
      return;
    }

    const now = Date.now();

    const elapsedSinceLastTick = Math.max(
      0,
      now - state.lastTickAt
    );

    state.sessionElapsedMs += elapsedSinceLastTick;
    state.continuousMs += elapsedSinceLastTick;
    state.lastTickAt = now;
  }

  function startTimer() {
    stopTimer();

    timer = window.setInterval(() => {
      updateTime();
      renderTimers();
    }, 250);
  }

  function stopTimer() {
    if (timer === null) {
      return;
    }

    window.clearInterval(timer);
    timer = null;
  }

  function startStudy() {
    if (state.sessionActive) {
      return;
    }

    checkNewDay();

    const now = Date.now();

    state.sessionActive = true;
    state.sessionElapsedMs = 0;
    state.continuousMs = 0;

    state.sessionStartedAt = now;

    state.pausedByVisibility = document.hidden;
    state.lastTickAt = document.hidden
      ? null
      : now;

    if (!document.hidden) {
      startTimer();
    }

    saveState();
    render();

    showToast("学习计时已开始");
  }

  function stopStudy() {
    if (!state.sessionActive) {
      return;
    }

    updateTime();
    stopTimer();

    const endedAt = Date.now();
    const duration = state.sessionElapsedMs;

    if (duration > 0) {
      state.dailyTotalMs += duration;

      state.records.unshift({
        id: createId(),
        startedAt: state.sessionStartedAt,
        endedAt,
        durationMs: duration
      });
    }

    state.sessionActive = false;
    state.sessionElapsedMs = 0;
    state.continuousMs = 0;

    state.sessionStartedAt = null;
    state.lastTickAt = null;
    state.pausedByVisibility = false;

    saveState();
    render();

    if (duration > 0) {
      showToast("本次学习记录已保存");
    } else {
      showToast("本次没有产生有效学习时长");
    }
  }

  function handleVisibilityChange() {
    if (!state.sessionActive) {
      renderStatus();
      return;
    }

    if (document.hidden) {
      updateTime();

      state.leaveCount += 1;
      state.continuousMs = 0;

      state.lastTickAt = null;
      state.pausedByVisibility = true;

      stopTimer();
    } else {
      state.lastTickAt = Date.now();
      state.pausedByVisibility = false;

      startTimer();
    }

    saveState();
    render();
  }

  function addTask(title) {
    state.tasks.push({
      id: createId(),
      title,
      completed: false
    });

    saveState();
    renderTasks();
  }

  function toggleTask(taskId) {
    const task = state.tasks.find(
      (item) => item.id === taskId
    );

    if (!task) {
      return;
    }

    task.completed = !task.completed;

    saveState();
    renderTasks();
  }

  function deleteTask(taskId) {
    state.tasks = state.tasks.filter(
      (item) => item.id !== taskId
    );

    saveState();
    renderTasks();
  }

  function clearRecords() {
    state.records = [];
    state.dailyTotalMs = 0;

    saveState();
    render();

    showToast("今日学习记录已清空");
  }

  function openModal(modal) {
    if (!modal) {
      return;
    }

    modal.classList.add("open");
  }

  function closeModal(modal) {
    if (!modal) {
      return;
    }

    modal.classList.remove("open");
  }

  function renderTimers() {
    elements.sessionTimer.textContent =
      formatDuration(state.sessionElapsedMs);

    const currentDailyTotal =
      state.dailyTotalMs +
      (
        state.sessionActive
          ? state.sessionElapsedMs
          : 0
      );

    elements.dailyTotal.textContent =
      formatDuration(currentDailyTotal);

    elements.leaveCount.textContent =
      String(state.leaveCount);

    elements.continuousTimer.textContent =
      formatDuration(state.continuousMs);
  }

  function renderStatus() {
    elements.statusDot.className = "status-dot";

    if (!state.sessionActive) {
      elements.statusText.textContent = "尚未开始";

      elements.visibilityTip.textContent =
        "当前页面可见，点击开始后将正常计时。";
    } else if (
      document.hidden ||
      state.pausedByVisibility
    ) {
      elements.statusDot.classList.add("paused");

      elements.statusText.textContent =
        "已自动暂停";

      elements.visibilityTip.textContent =
        "页面进入后台，返回后将自动继续计时。";
    } else {
      elements.statusDot.classList.add("running");

      elements.statusText.textContent =
        "正在专注";

      elements.visibilityTip.textContent =
        "当前页面处于前台，正在累计学习时间。";
    }

    elements.startBtn.disabled =
      state.sessionActive;

    elements.stopBtn.disabled =
      !state.sessionActive;
  }

  function renderTasks() {
    elements.taskList.innerHTML = "";

    state.tasks.forEach((task) => {
      const listItem = document.createElement("li");

      listItem.className = task.completed
        ? "task-item completed"
        : "task-item";

      const checkbox = document.createElement("input");

      checkbox.type = "checkbox";
      checkbox.className = "task-check";
      checkbox.checked = task.completed;

      checkbox.setAttribute(
        "aria-label",
        `完成任务：${task.title}`
      );

      checkbox.addEventListener("change", () => {
        toggleTask(task.id);
      });

      const title = document.createElement("span");

      title.className = "task-title";
      title.textContent = task.title;

      const deleteButton =
        document.createElement("button");

      deleteButton.type = "button";
      deleteButton.className = "icon-btn";
      deleteButton.textContent = "删除";

      deleteButton.addEventListener("click", () => {
        deleteTask(task.id);
      });

      listItem.append(
        checkbox,
        title,
        deleteButton
      );

      elements.taskList.appendChild(listItem);
    });

    const completedCount = state.tasks.filter(
      (task) => task.completed
    ).length;

    elements.taskProgress.textContent =
      `${completedCount} / ${state.tasks.length}`;

    elements.taskEmpty.hidden =
      state.tasks.length > 0;
  }

  function renderRecords() {
    elements.recordList.innerHTML = "";

    state.records.forEach((record, index) => {
      const item = document.createElement("div");

      item.className = "record-item";

      const meta = document.createElement("div");

      meta.className = "record-meta";

      const title = document.createElement("strong");

      title.textContent =
        `学习记录 ${state.records.length - index}`;

      const time = document.createElement("span");

      time.textContent =
        `${formatTime(record.startedAt)} — ${formatTime(record.endedAt)}`;

      const duration = document.createElement("div");

      duration.className = "record-duration";
      duration.textContent =
        formatDuration(record.durationMs);

      meta.append(title, time);
      item.append(meta, duration);

      elements.recordList.appendChild(item);
    });

    elements.recordEmpty.hidden =
      state.records.length > 0;
  }

  function render() {
    checkNewDay();

    elements.todayLabel.textContent =
      getTodayText();

    renderTimers();
    renderStatus();
    renderTasks();
    renderRecords();
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);

    elements.toast.textContent = message;
    elements.toast.classList.add("show");

    toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove("show");
    }, 2200);
  }

  elements.startBtn.addEventListener(
    "click",
    startStudy
  );

  elements.stopBtn.addEventListener(
    "click",
    stopStudy
  );

  elements.taskForm.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      const taskTitle =
        elements.taskInput.value.trim();

      if (!taskTitle) {
        showToast("请输入任务内容");
        return;
      }

      addTask(taskTitle);

      elements.taskInput.value = "";
      elements.taskInput.focus();
    }
  );

  elements.clearRecordsBtn.addEventListener(
    "click",
    () => {
      const hasNoRecords =
        state.records.length === 0 &&
        state.dailyTotalMs === 0;

      if (hasNoRecords) {
        showToast("今天还没有学习记录");
        return;
      }

      const confirmed = window.confirm(
        "确定清空今天的学习记录和累计时长吗？"
      );

      if (confirmed) {
        clearRecords();
      }
    }
  );

  elements.openTasksBtn.addEventListener(
    "click",
    () => {
      closeModal(elements.recordsModal);
      openModal(elements.tasksModal);

      window.setTimeout(() => {
        elements.taskInput.focus();
      }, 150);
    }
  );

  elements.closeTasksBtn.addEventListener(
    "click",
    () => {
      closeModal(elements.tasksModal);
    }
  );

  elements.openRecordsBtn.addEventListener(
    "click",
    () => {
      closeModal(elements.tasksModal);
      openModal(elements.recordsModal);
    }
  );

  elements.closeRecordsBtn.addEventListener(
    "click",
    () => {
      closeModal(elements.recordsModal);
    }
  );

  elements.tasksModal.addEventListener(
    "click",
    (event) => {
      if (event.target === elements.tasksModal) {
        closeModal(elements.tasksModal);
      }
    }
  );

  elements.recordsModal.addEventListener(
    "click",
    (event) => {
      if (event.target === elements.recordsModal) {
        closeModal(elements.recordsModal);
      }
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") {
        return;
      }

      closeModal(elements.tasksModal);
      closeModal(elements.recordsModal);
    }
  );

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  window.addEventListener(
    "beforeunload",
    () => {
      updateTime();
      saveState();
    }
  );

  loadState();
  render();
});