const pool = require("../config/db");

const MAX_ROADMAP_SUMMARIES = 12;
const MAX_DAY_DETAILS = 10;
const MAX_TASK_DETAILS = 12;
const MAX_CONTEXT_CHARACTERS = 24000;
const INVENTORY_PAGE_SIZE = 15;
const MAX_INVENTORY_RESPONSE_CHARACTERS = 7000;
const ROADMAP_STOP_WORDS = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "by", "can", "day",
  "do", "for", "from", "i", "in", "is", "it", "learning", "me", "my", "of",
  "on", "or", "please", "roadmap", "show", "tell", "that", "the", "their",
  "them", "this", "to", "what", "which", "with", "plan", "progress", "status",
  "complete", "completed", "current", "details", "lesson", "lessons",
  "am", "doing", "how", "many", "task", "tasks", "well", "going", "progressing",
  "today", "todays", "next", "upcoming", "learn",
]);

function clip(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getKeywords(value) {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((word) => word.length > 1 && !ROADMAP_STOP_WORDS.has(word)),
  );
}

function matchRoadmap(question, roadmaps) {
  const normalizedQuestion = normalize(question);
  const questionKeywords = getKeywords(question);
  if (!questionKeywords.size) {
    if (!hasRoadmapReference(question)) return { status: "none", roadmap: null, candidates: [] };
    if (roadmaps.length === 1) return { status: "matched", roadmap: roadmaps[0], candidates: [roadmaps[0]] };
    if (roadmaps.length > 1) return { status: "ambiguous", roadmap: null, candidates: roadmaps.slice(0, 5) };
    return { status: "unmatched", roadmap: null, candidates: [] };
  }

  const scored = roadmaps.map((roadmap) => {
    const normalizedTitle = normalize(roadmap.title);
    const titleKeywords = getKeywords(roadmap.title);
    const matches = [...titleKeywords].filter((word) => questionKeywords.has(word));
    const exactTitle = normalizedTitle.length > 0 && normalizedQuestion.includes(normalizedTitle);
    const titleCoverage = titleKeywords.size ? matches.length / titleKeywords.size : 0;
    const questionCoverage = matches.length / questionKeywords.size;
    const matched = exactTitle
      || (matches.length >= 2 && titleCoverage >= 0.3 && questionCoverage >= 0.4)
      || (matches.length === 1 && questionCoverage >= 0.5);

    return {
      roadmap,
      matched,
      score: exactTitle ? 2 : titleCoverage * 0.65 + questionCoverage * 0.35,
      matches: matches.length,
    };
  }).filter((candidate) => candidate.matched)
    .sort((first, second) => second.score - first.score || second.matches - first.matches);

  if (!scored.length) return { status: "unmatched", roadmap: null, candidates: [] };
  const tiedSingleKeyword = questionKeywords.size === 1
    && scored.length > 1
    && scored[0].matches === scored[1].matches;
  if (scored.length > 1 && (tiedSingleKeyword || Math.abs(scored[0].score - scored[1].score) < 0.04)) {
    const ambiguousCandidates = tiedSingleKeyword
      ? scored.filter((candidate) => candidate.matches === scored[0].matches)
      : scored.filter((candidate) => Math.abs(scored[0].score - candidate.score) < 0.04);
    return {
      status: "ambiguous",
      roadmap: null,
      candidates: ambiguousCandidates.map((candidate) => candidate.roadmap),
    };
  }
  return { status: "matched", roadmap: scored[0].roadmap, candidates: [scored[0].roadmap] };
}

function hasRoadmapReference(question) {
  return /\b(roadmap|learning plan|plan|lesson|day\s*\d+)\b/i.test(question);
}

function getRequestedDayNumbers(question) {
  const matches = [...question.matchAll(/\bday(?:\s+number)?\s*#?\s*(\d+)\b/gi)];
  return [...new Set(matches.map((match) => Number(match[1])).filter(Number.isSafeInteger))].slice(0, MAX_DAY_DETAILS);
}

function parseTopics(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed)
      ? parsed.filter((topic) => typeof topic === "string").slice(0, 8).map((topic) => clip(topic, 120))
      : [];
  } catch {
    return [];
  }
}

function toIsoString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? clip(String(value), 40) : date.toISOString();
}

function getRoadmapProgress(roadmap) {
  const dayCounts = { completed: 0, in_progress: 0, pending: 0, other: 0 };
  for (const day of roadmap.days) {
    if (Object.hasOwn(dayCounts, day.status)) dayCounts[day.status] += 1;
    else dayCounts.other += 1;
  }
  return {
    completedDays: dayCounts.completed,
    dayRecordCount: roadmap.days.length,
    configuredTotalDays: roadmap.totalDays,
    completionPercentage: Number.isInteger(roadmap.totalDays) && roadmap.totalDays > 0
      ? Math.round((dayCounts.completed / roadmap.totalDays) * 100)
      : null,
    dayCounts,
  };
}

function getTaskCounts(tasks) {
  const counts = { total: tasks.length, completed: 0, inProgress: 0, pending: 0, other: 0 };
  for (const task of tasks) {
    if (task.status === "completed") counts.completed += 1;
    else if (task.status === "in_progress") counts.inProgress += 1;
    else if (task.status === "pending") counts.pending += 1;
    else counts.other += 1;
  }
  return counts;
}

function selectRoadmapDetails(roadmap, question, requestedDayNumbers) {
  if (!roadmap) return null;

  let selectedDays;
  if (requestedDayNumbers.length) {
    selectedDays = requestedDayNumbers
      .map((dayNumber) => roadmap.days.find((day) => day.dayNumber === dayNumber))
      .filter(Boolean);
  } else if (/\b(all|every|each|schedule|topics|lessons|day by day)\b/i.test(question)) {
    selectedDays = roadmap.days.slice(0, MAX_DAY_DETAILS);
  } else {
    selectedDays = roadmap.days.filter((day) => day.dayNumber === roadmap.currentDay).slice(0, 1);
  }

  return {
    title: roadmap.title,
    description: roadmap.description,
    status: roadmap.status,
    currentDay: roadmap.currentDay,
    totalDays: roadmap.totalDays,
    createdAt: roadmap.createdAt,
    progress: getRoadmapProgress(roadmap),
    requestedDayNumbers,
    requestedDaysFound: selectedDays.map((day) => day.dayNumber),
    daysOmitted: Math.max(0, roadmap.days.length - selectedDays.length),
    days: selectedDays.map((day) => ({
      dayNumber: day.dayNumber,
      title: day.title,
      description: day.description,
      topics: day.topics,
      status: day.status,
      completedAt: day.completedAt,
    })),
  };
}

function rankTasks(tasks, question) {
  const keywords = getKeywords(question);
  if (!keywords.size) return tasks;
  return [...tasks].sort((first, second) => {
    const score = (task) => [...getKeywords(task.title)].filter((word) => keywords.has(word)).length;
    return score(second) - score(first);
  });
}

function limitContextSize(context, selectedRoadmapTitle) {
  const result = JSON.parse(JSON.stringify(context));
  const selectedSummary = result.roadmapOverview.roadmaps.find((roadmap) => roadmap.title === selectedRoadmapTitle);

  while (JSON.stringify(result).length > MAX_CONTEXT_CHARACTERS && result.tasks.details.length > 3) {
    result.tasks.details.pop();
    result.tasks.detailsOmitted += 1;
  }
  while (JSON.stringify(result).length > MAX_CONTEXT_CHARACTERS && result.roadmapOverview.roadmaps.length > 3) {
    const removableIndex = result.roadmapOverview.roadmaps.findIndex((roadmap) => roadmap.title !== selectedRoadmapTitle);
    if (removableIndex < 0) break;
    result.roadmapOverview.roadmaps.splice(removableIndex, 1);
    result.roadmapOverview.summariesOmitted += 1;
  }
  while (JSON.stringify(result).length > MAX_CONTEXT_CHARACTERS && result.selectedRoadmap?.days.length > 1) {
    const removableIndex = result.selectedRoadmap.days.findIndex(
      (day) => !result.selectedRoadmap.requestedDayNumbers.includes(day.dayNumber)
        && day.dayNumber !== result.selectedRoadmap.currentDay,
    );
    if (removableIndex < 0) break;
    result.selectedRoadmap.days.splice(removableIndex, 1);
    result.selectedRoadmap.daysOmitted += 1;
  }
  while (JSON.stringify(result).length > MAX_CONTEXT_CHARACTERS && result.tasks.details.length) {
    result.tasks.details.pop();
    result.tasks.detailsOmitted += 1;
  }
  if (JSON.stringify(result).length > MAX_CONTEXT_CHARACTERS) {
    result.roadmapOverview.roadmaps = result.roadmapOverview.roadmaps.map((roadmap) => ({
      ...roadmap,
      description: clip(roadmap.description, 80),
    }));
    if (result.selectedRoadmap) result.selectedRoadmap.description = clip(result.selectedRoadmap.description, 300);
    if (selectedSummary) selectedSummary.description = clip(selectedSummary.description, 80);
  }
  if (JSON.stringify(result).length > MAX_CONTEXT_CHARACTERS) {
    if (result.selectedRoadmap) {
      result.selectedRoadmap.days = result.selectedRoadmap.days.map((day) => ({
        ...day,
        title: clip(day.title, 180),
        description: clip(day.description, 180),
        topics: day.topics.slice(0, 3).map((topic) => clip(topic, 80)),
      }));
      result.selectedRoadmap.description = clip(result.selectedRoadmap.description, 180);
    }
    result.tasks.details = result.tasks.details.map((task) => ({
      ...task,
      title: clip(task.title, 180),
      description: clip(task.description, 120),
    }));
  }

  return result;
}

function getRequestedPage(question) {
  const match = question.match(/\bpage\s+(\d+)\b/i);
  const page = match ? Number(match[1]) : 1;
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function formatInventoryList(label, records, renderRecord, page) {
  const total = records.length;
  const start = Math.min((page - 1) * INVENTORY_PAGE_SIZE, total);
  const pageRecords = records.slice(start, start + INVENTORY_PAGE_SIZE);
  const lines = [`${label} (${total})`];
  let listed = 0;

  for (const record of pageRecords) {
    const line = `${start + listed + 1}. ${renderRecord(record)}`;
    const prospectiveLength = [...lines, line].join("\n").length;
    if (prospectiveLength > MAX_INVENTORY_RESPONSE_CHARACTERS) break;
    lines.push(line);
    listed += 1;
  }

  const nextIndex = start + listed;
  if (nextIndex < total) {
    lines.push(`Showing ${start + 1}–${nextIndex} of ${total}; ask for page ${Math.floor(nextIndex / INVENTORY_PAGE_SIZE) + 1} to see more.`);
  } else if (listed === 0 && total > 0) {
    lines.push(`Page ${page} is outside the available range. There are ${total} records.`);
  } else if (total === 0) {
    lines.push("No records found.");
  }
  return lines.join("\n");
}

function getStatusLabel(status) {
  if (status === "in_progress") return "In progress";
  if (typeof status !== "string" || !status.trim()) return "Status unavailable";
  return status.charAt(0).toLocaleUpperCase() + status.slice(1);
}

function createDeterministicAnswer(question, context) {
  const normalizedQuestion = normalize(question);
  const inventory = context.inventory;
  const page = getRequestedPage(question);
  const asksToList = /\b(list|show|display|give me|what are|which are|see|page\s+\d+)\b/i.test(question);
  const asksCountOrProgress = /\b(how many|count|total|progress|progressing|status|completed|in progress|pending)\b/i.test(question);
  const asksProgressSummary = /\b(how many|count|total|progress|progressing)\b/i.test(question);
  const mentionsRoadmaps = /\broadmaps?\b/i.test(question);
  const mentionsTasks = /\b(tasks?|todo(?:s)?)\b/i.test(question);

  if (mentionsRoadmaps && asksToList && !asksProgressSummary) {
    return formatInventoryList(
      "Your roadmaps",
      inventory.roadmaps,
      (roadmap) => `${roadmap.title} — ${getStatusLabel(roadmap.status)}`,
      page,
    );
  }
  if (mentionsTasks && asksToList && !asksProgressSummary) {
    return formatInventoryList(
      "Your tasks",
      inventory.tasks,
      (task) => `${task.title} — ${getStatusLabel(task.status)}${task.dueDate ? ` — Due ${task.dueDate}` : ""}`,
      page,
    );
  }
  if (mentionsTasks && asksCountOrProgress) {
    const counts = inventory.taskCounts;
    return `Task progress (${counts.total} total): ${counts.completed} completed, ${counts.inProgress} in progress, ${counts.pending} pending${counts.other ? `, ${counts.other} other status` : ""}.`;
  }
  if (mentionsRoadmaps && asksCountOrProgress) {
    const selected = context.modelContext.selectedRoadmap;
    if (selected) {
      const progress = selected.progress;
      const percentage = progress.completionPercentage === null ? "percentage unavailable" : `${progress.completionPercentage}%`;
      return `Roadmap progress for ${selected.title}: ${progress.completedDays} of ${progress.configuredTotalDays ?? "unknown"} configured days completed (${percentage}). Saved day records: ${progress.dayRecordCount}; ${progress.dayCounts.completed} completed, ${progress.dayCounts.in_progress} in progress, ${progress.dayCounts.pending} pending. Roadmap status: ${getStatusLabel(selected.status)}.`;
    }
    if (inventory.roadmaps.length) {
      return formatInventoryList(
        "Roadmap progress",
        inventory.roadmaps,
        (roadmap) => `${roadmap.title} — ${getStatusLabel(roadmap.status)}, ${roadmap.progress.completedDays}/${roadmap.progress.configuredTotalDays ?? "unknown"} days complete (${roadmap.progress.completionPercentage === null ? "percentage unavailable" : `${roadmap.progress.completionPercentage}%`})`,
        page,
      );
    }
    return "No roadmaps are saved in your account.";
  }
  if (asksToList && /\b(project|workspace|account|mine|my)\b/i.test(normalizedQuestion)) {
    return `Your account has ${inventory.roadmaps.length} roadmaps and ${inventory.tasks.length} tasks.`;
  }
  return null;
}

async function loadAssistantContext(userId, question = "") {
  const [roadmapResult, taskResult] = await Promise.all([
    pool.query(
      `SELECT
         lr.id AS roadmap_id,
         lr.title AS roadmap_title,
         lr.description AS roadmap_description,
         lr.current_day,
         lr.total_days,
         lr.status AS roadmap_status,
         lr.created_at AS roadmap_created_at,
         rd.id AS day_id,
         rd.day_number,
         rd.title AS day_title,
         rd.description AS day_description,
         rd.topics AS day_topics,
         rd.status AS day_status,
         rd.completed_at
       FROM learning_roadmaps lr
       LEFT JOIN roadmap_days rd ON rd.roadmap_id = lr.id
       WHERE lr.user_id = $1
       ORDER BY lr.created_at DESC, rd.day_number ASC`,
      [userId],
    ),
    pool.query(
          `SELECT id, title, description, status, due_date,
            (image_url IS NOT NULL) AS has_attachment
       FROM tasks
       WHERE owner_id = $1
       ORDER BY id`,
      [userId],
    ),
  ]);

  const roadmapMap = new Map();
  for (const row of roadmapResult.rows) {
    let roadmap = roadmapMap.get(row.roadmap_id);
    if (!roadmap) {
      roadmap = {
        id: row.roadmap_id,
        title: clip(row.roadmap_title, 255),
        description: clip(row.roadmap_description, 600),
        status: clip(row.roadmap_status, 30),
        currentDay: Number.isInteger(row.current_day) ? row.current_day : null,
        totalDays: Number.isInteger(row.total_days) ? row.total_days : null,
        createdAt: toIsoString(row.roadmap_created_at),
        days: [],
      };
      roadmapMap.set(row.roadmap_id, roadmap);
    }

    if (row.day_id !== null) {
      roadmap.days.push({
        dayNumber: Number.isInteger(row.day_number) ? row.day_number : null,
        title: clip(row.day_title, 255),
        description: clip(row.day_description, 500),
        topics: parseTopics(row.day_topics),
        status: clip(row.day_status, 30),
        completedAt: toIsoString(row.completed_at),
      });
    }
  }

  const roadmaps = [...roadmapMap.values()];
  const roadmapSelection = matchRoadmap(question, roadmaps);
  const selectedRoadmap = roadmapSelection.roadmap;
  const requestedDayNumbers = getRequestedDayNumbers(question);
  const allTasks = taskResult.rows.map((task) => ({
    id: task.id,
    title: clip(task.title, 255),
    description: clip(task.description, 500),
    status: clip(task.status, 30),
    dueDate: task.due_date ? String(task.due_date).slice(0, 10) : null,
    hasAttachment: Boolean(task.has_attachment),
  }));
  const taskCounts = getTaskCounts(allTasks);
  const rankedTasks = rankTasks(allTasks, question).slice(0, MAX_TASK_DETAILS);
  const summaryRoadmaps = roadmaps.slice(0, MAX_ROADMAP_SUMMARIES);
  if (selectedRoadmap && !summaryRoadmaps.some((roadmap) => roadmap.id === selectedRoadmap.id)) {
    summaryRoadmaps.push(selectedRoadmap);
  }

  const modelContext = {
    roadmapOverview: {
      totalRoadmaps: roadmaps.length,
      summariesOmitted: Math.max(0, roadmaps.length - summaryRoadmaps.length),
      roadmaps: summaryRoadmaps.map((roadmap) => ({
        title: roadmap.title,
        description: clip(roadmap.description, 300),
        status: roadmap.status,
        currentDay: roadmap.currentDay,
        totalDays: roadmap.totalDays,
        createdAt: roadmap.createdAt,
        progress: getRoadmapProgress(roadmap),
      })),
    },
    roadmapSelection: {
      status: roadmapSelection.status,
      candidates: roadmapSelection.candidates.map((roadmap) => ({ title: roadmap.title })),
      hasRoadmapReference: hasRoadmapReference(question),
    },
    selectedRoadmap: selectRoadmapDetails(selectedRoadmap, question, requestedDayNumbers),
    taskSummary: taskCounts,
    tasks: {
      total: allTasks.length,
      counts: taskCounts,
      detailsOmitted: Math.max(0, allTasks.length - rankedTasks.length),
      details: rankedTasks.map(({ id, ...task }) => task),
    },
  };

  return {
    modelContext: limitContextSize(modelContext, selectedRoadmap?.title),
    inventory: {
      roadmaps: roadmaps.map((roadmap) => ({
        title: roadmap.title,
        status: roadmap.status,
        progress: getRoadmapProgress(roadmap),
      })),
      tasks: allTasks.map(({ title, status, dueDate }) => ({ title, status, dueDate })),
      taskCounts,
    },
  };
}

function createNoMatchReply(context) {
  const titles = context.roadmapOverview.roadmaps.map((roadmap) => roadmap.title);
  if (!titles.length) return "I couldn't find that roadmap in your account. No saved roadmaps are currently available.";
  const omitted = context.roadmapOverview.summariesOmitted;
  const more = omitted > 0 ? `; and ${omitted} more` : "";
  return `I couldn't match that roadmap to one in your account. Your available roadmaps are: ${titles.join("; ")}${more}. Which one did you mean?`;
}

function createAmbiguousReply(context) {
  const titles = context.roadmapSelection.candidates.map((roadmap) => roadmap.title);
  return `I found more than one matching roadmap: ${titles.join("; ")}. Which one should I use?`;
}

function createMissingDayReply(context) {
  const requestedDays = context.selectedRoadmap.requestedDayNumbers;
  const label = requestedDays.length === 1 ? `Day ${requestedDays[0]}` : `Days ${requestedDays.join(", ")}`;
  return `I couldn't find ${label} in the saved day records for “${context.selectedRoadmap.title}”. I won't guess lesson details.`;
}

module.exports = {
  MAX_CONTEXT_CHARACTERS,
  MAX_INVENTORY_RESPONSE_CHARACTERS,
  INVENTORY_PAGE_SIZE,
  createAmbiguousReply,
  createDeterministicAnswer,
  createMissingDayReply,
  createNoMatchReply,
  loadAssistantContext,
};
