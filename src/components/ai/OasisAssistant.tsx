import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Bot, X, Send } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import Markdown from 'react-native-markdown-display';
import { Input } from '@/components/ui/Input';
import { createChatSession } from '@/lib/services/ai';
import { getEmployeeByProfileId } from '@/lib/services/employee';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

export function OasisAssistant({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useTheme();
  const { profile } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');
  
  const chatSessionRef = useRef<any>(null);
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (visible && profile && !chatSessionRef.current) {
      initChat();
    }
  }, [visible, profile]);

  const initChat = async () => {
    setInitializing(true);
    setError('');
    try {
      // Fetch extra context if they are an employee
      let extraContext = null;
      if (profile?.role === 'employee') {
        const emp = await getEmployeeByProfileId(profile.id);
        if (emp) extraContext = emp;
      }
      
      chatSessionRef.current = await createChatSession(profile!, extraContext);
      
      setMessages([
        { id: '1', role: 'ai', text: `Hi ${profile?.full_name?.split(' ')[0]}! I'm Oasis AI. How can I assist you today?` }
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize AI.');
    } finally {
      setInitializing(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !chatSessionRef.current || loading) return;

    const userMessage = input.trim();
    setInput('');
    const newMsg: Message = { id: Date.now().toString(), role: 'user', text: userMessage };
    setMessages(prev => [...prev, newMsg]);
    
    setLoading(true);
    try {
      const result = await chatSessionRef.current.sendMessage(userMessage);
      const aiResponse = result.response.text();
      
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', text: aiResponse }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', text: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.iconBox, { backgroundColor: colors.primary }]}>
                <Bot color="#FFF" size={24} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>Oasis AI</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>HRMS Smart Assistant</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color={colors.textSecondary} size={24} />
            </TouchableOpacity>
          </View>

          {/* Chat Area */}
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={styles.chatScroll}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {initializing ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : error ? (
              <Text style={{ color: colors.danger, textAlign: 'center', marginTop: 20 }}>{error}</Text>
            ) : (
              messages.map(msg => (
                <View 
                  key={msg.id} 
                  style={[
                    styles.bubble, 
                    msg.role === 'user' ? [styles.userBubble, { backgroundColor: colors.primary }] : [styles.aiBubble, { backgroundColor: colors.surface }]
                  ]}
                >
                  {msg.role === 'user' ? (
                    <Text style={[styles.msgText, { color: '#FFF' }]}>
                      {msg.text}
                    </Text>
                  ) : (
                    <Markdown style={getMarkdownStyles(colors) as any}>
                      {msg.text}
                    </Markdown>
                  )}
                </View>
              ))
            )}
            {loading && (
              <View style={[styles.bubble, styles.aiBubble, { backgroundColor: colors.surface }]}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </ScrollView>

          {/* Input Area */}
          <View style={[styles.inputContainer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={{ flex: 1 }}>
              <Input
                placeholder="Ask Oasis anything..."
                value={input}
                onChangeText={setInput}
                onSubmitEditing={sendMessage}
              />
            </View>
            <TouchableOpacity 
              onPress={sendMessage} 
              style={[styles.sendBtn, { backgroundColor: input.trim() && !loading ? colors.primary : colors.border }]}
              disabled={!input.trim() || loading}
            >
              <Send color="#FFF" size={20} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    height: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13 },
  closeBtn: { padding: 8 },
  chatScroll: { padding: 16, gap: 16, flexGrow: 1 },
  bubble: { padding: 16, borderRadius: 16, maxWidth: '85%' },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  msgText: { fontSize: 15, lineHeight: 22 },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  }
});

const getMarkdownStyles = (colors: any) => ({
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  heading1: { color: colors.text, fontWeight: '700', fontSize: 20, marginVertical: 8 },
  heading2: { color: colors.text, fontWeight: '700', fontSize: 18, marginVertical: 8 },
  heading3: { color: colors.text, fontWeight: '600', fontSize: 16, marginVertical: 8 },
  strong: { color: colors.text, fontWeight: 'bold' },
  em: { color: colors.text, fontStyle: 'italic' },
  paragraph: { marginVertical: 4 },
  list_item: { marginVertical: 4 },
  code_inline: { backgroundColor: colors.border, padding: 4, borderRadius: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  code_block: { backgroundColor: colors.background, padding: 12, borderRadius: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  fence: { backgroundColor: colors.background, padding: 12, borderRadius: 8 },
});
