import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Modal } from './Modal';
import { AlertTriangle, HelpCircle } from 'lucide-react-native';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
  loading,
}: ConfirmDialogProps) {
  const isDanger = variant === 'danger';

  return (
    <Modal
      visible={visible}
      onClose={onCancel}
      title={title}
      size="sm"
      icon={
        isDanger ? (
          <AlertTriangle size={20} color="#DC2626" />
        ) : (
          <HelpCircle size={20} color="#0D7377" />
        )
      }
      iconBgColor={isDanger ? '#FEF2F2' : '#F0F7F7'}
      iconBorderColor={isDanger ? '#FCA5A5' : 'rgba(13, 115, 119, 0.2)'}
      primaryAction={{
        label: confirmLabel,
        onPress: onConfirm,
        variant: isDanger ? 'danger' : 'primary',
        loading,
      }}
      secondaryAction={{
        label: cancelLabel,
        onPress: onCancel,
        disabled: loading,
      }}
    >
      <Text style={styles.message}>{message}</Text>
    </Modal>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
    marginVertical: 4,
  },
});
