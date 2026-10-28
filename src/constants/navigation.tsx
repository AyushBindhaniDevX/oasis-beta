import React from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Umbrella,
  CreditCard,
  MapPin,
  Settings,
  Shield,
  Key,
  Network,
  Award,
  CalendarClock,
  CalendarDays,
  Banknote,
  Briefcase,
  Receipt,
  Laptop,
  LifeBuoy,
  GraduationCap,
  FileText,
  Clock,
  BarChart3,
  Gift,
  Workflow,
  Building2,
  FileSpreadsheet,
} from 'lucide-react-native';
import type { UserRole } from '@/types';

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ElementType;
  feature?: string;
}

export const HR_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/(hr)/dashboard', icon: LayoutDashboard },
  { label: 'My Attendance', href: '/(employee)/attendance', icon: CalendarClock, feature: 'attendance' },
  { label: 'Users & Employees', href: '/(admin)/users', icon: Users, feature: 'users' },
  { label: 'Departments', href: '/(hr)/departments', icon: Network, feature: 'departments' },
  { label: 'Team Attendance', href: '/(hr)/attendance', icon: Calendar, feature: 'attendance' },
  { label: 'Leave', href: '/(hr)/leave', icon: Umbrella, feature: 'leave' },
  { label: 'Holiday Calendar', href: '/(hr)/holidays', icon: CalendarDays, feature: 'holidays' },
  { label: 'Shifts & Rosters', href: '/(hr)/shifts', icon: Clock, feature: 'shifts' },
  { label: 'Performance', href: '/(hr)/performance', icon: Award, feature: 'performance' },
  { label: 'Payroll', href: '/(hr)/payroll', icon: CreditCard, feature: 'payroll' },
  { label: 'Units / Sub-Brands', href: '/(hr)/locations', icon: Building2, feature: 'locations' },
];

export const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/(admin)/dashboard', icon: LayoutDashboard },
  { label: 'Central Portal', href: '/(admin)/portal', icon: Building2 },
  { label: 'My Attendance', href: '/(employee)/attendance', icon: CalendarClock, feature: 'attendance' },
  { label: 'Users & Employees', href: '/(admin)/users', icon: Users, feature: 'users' },
  { label: 'Departments', href: '/(hr)/departments', icon: Network, feature: 'departments' },
  { label: 'Team Attendance', href: '/(hr)/attendance', icon: Calendar, feature: 'attendance' },
  { label: 'Leave', href: '/(hr)/leave', icon: Umbrella, feature: 'leave' },
  { label: 'Holiday Calendar', href: '/(hr)/holidays', icon: CalendarDays, feature: 'holidays' },
  { label: 'Shifts & Rosters', href: '/(hr)/shifts', icon: Clock, feature: 'shifts' },
  { label: 'Performance', href: '/(hr)/performance', icon: Award, feature: 'performance' },
  { label: 'Payroll', href: '/(hr)/payroll', icon: CreditCard, feature: 'payroll' },
  { label: 'Units / Sub-Brands', href: '/(hr)/locations', icon: Building2, feature: 'locations' },
  { label: 'Audit Logs', href: '/(admin)/audit-logs', icon: Shield, feature: 'audit_logs' },
  { label: 'Approval Workflows', href: '/(admin)/approval-workflows', icon: Workflow },
  { label: 'Data Management', href: '/(admin)/data-management', icon: FileSpreadsheet },
  { label: 'Settings', href: '/(admin)/settings', icon: Settings },
];

export const EMPLOYEE_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/(employee)/dashboard', icon: LayoutDashboard },
  { label: 'Attendance', href: '/(employee)/attendance', icon: CalendarClock, feature: 'attendance' },
  { label: 'Leave', href: '/(employee)/leave', icon: CalendarDays, feature: 'leave' },
  { label: 'Holiday Calendar', href: '/(employee)/holidays', icon: CalendarDays, feature: 'holidays' },
  { label: 'Performance', href: '/(employee)/performance', icon: Award, feature: 'performance' },
  { label: 'Salary & Payslips', href: '/(employee)/payslips', icon: Banknote, feature: 'payroll' },
  { label: 'Directory', href: '/(employee)/directory', icon: Users, feature: 'users' },
];

export function getNavForRole(role?: UserRole | string | null, userEmail?: string | null): NavItem[] {
  if (role === 'admin') {
    if (userEmail !== 'ayushbindhani001@gmail.com') {
      return ADMIN_NAV.filter((item) => item.href !== '/(admin)/portal');
    }
    return ADMIN_NAV;
  }
  if (role === 'hr') return HR_NAV;
  return EMPLOYEE_NAV;
}
