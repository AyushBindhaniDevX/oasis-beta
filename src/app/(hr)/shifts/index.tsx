import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { LoadingState } from '@/components/ui/States';
import { getShifts, createShift, updateShift, getRoster, assignEmployeeShift } from '@/lib/services/shifts';
import { getEmployees, getDepartments } from '@/lib/services/employee';
import { WorkShift, EmployeeShift, Employee, Department } from '@/types';
import { formatCurrency } from '@/utils/format';
import {
  Clock,
  Calendar,
  Users,
  Sun,
  Moon,
  Sunset,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  X,
  Download,
  Building2,
  ShieldCheck,
  UserCheck,
} from 'lucide-react-native';
import { exportOrPrintPdf } from '@/utils/pdf';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export default function ShiftsScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg } = useTenant();
  const { width } = useWindowDimensions();

  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [rosterMap, setRosterMap] = useState<Record<string, string>>({}); // key: `${empId}_${date}` -> shiftId / 'OFF'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<'roster' | 'master'>('roster');

  // Week offset from current week
  const [weekOffset, setWeekOffset] = useState(0);

  // Shift assignment modal state
  const [assignModal, setAssignModal] = useState<{
    open: boolean;
    employee: Employee | null;
    date: string;
    dayLabel: string;
    currentShiftId?: string | null;
  }>({ open: false, employee: null, date: '', dayLabel: '' });

  // Add/Edit Shift Modal
  const [addShiftOpen, setAddShiftOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [newShiftName, setNewShiftName] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('09:00');
  const [newShiftEnd, setNewShiftEnd] = useState('17:00');
  const [newShiftColor, setNewShiftColor] = useState('#0D7377');
  const [newShiftAllowance, setNewShiftAllowance] = useState('0');
  const [savingShift, setSavingShift] = useState(false);

  // Calculate dates for current week
  const weekDates = React.useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sun, 1 is Mon
    const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMon + weekOffset * 7);

    return DAYS.map((day, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const dateStr = d.toISOString().split('T')[0];
      const dayNum = d.getDate();
      const monthStr = d.toLocaleString('default', { month: 'short' });
      return { day, dateStr, label: `${day} ${dayNum} ${monthStr}`, isToday: d.toDateString() === new Date().toDateString() };
    });
  }, [weekOffset]);

  const loadData = useCallback(async () => {
    try {
      const orgId = tenantOrg?.id || profile?.organization_id || '';
      const startDate = weekDates[0].dateStr;
      const endDate = weekDates[weekDates.length - 1].dateStr;

      let [shiftData, empData, rosterData, deptData] = await Promise.all([
        getShifts(orgId),
        getEmployees({ organization_id: orgId }),
        getRoster(startDate, endDate, orgId),
        getDepartments(orgId),
      ]);

      // If no shifts exist, seed default standard shifts
      if (!shiftData || shiftData.length === 0) {
        try {
          const defaultShifts = [
            { name: 'General Day Shift (8h)', start_time: '09:00', end_time: '17:00', color: '#0D7377', allowance_per_day: 0, is_night_shift: false, organization_id: orgId },
            { name: 'Morning Shift (8h)', start_time: '07:00', end_time: '15:00', color: '#0284C7', allowance_per_day: 100, is_night_shift: false, organization_id: orgId },
            { name: 'Evening Shift (8h)', start_time: '14:00', end_time: '22:00', color: '#D97706', allowance_per_day: 150, is_night_shift: false, organization_id: orgId },
            { name: 'Night Shift ICU (8h)', start_time: '21:00', end_time: '07:00', color: '#7C3AED', allowance_per_day: 300, is_night_shift: true, organization_id: orgId },
          ];
          for (const s of defaultShifts) {
            await createShift(s);
          }
          shiftData = await getShifts(orgId);
        } catch (sErr) {}
      }

      setShifts(shiftData || []);
      setEmployees(empData || []);
      setDepartments(deptData || []);

      // If logged in as HOD/Manager, restrict to their department
      if ((profile?.role as any) === 'manager' && profile?.id) {
        const myEmp = (empData || []).find((e) => e.profile_id === profile.id);
        if (myEmp?.department_id) {
          setSelectedDeptId(myEmp.department_id);
        }
      }

      const rMap: Record<string, string> = {};
      rosterData.forEach((r) => {
        if (r.shift_id) {
          rMap[`${r.employee_id}_${r.date}`] = r.shift_id;
        } else {
          rMap[`${r.employee_id}_${r.date}`] = 'OFF';
        }
      });
      setRosterMap(rMap);
    } catch (e) {
      console.error('Error loading shifts data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, tenantOrg, weekDates]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAssignShift = async (shiftId: string | null) => {
    if (!assignModal.employee) return;
    const orgId = tenantOrg?.id || profile?.organization_id || '';
    const key = `${assignModal.employee.id}_${assignModal.date}`;

    // Optimistic update
    setRosterMap((prev) => ({ ...prev, [key]: shiftId || 'OFF' }));
    setAssignModal({ open: false, employee: null, date: '', dayLabel: '' });

    await assignEmployeeShift(assignModal.employee.id, assignModal.date, shiftId, orgId);
    await loadData();
  };

  const handleDownloadPDF = async () => {
    try {
      setLoading(true);
      const activeDeptName = selectedDeptId
        ? departments.find(d => d.id === selectedDeptId)?.name || 'Department'
        : 'All Hospital Departments';

      const unitName = (tenantOrg as any)?.name || 'Shanti Memorial Hospital & Chikitsa Unit';
      const hodName = profile?.full_name || 'Department HOD';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Duty Roster - ${weekDates[0].dateStr} to ${weekDates[6].dateStr}</title>
            <style>
              @page {
                size: landscape;
                margin: 8mm;
              }
              * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                margin: 0;
                padding: 12px;
                color: #0F172A;
                background: #FFF;
                font-size: 11px;
              }
              .header-box {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 2.5px solid #0D7377;
                padding-bottom: 10px;
                margin-bottom: 12px;
              }
              .hospital-name {
                font-size: 18px;
                font-weight: 800;
                color: #0D7377;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                margin: 0 0 4px 0;
              }
              .doc-title {
                font-size: 13px;
                font-weight: 700;
                color: #D97706;
                text-transform: uppercase;
                margin: 0;
              }
              .meta-info {
                text-align: right;
                font-size: 11px;
                color: #475569;
                line-height: 1.5;
              }
              .meta-info strong {
                color: #0F172A;
              }
              .legend-bar {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 12px;
                background: #F8FAFC;
                border: 1px solid #E2E8F0;
                border-radius: 6px;
                padding: 8px 12px;
                margin-bottom: 12px;
              }
              .legend-heading {
                font-weight: 800;
                color: #334155;
                font-size: 10.5px;
                text-transform: uppercase;
                margin-right: 4px;
              }
              .legend-chip {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                font-size: 10px;
                font-weight: 600;
                color: #334155;
              }
              .color-bullet {
                width: 12px;
                height: 12px;
                border-radius: 3px;
                border: 1px solid rgba(0,0,0,0.1);
              }
              table.roster-grid {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
                font-size: 10px;
              }
              table.roster-grid th, table.roster-grid td {
                border: 1.2px solid #CBD5E1;
                padding: 6px 4px;
                text-align: center;
                vertical-align: middle;
              }
              table.roster-grid th {
                background-color: #0F766E !important;
                color: #FFFFFF !important;
                font-weight: 700;
                text-transform: uppercase;
                font-size: 10px;
              }
              table.roster-grid th.emp-th {
                width: 18%;
                text-align: left;
                padding-left: 8px;
              }
              table.roster-grid th.tot-th {
                width: 7%;
              }
              table.roster-grid tr:nth-child(even) {
                background-color: #F8FAFC;
              }
              .emp-info {
                text-align: left;
                padding-left: 8px;
              }
              .emp-name {
                font-weight: 700;
                color: #0F172A;
                font-size: 11px;
              }
              .emp-role {
                font-size: 9px;
                color: #64748B;
              }
              .shift-chip {
                display: inline-block;
                padding: 3px 5px;
                border-radius: 4px;
                font-weight: 700;
                font-size: 9px;
                line-height: 1.2;
                border: 1px solid rgba(0,0,0,0.12);
              }
              .off-text {
                color: #94A3B8;
                font-weight: 600;
                font-size: 10px;
              }
              .footer-sign {
                display: flex;
                justify-content: space-between;
                margin-top: 24px;
                padding-top: 14px;
              }
              .sign-box {
                width: 220px;
                text-align: center;
                border-top: 1.5px solid #475569;
                padding-top: 4px;
                font-size: 10.5px;
                font-weight: 700;
                color: #1E293B;
              }
              .sign-sub {
                font-size: 9px;
                font-weight: normal;
                color: #64748B;
              }
            </style>
          </head>
          <body>
            <div class="header-box">
              <div>
                <div class="hospital-name">${unitName}</div>
                <div class="doc-title">Weekly Staff Duty Roster</div>
              </div>
              <div class="meta-info">
                <div><strong>Roster Period:</strong> ${weekDates[0].dateStr} to ${weekDates[6].dateStr}</div>
                <div><strong>Department:</strong> ${activeDeptName}</div>
                <div><strong>Prepared By:</strong> ${hodName} (HOD)</div>
                <div><strong>Generated:</strong> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              </div>
            </div>

            <div class="legend-bar">
              <span class="legend-heading">Shift Schedule:</span>
              ${shifts.map(s => `
                <div class="legend-chip">
                  <span class="color-bullet" style="background-color: ${s.color};"></span>
                  <span><strong>${s.name}</strong> (${s.start_time} - ${s.end_time})</span>
                </div>
              `).join('')}
              <div class="legend-chip">
                <span class="color-bullet" style="background-color: #E2E8F0;"></span>
                <span><strong>OFF</strong> (Weekly Rest)</span>
              </div>
            </div>

            <table class="roster-grid">
              <thead>
                <tr>
                  <th class="emp-th">Employee / Staff</th>
                  ${weekDates.map((d, i) => `<th>${DAYS[i]}<br/><span style="font-size: 9px; opacity: 0.9;">${d.dateStr}</span></th>`).join('')}
                  <th class="tot-th">Duty Days</th>
                </tr>
              </thead>
              <tbody>
                ${employees.map(emp => {
                  let dutyDaysCount = 0;
                  const dayCells = weekDates.map(d => {
                    const shiftId = rosterMap[emp.id + '_' + d.dateStr];
                    const shiftDef = shifts.find(s => s.id === shiftId);
                    if (shiftId && shiftId !== 'OFF' && shiftDef) {
                      dutyDaysCount++;
                      return `<td><span class="shift-chip" style="background-color: ${shiftDef.color}25; color: ${shiftDef.color}; border-color: ${shiftDef.color}60;">${shiftDef.name}</span></td>`;
                    } else {
                      return '<td><span class="off-text">OFF</span></td>';
                    }
                  }).join('');

                  return `
                    <tr>
                      <td class="emp-info">
                        <div class="emp-name">${emp.profile?.full_name || 'Staff Member'}</div>
                        <div class="emp-role">${emp.employee_code || ''} · ${emp.designation || 'Staff'}</div>
                      </td>
                      ${dayCells}
                      <td style="font-weight: 700; color: #0D7377;">${dutyDaysCount} / 7</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div class="footer-sign">
              <div class="sign-box">
                Immediate HOD Signature<br/>
                <span class="sign-sub">${activeDeptName}</span>
              </div>
              <div class="sign-box">
                Medical Superintendent<br/>
                <span class="sign-sub">Clinical Administration</span>
              </div>
              <div class="sign-box">
                HR & Payroll Department<br/>
                <span class="sign-sub">Shanti Memorial Hospital</span>
              </div>
            </div>
          </body>
        </html>
      `;
      
      const fileName = `SMH_Duty_Roster_${weekDates[0].dateStr}_${weekDates[6].dateStr}.pdf`;
      await exportOrPrintPdf(htmlContent, fileName);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdateShift = async () => {
    if (!newShiftName.trim()) return;
    setSavingShift(true);
    try {
      const orgId = tenantOrg?.id || profile?.organization_id || '00000000-0000-0000-0000-000000000002';
      const shiftPayload = {
        name: newShiftName.trim(),
        start_time: newShiftStart.trim(),
        end_time: newShiftEnd.trim(),
        color: newShiftColor,
        allowance_per_day: Number(newShiftAllowance) || 0,
        is_night_shift: newShiftStart.trim() > newShiftEnd.trim(), // simple check for night shift
      };

      if (editingShiftId) {
        await updateShift(editingShiftId, shiftPayload);
        setShifts((prev) => prev.map(s => s.id === editingShiftId ? { ...s, ...shiftPayload } : s));
      } else {
        const created = await createShift({
          organization_id: orgId,
          ...shiftPayload
        });
        setShifts((prev) => [...prev, created]);
      }

      setAddShiftOpen(false);
      setNewShiftName('');
      setNewShiftStart('09:00');
      setNewShiftEnd('17:00');
      setNewShiftAllowance('0');
      setEditingShiftId(null);
    } catch (e) {
      console.error('Error saving shift:', e);
    } finally {
      setSavingShift(false);
    }
  };

  const openEditShift = (s: WorkShift) => {
    setEditingShiftId(s.id);
    setNewShiftName(s.name);
    setNewShiftStart(s.start_time);
    setNewShiftEnd(s.end_time);
    setNewShiftColor(s.color);
    setNewShiftAllowance(s.allowance_per_day?.toString() || '0');
    setAddShiftOpen(true);
  };

  if (loading) return <LoadingState />;

  return (
    <SidebarLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Shift Scheduling & Team Rosters</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Manage Weekly Rotational Schedules & Shift Allowances
            </Text>
          </View>

          {selectedView === 'master' && (
            <TouchableOpacity
            onPress={() => {
              setEditingShiftId(null);
              setNewShiftName('');
              setNewShiftStart('09:00');
              setNewShiftEnd('17:00');
              setNewShiftColor('#0D7377');
              setNewShiftAllowance('0');
              setAddShiftOpen(true);
            }}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}>
              <Plus size={16} color="#FFF" />
              <Text style={styles.addBtnText}>New Shift Type</Text>
            </TouchableOpacity>
          )}

          {selectedView === 'roster' && (
            <TouchableOpacity onPress={handleDownloadPDF} style={[styles.addBtn, { backgroundColor: '#10b981' }]}>
              <Download size={16} color="#FFF" />
              <Text style={styles.addBtnText}>Export PDF</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* View Switcher */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            onPress={() => setSelectedView('roster')}
            style={[styles.tabBtn, selectedView === 'roster' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, selectedView === 'roster' && styles.tabTextActive]}>
              Weekly Roster Matrix
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedView('master')}
            style={[styles.tabBtn, selectedView === 'master' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, selectedView === 'master' && styles.tabTextActive]}>
              Shift Master ({shifts.length})
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1, padding: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
        >
          {selectedView === 'roster' ? (
            <View style={{ gap: 16 }}>
              {/* HOD Roster Assignment Notice & Department Selector */}
              <View style={{ backgroundColor: '#F0FDFA', borderColor: '#99F6E4', borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={18} color="#0D7377" />
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F766E' }}>
                        HOD Duty Roster Assignment
                      </Text>
                      <Text style={{ fontSize: 11, color: '#115E59' }}>
                        Hospital Policy: Duty rosters must be assigned by respective immediate HODs for scheduled 8-hour shifts.
                      </Text>
                    </View>
                  </View>
                  {(profile?.role as any) === 'manager' && (
                    <View style={{ backgroundColor: '#CCFBF1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F766E' }}>
                        HOD Mode: {departments.find(d => d.id === selectedDeptId)?.name || 'My Department'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Department Filter Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setSelectedDeptId('all')}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: selectedDeptId === 'all' ? '#0D7377' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: selectedDeptId === 'all' ? '#0D7377' : '#CCFBF1',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: selectedDeptId === 'all' ? '#FFFFFF' : '#0F766E' }}>
                      All Departments ({employees.length})
                    </Text>
                  </TouchableOpacity>
                  {departments.map((dept) => {
                    const count = employees.filter((e) => e.department_id === dept.id).length;
                    const active = selectedDeptId === dept.id;
                    return (
                      <TouchableOpacity
                        key={dept.id}
                        onPress={() => setSelectedDeptId(dept.id)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 20,
                          backgroundColor: active ? '#0D7377' : '#FFFFFF',
                          borderWidth: 1,
                          borderColor: active ? '#0D7377' : '#CCFBF1',
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#FFFFFF' : '#0F766E' }}>
                          {dept.name} ({count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Week Selector Bar */}
              <View style={styles.weekControlBar}>
                <TouchableOpacity
                  onPress={() => setWeekOffset((prev) => prev - 1)}
                  style={styles.weekNavBtn}
                >
                  <ChevronLeft size={18} color="#0D7377" />
                  <Text style={styles.weekNavText}>Prev Week</Text>
                </TouchableOpacity>

                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.weekTitleText}>
                    Week of {weekDates[0].dateStr} — {weekDates[6].dateStr}
                  </Text>
                  {weekOffset === 0 && (
                    <View style={styles.liveTag}>
                      <Sparkles size={11} color="#0D7377" />
                      <Text style={styles.liveTagText}>CURRENT WEEK</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => setWeekOffset((prev) => prev + 1)}
                  style={styles.weekNavBtn}
                >
                  <Text style={styles.weekNavText}>Next Week</Text>
                  <ChevronRight size={18} color="#0D7377" />
                </TouchableOpacity>
              </View>

              {/* Roster Table Card */}
              <View style={styles.rosterCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ minWidth: 800 }}>
                    {/* Header Row */}
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.thCell, { width: 220, textAlign: 'left', paddingLeft: 8 }]}>EMPLOYEE</Text>
                      {weekDates.map((d) => (
                        <View key={d.dateStr} style={[styles.thCellBox, d.isToday && { backgroundColor: '#E6F4F4' }]}>
                          <Text style={[styles.thDayText, d.isToday && { color: '#0D7377', fontWeight: '800' }]}>{d.day}</Text>
                          <Text style={[styles.thDateText, d.isToday && { color: '#0D7377' }]}>{d.dateStr.slice(5)}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Employee Rows */}
                    {employees.filter(e => selectedDeptId === 'all' || e.department_id === selectedDeptId).length === 0 ? (
                      <View style={{ padding: 32, alignItems: 'center' }}>
                        <Text style={{ color: colors.textSecondary }}>No employees found for this department filter.</Text>
                      </View>
                    ) : (
                      employees.filter(e => selectedDeptId === 'all' || e.department_id === selectedDeptId).map((emp) => (
                        <View key={emp.id} style={styles.tableRow}>
                          <View style={{ width: 220, paddingRight: 12 }}>
                            <Text style={styles.empName}>{emp.profile?.full_name || 'Staff'}</Text>
                            <Text style={styles.empRole}>{emp.designation || 'Team Member'}</Text>
                          </View>

                          {weekDates.map((d) => {
                            const key = `${emp.id}_${d.dateStr}`;
                            const shiftId = rosterMap[key];
                            const assignedShift = shifts.find((s) => s.id === shiftId);
                            const isOff = shiftId === 'OFF' || !assignedShift;
                            const isNight = assignedShift?.is_night_shift;

                            return (
                              <TouchableOpacity
                                key={d.dateStr}
                                onPress={() =>
                                  setAssignModal({
                                    open: true,
                                    employee: emp,
                                    date: d.dateStr,
                                    dayLabel: d.label,
                                    currentShiftId: shiftId,
                                  })
                                }
                                style={styles.cellBox}
                              >
                                <View
                                  style={[
                                    styles.shiftPill,
                                    isOff && { backgroundColor: '#F1F5F9' },
                                    !isOff && isNight && { backgroundColor: '#1E293B' },
                                    !isOff && !isNight && { backgroundColor: (assignedShift?.color || '#0D7377') + '20', borderColor: assignedShift?.color || '#0D7377', borderWidth: 1 },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.shiftPillText,
                                      isOff && { color: '#94A3B8' },
                                      !isOff && isNight && { color: '#FFFFFF' },
                                      !isOff && !isNight && { color: assignedShift?.color || '#0D7377' },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {assignedShift ? assignedShift.name.split(' ')[0] : 'OFF'}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))
                    )}
                  </View>
                </ScrollView>
              </View>
            </View>
          ) : (
            /* Shift Master View */
            <View style={styles.grid}>
              {shifts.map((s) => (
                <View key={s.id} style={styles.shiftCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View style={[styles.shiftDot, { backgroundColor: s.color }]} />
                    {s.allowance_per_day > 0 ? (
                      <View style={styles.allowanceBadge}>
                        <Text style={styles.allowanceText}>+{formatCurrency(s.allowance_per_day)} / Day</Text>
                      </View>
                    ) : (
                      <View style={[styles.allowanceBadge, { backgroundColor: '#F1F5F9' }]}>
                        <Text style={[styles.allowanceText, { color: '#64748B' }]}>Standard</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.shiftName}>{s.name}</Text>
                    <TouchableOpacity onPress={() => openEditShift(s)}>
                      <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.timeBox}>
                    <Clock size={16} color="#0D7377" />
                    <Text style={styles.timeText}>
                      {s.start_time} — {s.end_time} IST
                    </Text>
                  </View>
                  {s.is_night_shift && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                      <Moon size={14} color="#7C3AED" />
                      <Text style={{ fontSize: 12, color: '#7C3AED', fontWeight: '600' }}>Night Shift Protocol Active</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Assign Shift Modal */}
        <Modal visible={assignModal.open} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Assign Shift</Text>
                  <Text style={styles.modalSub}>
                    {assignModal.employee?.profile?.full_name} • {assignModal.dayLabel}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setAssignModal({ open: false, employee: null, date: '', dayLabel: '' })}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 8, marginVertical: 16 }}>
                {shifts.map((s) => {
                  const isSelected = assignModal.currentShiftId === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => handleAssignShift(s.id)}
                      style={[styles.shiftOption, isSelected && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={[styles.shiftDot, { backgroundColor: s.color }]} />
                        <View>
                          <Text style={{ fontWeight: '700', color: colors.text, fontSize: 14 }}>{s.name}</Text>
                          <Text style={{ fontSize: 12, color: colors.textSecondary }}>{s.start_time} - {s.end_time}</Text>
                        </View>
                      </View>
                      {s.allowance_per_day > 0 && (
                        <Text style={{ fontSize: 12, color: '#059669', fontWeight: '700' }}>+{formatCurrency(s.allowance_per_day)}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  onPress={() => handleAssignShift(null)}
                  style={[styles.shiftOption, assignModal.currentShiftId === 'OFF' && { borderColor: '#94A3B8', backgroundColor: '#F1F5F9' }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.shiftDot, { backgroundColor: '#94A3B8' }]} />
                    <Text style={{ fontWeight: '700', color: '#64748B', fontSize: 14 }}>Day OFF (No Shift)</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Add Shift Modal */}
        <Modal visible={addShiftOpen} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingShiftId ? 'Edit Shift' : 'Create Shift Type'}</Text>
                <TouchableOpacity onPress={() => setAddShiftOpen(false)}>
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 14, marginVertical: 16 }}>
                <View>
                  <Text style={styles.inputLabel}>Shift Name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. ICU Night Duty"
                    value={newShiftName}
                    onChangeText={setNewShiftName}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Start Time</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="09:00"
                      value={newShiftStart}
                      onChangeText={setNewShiftStart}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>End Time</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="17:00"
                      value={newShiftEnd}
                      onChangeText={setNewShiftEnd}
                    />
                  </View>
                </View>

                <View>
                  <Text style={styles.inputLabel}>Daily Allowance (INR)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={newShiftAllowance}
                    onChangeText={setNewShiftAllowance}
                  />
                </View>

                <TouchableOpacity
                  onPress={handleCreateOrUpdateShift}
                  disabled={savingShift}
                  style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                >
                  {savingShift ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>{editingShiftId ? 'Save Changes' : 'Create Shift'}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  tabBar: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#F0F7F7' },
  tabText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  tabTextActive: { color: '#0D7377', fontWeight: '800' },
  weekControlBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  weekNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#F0F7F7' },
  weekNavText: { color: '#0D7377', fontWeight: '700', fontSize: 12 },
  weekTitleText: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0F7F7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  liveTagText: { fontSize: 9, fontWeight: '800', color: '#0D7377' },
  rosterCard: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 10, marginBottom: 8 },
  thCell: { fontSize: 11, fontWeight: '800', color: '#64748B' },
  thCellBox: { width: 85, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, borderRadius: 6 },
  thDayText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  thDateText: { fontSize: 10, color: '#94A3B8' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  empName: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  empRole: { fontSize: 11, color: '#64748B', marginTop: 1 },
  cellBox: { width: 85, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  shiftPill: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, width: '100%', alignItems: 'center', justifyContent: 'center' },
  shiftPillText: { fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  shiftCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', width: 280 },
  shiftDot: { width: 14, height: 14, borderRadius: 7 },
  shiftName: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
  allowanceBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  allowanceText: { fontSize: 11, fontWeight: '800', color: '#059669' },
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  timeText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, width: '100%', maxWidth: 420 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  modalSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  shiftOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 },
  textInput: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  saveBtn: { paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
