import React from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet, Platform } from 'react-native';
import { HeartPulse, ShieldCheck, Stethoscope, Navigation, Check } from 'lucide-react-native';
import type { HHCRole } from '@/types';

interface HhcRoleSelectorProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  role: HHCRole;
  onRoleChange: (role: HHCRole) => void;
  colors: {
    surface: string;
    border: string;
    text: string;
    textSecondary: string;
    primary?: string;
  };
  title?: string;
  subtitle?: string;
}

export const HHC_ROLE_CONFIG: Record<
  HHCRole,
  {
    title: string;
    badge: string;
    badgeBg: string;
    badgeColor: string;
    activeBorder: string;
    activeBg: string;
    tagline: string;
    description: string;
  }
> = {
  supervisor: {
    title: 'Supervisor',
    badge: 'DISPATCH & OPS',
    badgeBg: '#EEF2FF',
    badgeColor: '#4F46E5',
    activeBorder: '#6366F1',
    activeBg: '#F5F3FF',
    tagline: 'Coordinator & Lead',
    description: 'Manages patient lead dispatch, assigns clinical staff, oversees schedules & finalizes billing.',
  },
  doctor: {
    title: 'Doctor',
    badge: 'CLINICAL ASSESSOR',
    badgeBg: '#CCFBF1',
    badgeColor: '#0F766E',
    activeBorder: '#0D7377',
    activeBg: '#F0FDF4',
    tagline: 'Consulting Physician',
    description: 'Evaluates patient vitals, conducts teleconsultations, diagnoses & signs off on clinical care plans.',
  },
  field_worker: {
    title: 'Field Worker',
    badge: 'DOORSTEP CARE',
    badgeBg: '#E0F2FE',
    badgeColor: '#0369A1',
    activeBorder: '#0284C7',
    activeBg: '#F0F9FF',
    tagline: 'Paramedic & Nurse',
    description: 'Executes home visits, doorstep GPS geofence clock-in/out, emergency care & vitals capture.',
  },
};

export const HhcRoleSelector: React.FC<HhcRoleSelectorProps> = ({
  enabled,
  onEnabledChange,
  role = 'field_worker',
  onRoleChange,
  colors,
  title = 'Home Health Care (HHC) Portal',
  subtitle = 'Enable clinical dispatch and patient care visits in Cordelia Care portal.',
}) => {
  const currentConfig = HHC_ROLE_CONFIG[role] || HHC_ROLE_CONFIG.field_worker;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: enabled ? currentConfig.activeBorder : colors.border }]}>
      {/* Main Switch Header */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onEnabledChange(!enabled)}
        style={styles.headerRow}
      >
        <View style={styles.headerInfo}>
          <View style={styles.headerTitleWrap}>
            <HeartPulse size={19} color={enabled ? currentConfig.activeBorder : '#64748B'} />
            <Text style={[styles.headerTitle, { color: enabled ? currentConfig.activeBorder : colors.text }]}>
              {title}
            </Text>
            {enabled && (
              <View style={[styles.activeRolePill, { backgroundColor: currentConfig.badgeBg }]}>
                <Text style={[styles.activeRolePillText, { color: currentConfig.badgeColor }]}>
                  {currentConfig.badge}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        </View>

        <Switch
          value={enabled}
          onValueChange={onEnabledChange}
          trackColor={{ false: '#E2E8F0', true: currentConfig.activeBorder }}
          thumbColor="#FFFFFF"
        />
      </TouchableOpacity>

      {/* Seamless Role Options (Visible when enabled) */}
      {enabled && (
        <View style={styles.rolesSection}>
          <View style={styles.divider} />
          
          <View style={styles.rolesPromptRow}>
            <Text style={[styles.rolesPromptText, { color: colors.textSecondary }]}>
              SELECT HHC CLINICAL ROLE FOR THIS STAFF MEMBER:
            </Text>
            <Text style={[styles.rolesPromptSub, { color: currentConfig.badgeColor }]}>
              {currentConfig.title} Selected
            </Text>
          </View>

          <View style={styles.rolesGrid}>
            {/* 1. Supervisor */}
            <RoleCard
              id="supervisor"
              title="Supervisor"
              tagline="Operations & Dispatch"
              description="Full dispatch oversight, patient lead triage, staff assignment, visit audits & billing."
              isSelected={role === 'supervisor'}
              icon={<ShieldCheck size={20} color={role === 'supervisor' ? '#4F46E5' : '#64748B'} />}
              activeColor="#4F46E5"
              activeBg="#EEF2FF"
              onSelect={() => onRoleChange('supervisor')}
              colors={colors}
            />

            {/* 2. Doctor */}
            <RoleCard
              id="doctor"
              title="Doctor"
              tagline="Clinical Specialist"
              description="Clinical evaluations, vitals assessments, prescriptions, teleconsults & care plan approvals."
              isSelected={role === 'doctor'}
              icon={<Stethoscope size={20} color={role === 'doctor' ? '#0F766E' : '#64748B'} />}
              activeColor="#0D7377"
              activeBg="#F0FDF4"
              onSelect={() => onRoleChange('doctor')}
              colors={colors}
            />

            {/* 3. Field Worker */}
            <RoleCard
              id="field_worker"
              title="Field Worker"
              tagline="Paramedic & Home Nurse"
              description="On-site doorstep visits, GPS-geofenced clock in/out, emergency visits & vitals recording."
              isSelected={role === 'field_worker'}
              icon={<Navigation size={20} color={role === 'field_worker' ? '#0284C7' : '#64748B'} />}
              activeColor="#0284C7"
              activeBg="#F0F9FF"
              onSelect={() => onRoleChange('field_worker')}
              colors={colors}
            />
          </View>
        </View>
      )}
    </View>
  );
};

interface RoleCardProps {
  id: HHCRole;
  title: string;
  tagline: string;
  description: string;
  isSelected: boolean;
  icon: React.ReactNode;
  activeColor: string;
  activeBg: string;
  onSelect: () => void;
  colors: {
    border: string;
    text: string;
    textSecondary: string;
  };
}

const RoleCard: React.FC<RoleCardProps> = ({
  title,
  tagline,
  description,
  isSelected,
  icon,
  activeColor,
  activeBg,
  onSelect,
  colors,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onSelect}
      style={[
        styles.roleCard,
        {
          borderColor: isSelected ? activeColor : colors.border,
          backgroundColor: isSelected ? activeBg : '#FFFFFF',
          borderWidth: isSelected ? 2 : 1,
        },
      ]}
    >
      <View style={styles.roleCardHeader}>
        <View style={styles.roleCardIconWrap}>
          <View style={[styles.roleIconCircle, { backgroundColor: isSelected ? '#FFFFFF' : '#F1F5F9' }]}>
            {icon}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.roleCardTitle, { color: isSelected ? activeColor : colors.text }]}>
                {title}
              </Text>
            </View>
            <Text style={[styles.roleCardTagline, { color: colors.textSecondary }]}>
              {tagline}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.radioCircle,
            {
              borderColor: isSelected ? activeColor : '#CBD5E1',
              backgroundColor: isSelected ? activeColor : 'transparent',
            },
          ]}
        >
          {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
        </View>
      </View>

      <Text style={[styles.roleCardDesc, { color: colors.textSecondary }]}>
        {description}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    borderRadius: 14,
    marginVertical: 10,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerInfo: {
    flex: 1,
    paddingRight: 14,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  activeRolePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeRolePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  rolesSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  rolesPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 4,
  },
  rolesPromptText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rolesPromptSub: {
    fontSize: 11,
    fontWeight: '700',
  },
  rolesGrid: {
    gap: 10,
  },
  roleCard: {
    borderRadius: 12,
    padding: 12,
  },
  roleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  roleCardIconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  roleIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  roleCardTagline: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  roleCardDesc: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
});

