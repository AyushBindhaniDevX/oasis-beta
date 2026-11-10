import { FONT, LAYOUT, R, T } from '@/constants/ui';
import React from 'react';
import {
    Text, TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';

/* ─── Button ─────────────────────────────────────────────────────── */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onDark';

export function Btn({
    title, onPress, variant = 'primary', icon, loading, disabled, fullWidth, size = 'md', style,
}: {
    title: string;
    onPress?: () => void;
    variant?: BtnVariant;
    icon?: React.ReactNode;
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    size?: 'sm' | 'md' | 'lg';
    style?: any;
}) {
    const v = {
        primary: { bg: T.primary, fg: T.onPrimary, border: T.primary },
        secondary: { bg: T.canvas, fg: T.ink, border: T.hairlineStrong },
        ghost: { bg: 'transparent', fg: T.ink, border: 'transparent' },
        danger: { bg: T.semanticError, fg: T.onPrimary, border: T.semanticError },
        onDark: { bg: 'rgba(255,255,255,0.14)', fg: '#fff', border: 'rgba(255,255,255,0.22)' },
    }[variant];
    const h = { sm: 32, md: 38, lg: 44 }[size];
    return (
        <TouchableOpacity
            onPress={disabled || loading ? undefined : onPress}
            activeOpacity={0.8}
            style={[
                {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingHorizontal: 14,
                    height: h,
                    borderRadius: R.md,
                    backgroundColor: v.bg,
                    borderWidth: 1,
                    borderColor: v.border,
                    opacity: disabled ? 0.55 : 1,
                    width: fullWidth ? '100%' : undefined,
                },
                style,
            ]}
        >
            {icon}
            <Text style={{ fontFamily: FONT, fontSize: 13, fontWeight: '500', color: v.fg }}>
                {loading ? 'Loading…' : title}
            </Text>
        </TouchableOpacity>
    );
}

/* ─── PageHeader — consistent top of every screen ────────────────── */
export { CraftHeader as PageHeader } from './CraftKit';

/* ─── Card ───────────────────────────────────────────────────────── */
export function Card({
    children, tint, style, padded = true,
}: {
    children: React.ReactNode;
    tint?: keyof typeof T | null;
    style?: any;
    padded?: boolean;
}) {
    return (
        <View
            style={[
                {
                    backgroundColor: tint ? (T[tint] as string) : T.canvas,
                    borderRadius: R.lg,
                    borderWidth: 1,
                    borderColor: T.hairline,
                    padding: padded ? 16 : 0,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}

/* ─── Chip ───────────────────────────────────────────────────────── */
export function Chip({
    label, active, onPress, icon,
}: { label: string; active?: boolean; onPress?: () => void; icon?: React.ReactNode }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: R.full,
                borderWidth: 1,
                borderColor: active ? T.ink : T.hairline,
                backgroundColor: active ? T.ink : T.canvas,
            }}
        >
            {icon}
            <Text
                style={{
                    fontFamily: FONT,
                    fontSize: 11,
                    fontWeight: active ? '600' : '500',
                    color: active ? T.onPrimary : T.steel,
                }}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
}

/* ─── SectionLabel ───────────────────────────────────────────────── */
export function SectionLabel({ children }: { children: string }) {
    return (
        <Text style={{ fontFamily: FONT, fontSize: 10, fontWeight: '600', color: T.steel, letterSpacing: 1, marginBottom: 10 }}>
            {children.toUpperCase()}
        </Text>
    );
}

/* ─── Empty state ────────────────────────────────────────────────── */
export function Empty({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
    return (
        <View
            style={{
                padding: 32,
                alignItems: 'center',
                backgroundColor: T.canvas,
                borderRadius: R.lg,
                borderWidth: 1,
                borderColor: T.hairline,
                borderStyle: 'dashed',
            }}
        >
            {icon}
            <Text style={{ fontFamily: FONT, fontSize: 15, fontWeight: '600', color: T.ink, marginTop: 10 }}>{title}</Text>
            {subtitle ? (
                <Text style={{ fontFamily: FONT, fontSize: 12, color: T.steel, marginTop: 4 }}>{subtitle}</Text>
            ) : null}
        </View>
    );
}