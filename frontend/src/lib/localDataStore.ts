type StaffAvailability = "available" | "busy" | "break" | "offline";

type QueueRecord = {
  counterId: number;
  queueSize: number;
  averageWaitTime: number;
  status: "normal" | "busy" | "critical";
  timestamp: string;
};

type StaffRecord = {
  staffId: string;
  name: string;
  email: string;
  phone: string;
  skills: string[];
  availability: StaffAvailability;
  currentCounter: number | null;
  performanceScore: number;
  shiftStart: string;
  shiftEnd: string;
  lastMovedAt: string | null;
};

type AllocationAssignment = {
  staffId: string;
  staffName: string;
  counterId: number;
  startTime: string;
  endTime: string;
  lastMovedAt: string | null;
  priority: number;
  reason: string;
};

type AllocationRecord = {
  id: string;
  timestamp: string;
  allocations: AllocationAssignment[];
  totalCost: number;
  status: "pending" | "active" | "completed" | "applied";
  appliedBy: string;
};

const STAFF_KEY = "queue_local_staff_v1";
const QUEUE_HISTORY_KEY = "queue_local_history_v1";
const ALLOCATION_KEY = "queue_local_allocations_v1";

const hasStorage = () => typeof window !== "undefined" && !!window.localStorage;

function readJson<T>(key: string, fallback: T): T {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write failures.
  }
}

function nowIso() {
  return new Date().toISOString();
}

function deriveQueueStatus(queueSize: number): "normal" | "busy" | "critical" {
  if (queueSize > 15) return "critical";
  if (queueSize > 8) return "busy";
  return "normal";
}

function seedStaff(): StaffRecord[] {
  return [
    {
      staffId: "S001",
      name: "Aarav Singh",
      email: "aarav@local.dev",
      phone: "+910000000001",
      skills: ["general", "cashier"],
      availability: "available",
      currentCounter: null,
      performanceScore: 90,
      shiftStart: "09:00",
      shiftEnd: "17:00",
      lastMovedAt: null,
    },
    {
      staffId: "S002",
      name: "Isha Patel",
      email: "isha@local.dev",
      phone: "+910000000002",
      skills: ["loan", "inquiry"],
      availability: "available",
      currentCounter: null,
      performanceScore: 84,
      shiftStart: "09:00",
      shiftEnd: "17:00",
      lastMovedAt: null,
    },
    {
      staffId: "S003",
      name: "Kabir Mehta",
      email: "kabir@local.dev",
      phone: "+910000000003",
      skills: ["account", "premium"],
      availability: "available",
      currentCounter: null,
      performanceScore: 78,
      shiftStart: "09:00",
      shiftEnd: "17:00",
      lastMovedAt: null,
    },
  ];
}

function seedQueueHistory(): QueueRecord[] {
  const stamp = nowIso();
  return [1, 2, 3].map((counterId) => ({
    counterId,
    queueSize: 0,
    averageWaitTime: 0,
    status: "normal",
    timestamp: stamp,
  }));
}

function ensureSeeded() {
  const staff = readJson<StaffRecord[]>(STAFF_KEY, []);
  if (!staff.length) {
    writeJson(STAFF_KEY, seedStaff());
  }

  const queueHistory = readJson<QueueRecord[]>(QUEUE_HISTORY_KEY, []);
  if (!queueHistory.length) {
    writeJson(QUEUE_HISTORY_KEY, seedQueueHistory());
  }

  const allocations = readJson<AllocationRecord[]>(ALLOCATION_KEY, []);
  if (!Array.isArray(allocations)) {
    writeJson(ALLOCATION_KEY, []);
  }
}

export function getLocalStaff(filters?: { availability?: string; skill?: string }) {
  ensureSeeded();
  let staff = readJson<StaffRecord[]>(STAFF_KEY, []);

  if (filters?.availability) {
    staff = staff.filter((s) => s.availability === filters.availability);
  }

  if (filters?.skill) {
    const wanted = filters.skill.toLowerCase();
    staff = staff.filter((s) => s.skills.some((skill) => skill.toLowerCase() === wanted));
  }

  return staff.sort((a, b) => a.staffId.localeCompare(b.staffId));
}

export function getLocalStaffById(staffId: string) {
  const staff = getLocalStaff();
  return staff.find((s) => s.staffId === staffId) || null;
}

export function createLocalStaff(input: Partial<StaffRecord> & { staffId: string; name: string }) {
  const staff = getLocalStaff();
  const exists = staff.some((s) => s.staffId === input.staffId);
  if (exists) {
    throw new Error("Staff member with this ID already exists");
  }

  const next: StaffRecord = {
    staffId: input.staffId,
    name: input.name,
    email: input.email || `${input.staffId.toLowerCase()}@local.dev`,
    phone: input.phone || "",
    skills: Array.isArray(input.skills) && input.skills.length > 0 ? input.skills : ["general"],
    availability: (input.availability as StaffAvailability) || "available",
    currentCounter: typeof input.currentCounter === "number" ? input.currentCounter : null,
    performanceScore: typeof input.performanceScore === "number" ? input.performanceScore : 80,
    shiftStart: input.shiftStart || "09:00",
    shiftEnd: input.shiftEnd || "17:00",
    lastMovedAt: input.lastMovedAt || null,
  };

  staff.push(next);
  writeJson(STAFF_KEY, staff);
  return next;
}

export function updateLocalStaff(staffId: string, updates: Partial<StaffRecord>) {
  const staff = getLocalStaff();
  const idx = staff.findIndex((s) => s.staffId === staffId);
  if (idx === -1) return null;

  const merged = {
    ...staff[idx],
    ...updates,
    staffId,
  };

  staff[idx] = merged;
  writeJson(STAFF_KEY, staff);
  return merged;
}

export function deleteLocalStaff(staffId: string) {
  const staff = getLocalStaff();
  const next = staff.filter((s) => s.staffId !== staffId);
  const changed = next.length !== staff.length;
  if (changed) {
    writeJson(STAFF_KEY, next);
  }
  return changed;
}

export function getLocalQueueHistory(limit = 100, counterId?: string) {
  ensureSeeded();
  let history = readJson<QueueRecord[]>(QUEUE_HISTORY_KEY, []);

  if (counterId) {
    history = history.filter((h) => String(h.counterId) === String(counterId));
  }

  history.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
  return history.slice(0, Math.max(1, limit));
}

export function getLocalLiveQueue() {
  const history = getLocalQueueHistory(500);
  const latestByCounter = new Map<number, QueueRecord>();

  for (const row of history) {
    if (!latestByCounter.has(row.counterId)) {
      latestByCounter.set(row.counterId, row);
    }
  }

  return Array.from(latestByCounter.values()).sort((a, b) => a.counterId - b.counterId);
}

export function appendLocalQueueRecord(counterId: number, queueSize: number, timestamp?: string) {
  ensureSeeded();
  const history = readJson<QueueRecord[]>(QUEUE_HISTORY_KEY, []);
  const record: QueueRecord = {
    counterId,
    queueSize,
    averageWaitTime: Math.max(0, Math.round(queueSize * 3)),
    status: deriveQueueStatus(queueSize),
    timestamp: timestamp || nowIso(),
  };

  history.push(record);

  // Keep local history bounded.
  const trimmed = history.slice(-500);
  writeJson(QUEUE_HISTORY_KEY, trimmed);
  return record;
}

export function appendLocalQueueFromCounters(counters: Record<string, { count: number }>, timestamp?: string) {
  const stamp = timestamp || nowIso();
  for (const [counterId, info] of Object.entries(counters || {})) {
    const id = Number(counterId);
    if (!Number.isFinite(id)) continue;
    appendLocalQueueRecord(id, Number(info?.count || 0), stamp);
  }
}

export function getLocalQueuePrediction(counterId?: string, minutesAhead = 15) {
  const history = getLocalQueueHistory(60, counterId);
  const chronological = [...history].reverse();

  if (chronological.length === 0) {
    return {
      predicted_queue: 0,
      current_queue: 0,
      change: 0,
      confidence: 0.55,
      rush_level: "low",
      recommendation: "Insufficient data. Keep collecting queue snapshots.",
      minutes_ahead: minutesAhead,
      trend: "decreasing",
    };
  }

  const current = Number(chronological[chronological.length - 1]?.queueSize || 0);
  const recent = chronological.slice(-10);
  const mean = recent.reduce((sum, row) => sum + Number(row.queueSize || 0), 0) / Math.max(1, recent.length);
  const first = Number(recent[0]?.queueSize || current);
  const trendDelta = (current - first) / Math.max(1, recent.length - 1);

  const predicted = Math.max(0, Math.round(mean + trendDelta * Math.max(2, Math.round(minutesAhead / 5))));
  const rush = predicted > 15 ? "high" : predicted > 8 ? "medium" : "low";

  return {
    predicted_queue: predicted,
    current_queue: current,
    change: predicted - current,
    confidence: 0.72,
    rush_level: rush,
    recommendation:
      rush === "high"
        ? "Expected high load. Reassign additional staff."
        : rush === "medium"
          ? "Moderate load expected. Monitor counters closely."
          : "Load expected to remain stable.",
    minutes_ahead: minutesAhead,
    trend: predicted >= current ? "increasing" : "decreasing",
  };
}

export function generateLocalAllocation() {
  const staff = getLocalStaff().filter((s) => s.availability !== "offline" && s.availability !== "break");
  const queue = getLocalLiveQueue();

  const counters = [...queue].sort((a, b) => b.queueSize - a.queueSize);
  const available = [...staff].sort((a, b) => b.performanceScore - a.performanceScore);

  const assignments: AllocationAssignment[] = [];
  const now = nowIso();

  for (const counter of counters) {
    const required = counter.queueSize > 0 ? Math.max(1, Math.ceil(counter.queueSize / 6)) : 0;
    for (let i = 0; i < required && available.length > 0; i += 1) {
      const member = available.shift();
      if (!member) break;
      assignments.push({
        staffId: member.staffId,
        staffName: member.name,
        counterId: counter.counterId,
        startTime: now,
        endTime: "N/A",
        lastMovedAt: member.lastMovedAt,
        priority: counter.queueSize > 12 ? 1 : 2,
        reason: "Local heuristic allocation",
      });
    }
  }

  const allocation: AllocationRecord = {
    id: `local-${Date.now()}`,
    timestamp: now,
    allocations: assignments,
    totalCost: assignments.length * 20,
    status: "pending",
    appliedBy: "local-offline-engine",
  };

  const history = readJson<AllocationRecord[]>(ALLOCATION_KEY, []);
  history.unshift(allocation);
  writeJson(ALLOCATION_KEY, history.slice(0, 100));

  return allocation;
}

export function getLocalLatestAllocation(status = "pending") {
  const history = readJson<AllocationRecord[]>(ALLOCATION_KEY, []);
  return history.find((a) => a.status === status) || null;
}

export function getLocalAllocationHistory(limit = 20) {
  const history = readJson<AllocationRecord[]>(ALLOCATION_KEY, []);
  return history.slice(0, Math.max(1, limit));
}

export function applyLocalAllocationById(allocationId: string) {
  const allocations = readJson<AllocationRecord[]>(ALLOCATION_KEY, []);
  const target = allocations.find((a) => a.id === allocationId);
  if (!target) return null;

  const map: Record<string, string[]> = {};
  for (const row of target.allocations) {
    const key = String(row.counterId);
    if (!map[key]) map[key] = [];
    map[key].push(row.staffId);
  }

  applyLocalStaffAllocationState(map);

  target.status = "applied";
  writeJson(ALLOCATION_KEY, allocations);
  return target;
}

export function applyLocalStaffAllocationState(allocationMap: Record<string, string[]>) {
  const staff = getLocalStaff();
  const now = nowIso();

  const assignedByStaffId = new Map<string, number>();
  for (const [counterId, ids] of Object.entries(allocationMap || {})) {
    for (const id of ids) {
      assignedByStaffId.set(String(id), Number(counterId));
    }
  }

  const updated = staff.map((member) => {
    const assignedCounter = assignedByStaffId.get(member.staffId);
    if (assignedCounter !== undefined) {
      return {
        ...member,
        currentCounter: assignedCounter,
        availability: "busy" as StaffAvailability,
        lastMovedAt: now,
      };
    }

    if (member.availability === "busy" || member.currentCounter !== null) {
      return {
        ...member,
        availability: "available" as StaffAvailability,
        currentCounter: null,
      };
    }

    return member;
  });

  writeJson(STAFF_KEY, updated);

  return {
    allocation: allocationMap,
    updatedAt: now,
  };
}

export function getLocalAllocationStats() {
  const allocations = readJson<AllocationRecord[]>(ALLOCATION_KEY, []);
  const staff = getLocalStaff();

  const staffDistribution = ["available", "busy", "break", "offline"].map((status) => ({
    _id: status,
    count: staff.filter((s) => s.availability === status).length,
  }));

  return {
    totalAllocations: allocations.length,
    activeAllocations: allocations.filter((a) => a.status === "active" || a.status === "applied").length,
    pendingAllocations: allocations.filter((a) => a.status === "pending").length,
    staffDistribution,
  };
}
