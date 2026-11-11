import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Modal } from '@/components/ui/Modal';
import { TimePicker } from '@/components/ui/TimePicker';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { InteractiveTile } from '@/components/ui/InteractiveTile';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { LoadingState } from '@/components/ui/States';
import { getNavForRole } from '@/constants/navigation';
import { getTenantDefaultUnits, normalizeHospitalUnit } from '@/constants/config';
import { STOCK_4_SVG, STOCK_8_SVG, STOCK_10_SVG, STOCK_12_SVG } from '@/constants/workManagementSvgs';
import { getShifts, createShift, updateShift, getRoster, assignEmployeeShift } from '@/lib/services/shifts';
import { getEmployees, getDepartments } from '@/lib/services/employee';
import { WorkShift, EmployeeShift, Employee, Department } from '@/types';
import { formatCurrency, getInitials } from '@/utils/format';
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
  CheckSquare,
  MinusSquare,
  Square,
  RotateCcw,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react-native';
import { Select } from '@/components/ui/Select';
import { exportOrPrintPdf } from '@/utils/pdf';

function MetricWave({ color, width = 85, height = 28 }: { color: string; width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 90 30" fill="none">
      <Path
        d="M 2 18 C 16 26, 26 8, 42 16 C 56 24, 66 6, 88 12"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export default function ShiftsScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg, units: tenantUnits } = useTenant();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [rosterMap, setRosterMap] = useState<Record<string, string>>({}); // key: `${empId}_${date}` -> shiftId / 'OFF'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<'roster' | 'master'>('roster');

  const availableUnits = useMemo(() => {
    if (tenantUnits && tenantUnits.length > 0) return tenantUnits;
    return getTenantDefaultUnits(tenantOrg?.name, tenantOrg?.id);
  }, [tenantUnits, tenantOrg]);

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
  const weekDates = useMemo(() => {
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

  const displayedEmployees = useMemo(() => {
    const filtered = employees.filter(e => {
      const matchDept = selectedDeptId === 'all' || e.department_id === selectedDeptId;
      const matchUnit = unitFilter === 'all' || (e.hospital_unit || '').toLowerCase() === unitFilter.toLowerCase();
      return matchDept && matchUnit;
    });
    const seen = new Set<string>();
    return filtered.filter(e => {
      if (!e.id || seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [employees, selectedDeptId, unitFilter]);

  // Mass action selection state
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set());
  const [massShiftModalOpen, setMassShiftModalOpen] = useState(false);
  const [massTargetShiftId, setMassTargetShiftId] = useState<string | null>(null);
  const [massTargetScope, setMassTargetScope] = useState<'all' | 'weekdays' | 'weekend' | string>('all');
  const [massApplying, setMassApplying] = useState(false);

  const isAllSelected = displayedEmployees.length > 0 && displayedEmployees.every((e) => selectedEmpIds.has(e.id));
  const isSomeSelected = displayedEmployees.some((e) => selectedEmpIds.has(e.id)) && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedEmpIds(new Set());
    } else {
      setSelectedEmpIds(new Set(displayedEmployees.map((e) => e.id)));
    }
  };

  const toggleSelectEmp = (empId: string) => {
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

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
            { name: 'Night Shift Operations (8h)', start_time: '21:00', end_time: '07:00', color: '#7C3AED', allowance_per_day: 300, is_night_shift: true, organization_id: orgId },
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
    setRosterMap((prev) => {
      const next = { ...prev };
      if (shiftId === null) {
        delete next[key];
      } else {
        next[key] = shiftId;
      }
      return next;
    });
    setAssignModal({ open: false, employee: null, date: '', dayLabel: '' });

    await assignEmployeeShift(assignModal.employee.id, assignModal.date, shiftId, orgId);
    await loadData();
  };

  const handleMassAssign = async (targetShiftId: string | 'OFF' | null, scope: 'all' | 'weekdays' | 'weekend' | string) => {
    if (selectedEmpIds.size === 0) return;
    setMassApplying(true);
    try {
      const orgId = tenantOrg?.id || profile?.organization_id || '';
      let targetDates = weekDates.map((d) => d.dateStr);
      if (scope === 'weekdays') {
        targetDates = weekDates.slice(0, 5).map((d) => d.dateStr);
      } else if (scope === 'weekend') {
        targetDates = weekDates.slice(5, 7).map((d) => d.dateStr);
      } else if (scope !== 'all') {
        targetDates = [scope];
      }

      setRosterMap((prev) => {
        const next = { ...prev };
        for (const empId of selectedEmpIds) {
          for (const d of targetDates) {
            const key = `${empId}_${d}`;
            if (targetShiftId === null) {
              delete next[key];
            } else {
              next[key] = targetShiftId;
            }
          }
        }
        return next;
      });

      const promises: Promise<void>[] = [];
      for (const empId of selectedEmpIds) {
        for (const date of targetDates) {
          promises.push(assignEmployeeShift(empId, date, targetShiftId, orgId));
        }
      }
      await Promise.all(promises);
      setMassShiftModalOpen(false);
      await loadData();
    } catch (e) {
      console.error('Failed mass shift assignment:', e);
    } finally {
      setMassApplying(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setLoading(true);
      const activeDeptName = selectedDeptId
        ? departments.find(d => d.id === selectedDeptId)?.name || 'Department'
        : 'All Departments';

      const unitName = (tenantOrg as any)?.name || 'Main Organization';
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
              .workplace-name {
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
                <div class="workplace-name">${unitName}</div>
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
                    const rawShiftId = rosterMap[emp.id + '_' + d.dateStr];
                    const effectiveShiftId = rawShiftId !== undefined ? rawShiftId : (emp.default_shift_id || 'OFF');
                    const shiftDef = shifts.find(s => s.id === effectiveShiftId);
                    if (effectiveShiftId && effectiveShiftId !== 'OFF' && shiftDef) {
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
                Operations & Management<br/>
                <span class="sign-sub">Operational Administration</span>
              </div>
              <div class="sign-box">
                HR & Payroll Department<br/>
                <span class="sign-sub">${unitName}</span>
              </div>
            </div>
          </body>
        </html>
      `;
      
      const fileName = `Duty_Roster_${weekDates[0].dateStr}_${weekDates[6].dateStr}.pdf`;
      await exportOrPrintPdf(htmlContent, fileName);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      Alert.alert('PDF Export Error', 'Failed to generate PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdateShift = async () => {
    if (!newShiftName.trim()) return;
    setSavingShift(true);
    try {
      const orgId = tenantOrg?.id || profile?.organization_id || '';
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
    <SidebarLayout items={getNavForRole(profile?.role || 'hr', profile?.email)}>
      <ScrollView
        style={[styles.container, { backgroundColor: '#FAF9FD' }]}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {/* Top Header Row with STOCK 4 SVG */}
        <Animated.View entering={FadeInDown.duration(280)} style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 260 }}>
            <View style={styles.breadcrumbRow}>
              <Text style={styles.breadcrumbMuted}>Dashboard</Text>
              <Text style={styles.breadcrumbMuted}>/</Text>
              <Text style={styles.breadcrumbActive}>Shifts & Rosters</Text>
            </View>

            <Text style={[styles.pageTitle, { color: '#0F172A' }]}>Shift Scheduling & Duty Rosters</Text>
            <Text style={[styles.pageSubtitle, { color: '#64748B' }]}>
              Manage weekly rotational shifts, 24x7 operational schedules, and duty roster assignments across{' '}
              <Text style={{ fontWeight: '700', color: '#0F172A' }}>{tenantOrg?.name || 'Workspace'}</Text>.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => { setRefreshing(true); loadData(); }}
              disabled={refreshing}
              activeOpacity={0.8}
            >
              <RefreshCw size={15} color="#64748B" />
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDownloadPDF}
              style={[styles.refreshBtn, { backgroundColor: '#F0FDFA', borderColor: '#99F6E4' }]}
              activeOpacity={0.8}
            >
              <Download size={15} color="#0D7377" />
              <Text style={[styles.refreshBtnText, { color: '#0D7377', fontWeight: '700' }]}>Export PDF</Text>
            </TouchableOpacity>

            <View style={{ opacity: 0.95 }}>
              <SvgXml xml={STOCK_4_SVG} width={isDesktop ? 120 : 85} height={isDesktop ? 85 : 60} />
            </View>

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
              style={[styles.headerPrimaryBtn, { backgroundColor: '#7C3AED' }]}
              activeOpacity={0.88}
            >
              <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.headerPrimaryBtnText}>New Shift Pattern</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* 4 Pastel KPI Metric Cards with InteractiveTile */}
        <Animated.View entering={FadeInDown.delay(50).duration(280)} style={{ marginBottom: 16 }}>
          {isDesktop ? (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Tile 1: Active Shift Patterns */}
              <InteractiveTile
                style={[
                  styles.pastelMetricCard,
                  {
                    backgroundColor: '#F3EEFE',
                    borderColor: '#E4DCFD',
                    flex: 1,
                  },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#DDD6FE' }]}>
                    <Clock size={18} color="#7C3AED" />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.metricValueText, { color: '#1E1B4B' }]}>{shifts.length}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#8B5CF6', marginTop: 1 }}>Patterns</Text>
                  </View>
                </View>
                <Text style={styles.metricLabelText}>Active Shift Patterns</Text>
                <View style={styles.waveContainer}>
                  <MetricWave color="#8B5CF6" width={150} height={24} />
                </View>
              </InteractiveTile>

              {/* Tile 2: Scheduled Staff */}
              <InteractiveTile
                style={[
                  styles.pastelMetricCard,
                  {
                    backgroundColor: '#EDFAF2',
                    borderColor: '#CEF2DE',
                    flex: 1,
                  },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#D1FAE5' }]}>
                    <Users size={18} color="#10B981" />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.metricValueText, { color: '#064E3B' }]}>{displayedEmployees.length}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>Staff</Text>
                  </View>
                </View>
                <Text style={styles.metricLabelText}>Scheduled Staff</Text>
                <View style={styles.waveContainer}>
                  <MetricWave color="#10B981" width={150} height={24} />
                </View>
              </InteractiveTile>

              {/* Tile 3: Night Duty Rosters */}
              <InteractiveTile
                style={[
                  styles.pastelMetricCard,
                  {
                    backgroundColor: '#FFF4EB',
                    borderColor: '#FFE2CD',
                    flex: 1,
                  },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#FFEDD5' }]}>
                    <Moon size={18} color="#EA580C" />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.metricValueText, { color: '#7C2D12' }]}>
                      {shifts.filter((s) => s.is_night_shift).length}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C', marginTop: 1 }}>Night Shifts</Text>
                  </View>
                </View>
                <Text style={styles.metricLabelText}>Night Duty Protocols</Text>
                <View style={styles.waveContainer}>
                  <MetricWave color="#F97316" width={150} height={24} />
                </View>
              </InteractiveTile>

              {/* Tile 4: Departments */}
              <InteractiveTile
                style={[
                  styles.pastelMetricCard,
                  {
                    backgroundColor: '#EFF6FF',
                    borderColor: '#DBEAFE',
                    flex: 1,
                  },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#DBEAFE' }]}>
                    <Building2 size={18} color="#2563EB" />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.metricValueText, { color: '#1E3A8A' }]}>{departments.length}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', marginTop: 1 }}>Depts</Text>
                  </View>
                </View>
                <Text style={styles.metricLabelText}>Roster Departments</Text>
                <View style={styles.waveContainer}>
                  <MetricWave color="#3B82F6" width={150} height={24} />
                </View>
              </InteractiveTile>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Tile 1: Active Shift Patterns */}
                <InteractiveTile
                  style={[
                    styles.pastelMetricCard,
                    {
                      backgroundColor: '#F3EEFE',
                      borderColor: '#E4DCFD',
                      flex: 1,
                    },
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.iconBox, { backgroundColor: '#DDD6FE' }]}>
                      <Clock size={18} color="#7C3AED" />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.metricValueText, { color: '#1E1B4B' }]}>{shifts.length}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#8B5CF6', marginTop: 1 }}>Patterns</Text>
                    </View>
                  </View>
                  <Text style={styles.metricLabelText}>Patterns</Text>
                  <View style={styles.waveContainer}>
                    <MetricWave color="#8B5CF6" width={80} height={24} />
                  </View>
                </InteractiveTile>

                {/* Tile 2: Scheduled Staff */}
                <InteractiveTile
                  style={[
                    styles.pastelMetricCard,
                    {
                      backgroundColor: '#EDFAF2',
                      borderColor: '#CEF2DE',
                      flex: 1,
                    },
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.iconBox, { backgroundColor: '#D1FAE5' }]}>
                      <Users size={18} color="#10B981" />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.metricValueText, { color: '#064E3B' }]}>{displayedEmployees.length}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>Staff</Text>
                    </View>
                  </View>
                  <Text style={styles.metricLabelText}>Staff</Text>
                  <View style={styles.waveContainer}>
                    <MetricWave color="#10B981" width={80} height={24} />
                  </View>
                </InteractiveTile>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Tile 3: Night Duty Rosters */}
                <InteractiveTile
                  style={[
                    styles.pastelMetricCard,
                    {
                      backgroundColor: '#FFF4EB',
                      borderColor: '#FFE2CD',
                      flex: 1,
                    },
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.iconBox, { backgroundColor: '#FFEDD5' }]}>
                      <Moon size={18} color="#EA580C" />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.metricValueText, { color: '#7C2D12' }]}>
                        {shifts.filter((s) => s.is_night_shift).length}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C', marginTop: 1 }}>Night Shifts</Text>
                    </View>
                  </View>
                  <Text style={styles.metricLabelText}>Night Duty</Text>
                  <View style={styles.waveContainer}>
                    <MetricWave color="#F97316" width={80} height={24} />
                  </View>
                </InteractiveTile>

                {/* Tile 4: Departments */}
                <InteractiveTile
                  style={[
                    styles.pastelMetricCard,
                    {
                      backgroundColor: '#EFF6FF',
                      borderColor: '#DBEAFE',
                      flex: 1,
                    },
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.iconBox, { backgroundColor: '#DBEAFE' }]}>
                      <Building2 size={18} color="#2563EB" />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.metricValueText, { color: '#1E3A8A' }]}>{departments.length}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', marginTop: 1 }}>Depts</Text>
                    </View>
                  </View>
                  <Text style={styles.metricLabelText}>Depts</Text>
                  <View style={styles.waveContainer}>
                    <MetricWave color="#3B82F6" width={80} height={24} />
                  </View>
                </InteractiveTile>
              </View>
            </View>
          )}
        </Animated.View>

        {/* View Switcher Tabs */}
        <View style={styles.viewModeTabs}>
          <TouchableOpacity
            onPress={() => setSelectedView('roster')}
            style={[styles.viewTabBtn, selectedView === 'roster' && styles.viewTabBtnActive]}
          >
            <Calendar size={15} color={selectedView === 'roster' ? '#7C3AED' : '#64748B'} />
            <Text style={[styles.viewTabBtnText, selectedView === 'roster' && styles.viewTabBtnTextActive]}>
              Weekly Roster Matrix
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedView('master')}
            style={[styles.viewTabBtn, selectedView === 'master' && styles.viewTabBtnActive]}
          >
            <Clock size={15} color={selectedView === 'master' ? '#7C3AED' : '#64748B'} />
            <Text style={[styles.viewTabBtnText, selectedView === 'master' && styles.viewTabBtnTextActive]}>
              Shift Patterns & Masters ({shifts.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Workplace Units Filter Pills */}
        <View style={styles.unitFilterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitPillsRow}>
            <TouchableOpacity
              style={[styles.unitFilterPill, unitFilter === 'all' && styles.unitFilterPillActive]}
              onPress={() => setUnitFilter('all')}
              activeOpacity={0.8}
            >
              <Text style={[styles.unitFilterPillText, unitFilter === 'all' && styles.unitFilterPillTextActive]}>
                All Units ({employees.length} Staff)
              </Text>
            </TouchableOpacity>

            {availableUnits.map((u) => {
              const normalized = normalizeHospitalUnit(u);
              const active = unitFilter.toLowerCase() === u.toLowerCase();
              return (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitFilterPill, active && styles.unitFilterPillActive]}
                  onPress={() => setUnitFilter(active ? 'all' : u)}
                  activeOpacity={0.8}
                >
                  <Building2 size={12} color={active ? '#7C3AED' : '#64748B'} />
                  <Text style={[styles.unitFilterPillText, active && styles.unitFilterPillTextActive]}>
                    {normalized}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ paddingVertical: 10 }}>
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
                        Workplace Policy: Duty rosters must be assigned by respective immediate HODs / managers for scheduled shifts.
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

              {/* Mass Selection Action Bar */}
              {selectedEmpIds.size > 0 && (
                <View style={styles.massActionBar}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.massBadge}>
                      <Text style={styles.massBadgeText}>{selectedEmpIds.size} Selected</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F766E' }}>
                      Bulk action for {selectedEmpIds.size} staff member{selectedEmpIds.size > 1 ? 's' : ''}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      onPress={() => {
                        setMassTargetShiftId(shifts[0]?.id || null);
                        setMassTargetScope('all');
                        setMassShiftModalOpen(true);
                      }}
                      style={[styles.massBtn, { backgroundColor: '#0D7377' }]}
                    >
                      <Clock size={14} color="#FFF" />
                      <Text style={styles.massBtnText}>Assign Shift</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleMassAssign('OFF', 'all')}
                      disabled={massApplying}
                      style={[styles.massBtn, { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' }]}
                    >
                      <Text style={[styles.massBtnText, { color: '#475569' }]}>Mark Week OFF</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleMassAssign(null, 'all')}
                      disabled={massApplying}
                      style={[styles.massBtn, { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC' }]}
                    >
                      <RotateCcw size={14} color="#166534" />
                      <Text style={[styles.massBtnText, { color: '#166534' }]}>Reset to Default Shift</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setSelectedEmpIds(new Set())}
                      style={[styles.massBtn, { backgroundColor: 'transparent' }]}
                    >
                      <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '700' }}>Deselect All</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Roster Table Card */}
              <View style={styles.rosterCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ minWidth: 840 }}>
                    {/* Header Row */}
                    <View style={styles.tableHeaderRow}>
                      <TouchableOpacity
                        onPress={toggleSelectAll}
                        style={{ width: 44, alignItems: 'center', justifyContent: 'center' }}
                      >
                        {isAllSelected ? (
                          <CheckSquare size={18} color="#0D7377" />
                        ) : isSomeSelected ? (
                          <MinusSquare size={18} color="#0D7377" />
                        ) : (
                          <Square size={18} color="#94A3B8" />
                        )}
                      </TouchableOpacity>
                      <Text style={[styles.thCell, { width: 210, textAlign: 'left', paddingLeft: 4 }]}>STAFF / EMPLOYEE</Text>
                      {weekDates.map((d) => (
                        <View key={d.dateStr} style={[styles.thCellBox, d.isToday && { backgroundColor: '#E6F4F4' }]}>
                          <Text style={[styles.thDayText, d.isToday && { color: '#0D7377', fontWeight: '800' }]}>{d.day}</Text>
                          <Text style={[styles.thDateText, d.isToday && { color: '#0D7377' }]}>{d.dateStr.slice(5)}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Employee Rows */}
                    {displayedEmployees.length === 0 ? (
                      <View style={{ padding: 32, alignItems: 'center' }}>
                        <Text style={{ color: colors.textSecondary }}>No employees found for this department filter.</Text>
                      </View>
                    ) : (
                      displayedEmployees.map((emp) => {
                        const isSelected = selectedEmpIds.has(emp.id);
                        return (
                          <View key={emp.id} style={[styles.tableRow, isSelected && { backgroundColor: '#F0FDFA' }]}>
                            <TouchableOpacity
                              onPress={() => toggleSelectEmp(emp.id)}
                              style={{ width: 44, alignItems: 'center', justifyContent: 'center' }}
                            >
                              {isSelected ? (
                                <CheckSquare size={18} color="#0D7377" />
                              ) : (
                                <Square size={18} color="#CBD5E1" />
                              )}
                            </TouchableOpacity>

                            <View style={{ width: 210, paddingRight: 10 }}>
                              <Text style={styles.empName}>{emp.profile?.full_name || 'Staff'}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                                <Text style={styles.empRole}>{emp.designation || 'Team Member'}</Text>
                                {emp.default_shift_id && (
                                  <View style={styles.defaultShiftBadge}>
                                    <Text style={styles.defaultShiftBadgeText}>
                                      Fixed: {shifts.find(s => s.id === emp.default_shift_id)?.name?.split(' ')[0] || 'Default'}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>

                            {weekDates.map((d) => {
                              const key = `${emp.id}_${d.dateStr}`;
                              const rawShiftId = rosterMap[key];
                              const isOverridden = rawShiftId !== undefined;
                              // Fallback to employee's default shift (fixed everyday unless changed in roster)
                              const effectiveShiftId = isOverridden ? rawShiftId : (emp.default_shift_id || 'OFF');
                              const assignedShift = shifts.find((s) => s.id === effectiveShiftId);
                              const isOff = effectiveShiftId === 'OFF' || !assignedShift;
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
                                      currentShiftId: effectiveShiftId,
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
                                      isOverridden && { borderWidth: 1.5, borderColor: '#0D7377' },
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
                        );
                      })
                    )}
                  </View>
                </ScrollView>
              </View>
            </View>
          ) : (
            /* Shift Master View (Modern Cards matching Image 1) */
            <View style={{ gap: 10 }}>
              {shifts.map((s) => (
                <View key={s.id} style={styles.modernShiftRowCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View style={[styles.shiftDotLarge, { backgroundColor: s.color || '#7C3AED' }]} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.shiftTitleModern}>{s.name}</Text>
                        {s.is_night_shift && (
                          <View style={styles.nightBadge}>
                            <Moon size={11} color="#7C3AED" />
                            <Text style={styles.nightBadgeText}>Night Shift Protocol</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.shiftSubModern}>Rotational Operational Pattern</Text>
                    </View>
                  </View>

                  {/* Timing Column */}
                  <View style={{ width: 180 }}>
                    <Text style={styles.colHeaderLabel}>Shift Window</Text>
                    <View style={styles.timePillModern}>
                      <Clock size={12} color="#475569" />
                      <Text style={styles.timePillText}>{s.start_time} — {s.end_time} IST</Text>
                    </View>
                  </View>

                  {/* Allowance Column */}
                  <View style={{ width: 140 }}>
                    <Text style={styles.colHeaderLabel}>Shift Allowance</Text>
                    {s.allowance_per_day > 0 ? (
                      <View style={styles.allowancePillGreen}>
                        <Text style={styles.allowancePillGreenText}>+{formatCurrency(s.allowance_per_day)} / Day</Text>
                      </View>
                    ) : (
                      <View style={styles.allowancePillMuted}>
                        <Text style={styles.allowancePillMutedText}>Standard</Text>
                      </View>
                    )}
                  </View>

                  {/* Actions Column */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => openEditShift(s)}
                      style={styles.shiftEditBtn}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.shiftEditBtnText}>Edit Pattern</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Assign Shift Modal */}
        <Modal
          visible={assignModal.open}
          onClose={() => setAssignModal({ open: false, employee: null, date: '', dayLabel: '' })}
          title={`Assign Shift • ${assignModal.dayLabel || ''}`}
          maxWidth={480}
        >
          {assignModal.employee && (
            <View style={{ marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                {assignModal.employee.profile?.full_name || 'Staff Member'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                {assignModal.employee.employee_code ? `${assignModal.employee.employee_code} • ` : ''}
                {assignModal.employee.designation || 'Team Member'}
              </Text>
            </View>
          )}

          <View style={{ gap: 8, paddingBottom: 12 }}>
            {shifts.map((s) => {
              const isSelected = assignModal.currentShiftId === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => handleAssignShift(s.id)}
                  style={[
                    styles.shiftOption,
                    isSelected && { borderColor: colors.primary, backgroundColor: colors.primary + '15', borderWidth: 2 },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={[styles.shiftDot, { backgroundColor: s.color || colors.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: colors.text, fontSize: 14 }}>{s.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        {s.start_time} - {s.end_time} IST
                      </Text>
                    </View>
                  </View>
                  {s.allowance_per_day > 0 && (
                    <Text style={{ fontSize: 12, color: '#059669', fontWeight: '700', marginLeft: 8 }}>
                      +{formatCurrency(s.allowance_per_day)}
                    </Text>
                  )}
                  {isSelected && (
                    <CheckCircle2 size={18} color={colors.primary} style={{ marginLeft: 8 }} />
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              onPress={() => handleAssignShift('OFF')}
              style={[
                styles.shiftOption,
                assignModal.currentShiftId === 'OFF' && { borderColor: '#94A3B8', backgroundColor: '#F1F5F9', borderWidth: 2 },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={[styles.shiftDot, { backgroundColor: '#94A3B8' }]} />
                <View>
                  <Text style={{ fontWeight: '700', color: '#64748B', fontSize: 14 }}>Day OFF (Weekly Rest)</Text>
                  <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Mark this day as weekly off / holiday</Text>
                </View>
              </View>
              {assignModal.currentShiftId === 'OFF' && (
                <CheckCircle2 size={18} color="#64748B" style={{ marginLeft: 8 }} />
              )}
            </TouchableOpacity>

            {assignModal.employee?.default_shift_id && (
              <TouchableOpacity
                onPress={() => handleAssignShift(null)}
                style={[
                  styles.shiftOption,
                  { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <RotateCcw size={16} color="#166534" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: '#166534', fontSize: 14 }}>
                      Reset to Fixed Default Shift
                    </Text>
                    <Text style={{ fontSize: 12, color: '#15803D', marginTop: 2 }}>
                      Revert to fixed daily shift ({shifts.find(s => s.id === assignModal.employee?.default_shift_id)?.name || 'Default'})
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </Modal>

        {/* Mass Assign Shift Modal */}
        <Modal
          visible={massShiftModalOpen}
          onClose={() => setMassShiftModalOpen(false)}
          title={`Mass Assign Shift (${selectedEmpIds.size} Selected)`}
          maxWidth={500}
        >
          <View style={{ gap: 16, paddingBottom: 12 }}>
            <View>
              <Text style={styles.inputLabel}>Choose Shift or Action to Apply</Text>
              <View style={{ gap: 8, marginTop: 4 }}>
                {shifts.map((s) => {
                  const isSelected = massTargetShiftId === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => setMassTargetShiftId(s.id)}
                      style={[
                        styles.shiftOption,
                        isSelected && { borderColor: '#0D7377', backgroundColor: '#F0FDFA', borderWidth: 2 },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View style={[styles.shiftDot, { backgroundColor: s.color }]} />
                        <View>
                          <Text style={{ fontWeight: '700', color: colors.text, fontSize: 14 }}>{s.name}</Text>
                          <Text style={{ fontSize: 12, color: colors.textSecondary }}>{s.start_time} - {s.end_time} IST</Text>
                        </View>
                      </View>
                      {isSelected && <CheckCircle2 size={18} color="#0D7377" />}
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  onPress={() => setMassTargetShiftId('OFF')}
                  style={[
                    styles.shiftOption,
                    massTargetShiftId === 'OFF' && { borderColor: '#94A3B8', backgroundColor: '#F1F5F9', borderWidth: 2 },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={[styles.shiftDot, { backgroundColor: '#94A3B8' }]} />
                    <View>
                      <Text style={{ fontWeight: '700', color: '#64748B', fontSize: 14 }}>Day OFF (Weekly Rest)</Text>
                      <Text style={{ fontSize: 12, color: '#94A3B8' }}>Mark all selected days as OFF</Text>
                    </View>
                  </View>
                  {massTargetShiftId === 'OFF' && <CheckCircle2 size={18} color="#64748B" />}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setMassTargetShiftId(null)}
                  style={[
                    styles.shiftOption,
                    massTargetShiftId === null && { borderColor: '#166534', backgroundColor: '#F0FDF4', borderWidth: 2 },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <RotateCcw size={16} color="#166534" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: '#166534', fontSize: 14 }}>Reset to Fixed Default Shift</Text>
                      <Text style={{ fontSize: 12, color: '#15803D' }}>Clear date overrides; staff keeps their fixed default shift everyday</Text>
                    </View>
                  </View>
                  {massTargetShiftId === null && <CheckCircle2 size={18} color="#166534" />}
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text style={styles.inputLabel}>Apply to Schedule Scope</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TouchableOpacity
                  onPress={() => setMassTargetScope('all')}
                  style={[
                    styles.scopeBtn,
                    massTargetScope === 'all' && styles.scopeBtnActive,
                  ]}
                >
                  <Text style={[styles.scopeBtnText, massTargetScope === 'all' && styles.scopeBtnTextActive]}>
                    Entire Week (7 Days)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setMassTargetScope('weekdays')}
                  style={[
                    styles.scopeBtn,
                    massTargetScope === 'weekdays' && styles.scopeBtnActive,
                  ]}
                >
                  <Text style={[styles.scopeBtnText, massTargetScope === 'weekdays' && styles.scopeBtnTextActive]}>
                    Mon - Fri (5 Days)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setMassTargetScope('weekend')}
                  style={[
                    styles.scopeBtn,
                    massTargetScope === 'weekend' && styles.scopeBtnActive,
                  ]}
                >
                  <Text style={[styles.scopeBtnText, massTargetScope === 'weekend' && styles.scopeBtnTextActive]}>
                    Sat & Sun (Weekend)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => handleMassAssign(massTargetShiftId as any, massTargetScope)}
              disabled={massApplying}
              style={[styles.saveBtn, { backgroundColor: '#0D7377', marginTop: 10 }]}
            >
              {massApplying ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveBtnText}>
                  Apply to {selectedEmpIds.size} Selected Staff
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Add/Edit Shift Modal */}
        <Modal
          visible={addShiftOpen}
          onClose={() => setAddShiftOpen(false)}
          title={editingShiftId ? 'Edit Shift' : 'Create Shift Type'}
          maxWidth={480}
        >
          <View style={{ gap: 14, paddingBottom: 12 }}>
            <View>
              <Text style={styles.inputLabel}>Shift Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Night Operations Shift"
                value={newShiftName}
                onChangeText={setNewShiftName}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <TimePicker
                  label="Start Time"
                  value={newShiftStart}
                  onChange={setNewShiftStart}
                  format="HH:mm"
                  placeholder="09:00"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TimePicker
                  label="End Time"
                  value={newShiftEnd}
                  onChange={setNewShiftEnd}
                  format="HH:mm"
                  placeholder="17:00"
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
        </Modal>
      </ScrollView>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 24, paddingBottom: 64 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  breadcrumbMuted: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  breadcrumbActive: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '700',
  },
  eyebrowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F3EEFE',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  eyebrowText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 4,
    maxWidth: 620,
    lineHeight: 19,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refreshBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  headerPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9,
  },
  headerPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  pastelMetricCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValueText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricLabelText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  waveContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    opacity: 0.8,
  },

  viewModeTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    gap: 4,
    flexWrap: 'wrap',
  },
  viewTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
  },
  viewTabBtnActive: {
    backgroundColor: '#F3EEFE',
  },
  viewTabBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  viewTabBtnTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  unitFilterContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 12,
  },
  unitPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitFilterPillActive: {
    backgroundColor: '#FAF5FF',
    borderColor: '#C084FC',
  },
  unitFilterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  unitFilterPillTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  modernShiftRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  shiftDotLarge: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  shiftTitleModern: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  shiftSubModern: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  nightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3EEFE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nightBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  colHeaderLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  timePillModern: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  timePillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  allowancePillGreen: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  allowancePillGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  allowancePillMuted: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  allowancePillMutedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  shiftEditBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  shiftEditBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
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
  massActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#5EEAD4',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexWrap: 'wrap',
    gap: 12,
  },
  massBadge: {
    backgroundColor: '#0D7377',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  massBadgeText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
  },
  massBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  massBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  defaultShiftBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  defaultShiftBadgeText: {
    fontSize: 10,
    color: '#166534',
    fontWeight: '700',
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  scopeBtnActive: {
    backgroundColor: '#0D7377',
    borderColor: '#0D7377',
  },
  scopeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  scopeBtnTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
});
