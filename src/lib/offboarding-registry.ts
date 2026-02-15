export interface OffboardedEmployee {
  sessionId: string
  employeeName: string
  roleTitle: string
  projectName: string
  completedAt: string
  status: 'completed' | 'in_progress'
}

const STORAGE_KEY = 'golden_gate_offboarded'

export function getOffboardedEmployees(): OffboardedEmployee[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addOffboardedEmployee(employee: OffboardedEmployee): void {
  const list = getOffboardedEmployees()
  // Replace if same sessionId exists, otherwise append
  const idx = list.findIndex(e => e.sessionId === employee.sessionId)
  if (idx >= 0) {
    list[idx] = employee
  } else {
    list.push(employee)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function getOffboardedEmployee(sessionId: string): OffboardedEmployee | undefined {
  return getOffboardedEmployees().find(e => e.sessionId === sessionId)
}
