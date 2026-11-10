import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {
  Clock,
  ChevronDown,
  X,
  Check,
  AlertCircle,
  RotateCcw,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/use-theme';
import { Modal } from './Modal';
import { InteractiveTile } from './InteractiveTile';

export interface TimePickerPreset {
  label: string;
  value: string; // "HH:mm"
}

export interface TimePickerProps {
  label?: string;
  value?: string | Date | null;
  onChange?: (time: string, dateObj?: Date) => void;
  format?: 'HH:mm' | 'hh:mm a' | 'HH:mm:ss' | 'hh:mm:ss a';
  placeholder?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  clearable?: boolean;
  minTime?: string; // "HH:mm"
  maxTime?: string; // "HH:mm"
  stepMinutes?: number; // 1, 5, 10, 15, 30
  is24Hour?: boolean;
  presets?: TimePickerPreset[];
  validate?: (time: string) => string | undefined;
  style?: StyleProp<ViewStyle>;
  required?: boolean;
}

const DEFAULT_PRESETS: TimePickerPreset[] = [
  { label: 'Morning (09:00)', value: '09:00' },
  { label: 'Midday (13:00)', value: '13:00' },
  { label: 'Shift End (18:00)', value: '18:00' },
  { label: 'Night (21:00)', value: '21:00' },
];

/**
 * Parses time input into normalized { hours: number, minutes: number, seconds: number }
 */
function parseTimeToParts(val: string | Date | null | undefined): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  if (!val) {
    const now = new Date();
    return { hours: now.getHours(), minutes: now.getMinutes(), seconds: 0 };
  }
  if (val instanceof Date) {
    return { hours: val.getHours(), minutes: val.getMinutes(), seconds: val.getSeconds() };
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // Check for 12h format e.g. "09:30 PM"
    const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = parseInt(match12[2], 10);
      const s = match12[3] ? parseInt(match12[3], 10) : 0;
      const meridiem = match12[4]?.toUpperCase();
      if (meridiem === 'PM' && h < 12) h += 12;
      if (meridiem === 'AM' && h === 12) h = 0;
      return {
        hours: Math.min(23, Math.max(0, isNaN(h) ? 9 : h)),
        minutes: Math.min(59, Math.max(0, isNaN(m) ? 0 : m)),
        seconds: Math.min(59, Math.max(0, isNaN(s) ? 0 : s)),
      };
    }
  }
  return { hours: 9, minutes: 0, seconds: 0 };
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Format hours & minutes into target string representation
 */
function formatTimeOutput(
  hours: number,
  minutes: number,
  is24h: boolean,
  includeSeconds = false
): string {
  if (is24h) {
    const base = `${pad2(hours)}:${pad2(minutes)}`;
    return includeSeconds ? `${base}:00` : base;
  }
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  let h12 = hours % 12;
  if (h12 === 0) h12 = 12;
  const base = `${pad2(h12)}:${pad2(minutes)} ${meridiem}`;
  return includeSeconds ? `${pad2(h12)}:${pad2(minutes)}:00 ${meridiem}` : base;
}

function timeToMinutes(timeStr: string): number {
  const { hours, minutes } = parseTimeToParts(timeStr);
  return hours * 60 + minutes;
}

/**
 * Modern TimePicker Component
 * Inspired by rsuite's clean multi-column selector, with quick presets, 
 * 12h/24h toggle, interactive hour/minute scrolling, direct typing input,
 * and built-in validation for enterprise HCM applications.
 */
export function TimePicker({
  label,
  value,
  onChange,
  format = 'HH:mm',
  placeholder = 'Select time',
  error,
  helperText,
  disabled = false,
  clearable = true,
  minTime,
  maxTime,
  stepMinutes = 5,
  is24Hour: propIs24Hour,
  presets = DEFAULT_PRESETS,
  validate,
  style,
  required = false,
}: TimePickerProps) {
  const colors = useTheme();

  // Determine initial 24h mode
  const default24h = propIs24Hour !== undefined ? propIs24Hour : !format.includes('a') && !format.includes('A');
  const [use24h, setUse24h] = useState(default24h);
  const [showModal, setShowModal] = useState(false);

  // Current selection in modal
  const initialParts = useMemo(() => parseTimeToParts(value), [value]);
  const [tempHours, setTempHours] = useState(initialParts.hours);
  const [tempMinutes, setTempMinutes] = useState(initialParts.minutes);
  const [manualInput, setManualInput] = useState('');
  const [internalError, setInternalError] = useState<string | null>(null);

  // Sync state when modal opens
  const handleOpen = () => {
    if (disabled) return;
    const parts = parseTimeToParts(value);
    setTempHours(parts.hours);
    setTempMinutes(parts.minutes);
    setManualInput(value ? formatTimeOutput(parts.hours, parts.minutes, use24h) : '');
    setInternalError(null);
    setShowModal(true);
  };

  // Convert 24h hours to 12h representation for UI
  const display12h = useMemo(() => {
    let h = tempHours % 12;
    if (h === 0) h = 12;
    const meridiem = tempHours >= 12 ? 'PM' : 'AM';
    return { hour12: h, meridiem };
  }, [tempHours]);

  // Validation logic
  const validateSelection = (h: number, m: number): string | null => {
    const totalMins = h * 60 + m;
    if (minTime) {
      const minMins = timeToMinutes(minTime);
      if (totalMins < minMins) {
        return `Time cannot be earlier than ${minTime}`;
      }
    }
    if (maxTime) {
      const maxMins = timeToMinutes(maxTime);
      if (totalMins > maxMins) {
        return `Time cannot be later than ${maxTime}`;
      }
    }
    const formatted = formatTimeOutput(h, m, true);
    if (validate) {
      const customErr = validate(formatted);
      if (customErr) return customErr;
    }
    return null;
  };

  const handleApply = (h = tempHours, m = tempMinutes) => {
    const err = validateSelection(h, m);
    if (err) {
      setInternalError(err);
      return;
    }
    const resultStr = formatTimeOutput(h, m, default24h);
    const dateObj = new Date();
    dateObj.setHours(h, m, 0, 0);
    onChange?.(resultStr, dateObj);
    setShowModal(false);
  };

  const handleClear = (e?: any) => {
    e?.stopPropagation?.();
    onChange?.('', undefined);
    setInternalError(null);
  };

  const handleSelectPreset = (presetValue: string) => {
    const parts = parseTimeToParts(presetValue);
    setTempHours(parts.hours);
    setTempMinutes(parts.minutes);
    setManualInput(presetValue);
    handleApply(parts.hours, parts.minutes);
  };

  const handleSelectNow = () => {
    const now = new Date();
    setTempHours(now.getHours());
    setTempMinutes(now.getMinutes());
    setManualInput(formatTimeOutput(now.getHours(), now.getMinutes(), use24h));
  };

  const handleManualInputSubmit = () => {
    const parts = parseTimeToParts(manualInput);
    setTempHours(parts.hours);
    setTempMinutes(parts.minutes);
    handleApply(parts.hours, parts.minutes);
  };

  // Hours list (24 or 12)
  const hoursList = useMemo(() => {
    if (use24h) {
      return Array.from({ length: 24 }, (_, i) => i);
    }
    return Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i));
  }, [use24h]);

  // Minutes list
  const minutesList = useMemo(() => {
    const step = stepMinutes || 5;
    const list: number[] = [];
    for (let m = 0; m < 60; m += step) {
      list.push(m);
    }
    return list;
  }, [stepMinutes]);

  // Formatted trigger value
  const displayTriggerValue = useMemo(() => {
    if (!value) return null;
    const parts = parseTimeToParts(value);
    return formatTimeOutput(parts.hours, parts.minutes, default24h);
  }, [default24h, value]);

  const activeError = error || internalError;

  return (
    <View style={[s.container, style]}>
      {label && (
        <View style={s.labelRow}>
          <Text style={[s.label, { color: colors.text }]}>{label}</Text>
          {required && <Text style={s.requiredDot}>*</Text>}
        </View>
      )}

      {/* Trigger Button Input */}
      <TouchableOpacity
        onPress={handleOpen}
        disabled={disabled}
        activeOpacity={0.75}
        style={[
          s.trigger,
          {
            backgroundColor: disabled ? '#F8FAFC' : '#FFFFFF',
            borderColor: activeError ? '#EF4444' : showModal ? '#7C3AED' : '#E2E8F0',
          },
        ]}
      >
        <View style={s.triggerLeft}>
          <View style={[s.iconPill, { backgroundColor: '#EDE9FE' }]}>
            <Clock size={16} color="#7C3AED" />
          </View>
          <Text
            style={[
              s.valueText,
              { color: displayTriggerValue ? '#0F172A' : '#94A3B8' },
            ]}
          >
            {displayTriggerValue || placeholder}
          </Text>
        </View>

        <View style={s.triggerRight}>
          {clearable && displayTriggerValue && !disabled && (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={s.clearBtn}
            >
              <X size={14} color="#94A3B8" />
            </TouchableOpacity>
          )}
          <ChevronDown size={15} color="#64748B" />
        </View>
      </TouchableOpacity>

      {/* Error or Helper Text */}
      {activeError ? (
        <View style={s.feedbackRow}>
          <AlertCircle size={13} color="#EF4444" />
          <Text style={s.errorText}>{activeError}</Text>
        </View>
      ) : helperText ? (
        <Text style={s.helperText}>{helperText}</Text>
      ) : null}

      {/* Modal / Popover Selector */}
      <Modal visible={showModal} onClose={() => setShowModal(false)} maxWidth={440}>
        <View style={s.modalContainer}>
          {/* Header with Title and 12h/24h Switch */}
          <View style={s.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[s.iconPill, { backgroundColor: '#EDE9FE', width: 28, height: 28 }]}>
                <Clock size={15} color="#7C3AED" />
              </View>
              <Text style={s.modalTitle}>{label || 'Select Time'}</Text>
            </View>

            {/* 12h / 24h Toggle Pill */}
            <View style={s.formatToggle}>
              <TouchableOpacity
                onPress={() => setUse24h(false)}
                style={[s.formatOption, !use24h && s.formatOptionActive]}
              >
                <Text style={[s.formatOptionText, !use24h && s.formatOptionTextActive]}>12h</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setUse24h(true)}
                style={[s.formatOption, use24h && s.formatOptionActive]}
              >
                <Text style={[s.formatOptionText, use24h && s.formatOptionTextActive]}>24h</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Presets Bar */}
          {presets && presets.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.presetsScroll}
            >
              {presets.map((p, idx) => (
                <TouchableOpacity
                  key={`preset-${idx}`}
                  style={s.presetPill}
                  onPress={() => handleSelectPreset(p.value)}
                  activeOpacity={0.7}
                >
                  <Sparkles size={11} color="#7C3AED" />
                  <Text style={s.presetPillText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Big Digital Display Banner */}
          <View style={s.digitalDisplayCard}>
            <View style={s.digitalTimeRow}>
              <View style={s.digitalSegment}>
                <Text style={s.digitalNumber}>
                  {pad2(use24h ? tempHours : display12h.hour12)}
                </Text>
                <Text style={s.digitalSub}>HOURS</Text>
              </View>

              <Text style={s.digitalColon}>:</Text>

              <View style={s.digitalSegment}>
                <Text style={s.digitalNumber}>{pad2(tempMinutes)}</Text>
                <Text style={s.digitalSub}>MINUTES</Text>
              </View>

              {!use24h && (
                <View style={[s.meridiemTag, { backgroundColor: '#7C3AED' }]}>
                  <Text style={s.meridiemTagText}>{display12h.meridiem}</Text>
                </View>
              )}
            </View>

            {/* Quick "Now" button */}
            <TouchableOpacity onPress={handleSelectNow} style={s.nowBtn} activeOpacity={0.7}>
              <RotateCcw size={12} color="#7C3AED" />
              <Text style={s.nowBtnText}>Now</Text>
            </TouchableOpacity>
          </View>

          {/* Columns Selector */}
          <View style={s.columnsRow}>
            {/* Hours Column */}
            <View style={s.columnCol}>
              <Text style={s.columnHeader}>Hours</Text>
              <ScrollView
                style={s.columnScroll}
                contentContainerStyle={s.columnScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {hoursList.map((h) => {
                  let isSelected = false;
                  if (use24h) {
                    isSelected = tempHours === h;
                  } else {
                    isSelected = display12h.hour12 === h;
                  }

                  return (
                    <TouchableOpacity
                      key={`hour-${h}`}
                      style={[s.unitPill, isSelected && s.unitPillActive]}
                      onPress={() => {
                        if (use24h) {
                          setTempHours(h);
                        } else {
                          const isPm = display12h.meridiem === 'PM';
                          let actual = h % 12;
                          if (isPm) actual += 12;
                          setTempHours(actual);
                        }
                      }}
                    >
                      <Text style={[s.unitPillText, isSelected && s.unitPillTextActive]}>
                        {pad2(h)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Minutes Column */}
            <View style={s.columnCol}>
              <Text style={s.columnHeader}>Minutes</Text>
              <ScrollView
                style={s.columnScroll}
                contentContainerStyle={s.columnScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {minutesList.map((m) => {
                  const isSelected = tempMinutes === m;
                  return (
                    <TouchableOpacity
                      key={`min-${m}`}
                      style={[s.unitPill, isSelected && s.unitPillActive]}
                      onPress={() => setTempMinutes(m)}
                    >
                      <Text style={[s.unitPillText, isSelected && s.unitPillTextActive]}>
                        {pad2(m)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* AM / PM Column (12h mode only) */}
            {!use24h && (
              <View style={[s.columnCol, { flex: 0.9 }]}>
                <Text style={s.columnHeader}>Period</Text>
                <View style={s.meridiemCol}>
                  <TouchableOpacity
                    style={[s.meridiemPill, display12h.meridiem === 'AM' && s.unitPillActive]}
                    onPress={() => {
                      if (tempHours >= 12) setTempHours(tempHours - 12);
                    }}
                  >
                    <Text
                      style={[
                        s.meridiemPillText,
                        display12h.meridiem === 'AM' && s.unitPillTextActive,
                      ]}
                    >
                      AM
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.meridiemPill, display12h.meridiem === 'PM' && s.unitPillActive]}
                    onPress={() => {
                      if (tempHours < 12) setTempHours(tempHours + 12);
                    }}
                  >
                    <Text
                      style={[
                        s.meridiemPillText,
                        display12h.meridiem === 'PM' && s.unitPillTextActive,
                      ]}
                    >
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Direct Keyboard Entry Row (Desktop & Power Users) */}
          <View style={s.directInputRow}>
            <View style={s.directInputWrap}>
              <TextInput
                value={manualInput}
                onChangeText={setManualInput}
                placeholder={use24h ? 'e.g. 09:30' : 'e.g. 09:30 AM'}
                placeholderTextColor="#94A3B8"
                style={s.directInputText}
                onSubmitEditing={handleManualInputSubmit}
              />
            </View>
            <TouchableOpacity
              onPress={handleManualInputSubmit}
              style={s.directInputBtn}
              activeOpacity={0.8}
            >
              <Text style={s.directInputBtnText}>Set</Text>
            </TouchableOpacity>
          </View>

          {/* Validation Error Banner in Modal */}
          {internalError && (
            <View style={s.modalErrorBox}>
              <AlertCircle size={14} color="#DC2626" />
              <Text style={s.modalErrorText}>{internalError}</Text>
            </View>
          )}

          {/* Footer Action Buttons */}
          <View style={s.modalFooter}>
            <TouchableOpacity
              onPress={() => setShowModal(false)}
              style={s.cancelBtn}
              activeOpacity={0.8}
            >
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleApply()}
              style={s.confirmBtn}
              activeOpacity={0.85}
            >
              <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={s.confirmBtnText}>Apply Time</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  requiredDot: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
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
  iconPill: {
    width: 28,
    height: 28,
    borderRadius: 8,
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
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500',
  },
  helperText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },

  /* Modal Interior */
  modalContainer: {
    padding: 6,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  formatToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  formatOption: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  formatOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  formatOptionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  formatOptionTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  /* Presets */
  presetsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  presetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  presetPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#7C3AED',
  },

  /* Digital Display Card */
  digitalDisplayCard: {
    backgroundColor: '#FAF9FD',
    borderWidth: 1,
    borderColor: '#E4DCFD',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  digitalTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  digitalSegment: {
    alignItems: 'center',
  },
  digitalNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E1B4B',
    letterSpacing: -0.5,
  },
  digitalSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8B5CF6',
    letterSpacing: 0.5,
    marginTop: -2,
  },
  digitalColon: {
    fontSize: 26,
    fontWeight: '800',
    color: '#A78BFA',
    marginBottom: 10,
  },
  meridiemTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 6,
    marginBottom: 6,
  },
  meridiemTagText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  nowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  nowBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#7C3AED',
  },

  /* Columns */
  columnsRow: {
    flexDirection: 'row',
    gap: 12,
    height: 180,
  },
  columnCol: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 6,
  },
  columnHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 4,
  },
  columnScroll: {
    flex: 1,
  },
  columnScrollContent: {
    gap: 4,
    paddingVertical: 2,
  },
  unitPill: {
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitPillActive: {
    backgroundColor: '#7C3AED',
  },
  unitPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  unitPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  meridiemCol: {
    gap: 8,
    paddingTop: 16,
  },
  meridiemPill: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  meridiemPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },

  /* Direct Typing Row */
  directInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  directInputWrap: {
    flex: 1,
    height: 38,
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
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directInputBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#7C3AED',
  },

  /* Error in Modal */
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

  /* Footer Actions */
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 4,
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
  confirmBtn: {
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
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default TimePicker;

