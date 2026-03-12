import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  clearSession,
  loadAppState,
  loadSession,
  loginWithPlaceholder,
  resetAppState,
  saveAppState,
  saveSession,
} from './services/hrisStore'

const navItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'employees', label: 'Employees' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'biometrics', label: 'Biometrics' },
  { id: 'leave', label: 'Leave' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
]

const departmentOptions = [
  'People Operations',
  'Engineering',
  'Design',
  'Finance',
  'Customer Success',
  'Operations',
]

const displayDate = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const compactDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

const dateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
})

function App() {
  const [appState, setAppState] = useState(loadAppState)
  const [session, setSession] = useState(loadSession)
  const [activeView, setActiveView] = useState('dashboard')
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
    role: 'hr',
  })
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    email: '',
    department: 'People Operations',
    position: '',
    location: 'Manila',
    manager: 'Jordan Lee',
  })
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    saveAppState(appState)
  }, [appState])

  useEffect(() => {
    if (session) {
      saveSession(session)
      return
    }

    clearSession()
  }, [session])

  const employeeMap = useMemo(
    () => Object.fromEntries(appState.employees.map((employee) => [employee.id, employee])),
    [appState.employees],
  )

  const deviceMap = useMemo(
    () => Object.fromEntries(appState.biometricDevices.map((device) => [device.id, device])),
    [appState.biometricDevices],
  )

  const attendanceSummary = useMemo(() => {
    return appState.attendanceRecords.reduce(
      (summary, record) => {
        summary.total += 1
        summary[record.status] = (summary[record.status] ?? 0) + 1
        return summary
      },
      { total: 0, Present: 0, Remote: 0, Late: 0, Leave: 0 },
    )
  }, [appState.attendanceRecords])

  const biometricSummary = useMemo(() => {
    const verifiedCount = appState.biometricLogs.filter((log) => log.status === 'Verified').length
    const onlineDevices = appState.biometricDevices.filter((device) => device.status === 'Online').length
    const enrolledEmployees = appState.biometricEnrollments.filter(
      (enrollment) => enrollment.status === 'Enrolled',
    ).length
    const syncCompleted = appState.biometricSyncHistory.filter(
      (syncJob) => syncJob.status === 'Completed',
    ).length

    return {
      verifiedCount,
      onlineDevices,
      enrolledEmployees,
      syncCompleted,
    }
  }, [appState.biometricDevices, appState.biometricEnrollments, appState.biometricLogs, appState.biometricSyncHistory])

  const pendingLeaveCount = appState.leaveRequests.filter(
    (request) => request.status === 'Pending',
  ).length

  const activeEmployees = appState.employees.filter(
    (employee) => employee.status === 'Active',
  ).length

  const currentPayroll = appState.payrollCycles[0]

  const dashboardMetrics = [
    {
      label: 'Headcount',
      value: `${appState.employees.length}`,
      note: `${activeEmployees} active employees`,
    },
    {
      label: 'Present Today',
      value: `${attendanceSummary.Present + attendanceSummary.Remote}`,
      note: `${attendanceSummary.Late} late, ${attendanceSummary.Leave} on leave`,
    },
    {
      label: 'Pending Leave',
      value: `${pendingLeaveCount}`,
      note: 'Waiting for review and approval',
    },
    {
      label: 'Payroll Readiness',
      value: `${currentPayroll.completion}%`,
      note: `${currentPayroll.label} is ${currentPayroll.status.toLowerCase()}`,
    },
  ]

  function handleLogin(event) {
    event.preventDefault()

    if (!loginForm.email.trim()) {
      setAuthError('Enter an email address to continue.')
      return
    }

    const nextSession = loginWithPlaceholder(loginForm)
    setSession(nextSession)
    setAuthError('')
  }

  function handleAddEmployee(event) {
    event.preventDefault()

    const nextEmployee = {
      id: `emp-${Date.now()}`,
      name: employeeForm.name.trim(),
      email: employeeForm.email.trim(),
      department: employeeForm.department,
      position: employeeForm.position.trim(),
      status: 'Active',
      location: employeeForm.location.trim(),
      manager: employeeForm.manager.trim(),
      leaveBalance: 12,
      joinDate: new Date().toISOString().slice(0, 10),
    }

    if (!nextEmployee.name || !nextEmployee.email || !nextEmployee.position) {
      return
    }

    setAppState((current) => ({
      ...current,
      employees: [nextEmployee, ...current.employees],
      attendanceRecords: [
        {
          id: `att-${Date.now()}`,
          employeeId: nextEmployee.id,
          date: '2026-03-11',
          status: 'Present',
          shift: '08:00 - 17:00',
          checkIn: '08:00',
          checkOut: '--:--',
        },
        ...current.attendanceRecords,
      ],
    }))

    setEmployeeForm({
      name: '',
      email: '',
      department: 'People Operations',
      position: '',
      location: 'Manila',
      manager: 'Jordan Lee',
    })
    setActiveView('employees')
  }

  function updateLeaveStatus(id, status) {
    setAppState((current) => ({
      ...current,
      leaveRequests: current.leaveRequests.map((request) =>
        request.id === id ? { ...request, status } : request,
      ),
    }))
  }

  function cyclePayrollStatus(id) {
    const order = ['Preparing', 'In Review', 'Approved', 'Released']

    setAppState((current) => ({
      ...current,
      payrollCycles: current.payrollCycles.map((cycle) => {
        if (cycle.id !== id) {
          return cycle
        }

        const currentIndex = order.indexOf(cycle.status)
        const nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, order.length - 1)

        return {
          ...cycle,
          status: order[nextIndex],
          completion: Math.min(cycle.completion + 18, 100),
        }
      }),
    }))
  }

  function toggleBiometricEnrollment(employeeId) {
    const order = ['Not Enrolled', 'Pending', 'Enrolled']

    setAppState((current) => ({
      ...current,
      biometricEnrollments: current.biometricEnrollments.map((enrollment) => {
        if (enrollment.employeeId !== employeeId) {
          return enrollment
        }

        const currentIndex = order.indexOf(enrollment.status)
        const nextIndex = currentIndex === -1 ? order.length - 1 : (currentIndex + 1) % order.length

        return {
          ...enrollment,
          status: order[nextIndex],
          lastUpdated: new Date().toISOString().slice(0, 10),
        }
      }),
    }))
  }

  function toggleDeviceStatus(deviceId) {
    setAppState((current) => ({
      ...current,
      biometricDevices: current.biometricDevices.map((device) =>
        device.id === deviceId
          ? {
              ...device,
              status: device.status === 'Online' ? 'Maintenance' : 'Online',
            }
          : device,
      ),
    }))
  }

  function runBiometricSync(deviceId) {
    setAppState((current) => {
      const device = current.biometricDevices.find((item) => item.id === deviceId)

      if (!device) {
        return current
      }

      const syncTime = new Date().toISOString()
      const isBlocked = device.status === 'Maintenance'
      const eligibleEnrollment = current.biometricEnrollments.find(
        (enrollment) => enrollment.status === 'Enrolled',
      )

      const newSyncJob = {
        id: `bio-sync-${Date.now()}`,
        deviceId,
        startedAt: syncTime,
        recordsPulled: isBlocked ? 0 : 12,
        status: isBlocked ? 'Blocked' : 'Completed',
      }

      const nextLogs = isBlocked || !eligibleEnrollment
        ? current.biometricLogs
        : [
            {
              id: `bio-log-${Date.now()}`,
              employeeId: eligibleEnrollment.employeeId,
              deviceId,
              method: eligibleEnrollment.method,
              event: 'Sync Import',
              time: syncTime,
              status: 'Verified',
            },
            ...current.biometricLogs,
          ]

      return {
        ...current,
        biometricDevices: current.biometricDevices.map((item) =>
          item.id === deviceId ? { ...item, lastSync: syncTime } : item,
        ),
        biometricSyncHistory: [newSyncJob, ...current.biometricSyncHistory],
        biometricLogs: nextLogs,
      }
    })
  }

  function resetDemoData() {
    setAppState(resetAppState())
    setSession(null)
    setActiveView('dashboard')
  }

  function renderDashboard() {
    return (
      <div className="page-content">
        <SectionTitle
          eyebrow="Overview"
          title="Executive HR snapshot"
          description="A polished starter dashboard with reusable structures for future APIs, databases, and workflow automation."
        />

        <div className="metric-grid">
          {dashboardMetrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>

        <div className="two-column-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h3>Announcements</h3>
                <p>Broadcast updates to employees and operations teams.</p>
              </div>
            </div>
            <div className="stack-list">
              {appState.announcements.map((announcement) => (
                <article key={announcement.id} className={`announcement ${announcement.tone}`}>
                  <h4>{announcement.title}</h4>
                  <p>{announcement.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h3>Platform readiness</h3>
                <p>Core modules already mapped for backend integration.</p>
              </div>
            </div>
            <div className="readiness-list">
              <ReadinessItem label="Auth layer" detail="Placeholder login ready to swap with real auth." />
              <ReadinessItem label="Employee domain" detail="Structured records with manager and leave data." />
              <ReadinessItem label="Attendance data" detail="Daily records modeled for timekeeping APIs." />
              <ReadinessItem label="Biometrics module" detail="Device sync, enrollment, and scan logs are demo-ready." />
              <ReadinessItem label="Payroll cycles" detail="Status and completion states prepared for workflow rules." />
            </div>
          </section>
        </div>
      </div>
    )
  }

  function renderEmployees() {
    return (
      <div className="page-content">
        <SectionTitle
          eyebrow="People"
          title="Employee records"
          description="Centralized employee information, ready for future persistence and approval flows."
        />

        <div className="two-column-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h3>Add employee</h3>
                <p>Create a new employee profile in the starter system.</p>
              </div>
            </div>
            <form className="form-grid" onSubmit={handleAddEmployee}>
              <label>
                Full name
                <input
                  value={employeeForm.name}
                  onChange={(event) =>
                    setEmployeeForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Jamie Carter"
                />
              </label>
              <label>
                Work email
                <input
                  type="email"
                  value={employeeForm.email}
                  onChange={(event) =>
                    setEmployeeForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="jamie@northstarhris.dev"
                />
              </label>
              <label>
                Department
                <select
                  value={employeeForm.department}
                  onChange={(event) =>
                    setEmployeeForm((current) => ({ ...current, department: event.target.value }))
                  }
                >
                  {departmentOptions.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Position
                <input
                  value={employeeForm.position}
                  onChange={(event) =>
                    setEmployeeForm((current) => ({ ...current, position: event.target.value }))
                  }
                  placeholder="HR Generalist"
                />
              </label>
              <label>
                Location
                <input
                  value={employeeForm.location}
                  onChange={(event) =>
                    setEmployeeForm((current) => ({ ...current, location: event.target.value }))
                  }
                />
              </label>
              <label>
                Manager
                <input
                  value={employeeForm.manager}
                  onChange={(event) =>
                    setEmployeeForm((current) => ({ ...current, manager: event.target.value }))
                  }
                />
              </label>
              <button className="primary-button" type="submit">
                Save employee
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h3>Directory</h3>
                <p>Track role, location, reporting line, and leave balance.</p>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Position</th>
                    <th>Status</th>
                    <th>Leave</th>
                  </tr>
                </thead>
                <tbody>
                  {appState.employees.map((employee) => (
                    <tr key={employee.id}>
                      <td>
                        <strong>{employee.name}</strong>
                        <span>{employee.email}</span>
                      </td>
                      <td>{employee.department}</td>
                      <td>{employee.position}</td>
                      <td>
                        <StatusPill value={employee.status} />
                      </td>
                      <td>{employee.leaveBalance} days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    )
  }

  function renderAttendance() {
    return (
      <div className="page-content">
        <SectionTitle
          eyebrow="Timekeeping"
          title="Attendance tracker"
          description="Live attendance-style data structure with shift, check-in, and status fields."
        />

        <div className="metric-grid">
          <MetricCard label="Present" value={attendanceSummary.Present} note="Onsite employees clocked in" />
          <MetricCard label="Remote" value={attendanceSummary.Remote} note="Working remotely today" />
          <MetricCard label="Late" value={attendanceSummary.Late} note="Requires manager review" />
          <MetricCard label="Leave" value={attendanceSummary.Leave} note="Covered by approved or pending leave" />
        </div>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Daily attendance</h3>
              <p>Latest recorded shift activity.</p>
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Shift</th>
                  <th>Status</th>
                  <th>Check in</th>
                  <th>Check out</th>
                </tr>
              </thead>
              <tbody>
                {appState.attendanceRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{employeeMap[record.employeeId]?.name ?? 'Unknown employee'}</td>
                    <td>{record.shift}</td>
                    <td>
                      <StatusPill value={record.status} />
                    </td>
                    <td>{record.checkIn}</td>
                    <td>{record.checkOut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    )
  }

  function renderLeave() {
    return (
      <div className="page-content">
        <SectionTitle
          eyebrow="Requests"
          title="Leave management"
          description="Review leave requests, approve workflows, and keep balances visible to HR."
        />

        <div className="card-grid">
          {appState.leaveRequests.map((request) => (
            <article key={request.id} className="panel card-panel">
              <div className="card-header">
                <div>
                  <h3>{employeeMap[request.employeeId]?.name ?? 'Unknown employee'}</h3>
                  <p>
                    {request.type} for {request.days} day{request.days > 1 ? 's' : ''}
                  </p>
                </div>
                <StatusPill value={request.status} />
              </div>
              <p className="subtle-copy">
                {compactDate.format(new Date(request.startDate))} - {compactDate.format(new Date(request.endDate))}
              </p>
              <p>{request.reason}</p>
              <div className="inline-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => updateLeaveStatus(request.id, 'Approved')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => updateLeaveStatus(request.id, 'Declined')}
                >
                  Decline
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    )
  }

  function renderBiometrics() {
    return (
      <div className="page-content">
        <SectionTitle
          eyebrow="Identity"
          title="Biometrics and device sync"
          description="Simulated biometric attendance with enrollment tracking, devices, verification logs, and sync history."
        />

        <div className="metric-grid">
          <MetricCard label="Online Devices" value={biometricSummary.onlineDevices} note="Active biometric terminals" />
          <MetricCard label="Enrolled Employees" value={biometricSummary.enrolledEmployees} note="Profiles ready for verification" />
          <MetricCard label="Verified Scans" value={biometricSummary.verifiedCount} note="Validated biometric events today" />
          <MetricCard label="Completed Syncs" value={biometricSummary.syncCompleted} note="Successful device pulls in history" />
        </div>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Biometric devices</h3>
              <p>Monitor terminal availability and simulate sync actions for demos.</p>
            </div>
          </div>
          <div className="card-grid">
            {appState.biometricDevices.map((device) => (
              <article key={device.id} className="panel card-panel inset-panel">
                <div className="card-header">
                  <div>
                    <h3>{device.name}</h3>
                    <p>
                      {device.location} • {device.type}
                    </p>
                  </div>
                  <StatusPill value={device.status} />
                </div>
                <div className="info-pairs">
                  <div>
                    <span>Firmware</span>
                    <strong>{device.firmware}</strong>
                  </div>
                  <div>
                    <span>Last sync</span>
                    <strong>{dateTime.format(new Date(device.lastSync))}</strong>
                  </div>
                </div>
                <div className="inline-actions">
                  <button type="button" className="primary-button" onClick={() => runBiometricSync(device.id)}>
                    Run sync
                  </button>
                  <button type="button" className="secondary-button" onClick={() => toggleDeviceStatus(device.id)}>
                    Toggle status
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="two-column-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h3>Enrollment roster</h3>
                <p>Track which employees are enrolled, pending, or not yet registered.</p>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Last updated</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {appState.biometricEnrollments.map((enrollment) => (
                    <tr key={enrollment.employeeId}>
                      <td>{employeeMap[enrollment.employeeId]?.name ?? 'Unknown employee'}</td>
                      <td>{enrollment.method}</td>
                      <td>
                        <StatusPill value={enrollment.status} />
                      </td>
                      <td>{displayDate.format(new Date(enrollment.lastUpdated))}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          onClick={() => toggleBiometricEnrollment(enrollment.employeeId)}
                        >
                          Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h3>Sync history</h3>
                <p>Recent biometric imports and blocked sync attempts.</p>
              </div>
            </div>
            <div className="stack-list">
              {appState.biometricSyncHistory.map((syncJob) => (
                <article key={syncJob.id} className="announcement info">
                  <div className="list-row">
                    <strong>{deviceMap[syncJob.deviceId]?.name ?? 'Unknown device'}</strong>
                    <StatusPill value={syncJob.status} />
                  </div>
                  <p>{dateTime.format(new Date(syncJob.startedAt))}</p>
                  <p>{syncJob.recordsPulled} records imported</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Recent biometric logs</h3>
              <p>Shows which employee scanned, which device captured it, and validation status.</p>
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Device</th>
                  <th>Method</th>
                  <th>Event</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appState.biometricLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{employeeMap[log.employeeId]?.name ?? 'Unknown employee'}</td>
                    <td>{deviceMap[log.deviceId]?.name ?? 'Unknown device'}</td>
                    <td>{log.method}</td>
                    <td>{log.event}</td>
                    <td>{dateTime.format(new Date(log.time))}</td>
                    <td>
                      <StatusPill value={log.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    )
  }

  function renderPayroll() {
    return (
      <div className="page-content">
        <SectionTitle
          eyebrow="Compensation"
          title="Payroll operations"
          description="Cycle-based payroll tracking with statuses and totals, ready for future payroll engine integrations."
        />

        <div className="card-grid">
          {appState.payrollCycles.map((cycle) => (
            <article key={cycle.id} className="panel card-panel">
              <div className="card-header">
                <div>
                  <h3>{cycle.label}</h3>
                  <p>Pay date: {displayDate.format(new Date(cycle.payDate))}</p>
                </div>
                <StatusPill value={cycle.status} />
              </div>
              <div className="payroll-stats">
                <div>
                  <span>Gross pay</span>
                  <strong>{money.format(cycle.grossPay)}</strong>
                </div>
                <div>
                  <span>Deductions</span>
                  <strong>{money.format(cycle.deductions)}</strong>
                </div>
                <div>
                  <span>Net pay</span>
                  <strong>{money.format(cycle.netPay)}</strong>
                </div>
              </div>
              <div className="progress-row">
                <div className="progress-bar">
                  <span style={{ width: `${cycle.completion}%` }} />
                </div>
                <strong>{cycle.completion}% complete</strong>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={() => cyclePayrollStatus(cycle.id)}
              >
                Advance status
              </button>
            </article>
          ))}
        </div>
      </div>
    )
  }

  function renderReports() {
    return (
      <div className="page-content">
        <SectionTitle
          eyebrow="Insights"
          title="Reports and analytics"
          description="Starter reporting catalog for headcount, leave, and payroll monitoring."
        />

        <div className="card-grid">
          {appState.reports.map((report) => (
            <article key={report.id} className="panel card-panel">
              <div className="card-header">
                <div>
                  <h3>{report.name}</h3>
                  <p>{report.owner}</p>
                </div>
              </div>
              <p>{report.description}</p>
              <p className="subtle-copy">Last generated: {displayDate.format(new Date(report.lastRun))}</p>
            </article>
          ))}
        </div>
      </div>
    )
  }

  function renderSettings() {
    return (
      <div className="page-content">
        <SectionTitle
          eyebrow="Configuration"
          title="Starter system settings"
          description="Keep the demo environment clean while preparing hooks for future infrastructure."
        />

        <div className="two-column-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h3>Environment notes</h3>
                <p>This version is intentionally frontend-first.</p>
              </div>
            </div>
            <ul className="feature-list">
              <li>Session and data persist in local storage for demo purposes.</li>
              <li>Auth service is isolated so a real provider can replace it later.</li>
              <li>Employee, attendance, leave, payroll, and reports share one state model.</li>
              <li>Seed data can be reset any time during demos or testing.</li>
            </ul>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h3>Danger zone</h3>
                <p>Reset the system back to its original seeded state.</p>
              </div>
            </div>
            <button type="button" className="danger-button" onClick={resetDemoData}>
              Reset demo data
            </button>
          </section>
        </div>
      </div>
    )
  }

  function renderActiveView() {
    switch (activeView) {
      case 'employees':
        return renderEmployees()
      case 'attendance':
        return renderAttendance()
      case 'biometrics':
        return renderBiometrics()
      case 'leave':
        return renderLeave()
      case 'payroll':
        return renderPayroll()
      case 'reports':
        return renderReports()
      case 'settings':
        return renderSettings()
      case 'dashboard':
      default:
        return renderDashboard()
    }
  }

  if (!session) {
    return (
      <div className="login-shell">
        <section className="login-panel">
          <div className="hero-copy">
            <span className="eyebrow">Northstar HRIS</span>
            <h1>Modern HR operations starter</h1>
            <p>
              Built as a polished frontend foundation with placeholder authentication and
              database-ready data structures.
            </p>
          </div>

          <div className="demo-credentials">
            <strong>Suggested roles</strong>
            <div className="role-chips">
              {['admin', 'hr', 'employee'].map((role) => (
                <button
                  key={role}
                  type="button"
                  className={loginForm.role === role ? 'chip active' : 'chip'}
                  onClick={() => setLoginForm((current) => ({ ...current, role }))}
                >
                  {role.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Email
              <input
                type="email"
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="hr@northstarhris.dev"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="Any value for demo"
              />
            </label>
            <button className="primary-button" type="submit">
              Enter HRIS
            </button>
            {authError ? <p className="error-copy">{authError}</p> : null}
          </form>
        </section>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <span className="eyebrow">Northstar HRIS</span>
          <h2>People platform</h2>
          <p>Starter system for HR, payroll, and reporting workflows.</p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeView === item.id ? 'nav-button active' : 'nav-button'}
              onClick={() => setActiveView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="session-card">
          <strong>{session.name}</strong>
          <span>{session.title}</span>
          <span>{session.role}</span>
          <button type="button" className="secondary-button" onClick={() => setSession(null)}>
            Log out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Today</p>
            <h1>{displayDate.format(new Date('2026-03-11'))}</h1>
          </div>
          <div className="topbar-actions">
            <button type="button" className="secondary-button" onClick={() => setActiveView('employees')}>
              Add employee
            </button>
            <button type="button" className="secondary-button" onClick={() => setActiveView('biometrics')}>
              Biometrics
            </button>
            <button type="button" className="primary-button" onClick={() => setActiveView('leave')}>
              Review leave
            </button>
          </div>
        </header>

        {renderActiveView()}
      </main>
    </div>
  )
}

function SectionTitle({ eyebrow, title, description }) {
  return (
    <div className="section-title">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}

function MetricCard({ label, value, note }) {
  return (
    <article className="panel metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  )
}

function StatusPill({ value }) {
  const tone = value.toLowerCase().replace(/\s+/g, '-')

  return <span className={`status-pill ${tone}`}>{value}</span>
}

function ReadinessItem({ label, detail }) {
  return (
    <div className="readiness-item">
      <strong>{label}</strong>
      <p>{detail}</p>
    </div>
  )
}

export default App
