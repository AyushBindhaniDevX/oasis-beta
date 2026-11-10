import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ScrollView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/utils/format';
import { Modal } from './Modal';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  AlertCircle,
  Sparkles,
} from 'lucide-react-native';

export interface DatePickerPreset {
  label: string;
  value: Date;
}

export interface DatePickerProps {
  label?: string;
  value: Date | string | null;
  onChange: (date: Date | null) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  clearable?: boolean;
  required?: boolean;
  validate?: (date: Date) => string | undefined;
  style?: StyleProp<ViewStyle>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/**
 * Modern DatePicker Component
 * Inspired by rsuite with direct calendar popover, quick presets, month/year jumper,
 * keyboard text input fallback, and real-time min/max range validation.
 */
export function DatePicker({
  label,
  value,
  onChange,
  error,
  helperText,
  placeholder = 'Select date (YYYY-MM-DD)',
  minDate,
  maxDate,
  disabled = false,
  clearable = true,
  required = false,
  validate,
  style,
}: DatePickerProps) {
  const colors = useTheme();

  const parseValue = (val: Date | string | null): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const selectedDate = useMemo(() => parseValue(value), [value]);
  const [show, setShow] = useState(false);
  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');

  const [currentYear, setCurrentYear] = useState(
    (selectedDate || new Date()).getFullYear()
  );
  const [currentMonth, setCurrentMonth] = useState(
    (selectedDate || new Date()).getMonth()
  );
  const [tempSelectedDay, setTempSelectedDay] = useState<number | null>(
    selectedDate ? selectedDate.getDate() : null
  );

  const [directDateInput, setDirectDateInput] = useState('');
  const [internalError, setInternalError] = useState<string | null>(null);

  const handleOpen = () => {
    if (disabled) return;
    const base = selectedDate || new Date();
    setCurrentYear(base.getFullYear());
    setCurrentMonth(base.getMonth());
    setTempSelectedDay(selectedDate ? selectedDate.getDate() : null);
    setDirectDateInput(selectedDate ? formatDate(selectedDate) : '');
    setInternalError(null);
    setViewMode('days');
    setShow(true);
  };

  const handleClear = (e?: any) => {
    e?.stopPropagation?.();
    onChange(null);
    setInternalError(null);
  };

  // Calendar Calculation
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  // Adjust so Monday = 0, Sunday = 6
  const startOffset = (firstDayOfMonth + 6) % 7;
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const prevMonthDays = Array.from({ length: startOffset }, (_, i) => daysInPrevMonth - startOffset + i + 1);
  const currentMonthDays = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

  const totalCells = prevMonthDays.length + currentMonthDays.length;
  const nextMonthDaysCount = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  const nextMonthDays = Array.from({ length: nextMonthDaysCount }, (_, i) => i + 1);

  const today = new Date();
  const isToday = (day: number) =>
    today.getDate() === day &&
    today.getMonth() === currentMonth &&
    today.getFullYear() === currentYear;

  const isSelected = (day: number) =>
    selectedDate &&
    selectedDate.getDate() === day &&
    selectedDate.getMonth() === currentMonth &&
    selectedDate.getFullYear() === currentYear;

  const isTempSelected = (day: number) => tempSelectedDay === day;

  // Range validation helper
  const isDayDisabled = (day: number) => {
    const targetDate = new Date(currentYear, currentMonth, day, 23, 59, 59);
    if (minDate && targetDate < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate(), 0, 0, 0)) {
      return true;
    }
    const targetDateStart = new Date(currentYear, currentMonth, day, 0, 0, 0);
    if (maxDate && targetDateStart > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59)) {
      return true;
    }
    return false;
  };

  const validateTargetDate = (d: Date): string | null => {
    if (minDate && d < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate(), 0, 0, 0)) {
      return `Date cannot be earlier than ${formatDate(minDate)}`;
    }
    if (maxDate && d > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59)) {
      return `Date cannot be later than ${formatDate(maxDate)}`;
    }
    if (validate) {
      const customErr = validate(d);
      if (customErr) return customErr;
    }
    return null;
  };

  const handleSelectDay = (day: number) => {
    if (isDayDisabled(day)) return;
    setTempSelectedDay(day);
    const candidate = new Date(currentYear, currentMonth, day);
    setDirectDateInput(formatDate(candidate));
    const err = validateTargetDate(candidate);
    setInternalError(err);
  };

  const handleApply = () => {
    const day = tempSelectedDay || (selectedDate ? selectedDate.getDate() : 1);
    const newDate = new Date(currentYear, currentMonth, day);
    const err = validateTargetDate(newDate);
    if (err) {
      setInternalError(err);
      return;
    }
    onChange(newDate);
    setShow(false);
  };

  const handleQuickPreset = (preset: 'today' | 'tomorrow' | 'nextWeek' | 'endOfMonth') => {
    const d = new Date();
    if (preset === 'today') {
      // today
    } else if (preset === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    } else if (preset === 'nextWeek') {
      d.setDate(d.getDate() + 7);
    } else if (preset === 'endOfMonth') {
      d.setMonth(d.getMonth() + 1, 0);
    }
    const err = validateTargetDate(d);
    if (err) {
      setInternalError(err);
      return;
    }
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
    setTempSelectedDay(d.getDate());
    onChange(d);
    setShow(false);
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleDirectInputSubmit = () => {
    if (!directDateInput.trim()) return;
    const parsed = new Date(directDateInput.trim());
    if (isNaN(parsed.getTime())) {
      setInternalError('Please enter a valid date in YYYY-MM-DD format');
      return;
    }
    const err = validateTargetDate(parsed);
    if (err) {
      setInternalError(err);
      return;
    }
    setCurrentYear(parsed.getFullYear());
    setCurrentMonth(parsed.getMonth());
    setTempSelectedDay(parsed.getDate());
    onChange(parsed);
    setShow(false);
  };

  const startYearRange = Math.floor(currentYear / 12) * 12;
  const yearsList = Array.from({ length: 12 }, (_, i) => startYearRange + i);

  const activeError = error || internalError;

  return (
    <View style={[styles.container, style]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
          {required && <Text style={styles.requiredDot}>*</Text>}
        </View>
      )}

      {/* Modern Trigger Box */}
      <TouchableOpacity
        onPress={handleOpen}
        disabled={disabled}
        activeOpacity={0.75}
        style={[
          styles.trigger,
          {
            backgroundColor: disabled ? '#F8FAFC' : '#FFFFFF',
            borderColor: activeError ? '#EF4444' : show ? '#7C3AED' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.triggerLeft}>
          <View style={styles.calIconWrap}>
            <CalendarIcon size={16} color="#7C3AED" />
          </View>
          <Text
            style={[
              styles.valueText,
              { color: selectedDate ? '#0F172A' : '#94A3B8' },
            ]}
          >
            {selectedDate ? formatDate(selectedDate) : placeholder}
          </Text>
        </View>

        <View style={styles.triggerRight}>
          {clearable && selectedDate && !disabled && (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearBtn}
            >
              <X size={14} color="#94A3B8" />
            </TouchableOpacity>
          )}
          <ChevronDown size={15} color="#64748B" />
        </View>
      </TouchableOpacity>

      {/* Error or Helper message */}
      {activeError ? (
        <View style={styles.feedbackRow}>
          <AlertCircle size={13} color="#EF4444" />
          <Text style={styles.errorText}>{activeError}</Text>
        </View>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}

      <Modal visible={show} onClose={() => setShow(false)} title="Select Date" maxWidth={440}>
        <View style={styles.modalContent}>
          {/* Quick Presets Bar */}
          <View style={styles.presetBar}>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => handleQuickPreset('today')}
              activeOpacity={0.7}
            >
              <Sparkles size={11} color="#7C3AED" />
              <Text style={styles.presetBtnText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => handleQuickPreset('tomorrow')}
              activeOpacity={0.7}
            >
              <Text style={styles.presetBtnText}>Tomorrow</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => handleQuickPreset('nextWeek')}
              activeOpacity={0.7}
            >
              <Text style={styles.presetBtnText}>+7 Days</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => handleQuickPreset('endOfMonth')}
              activeOpacity={0.7}
            >
              <Text style={styles.presetBtnText}>Month End</Text>
            </TouchableOpacity>
          </View>

          {/* Direct Typing Row */}
          <View style={styles.directInputRow}>
            <View style={styles.directInputWrap}>
              <TextInput
                value={directDateInput}
                onChangeText={setDirectDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                style={styles.directInputText}
                onSubmitEditing={handleDirectInputSubmit}
              />
            </View>
            <TouchableOpacity
              onPress={handleDirectInputSubmit}
              style={styles.directInputBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.directInputBtnText}>Jump</Text>
            </TouchableOpacity>
          </View>

          {/* Calendar Header Nav */}
          <View style={styles.headerNav}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrow} activeOpacity={0.7}>
              <ChevronLeft size={18} color="#475569" />
            </TouchableOpacity>

            <View style={styles.headerTitleRow}>
              <TouchableOpacity
                onPress={() => setViewMode(viewMode === 'months' ? 'days' : 'months')}
                style={[styles.headerDropdown, viewMode === 'months' && styles.headerDropdownActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.headerMonthText, viewMode === 'months' && { color: '#7C3AED' }]}>
                  {MONTH_NAMES[currentMonth]}
                </Text>
                <ChevronDown size={13} color={viewMode === 'months' ? '#7C3AED' : '#64748B'} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setViewMode(viewMode === 'years' ? 'days' : 'years')}
                style={[styles.headerDropdown, viewMode === 'years' && styles.headerDropdownActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.headerYearText, viewMode === 'years' && { color: '#7C3AED' }]}>
                  {currentYear}
                </Text>
                <ChevronDown size={13} color={viewMode === 'years' ? '#7C3AED' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleNextMonth} style={styles.navArrow} activeOpacity={0.7}>
              <ChevronRight size={18} color="#475569" />
            </TouchableOpacity>
          </View>

          {/* Months View */}
          {viewMode === 'months' && (
            <View style={styles.monthsGrid}>
              {MONTH_SHORT.map((m, idx) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => {
                    setCurrentMonth(idx);
                    setViewMode('days');
                  }}
                  style={[
                    styles.monthItem,
                    idx === currentMonth && { backgroundColor: '#7C3AED' },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.monthItemText,
                      idx === currentMonth && { color: '#FFFFFF', fontWeight: '800' },
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Years View */}
          {viewMode === 'years' && (
            <View style={styles.yearsGrid}>
              {yearsList.map((y) => (
                <TouchableOpacity
                  key={y}
                  onPress={() => {
                    setCurrentYear(y);
                    setViewMode('days');
                  }}
                  style={[
                    styles.yearItem,
                    y === currentYear && { backgroundColor: '#7C3AED' },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.yearItemText,
                      y === currentYear && { color: '#FFFFFF', fontWeight: '800' },
                    ]}
                  >
                    {y}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Standard Days View */}
          {viewMode === 'days' && (
            <View style={styles.daysContainer}>
              {/* Weekday Labels */}
              <View style={styles.weekdayRow}>
                {WEEKDAYS.map((w, idx) => (
                  <Text
                    key={w}
                    style={[
                      styles.weekdayText,
                      (idx === 5 || idx === 6) && { color: '#F97316' },
                    ]}
                  >
                    {w}
                  </Text>
                ))}
              </View>

              {/* Grid of Days */}
              <View style={styles.calendarGrid}>
                {/* Previous Month Inactive Days */}
                {prevMonthDays.map((d, i) => (
                  <View key={`prev-${i}`} style={styles.dayCell}>
                    <Text style={styles.inactiveDayText}>{d}</Text>
                  </View>
                ))}

                {/* Current Month Days */}
                {currentMonthDays.map((d) => {
                  const active = isTempSelected(d) || (tempSelectedDay === null && isSelected(d));
                  const todayDay = isToday(d);
                  const disabledDay = isDayDisabled(d);

                  return (
                    <TouchableOpacity
                      key={`cur-${d}`}
                      disabled={disabledDay}
                      onPress={() => handleSelectDay(d)}
                      style={[
                        styles.dayCell,
                        todayDay && styles.todayCell,
                        active && styles.activeDayCell,
                        disabledDay && styles.disabledDayCell,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          todayDay && styles.todayDayText,
                          active && styles.activeDayText,
                          disabledDay && styles.disabledDayText,
                        ]}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Next Month Inactive Days */}
                {nextMonthDays.map((d, i) => (
                  <View key={`next-${i}`} style={styles.dayCell}>
                    <Text style={styles.inactiveDayText}>{d}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Validation Error in Modal */}
          {internalError && (
            <View style={styles.modalErrorBox}>
              <AlertCircle size={14} color="#DC2626" />
              <Text style={styles.modalErrorText}>{internalError}</Text>
            </View>
          )}

          {/* Action Bar Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShow(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.applyBtn}
              onPress={handleApply}
              activeOpacity={0.85}
            >
              <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.applyBtnText}>Apply Selection</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 6 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  requiredDot: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  calIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  triggerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearBtn: {
    padding: 2,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },

  /* Modal Interior */
  modalContent: {
    padding: 6,
    gap: 12,
  },
  presetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  presetBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#7C3AED',
  },

  directInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  directInputWrap: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  directInputText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
  directInputBtn: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directInputBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },

  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  navArrow: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  headerDropdownActive: {
    backgroundColor: '#FAF5FF',
  },
  headerMonthText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerYearText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },

  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  monthItem: {
    width: '31%',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },

  yearsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  yearItem: {
    width: '31%',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },

  daysContainer: {
    gap: 6,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  weekdayText: {
    width: 36,
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 2,
  },
  dayCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1E293B',
  },
  inactiveDayText: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  todayCell: {
    borderWidth: 1.5,
    borderColor: '#7C3AED',
  },
  todayDayText: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  activeDayCell: {
    backgroundColor: '#7C3AED',
  },
  activeDayText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  disabledDayCell: {
    opacity: 0.35,
  },
  disabledDayText: {
    color: '#94A3B8',
  },

  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    padding: 10,
    borderRadius: 10,
  },
  modalErrorText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 6,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default DatePicker;
