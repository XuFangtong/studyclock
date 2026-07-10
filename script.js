const STORAGE_KEY = "focus-study-data-v4";
const VOLUME_STORAGE_KEY = "focus-white-noise-volume";

document.addEventListener("DOMContentLoaded", () => {
  const elements = {
    todayLabel: document.getElementById("todayLabel"),

    calendarWrapper:
      document.getElementById("calendarWrapper"),

    calendarMonthTitle:
      document.getElementById("calendarMonthTitle"),

    calendarGrid:
      document.getElementById("calendarGrid"),

    soundToggleBtn:
      document.getElementById("soundToggleBtn"),

    volumeSlider:
      document.getElementById("volumeSlider"),

    volumeValue:
      document.getElementById("volumeValue"),

    statusDot:
      document.getElementById("statusDot"),

    statusText:
      document.getElementById("statusText"),

    sessionTimer:
      document.getElementById("sessionTimer"),

    dailyTotal:
      document.getElementById("dailyTotal"),

    leaveCount:
      document.getElementById("leaveCount"),

    continuousTimer:
      document.getElementById("continuousTimer"),

    visibilityTip:
      document.getElementById("visibilityTip"),

    startBtn:
      document.getElementById("startBtn"),

    stopBtn:
      document.getElementById("stopBtn"),

    openTasksBtn:
      document.getElementById("openTasksBtn"),

    closeTasksBtn:
      document.getElementById("closeTasksBtn"),

    tasksModal:
      document.getElementById("tasksModal"),

    openRecordsBtn:
      document.getElementById("openRecordsBtn"),

    closeRecordsBtn:
      document.getElementById("closeRecordsBtn"),

    recordsModal:
      document.getElementById("recordsModal"),

    taskForm:
      document.getElementById("taskForm"),

    taskInput:
      document.getElementById("taskInput"),

    taskList:
      document.getElementById("taskList"),

    taskEmpty:
      document.getElementById("taskEmpty"),

    taskProgress:
      document.getElementById("taskProgress"),

    recordList:
      document.getElementById("recordList"),

    recordEmpty:
      document.getElementById("recordEmpty"),

    clearRecordsBtn:
      document.getElementById("clearRecordsBtn"),

    toast:
      document.getElementById("toast")
  };

  let timer = null;
  let toastTimer = null;

  let audioContext = null;
  let noiseSource = null;
  let noiseGain = null;
  let noiseFilter = null;
  let isNoisePlaying = false;

  let state = createInitialState();

  function createEmptyDay() {
    return {
      dailyTotalMs: 0,
      leaveCount: 0,
      tasks: [],
      records: []
    };
  }

  function createInitialState() {
    const today = getDateKey();

    return {
      currentDate: today,

      days: {
        [today]: createEmptyDay()
      },

      session: {
        active: false,
        date: today,
        elapsedMs: 0,
        continuousMs: 0,
        startedAt: null,
        lastTickAt: null,
        pausedByVisibility: false
      }
    };
  }

  function getDateKey(date = new Date()) {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getTodayText() {
    return new Intl.DateTimeFormat(
      "zh-CN",
      {
        month: "long",
        day: "numeric",
        weekday: "long"
      }
    ).format(new Date());
  }

  function getCurrentDayData() {
    const today = getDateKey();

    if (!state.days[today]) {
      state.days[today] = createEmptyDay();
    }

    return state.days[today];
  }

  function ensureCurrentDay() {
    const today = getDateKey();

    if (!state.days[today]) {
      state.days[today] = createEmptyDay();
    }

    state.currentDate = today;
  }

  function formatDuration(milliseconds) {
    const totalSeconds = Math.floor(
      milliseconds / 1000
    );

    const hours = Math.floor(
      totalSeconds / 3600
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const seconds = totalSeconds % 60;

    return [
      hours,
      minutes,
      seconds
    ]
      .map((value) =>
        String(value).padStart(2, "0")
      )
      .join(":");
  }

  function formatTime(timestamp) {
    if (!timestamp) {
      return "--:--";
    }

    return new Intl.DateTimeFormat(
      "zh-CN",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }
    ).format(new Date(timestamp));
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
      console.error(
        "保存网页数据失败：",
        error
      );
    }
  }

  function migrateOldData() {
    const oldKeys = [
      "focus-study-data-v3",
      "focus-study-data",
      "focusStudyDataV1"
    ];

    for (const key of oldKeys) {
      const raw = localStorage.getItem(key);

      if (!raw) {
        continue;
      }

      try {
        const oldData = JSON.parse(raw);

        if (oldData.days) {
          state = {
            ...createInitialState(),
            ...oldData,

            days: {
              ...createInitialState().days,
              ...oldData.days
            },

            session: {
              ...createInitialState().session,
              active: false,
              elapsedMs: 0,
              continuousMs: 0,
              startedAt: null,
              lastTickAt: null,
              pausedByVisibility: false
            }
          };
        } else {
          const oldDate =
            oldData.date || getDateKey();

          const oldDay = createEmptyDay();

          oldDay.dailyTotalMs =
            Number(oldData.dailyTotalMs) || 0;

          oldDay.leaveCount =
            Number(oldData.leaveCount) || 0;

          oldDay.tasks =
            Array.isArray(oldData.tasks)
              ? oldData.tasks
              : [];

          oldDay.records =
            Array.isArray(oldData.records)
              ? oldData.records
              : [];

          state.days[oldDate] = oldDay;
        }

        localStorage.removeItem(key);
        saveState();

        return;
      } catch (error) {
        console.warn(
          "旧版数据转换失败：",
          error
        );
      }
    }
  }

  function loadState() {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        migrateOldData();
        ensureCurrentDay();
        return;
      }

      const parsed = JSON.parse(saved);

      state = {
        ...createInitialState(),
        ...parsed,

        days: {
          ...createInitialState().days,
          ...(parsed.days || {})
        },

        session: {
          ...createInitialState().session,
          ...(parsed.session || {}),

          active: false,
          elapsedMs: 0,
          continuousMs: 0,
          startedAt: null,
          lastTickAt: null,
          pausedByVisibility: false
        }
      };
    } catch (error) {
      console.error(
        "读取网页数据失败：",
        error
      );

      localStorage.removeItem(STORAGE_KEY);

      state = createInitialState();
    }

    ensureCurrentDay();
    saveState();
  }

  function updateTime() {
    if (
      !state.session.active ||
      document.hidden ||
      state.session.lastTickAt === null
    ) {
      return;
    }

    const now = Date.now();

    const difference = Math.max(
      0,
      now - state.session.lastTickAt
    );

    state.session.elapsedMs += difference;
    state.session.continuousMs += difference;
    state.session.lastTickAt = now;
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
    if (state.session.active) {
      return;
    }

    ensureCurrentDay();

    const now = Date.now();
    const today = getDateKey();

    state.session = {
      active: true,
      date: today,
      elapsedMs: 0,
      continuousMs: 0,
      startedAt: now,

      lastTickAt:
        document.hidden
          ? null
          : now,

      pausedByVisibility:
        document.hidden
    };

    if (!document.hidden) {
      startTimer();
    }

    saveState();
    render();

    showToast("学习计时已开始");
  }

  function stopStudy() {
    if (!state.session.active) {
      return;
    }

    updateTime();
    stopTimer();

    const endedAt = Date.now();
    const duration = state.session.elapsedMs;

    const sessionDate =
      state.session.date || getDateKey();

    if (!state.days[sessionDate]) {
      state.days[sessionDate] =
        createEmptyDay();
    }

    const dayData =
      state.days[sessionDate];

    if (duration > 0) {
      dayData.dailyTotalMs += duration;

      dayData.records.unshift({
        id: createId(),
        startedAt:
          state.session.startedAt,
        endedAt,
        durationMs: duration
      });
    }

    state.session = {
      active: false,
      date: getDateKey(),
      elapsedMs: 0,
      continuousMs: 0,
      startedAt: null,
      lastTickAt: null,
      pausedByVisibility: false
    };

    saveState();
    render();

    if (duration > 0) {
      showToast("本次学习记录已保存");
    } else {
      showToast("本次没有产生有效学习时长");
    }
  }

  function handleVisibilityChange() {
    if (!state.session.active) {
      renderStatus();
      return;
    }

    if (document.hidden) {
      updateTime();

      const dayData = getCurrentDayData();

      dayData.leaveCount += 1;

      state.session.continuousMs = 0;
      state.session.lastTickAt = null;
      state.session.pausedByVisibility = true;

      stopTimer();
    } else {
      state.session.lastTickAt = Date.now();
      state.session.pausedByVisibility = false;

      startTimer();
    }

    saveState();
    render();
  }

  function addTask(title) {
    const dayData = getCurrentDayData();

    dayData.tasks.push({
      id: createId(),
      title,
      completed: false
    });

    saveState();
    renderTasks();
  }

  function toggleTask(taskId) {
    const dayData = getCurrentDayData();

    const task = dayData.tasks.find(
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
    const dayData = getCurrentDayData();

    dayData.tasks = dayData.tasks.filter(
      (item) => item.id !== taskId
    );

    saveState();
    renderTasks();
  }

  function clearRecords() {
    const dayData = getCurrentDayData();

    dayData.records = [];
    dayData.dailyTotalMs = 0;

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
    const dayData = getCurrentDayData();

    elements.sessionTimer.textContent =
      formatDuration(
        state.session.elapsedMs
      );

    const activeToday =
      state.session.active &&
      state.session.date === getDateKey();

    const displayedDailyTotal =
      dayData.dailyTotalMs +
      (
        activeToday
          ? state.session.elapsedMs
          : 0
      );

    elements.dailyTotal.textContent =
      formatDuration(displayedDailyTotal);

    elements.leaveCount.textContent =
      String(dayData.leaveCount);

    elements.continuousTimer.textContent =
      formatDuration(
        state.session.continuousMs
      );
  }

  function renderStatus() {
    elements.statusDot.className =
      "status-dot";

    if (!state.session.active) {
      elements.statusText.textContent =
        "尚未开始";

      elements.visibilityTip.textContent =
        "当前页面可见，点击开始后将正常计时。";
    } else if (
      document.hidden ||
      state.session.pausedByVisibility
    ) {
      elements.statusDot.classList.add(
        "paused"
      );

      elements.statusText.textContent =
        "已自动暂停";

      elements.visibilityTip.textContent =
        "页面进入后台，返回后将自动继续计时。";
    } else {
      elements.statusDot.classList.add(
        "running"
      );

      elements.statusText.textContent =
        "正在专注";

      elements.visibilityTip.textContent =
        "当前页面处于前台，正在累计学习时间。";
    }

    elements.startBtn.disabled =
      state.session.active;

    elements.stopBtn.disabled =
      !state.session.active;
  }

  function renderTasks() {
    const dayData = getCurrentDayData();

    elements.taskList.innerHTML = "";

    dayData.tasks.forEach((task) => {
      const listItem =
        document.createElement("li");

      listItem.className =
        task.completed
          ? "task-item completed"
          : "task-item";

      const checkbox =
        document.createElement("input");

      checkbox.type = "checkbox";
      checkbox.className = "task-check";
      checkbox.checked = task.completed;

      checkbox.setAttribute(
        "aria-label",
        `完成任务：${task.title}`
      );

      checkbox.addEventListener(
        "change",
        () => {
          toggleTask(task.id);
        }
      );

      const title =
        document.createElement("span");

      title.className = "task-title";
      title.textContent = task.title;

      const deleteButton =
        document.createElement("button");

      deleteButton.type = "button";
      deleteButton.className = "icon-btn";
      deleteButton.textContent = "删除";

      deleteButton.addEventListener(
        "click",
        () => {
          deleteTask(task.id);
        }
      );

      listItem.append(
        checkbox,
        title,
        deleteButton
      );

      elements.taskList.appendChild(
        listItem
      );
    });

    const completedCount =
      dayData.tasks.filter(
        (task) => task.completed
      ).length;

    elements.taskProgress.textContent =
      `${completedCount} / ${dayData.tasks.length}`;

    elements.taskEmpty.hidden =
      dayData.tasks.length > 0;
  }

  function renderRecords() {
    const dayData = getCurrentDayData();

    elements.recordList.innerHTML = "";

    dayData.records.forEach(
      (record, index) => {
        const item =
          document.createElement("div");

        item.className = "record-item";

        const meta =
          document.createElement("div");

        meta.className = "record-meta";

        const title =
          document.createElement("strong");

        title.textContent =
          `学习记录 ${
            dayData.records.length - index
          }`;

        const time =
          document.createElement("span");

        time.textContent =
          `${formatTime(
            record.startedAt
          )} — ${formatTime(
            record.endedAt
          )}`;

        const duration =
          document.createElement("div");

        duration.className =
          "record-duration";

        duration.textContent =
          formatDuration(
            record.durationMs
          );

        meta.append(title, time);

        item.append(meta, duration);

        elements.recordList.appendChild(
          item
        );
      }
    );

    elements.recordEmpty.hidden =
      dayData.records.length > 0;
  }

  function getStudyDurationForDate(
    dateKey
  ) {
    const dayData = state.days[dateKey];

    let duration =
      dayData
        ? Number(dayData.dailyTotalMs) || 0
        : 0;

    if (
      state.session.active &&
      state.session.date === dateKey
    ) {
      duration += state.session.elapsedMs;
    }

    return duration;
  }

  function renderCalendar() {
    const now = new Date();

    const year = now.getFullYear();
    const month = now.getMonth();

    elements.calendarMonthTitle.textContent =
      `${year}年${month + 1}月`;

    elements.calendarGrid.innerHTML = "";

    const firstDay =
      new Date(year, month, 1);

    const daysInMonth =
      new Date(
        year,
        month + 1,
        0
      ).getDate();

    const emptyCount =
      (firstDay.getDay() + 6) % 7;

    for (
      let index = 0;
      index < emptyCount;
      index += 1
    ) {
      const emptyCell =
        document.createElement("div");

      emptyCell.className =
        "calendar-day empty";

      elements.calendarGrid.appendChild(
        emptyCell
      );
    }

    const todayKey = getDateKey();

    for (
      let day = 1;
      day <= daysInMonth;
      day += 1
    ) {
      const date =
        new Date(year, month, day);

      const dateKey = getDateKey(date);

      const duration =
        getStudyDurationForDate(dateKey);

      const cell =
        document.createElement("div");

      cell.className = "calendar-day";
      cell.textContent = String(day);

      if (duration > 0) {
        cell.classList.add("studied");
      }

      if (dateKey === todayKey) {
        cell.classList.add("today");
      }

      const durationText =
        duration > 0
          ? `学习 ${formatDuration(duration)}`
          : "没有学习记录";

      cell.title =
        `${dateKey} · ${durationText}`;

      elements.calendarGrid.appendChild(
        cell
      );
    }
  }

  function render() {
    ensureCurrentDay();

    elements.todayLabel.textContent =
      getTodayText();

    renderTimers();
    renderStatus();
    renderTasks();
    renderRecords();
    renderCalendar();
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);

    elements.toast.textContent = message;

    elements.toast.classList.add("show");

    toastTimer = window.setTimeout(
      () => {
        elements.toast.classList.remove(
          "show"
        );
      },
      2200
    );
  }

  /* 白噪音 */

  function createWhiteNoiseBuffer(context) {
    const durationSeconds = 3;

    const bufferSize = Math.floor(
      context.sampleRate * durationSeconds
    );

    const buffer = context.createBuffer(
      1,
      bufferSize,
      context.sampleRate
    );

    const channelData =
      buffer.getChannelData(0);

    let lastValue = 0;

    for (
      let index = 0;
      index < bufferSize;
      index += 1
    ) {
      const white =
        Math.random() * 2 - 1;

      /*
        轻微平滑随机噪音，让声音没有那么刺耳，
        更接近适合学习使用的柔和白噪音。
      */
      lastValue =
        lastValue * 0.15 +
        white * 0.85;

      channelData[index] = lastValue;
    }

    return buffer;
  }

  function getNoiseVolume() {
    const sliderValue =
      Number(elements.volumeSlider.value);

    /*
      限制最大实际增益，避免白噪音过响。
    */
    return (sliderValue / 100) * 0.22;
  }

  async function startWhiteNoise() {
    try {
      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        showToast(
          "当前浏览器不支持白噪音播放"
        );
        return;
      }

      if (!audioContext) {
        audioContext =
          new AudioContextClass();
      }

      if (
        audioContext.state === "suspended"
      ) {
        await audioContext.resume();
      }

      stopNoiseNodes();

      noiseSource =
        audioContext.createBufferSource();

      noiseGain =
        audioContext.createGain();

      noiseFilter =
        audioContext.createBiquadFilter();

      noiseSource.buffer =
        createWhiteNoiseBuffer(
          audioContext
        );

      noiseSource.loop = true;

      noiseFilter.type = "lowpass";
      noiseFilter.frequency.value = 8000;
      noiseFilter.Q.value = 0.4;

      noiseGain.gain.value =
        getNoiseVolume();

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(
        audioContext.destination
      );

      noiseSource.start();

      isNoisePlaying = true;

      renderSoundControl();

      showToast("白噪音已开启");
    } catch (error) {
      console.error(
        "白噪音播放失败：",
        error
      );

      isNoisePlaying = false;

      renderSoundControl();

      showToast("白噪音播放失败");
    }
  }

  function stopNoiseNodes() {
    if (noiseSource) {
      try {
        noiseSource.stop();
      } catch (error) {
        console.warn(error);
      }

      try {
        noiseSource.disconnect();
      } catch (error) {
        console.warn(error);
      }

      noiseSource = null;
    }

    if (noiseFilter) {
      try {
        noiseFilter.disconnect();
      } catch (error) {
        console.warn(error);
      }

      noiseFilter = null;
    }

    if (noiseGain) {
      try {
        noiseGain.disconnect();
      } catch (error) {
        console.warn(error);
      }

      noiseGain = null;
    }
  }

  function stopWhiteNoise() {
    stopNoiseNodes();

    isNoisePlaying = false;

    renderSoundControl();

    showToast("白噪音已关闭");
  }

  function toggleWhiteNoise() {
    if (isNoisePlaying) {
      stopWhiteNoise();
    } else {
      startWhiteNoise();
    }
  }

  function updateNoiseVolume() {
    const volume =
      Number(elements.volumeSlider.value);

    elements.volumeValue.textContent =
      `${volume}%`;

    if (
      noiseGain &&
      audioContext
    ) {
      noiseGain.gain.setTargetAtTime(
        getNoiseVolume(),
        audioContext.currentTime,
        0.03
      );
    }

    try {
      localStorage.setItem(
        VOLUME_STORAGE_KEY,
        String(volume)
      );
    } catch (error) {
      console.warn(
        "保存音量失败：",
        error
      );
    }
  }

  function loadNoiseVolume() {
    let initialVolume = 40;

    try {
      const savedVolume =
        localStorage.getItem(
          VOLUME_STORAGE_KEY
        );

      if (savedVolume !== null) {
        initialVolume =
          Number(savedVolume);
      }
    } catch (error) {
      console.warn(
        "读取音量失败：",
        error
      );
    }

    if (
      !Number.isFinite(initialVolume)
    ) {
      initialVolume = 40;
    }

    const safeVolume = Math.min(
      100,
      Math.max(0, initialVolume)
    );

    elements.volumeSlider.value =
      String(safeVolume);

    elements.volumeValue.textContent =
      `${safeVolume}%`;
  }

  function renderSoundControl() {
    if (isNoisePlaying) {
      elements.soundToggleBtn.textContent =
        "关闭声音";

      elements.soundToggleBtn.classList.add(
        "playing"
      );

      elements.soundToggleBtn.setAttribute(
        "aria-pressed",
        "true"
      );
    } else {
      elements.soundToggleBtn.textContent =
        "白噪音";

      elements.soundToggleBtn.classList.remove(
        "playing"
      );

      elements.soundToggleBtn.setAttribute(
        "aria-pressed",
        "false"
      );
    }
  }

  /* 事件绑定 */

  elements.startBtn.addEventListener(
    "click",
    startStudy
  );

  elements.stopBtn.addEventListener(
    "click",
    stopStudy
  );

  elements.soundToggleBtn.addEventListener(
    "click",
    toggleWhiteNoise
  );

  elements.volumeSlider.addEventListener(
    "input",
    updateNoiseVolume
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
      const dayData =
        getCurrentDayData();

      const hasNoRecords =
        dayData.records.length === 0 &&
        dayData.dailyTotalMs === 0;

      if (hasNoRecords) {
        showToast(
          "今天还没有学习记录"
        );
        return;
      }

      const confirmed =
        window.confirm(
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
      if (
        event.target === elements.tasksModal
      ) {
        closeModal(elements.tasksModal);
      }
    }
  );

  elements.recordsModal.addEventListener(
    "click",
    (event) => {
      if (
        event.target === elements.recordsModal
      ) {
        closeModal(
          elements.recordsModal
        );
      }
    }
  );

  elements.calendarWrapper.addEventListener(
    "mouseenter",
    renderCalendar
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
      stopNoiseNodes();
    }
  );

  loadNoiseVolume();
  renderSoundControl();

  loadState();
  render();
});
