let processes = [];

window.onload = function () {
  generateProcessInputs();
};

function generateProcessInputs() {
  const count = parseInt(document.getElementById("processCount").value);
  const container = document.getElementById("processInputs");
  container.innerHTML = "";

  for (let i = 0; i < count; i++) {
    container.innerHTML += `
      <div class="process-row">
        <label>
          Process ID
          <input type="text" id="pid${i}" value="P${i + 1}">
        </label>

        <label>
          Arrival Time
          <input type="number" id="arrival${i}" min="0" value="${i}">
        </label>

        <label>
          Burst Time
          <input type="number" id="burst${i}" min="1" value="${(i + 1) * 2}">
        </label>
      </div>
    `;
  }
}

function generateRandomProcesses() {
  const count = parseInt(document.getElementById("processCount").value);
  const container = document.getElementById("processInputs");
  container.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const arrival = Math.floor(Math.random() * 6);
    const burst = Math.floor(Math.random() * 9) + 1;

    container.innerHTML += `
      <div class="process-row">
        <label>
          Process ID
          <input type="text" id="pid${i}" value="P${i + 1}">
        </label>

        <label>
          Arrival Time
          <input type="number" id="arrival${i}" min="0" value="${arrival}">
        </label>

        <label>
          Burst Time
          <input type="number" id="burst${i}" min="1" value="${burst}">
        </label>
      </div>
    `;
  }
}

function getProcesses() {
  const count = parseInt(document.getElementById("processCount").value);
  const list = [];

  for (let i = 0; i < count; i++) {
    list.push({
      pid: document.getElementById(`pid${i}`).value,
      arrival: parseInt(document.getElementById(`arrival${i}`).value),
      burst: parseInt(document.getElementById(`burst${i}`).value),
      remaining: parseInt(document.getElementById(`burst${i}`).value),
      completion: 0,
      turnaround: 0,
      waiting: 0,
      response: -1,
      started: false
    });
  }

  return list;
}

function runSimulation() {
  processes = getProcesses();
  const algorithm = document.getElementById("algorithm").value;

  let result;

  if (algorithm === "fcfs") result = fcfs(processes);
  if (algorithm === "sjf") result = sjf(processes);
  if (algorithm === "srtf") result = srtf(processes);
  if (algorithm === "rr") result = roundRobin(processes);
  if (algorithm === "mlfq") result = mlfq(processes);

  displayResults(result);
}

function calculateMetrics(list) {
  list.forEach(p => {
    p.turnaround = p.completion - p.arrival;
    p.waiting = p.turnaround - p.burst;
  });

  return list;
}

function fcfs(input) {
  const list = JSON.parse(JSON.stringify(input)).sort((a, b) => a.arrival - b.arrival);
  let time = 0;
  let gantt = [];
  let steps = [];

  list.forEach(p => {
    if (time < p.arrival) {
      gantt.push({ pid: "IDLE", start: time, end: p.arrival });
      time = p.arrival;
    }

    p.response = time - p.arrival;
    gantt.push({ pid: p.pid, start: time, end: time + p.burst });
    steps.push(`At time ${time}, ${p.pid} starts using the CPU using FCFS.`);
    time += p.burst;
    p.completion = time;
  });

  return {
    processes: calculateMetrics(list),
    gantt,
    steps
  };
}

function sjf(input) {
  const list = JSON.parse(JSON.stringify(input));
  let time = 0;
  let completed = 0;
  let gantt = [];
  let steps = [];

  while (completed < list.length) {
    const ready = list
      .filter(p => p.completion === 0 && p.arrival <= time)
      .sort((a, b) => a.burst - b.burst || a.arrival - b.arrival);

    if (ready.length === 0) {
      gantt.push({ pid: "IDLE", start: time, end: time + 1 });
      time++;
      continue;
    }

    const p = ready[0];
    p.response = time - p.arrival;
    gantt.push({ pid: p.pid, start: time, end: time + p.burst });
    steps.push(`At time ${time}, ${p.pid} runs because it has the shortest burst time.`);
    time += p.burst;
    p.completion = time;
    completed++;
  }

  return {
    processes: calculateMetrics(list),
    gantt,
    steps
  };
}

function srtf(input) {
  const list = JSON.parse(JSON.stringify(input));
  let time = 0;
  let completed = 0;
  let gantt = [];
  let steps = [];

  while (completed < list.length) {
    const ready = list
      .filter(p => p.remaining > 0 && p.arrival <= time)
      .sort((a, b) => a.remaining - b.remaining || a.arrival - b.arrival);

    if (ready.length === 0) {
      addGanttBlock(gantt, "IDLE", time, time + 1);
      time++;
      continue;
    }

    const p = ready[0];

    if (!p.started) {
      p.response = time - p.arrival;
      p.started = true;
    }

    addGanttBlock(gantt, p.pid, time, time + 1);
    steps.push(`At time ${time}, ${p.pid} runs because it has the shortest remaining time.`);
    p.remaining--;
    time++;

    if (p.remaining === 0) {
      p.completion = time;
      completed++;
    }
  }

  return {
    processes: calculateMetrics(list),
    gantt,
    steps
  };
}

function roundRobin(input) {
  const list = JSON.parse(JSON.stringify(input)).sort((a, b) => a.arrival - b.arrival);
  const quantum = parseInt(document.getElementById("rrQuantum").value);
  let time = 0;
  let queue = [];
  let completed = 0;
  let gantt = [];
  let steps = [];
  let added = new Set();

  while (completed < list.length) {
    list.forEach(p => {
      if (p.arrival <= time && !added.has(p.pid)) {
        queue.push(p);
        added.add(p.pid);
      }
    });

    if (queue.length === 0) {
      addGanttBlock(gantt, "IDLE", time, time + 1);
      time++;
      continue;
    }

    const p = queue.shift();

    if (!p.started) {
      p.response = time - p.arrival;
      p.started = true;
    }

    const runTime = Math.min(quantum, p.remaining);
    gantt.push({ pid: p.pid, start: time, end: time + runTime });
    steps.push(`At time ${time}, ${p.pid} runs for ${runTime} unit(s) using Round Robin.`);

    for (let i = 0; i < runTime; i++) {
      time++;
      p.remaining--;

      list.forEach(next => {
        if (next.arrival <= time && !added.has(next.pid)) {
          queue.push(next);
          added.add(next.pid);
        }
      });
    }

    if (p.remaining > 0) {
      queue.push(p);
    } else {
      p.completion = time;
      completed++;
    }
  }

  return {
    processes: calculateMetrics(list),
    gantt,
    steps
  };
}

function mlfq(input) {
  const list = JSON.parse(JSON.stringify(input)).sort((a, b) => a.arrival - b.arrival);
  const quantums = [
    parseInt(document.getElementById("q0").value),
    parseInt(document.getElementById("q1").value),
    parseInt(document.getElementById("q2").value),
    parseInt(document.getElementById("q3").value)
  ];

  let queues = [[], [], [], []];
  let time = 0;
  let completed = 0;
  let gantt = [];
  let steps = [];
  let added = new Set();

  while (completed < list.length) {
    list.forEach(p => {
      if (p.arrival <= time && !added.has(p.pid)) {
        p.level = 0;
        queues[0].push(p);
        added.add(p.pid);
      }
    });

    let level = queues.findIndex(q => q.length > 0);

    if (level === -1) {
      addGanttBlock(gantt, "IDLE", time, time + 1);
      time++;
      continue;
    }

    const p = queues[level].shift();

    if (!p.started) {
      p.response = time - p.arrival;
      p.started = true;
    }

    const runTime = Math.min(quantums[level], p.remaining);
    gantt.push({
      pid: `${p.pid} Q${level}`,
      start: time,
      end: time + runTime
    });

    steps.push(`At time ${time}, ${p.pid} runs at priority Q${level} for ${runTime} unit(s).`);

    for (let i = 0; i < runTime; i++) {
      time++;
      p.remaining--;

      list.forEach(next => {
        if (next.arrival <= time && !added.has(next.pid)) {
          next.level = 0;
          queues[0].push(next);
          added.add(next.pid);
        }
      });

      if (p.remaining === 0) break;
    }

    if (p.remaining > 0) {
      p.level = Math.min(level + 1, 3);
      queues[p.level].push(p);
    } else {
      p.completion = time;
      completed++;
    }
  }

  return {
    processes: calculateMetrics(list),
    gantt,
    steps
  };
}

function addGanttBlock(gantt, pid, start, end) {
  const last = gantt[gantt.length - 1];

  if (last && last.pid === pid && last.end === start) {
    last.end = end;
  } else {
    gantt.push({ pid, start, end });
  }
}

function displayResults(result) {
  displayTable(result.processes);
  displaySteps(result.steps);
  displayStatusTable(result.processes);
  animateGantt(result.gantt, result.processes);
}

function animateGantt(gantt, processList) {
  const ganttDiv = document.getElementById("ganttChart");
  const ascii = document.getElementById("asciiGantt");
  const cpuStatus = document.getElementById("cpuStatus");
  const nextQueue = document.getElementById("nextQueue");
  const actionMessage = document.getElementById("actionMessage");

  ganttDiv.innerHTML = "";
  ascii.textContent = "";
  cpuStatus.textContent = "Preparing...";
  nextQueue.textContent = "---";
  actionMessage.textContent = "Starting CPU scheduling simulation...";

  const colors = [
    "#7c3aed",
    "#0891b2",
    "#16a34a",
    "#ea580c",
    "#dc2626",
    "#4f46e5",
    "#be123c",
    "#0d9488"
  ];

  let asciiTop = "";
  let asciiBottom = "";
  let index = 0;

  const interval = setInterval(() => {
    if (index >= gantt.length) {
      clearInterval(interval);

      const lastEnd = gantt[gantt.length - 1]?.end ?? 0;
      asciiBottom += `${lastEnd}`;

      ascii.textContent = asciiTop + "|\n" + asciiBottom;
      cpuStatus.textContent = "IDLE";
      nextQueue.textContent = "None";
      actionMessage.textContent = "Simulation completed successfully.";

      displayStatusTable(processList, true);
      return;
    }

    const block = gantt[index];
    const duration = block.end - block.start;
    const width = Math.max(65, duration * 26);

    const div = document.createElement("div");
    div.className = "gantt-block";
    div.style.width = `${width}px`;
    div.style.background =
      block.pid === "IDLE" ? "#475569" : colors[index % colors.length];

    div.innerHTML = `
      ${block.pid}
      <small>${block.start} - ${block.end}</small>
    `;

    ganttDiv.appendChild(div);

    cpuStatus.textContent = block.pid;
    nextQueue.textContent = gantt[index + 1] ? gantt[index + 1].pid : "None";
    actionMessage.textContent = `At time ${block.start}, CPU runs ${block.pid}.`;

    asciiTop += `| ${block.pid} `;
    asciiBottom += `${block.start}`.padEnd(block.pid.length + 3, " ");

    ascii.textContent = asciiTop + "|\n" + asciiBottom;

    index++;
  }, 650);
}

function displayTable(list) {
  const table = document.getElementById("resultTable");
  table.innerHTML = "";

  let totalTat = 0;
  let totalWait = 0;
  let totalRt = 0;

  list.sort((a, b) => a.pid.localeCompare(b.pid, undefined, { numeric: true }));

  list.forEach(p => {
    totalTat += p.turnaround;
    totalWait += p.waiting;
    totalRt += p.response;

    table.innerHTML += `
      <tr>
        <td>${p.pid}</td>
        <td>${p.arrival}</td>
        <td>${p.burst}</td>
        <td>${p.completion}</td>
        <td>${p.turnaround}</td>
        <td>${p.waiting}</td>
        <td>${p.response}</td>
      </tr>
    `;
  });

  const n = list.length;
  document.getElementById("averages").innerHTML = `
    Average Turnaround Time: ${(totalTat / n).toFixed(2)} |
    Average Waiting Time: ${(totalWait / n).toFixed(2)} |
    Average Response Time: ${(totalRt / n).toFixed(2)}
  `;
}

function displaySteps(steps) {
  const stepsDiv = document.getElementById("steps");
  stepsDiv.innerHTML = "";

  steps.forEach(step => {
    stepsDiv.innerHTML += `<div class="step">${step}</div>`;
  });
}

function displayStatusTable(list, finished = false) {
  const statusTable = document.getElementById("statusTable");
  statusTable.innerHTML = "";

  list.forEach(p => {
    const completionPercent = finished ? 100 : Math.round(((p.burst - p.remaining) / p.burst) * 100);
    const remaining = finished ? 0 : p.remaining;

    let statusClass = finished ? "completed" : "waiting";
    let statusText = finished ? "Completed" : "Waiting";

    statusTable.innerHTML += `
      <tr>
        <td>${p.pid}</td>
        <td class="${statusClass}">${statusText}</td>
        <td>${completionPercent}%</td>
        <td>${remaining}</td>
        <td>${p.waiting}</td>
      </tr>
    `;
  });
}
const getStartedBtn = document.getElementById("getStartedBtn");
const landingPage = document.getElementById("landingPage");
const mainApp = document.getElementById("mainApp");

getStartedBtn.addEventListener("click", () => {
  landingPage.classList.add("hide-landing");

  setTimeout(() => {
    landingPage.style.display = "none";
    mainApp.classList.remove("hidden-app");
    mainApp.classList.add("show-app");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, 550);
});