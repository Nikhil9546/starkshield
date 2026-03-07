/**
 * Obscura AI Chat — Floating bottom-right chat widget.
 *
 * Uses DeepSeek API via serverless proxy to provide intelligent
 * DeFi assistance, privacy analysis, and protocol guidance.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useBalance } from '../hooks/useBalance';
import { useProof } from '../hooks/useProof';
import { sendChatMessage, type ChatMessage } from '../lib/ai/client';
import { parseActions, executeAction, type AIAction, type ActionResult } from '../lib/ai/executor';
import { getLocalShieldedBalance, getLocalCDPCollateral, getLocalCDPDebt } from '../lib/shieldedBalance';
import { CONTRACT_ADDRESSES } from '../lib/contracts/config';

interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'status' | 'action-confirm' | 'action-result';
  content: string;
  timestamp: number;
  action?: AIAction;
  actionResult?: ActionResult;
}

const QUICK_ACTIONS = [
  { label: 'My Balances', prompt: 'What are my current balances and positions?' },
  { label: 'Privacy Score', prompt: 'Analyze my privacy score and tell me what\'s visible on-chain vs what\'s private.' },
  { label: 'CDP Health', prompt: 'How healthy is my CDP? Run a price scenario analysis.' },
  { label: 'How It Works', prompt: 'Explain how Obscura\'s privacy-preserving DeFi works step by step.' },
  { label: 'Stake Guide', prompt: 'Walk me through how to deposit and shield tokens on the Stake page.' },
  { label: 'What\'s ZK?', prompt: 'Explain the ZK proof system — what are the 7 circuits and when are they used?' },
];

export default function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { address, account, privacyKey } = useWallet();
  const { balances, refresh: refreshBalances } = useBalance();
  const { prove } = useProof();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Build wallet context for AI
  const buildWalletContext = useCallback((): string => {
    if (!address) return 'Wallet not connected.';

    const shieldedBal = getLocalShieldedBalance(address);
    const cdpCollateral = getLocalCDPCollateral(address);
    const cdpDebt = getLocalCDPDebt(address);
    const pubBal = balances.publicBalance ?? BigInt(0);
    const lockedCol = balances.lockedCollateral ?? BigInt(0);
    const totalDep = balances.totalDeposited ?? BigInt(0);
    const hasCdp = balances.hasCDP;
    const debtCommitment = balances.debtCommitment ?? BigInt(0);

    const fmt = (v: bigint, decimals = 18) => {
      const d = BigInt(10) ** BigInt(decimals);
      const whole = v / d;
      const frac = v % d;
      return `${whole}.${frac.toString().padStart(decimals, '0').slice(0, 4)}`;
    };

    const fmt8 = (v: bigint) => {
      const d = BigInt(10) ** BigInt(8);
      const whole = v / d;
      const frac = v % d;
      return `${whole}.${frac.toString().padStart(8, '0').slice(0, 4)}`;
    };

    const totalBalance = pubBal + shieldedBal;
    const privacyScore = totalBalance > 0 ? Number((shieldedBal * BigInt(100)) / totalBalance) : 0;

    return [
      `- Wallet: ${address.slice(0, 8)}...${address.slice(-4)}`,
      `- Public vault balance: ${fmt(pubBal)} xyBTC`,
      `- Shielded balance (local): ${fmt(shieldedBal)} xyBTC`,
      `- Privacy score: ${privacyScore}% (${privacyScore >= 80 ? 'good' : privacyScore >= 50 ? 'moderate' : 'low'})`,
      `- Total vault deposits (protocol): ${fmt(totalDep)} xyBTC`,
      `- Has CDP: ${hasCdp ? 'Yes' : 'No'}`,
      hasCdp ? `- Locked collateral (on-chain): ${fmt(lockedCol)} xyBTC` : null,
      hasCdp ? `- CDP collateral (local tracker): ${fmt8(cdpCollateral)} xyBTC` : null,
      hasCdp ? `- CDP debt (local tracker): ${fmt8(cdpDebt)} sUSD` : null,
      hasCdp ? `- Debt commitment: ${debtCommitment > 0 ? `0x${debtCommitment.toString(16).slice(0, 12)}... (active debt)` : '0 (no debt)'}` : null,
      `- Contracts: Vault=${CONTRACT_ADDRESSES.shieldedVault.slice(0, 8)}..., CDP=${CONTRACT_ADDRESSES.shieldedCDP.slice(0, 8)}..., Solvency=${CONTRACT_ADDRESSES.solvencyProver.slice(0, 8)}...`,
      `- Network: Sepolia testnet`,
    ].filter(Boolean).join('\n');
  }, [address, balances]);

  // Strip action blocks and fake TX hashes from AI text for display
  const stripActionBlocks = (text: string): string => {
    return text
      .replace(/```action\s*\n[\s\S]*?\n```/g, '')
      .replace(/\{"action"\s*:\s*"\w+"(?:\s*,\s*"amount"\s*:\s*\d+(?:\.\d+)?)?\s*\}/g, '')
      .replace(/TX_HASH:\s*0x[a-fA-F0-9]+/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // Format action for display
  const formatAction = (action: AIAction): string => {
    const labels: Record<string, string> = {
      faucet: 'Mint 100 test xyBTC',
      deposit: `Deposit ${action.amount} xyBTC`,
      shield: `Shield ${action.amount} xyBTC`,
      unshield: `Unshield ${action.amount} xyBTC`,
      withdraw: `Withdraw ${action.amount} xyBTC`,
      open_cdp: 'Open CDP',
      lock_collateral: `Lock ${action.amount} xyBTC as collateral`,
      mint_susd: `Mint ${action.amount} sUSD`,
      repay: `Repay ${action.amount} sUSD`,
      close_cdp: 'Close CDP',
      check_balances: 'Check balances',
      check_solvency: 'Check solvency',
      submit_solvency: 'Submit solvency proofs',
    };
    return labels[action.action] || action.action;
  };

  const handleExecuteAction = useCallback(async (action: AIAction, confirmMsgId: string) => {
    if (!account || !address) {
      setError('Wallet not connected.');
      return;
    }

    setIsExecuting(true);

    // Remove the confirmation message
    setMessages(prev => prev.filter(m => m.id !== confirmMsgId));

    // Add executing status
    const statusId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: statusId,
      role: 'status' as const,
      content: `Executing: ${formatAction(action)}...`,
      timestamp: Date.now(),
    }]);

    const onStatus = (status: string) => {
      setMessages(prev => prev.map(m =>
        m.id === statusId ? { ...m, content: status } : m
      ));
    };

    try {
      const result = await executeAction(
        action,
        account,
        address,
        privacyKey,
        (input) => prove(input as Parameters<typeof prove>[0]),
        onStatus,
      );

      // Replace status with result
      setMessages(prev => prev.map(m =>
        m.id === statusId ? {
          ...m,
          role: 'action-result' as const,
          content: result.message,
          actionResult: result,
        } : m
      ));

      // Refresh balances after successful action
      if (result.success) {
        refreshBalances().catch(() => {});
      }

      // Feed result back into conversation with tx details
      const txHash = result.txHash;
      if (txHash) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: `TX_HASH:${txHash}`,
          timestamp: Date.now(),
        }]);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Action failed';
      setMessages(prev => prev.map(m =>
        m.id === statusId ? {
          ...m,
          role: 'action-result' as const,
          content: `Failed: ${errMsg}`,
          actionResult: { success: false, message: errMsg },
        } : m
      ));
    } finally {
      setIsExecuting(false);
    }
  }, [account, address, privacyKey, prove, refreshBalances]);

  const handleDismissAction = useCallback((confirmMsgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== confirmMsgId));
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'assistant' as const,
      content: 'Action cancelled. Let me know if you\'d like to do something else.',
      timestamp: Date.now(),
    }]);
  }, []);

  const handleSend = useCallback(async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText || isLoading || isExecuting) return;

    setInput('');
    setError(null);

    const userMsg: UIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: msgText,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Build chat history for API (last 10 messages, only user/assistant roles)
      const historyForApi: ChatMessage[] = [...messages.slice(-10), userMsg]
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const walletContext = buildWalletContext();
      const reply = await sendChatMessage(historyForApi, walletContext);

      // Check for executable actions
      const actions = parseActions(reply);
      const displayText = stripActionBlocks(reply);

      // Add the AI's text response
      if (displayText) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: displayText,
          timestamp: Date.now(),
        }]);
      }

      // If there are actions, show confirmation
      if (actions.length > 0) {
        const action = actions[0]; // Execute one at a time
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'action-confirm',
          content: formatAction(action),
          timestamp: Date.now(),
          action,
        }]);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to get AI response';
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, isExecuting, messages, buildWalletContext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Sanitize HTML — strip all tags except safe inline formatting
  const sanitize = (html: string): string => {
    return html.replace(/<(?!\/?(?:strong|code|span)\b)[^>]*>/gi, '');
  };

  // Copy text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  // Render a transaction card
  const renderTxCard = (txHash: string) => {
    return (
      <div className="ai-tx-card">
        <div className="ai-tx-header">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: '#22c55e' }}>
            TRANSACTION CONFIRMED
          </span>
        </div>
        <div className="ai-tx-hash-row">
          <span className="ai-tx-hash" title={txHash}>
            {txHash.slice(0, 8)}...{txHash.slice(-6)}
          </span>
          <button
            className="ai-tx-copy"
            onClick={() => copyToClipboard(txHash)}
            title="Copy full hash"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>
        <div className="ai-tx-network">Starknet Sepolia</div>
      </div>
    );
  };

  // Render markdown-lite (bold, code, lists)
  const renderContent = (content: string) => {
    // Check for TX_HASH: prefix — render as tx card
    if (content.startsWith('TX_HASH:')) {
      const hash = content.slice(8);
      return [renderTxCard(hash)];
    }

    return content.split('\n').map((line, i) => {
      // Escape HTML entities first to prevent XSS
      let escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      // Bold
      let processed = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Inline code
      processed = processed.replace(/`(.*?)`/g, '<code style="background:rgba(59,130,246,0.15);padding:1px 4px;border-radius:3px;font-size:11px">$1</code>');
      // Bullet points
      if (processed.startsWith('- ') || processed.startsWith('* ')) {
        processed = '<span style="color:rgba(59,130,246,0.6);margin-right:4px">&#8226;</span>' + processed.slice(2);
      }
      // Headers
      if (processed.startsWith('## ')) {
        return <div key={i} style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, fontWeight: 700, color: '#3b82f6', letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>{processed.slice(3)}</div>;
      }
      if (processed.startsWith('# ')) {
        return <div key={i} style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>{processed.slice(2)}</div>;
      }
      return <div key={i} dangerouslySetInnerHTML={{ __html: sanitize(processed) }} style={{ minHeight: line.trim() ? undefined : 8 }} />;
    });
  };

  return (
    <>
      <style>{chatStyles}</style>

      {/* Floating Toggle Button */}
      <button
        className="ai-chat-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Obscura AI Assistant"
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
            <path d="M10 22h4" />
            <path d="M9 9h.01M15 9h.01" />
            <path d="M9.5 13a3.5 3.5 0 0 0 5 0" />
          </svg>
        )}
        {!isOpen && <span className="ai-chat-badge">AI</span>}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="ai-chat-panel">
          {/* Header */}
          <div className="ai-chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="ai-pulse" />
              <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1.5 }}>
                OBSCURA AI
              </span>
            </div>
            <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
              POWERED BY AI
            </span>
          </div>

          {/* Messages */}
          <div className="ai-chat-messages">
            {messages.length === 0 && (
              <div className="ai-chat-welcome">
                <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                  Welcome to Obscura AI
                </div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.6 }}>
                  I can help you understand your positions, analyze privacy, explain ZK proofs, and guide you through DeFi operations.
                </p>
                <div className="ai-quick-actions">
                  {QUICK_ACTIONS.map((action, i) => (
                    <button
                      key={i}
                      className="ai-quick-btn"
                      onClick={() => handleSend(action.prompt)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => {
              // Action confirmation UI
              if (msg.role === 'action-confirm' && msg.action) {
                return (
                  <div key={msg.id} className="ai-action-confirm">
                    <div className="ai-msg-label" style={{ color: '#f59e0b' }}>CONFIRM ACTION</div>
                    <div className="ai-action-desc">{msg.content}</div>
                    <div className="ai-action-buttons">
                      <button
                        className="ai-action-btn ai-action-btn-yes"
                        onClick={() => handleExecuteAction(msg.action!, msg.id)}
                        disabled={isExecuting}
                      >
                        Execute
                      </button>
                      <button
                        className="ai-action-btn ai-action-btn-no"
                        onClick={() => handleDismissAction(msg.id)}
                        disabled={isExecuting}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              // Live status during execution
              if (msg.role === 'status') {
                return (
                  <div key={msg.id} className="ai-msg ai-msg-status">
                    <div className="ai-msg-label" style={{ color: '#3b82f6' }}>EXECUTING</div>
                    <div className="ai-msg-content ai-status-content">
                      <span className="ai-spinner" />
                      {msg.content}
                    </div>
                  </div>
                );
              }

              // Action result
              if (msg.role === 'action-result') {
                const success = msg.actionResult?.success;
                return (
                  <div key={msg.id} className={`ai-msg ai-msg-result ${success ? 'ai-result-ok' : 'ai-result-fail'}`}>
                    <div className="ai-msg-label" style={{ color: success ? '#22c55e' : '#ef4444' }}>
                      {success ? 'SUCCESS' : 'FAILED'}
                    </div>
                    <div className="ai-msg-content">
                      {renderContent(msg.content)}
                    </div>
                  </div>
                );
              }

              // Normal user/assistant messages
              return (
                <div key={msg.id} className={`ai-msg ai-msg-${msg.role}`}>
                  <div className="ai-msg-label">
                    {msg.role === 'user' ? 'YOU' : 'OBSCURA AI'}
                  </div>
                  <div className="ai-msg-content">
                    {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="ai-msg ai-msg-assistant">
                <div className="ai-msg-label">OBSCURA AI</div>
                <div className="ai-msg-content ai-typing">
                  <span className="ai-dot" />
                  <span className="ai-dot" style={{ animationDelay: '0.2s' }} />
                  <span className="ai-dot" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}

            {error && (
              <div className="ai-error">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="ai-chat-input-area">
            <input
              ref={inputRef}
              type="text"
              className="ai-chat-input"
              placeholder={address ? 'Ask about your positions, privacy, ZK proofs...' : 'Connect wallet for personalized insights...'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || isExecuting}
            />
            <button
              className="ai-send-btn"
              onClick={() => handleSend()}
              disabled={isLoading || isExecuting || !input.trim()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const chatStyles = `
  @keyframes ai-bounce {
    0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }
  @keyframes ai-glow-pulse {
    0%, 100% { box-shadow: 0 0 15px rgba(59,130,246,0.3); }
    50% { box-shadow: 0 0 25px rgba(59,130,246,0.5), 0 0 50px rgba(59,130,246,0.15); }
  }
  @keyframes ai-slide-up {
    from { opacity: 0; transform: translateY(20px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .ai-chat-toggle {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 1000;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(59,130,246,0.2), rgba(6,182,212,0.2));
    border: 1px solid rgba(59,130,246,0.3);
    color: #3b82f6;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    animation: ai-glow-pulse 3s ease-in-out infinite;
    backdrop-filter: blur(12px);
  }
  .ai-chat-toggle:hover {
    transform: scale(1.08);
    border-color: rgba(59,130,246,0.5);
    background: linear-gradient(135deg, rgba(59,130,246,0.3), rgba(6,182,212,0.3));
  }
  .ai-chat-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    background: #3b82f6;
    color: #000;
    font-size: 8px;
    font-weight: 800;
    font-family: 'Orbitron', sans-serif;
    padding: 2px 5px;
    border-radius: 6px;
    letter-spacing: 0.5px;
  }

  .ai-chat-panel {
    position: fixed;
    bottom: 88px;
    right: 24px;
    z-index: 999;
    width: 400px;
    max-height: 580px;
    display: flex;
    flex-direction: column;
    background: rgba(6,8,14,0.97);
    border: 1px solid rgba(59,130,246,0.15);
    border-radius: 16px;
    overflow: hidden;
    animation: ai-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow:
      0 0 40px rgba(59,130,246,0.08),
      0 20px 60px rgba(0,0,0,0.5);
    backdrop-filter: blur(20px);
  }

  .ai-chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    background: rgba(59,130,246,0.06);
    border-bottom: 1px solid rgba(59,130,246,0.1);
  }

  .ai-pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #3b82f6;
    box-shadow: 0 0 8px rgba(59,130,246,0.6);
    animation: ai-glow-pulse 2s ease-in-out infinite;
  }

  .ai-chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    max-height: 400px;
    scrollbar-width: thin;
    scrollbar-color: rgba(59,130,246,0.2) transparent;
  }
  .ai-chat-messages::-webkit-scrollbar {
    width: 4px;
  }
  .ai-chat-messages::-webkit-scrollbar-thumb {
    background: rgba(59,130,246,0.2);
    border-radius: 2px;
  }

  .ai-chat-welcome {
    text-align: center;
    padding: 12px 0;
  }

  .ai-quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }

  .ai-quick-btn {
    padding: 6px 12px;
    font-size: 10px;
    font-family: 'Fira Code', monospace;
    font-weight: 500;
    letter-spacing: 0.5px;
    background: rgba(59,130,246,0.08);
    border: 1px solid rgba(59,130,246,0.15);
    border-radius: 8px;
    color: rgba(255,255,255,0.6);
    cursor: pointer;
    transition: all 0.2s;
  }
  .ai-quick-btn:hover {
    background: rgba(59,130,246,0.15);
    border-color: rgba(59,130,246,0.3);
    color: #3b82f6;
  }

  .ai-msg {
    margin-bottom: 14px;
  }
  .ai-msg-label {
    font-family: 'Orbitron', sans-serif;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1.5px;
    margin-bottom: 4px;
  }
  .ai-msg-user .ai-msg-label {
    color: rgba(255,255,255,0.35);
  }
  .ai-msg-assistant .ai-msg-label {
    color: rgba(59,130,246,0.6);
  }
  .ai-msg-content {
    font-family: 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.65;
    padding: 10px 14px;
    border-radius: 10px;
  }
  .ai-msg-user .ai-msg-content {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.85);
  }
  .ai-msg-assistant .ai-msg-content {
    background: rgba(59,130,246,0.06);
    border: 1px solid rgba(59,130,246,0.1);
    color: rgba(255,255,255,0.75);
  }

  .ai-typing {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 16px !important;
  }
  .ai-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #3b82f6;
    animation: ai-bounce 1.4s ease-in-out infinite;
  }

  .ai-error {
    padding: 8px 12px;
    font-size: 11px;
    font-family: 'Fira Code', monospace;
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 8px;
    color: #f87171;
    margin-bottom: 8px;
  }

  .ai-chat-input-area {
    display: flex;
    gap: 8px;
    padding: 12px 14px;
    border-top: 1px solid rgba(59,130,246,0.08);
    background: rgba(4,6,11,0.8);
  }

  .ai-chat-input {
    flex: 1;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 10px 14px;
    font-family: 'Fira Code', monospace;
    font-size: 12px;
    color: #fff;
    outline: none;
    transition: border-color 0.2s;
  }
  .ai-chat-input:focus {
    border-color: rgba(59,130,246,0.3);
  }
  .ai-chat-input::placeholder {
    color: rgba(255,255,255,0.2);
  }

  .ai-send-btn {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(59,130,246,0.15);
    border: 1px solid rgba(59,130,246,0.25);
    color: #3b82f6;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
  }
  .ai-send-btn:hover:not(:disabled) {
    background: rgba(59,130,246,0.25);
    border-color: rgba(59,130,246,0.4);
  }
  .ai-send-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* Transaction card */
  .ai-tx-card {
    padding: 10px 12px;
    background: rgba(34,197,94,0.04);
    border: 1px solid rgba(34,197,94,0.15);
    border-radius: 8px;
  }
  .ai-tx-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }
  .ai-tx-hash-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }
  .ai-tx-hash {
    font-family: 'Fira Code', monospace;
    font-size: 11px;
    color: rgba(255,255,255,0.7);
    background: rgba(255,255,255,0.04);
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.06);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ai-tx-copy {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
  }
  .ai-tx-copy:hover {
    background: rgba(59,130,246,0.1);
    border-color: rgba(59,130,246,0.2);
    color: #3b82f6;
  }
  .ai-tx-network {
    font-family: 'Fira Code', monospace;
    font-size: 9px;
    color: rgba(255,255,255,0.25);
    letter-spacing: 0.5px;
  }

  /* Action confirmation */
  .ai-action-confirm {
    margin-bottom: 14px;
    padding: 12px 14px;
    background: rgba(245,158,11,0.06);
    border: 1px solid rgba(245,158,11,0.2);
    border-radius: 10px;
  }
  .ai-action-desc {
    font-family: 'Fira Code', monospace;
    font-size: 12px;
    font-weight: 600;
    color: #f59e0b;
    margin: 6px 0 10px;
  }
  .ai-action-buttons {
    display: flex;
    gap: 8px;
  }
  .ai-action-btn {
    padding: 6px 16px;
    font-family: 'Orbitron', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid;
  }
  .ai-action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .ai-action-btn-yes {
    background: rgba(34,197,94,0.15);
    border-color: rgba(34,197,94,0.3);
    color: #22c55e;
  }
  .ai-action-btn-yes:hover:not(:disabled) {
    background: rgba(34,197,94,0.25);
    border-color: rgba(34,197,94,0.5);
  }
  .ai-action-btn-no {
    background: rgba(239,68,68,0.1);
    border-color: rgba(239,68,68,0.2);
    color: #f87171;
  }
  .ai-action-btn-no:hover:not(:disabled) {
    background: rgba(239,68,68,0.2);
    border-color: rgba(239,68,68,0.35);
  }

  /* Status/executing */
  .ai-msg-status .ai-status-content {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #3b82f6;
  }
  @keyframes ai-spin {
    to { transform: rotate(360deg); }
  }
  .ai-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(59,130,246,0.2);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: ai-spin 0.8s linear infinite;
    flex-shrink: 0;
  }

  /* Action results */
  .ai-result-ok .ai-msg-content {
    background: rgba(34,197,94,0.06) !important;
    border-color: rgba(34,197,94,0.15) !important;
  }
  .ai-result-fail .ai-msg-content {
    background: rgba(239,68,68,0.06) !important;
    border-color: rgba(239,68,68,0.15) !important;
  }

  @media (max-width: 480px) {
    .ai-chat-panel {
      width: calc(100vw - 32px);
      right: 16px;
      bottom: 80px;
      max-height: 70vh;
    }
  }
`;
