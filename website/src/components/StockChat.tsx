import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Bot,
  Check,
  Layers3,
  Plus,
  RefreshCw,
} from 'lucide-react';
import './StockChat.css';
import { connectionLabels, isChatStatus, type ChatStatus } from '../domain/chat/connection';
import { apiUrl } from '../domain/chat/api';
type Source = {
  citation_id: string;
  title: string;
  text: string;
  source_url: string;
  source_pointer: string;
};
type Reply = {
  paragraphs: { text: string; citations: string[] }[];
  followups: string[];
  sources: Source[];
  freshness: { observed_through: string; calendar_days: number; stale: boolean };
  graph: { backend: string; retrieval: string; bundle: string; documents: number; paths: string[] };
  model: string;
};
type Turn = { role: 'user' | 'assistant'; content: string; reply?: Reply };
const prompts = [
  'Tôi có 200 triệu, nên đầu tư như thế nào?',
  'Dự báo FPT hiện tại nói lên điều gì?',
  'Dự báo thử nghiệm FPT trong khoảng sáu tháng đáng tin đến đâu?',
  'Tôi cần lưu ý những rủi ro gì khi mua FPT?',
];
const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
const date = (value: string) => value.split('-').reverse().join('/');

function Evidence({ reply }: { reply: Reply }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <p className="stock-chat-data-date">
        Dữ liệu giá đến {date(reply.freshness.observed_through)}
      </p>
      {reply.paragraphs.map((p, index) => (
        <p className="stock-chat-answer" key={index}>
          {p.text}{' '}
          {p.citations.map((id) => (
            <button
              className="stock-chat-citation"
              key={id}
              aria-label={`Xem nguồn ${id}`}
              onClick={() => {
                setOpen(true);
                setSelected(id);
              }}
            >
              {id}
            </button>
          ))}
        </p>
      ))}
      <details
        className="stock-chat-sources"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>
          <BookOpen size={14} /> Nguồn tham khảo
        </summary>
        {reply.sources.map((source) => (
          <div
            key={source.citation_id}
            className={
              selected === source.citation_id ? 'stock-chat-source selected' : 'stock-chat-source'
            }
          >
            <a
              href={
                source.source_url.startsWith('/api/')
                  ? apiUrl(source.source_url)
                  : source.source_url
              }
              target="_blank"
              rel="noreferrer"
            >
              {source.citation_id} · {source.title} <ArrowUpRight size={13} />
            </a>
            <details open={selected === source.citation_id}>
              <summary>Xem nội dung tham khảo</summary>
              <pre>{source.text}</pre>
            </details>
          </div>
        ))}
        <details className="stock-chat-technical">
          <summary>Chi tiết kỹ thuật</summary>
          <p>
            Tra cứu {reply.graph.documents} tài liệu qua {reply.graph.backend}; tìm theo từ khóa và
            liên kết dữ liệu. Câu trả lời do {reply.model} tạo.
          </p>
          <div className="stock-chat-paths">
            {reply.graph.paths.map((path) => (
              <code key={path}>{path}</code>
            ))}
          </div>
          <dl>
            {reply.sources.map((source) => (
              <div key={source.citation_id}>
                <dt>
                  {source.citation_id} · {source.title}
                </dt>
                <dd>
                  <code>{source.source_pointer}</code>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </details>
    </>
  );
}

export default function StockChat({ active, onBack }: { active: boolean; onBack: () => void }) {
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const latestAnswer = useRef<HTMLElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const request = useRef<AbortController | null>(null);
  const statusSequence = useRef(0);
  const statusBusy = useRef(false);
  const retry = useRef<Turn[] | null>(null);
  const live = useRef(true);

  async function checkStatus() {
    if (statusBusy.current) return;
    statusBusy.current = true;
    const sequence = ++statusSequence.current;
    setChecking(true);
    try {
      const response = await fetch(apiUrl('/api/chat/status'), {
        signal: AbortSignal.timeout(75000),
      });
      if (!response.ok) throw new Error('offline');
      const value: unknown = await response.json();
      if (!isChatStatus(value)) throw new Error('invalid_status');
      if (live.current && sequence === statusSequence.current) {
        setStatus(value);
      }
    } catch {
      if (live.current && sequence === statusSequence.current) setStatus(null);
    } finally {
      statusBusy.current = false;
      if (live.current && sequence === statusSequence.current) setChecking(false);
    }
  }
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    const question = window.sessionStorage.getItem('fpt-chat-prefill');
    if (!question) return;
    window.sessionStorage.removeItem('fpt-chat-prefill');
    setInput(question.slice(0, 4000));
  }, [active]);
  useEffect(() => {
    if (active) void checkStatus();
    const focus = () => {
      if (active) void checkStatus();
    };
    window.addEventListener('focus', focus);
    return () => {
      window.removeEventListener('focus', focus);
    };
  }, [active]);
  useEffect(() => {
    if (!active || status?.ready) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void checkStatus();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [active, status?.ready]);
  useEffect(() => {
    if (!active || !turns.length) return;
    if (!pending && !error && turns.at(-1)?.role === 'assistant') {
      latestAnswer.current?.scrollIntoView({ block: 'start' });
    } else {
      end.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [turns, pending, error, active]);

  async function submit(text: string, retryTurns?: Turn[]) {
    if (pending || !text.trim()) return;
    const next: Turn[] = retryTurns || [...turns, { role: 'user', content: text.trim() }];
    setTurns(next);
    setInput('');
    setError('');
    setPending(true);
    retry.current = next;
    request.current = new AbortController();
    // Bound recent context to the same limits enforced on the server.
    const recent = next.slice(-15).map(({ role, content }) => ({ role, content }));
    while (recent.reduce((sum, turn) => sum + turn.content.length, 0) > 24000) recent.shift();
    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: recent }),
        signal: AbortSignal.any([request.current.signal, AbortSignal.timeout(70000)]),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.detail?.message || 'Chưa gửi được câu hỏi. Hãy thử lại.');
      const reply = body as Reply;
      if (!Array.isArray(reply.paragraphs) || !Array.isArray(reply.sources))
        throw new Error('Câu trả lời chưa có định dạng hợp lệ.');
      if (live.current) {
        setTurns([
          ...next,
          { role: 'assistant', content: reply.paragraphs.map((p) => p.text).join('\n\n'), reply },
        ]);
        retry.current = null;
        void checkStatus();
      }
    } catch (caught) {
      if (live.current) {
        setError(
          caught instanceof TypeError || caught instanceof SyntaxError
            ? 'Không kết nối được máy chủ chat. Cấu hình đã lưu có thể vẫn còn; hãy kiểm tra kết nối rồi thử lại.'
            : caught instanceof Error &&
                caught.name !== 'TimeoutError' &&
                caught.name !== 'AbortError'
              ? caught.message
              : 'Chờ câu trả lời quá lâu. Hãy thử lại sau vài giây.',
        );
        void checkStatus();
      }
    } finally {
      if (live.current) {
        setPending(false);
        field.current?.focus({ preventScroll: true });
      }
    }
  }

  function usePrompt(text: string) {
    if (status?.ready) void submit(text);
    else {
      setInput(text);
      field.current?.focus();
    }
  }

  const connection = connectionLabels(status, checking);

  return (
    <div className="stock-chat-page">
      <header className="stock-chat-nav">
        <button onClick={onBack}>
          <ArrowLeft size={17} /> Về demo
        </button>
        <span>
          <Layers3 size={22} /> sequence.
        </span>
      </header>
      <main className="stock-chat-layout">
        <aside className="stock-chat-sidebar">
          <span className="stock-chat-eyebrow">04 — CHAT ĐẦU TƯ · FPT</span>
          <h1>
            Cổ phiếu FPT.
            <br />
            Hiểu trước khi đầu tư.
          </h1>
          <p>Hỏi về giá FPT, rủi ro và những điều cần cân nhắc với số vốn của bạn.</p>
          <button
            className="stock-chat-new"
            onClick={() => {
              setTurns([]);
              setError('');
              setInput('');
              retry.current = null;
              field.current?.focus();
            }}
            disabled={pending}
          >
            <Plus size={17} /> Cuộc trò chuyện mới
          </button>
          <div className="stock-chat-reference">
            <span>Dữ liệu đang tham khảo</span>
            <strong>FPT</strong>
            {status?.reference_close != null && status.observed_through ? (
              <>
                <p className="stock-chat-price">
                  {money(status.reference_close)} <small>VND</small>
                </p>
                <p>Giá đóng cửa {date(status.observed_through)}</p>
              </>
            ) : (
              <p>{checking ? 'Đang kiểm tra dữ liệu…' : 'Chưa đọc được dữ liệu từ máy chủ'}</p>
            )}
          </div>
          <p className="stock-chat-scope">
            Có mô hình thử nghiệm riêng cho khoảng 1, 3 và 6 tháng. Trao đổi dựa trên dữ liệu FPT
            hiện có; quyết định đầu tư còn tùy mục tiêu, thời hạn và tình hình tài chính của bạn.
          </p>
          <details className="stock-chat-connection" open={!status?.ready}>
            <summary>
              {status?.ready
                ? 'Đã kết nối'
                : checking
                  ? 'Đang kiểm tra kết nối…'
                  : !status
                    ? 'Chưa liên lạc được máy chủ'
                    : 'Cần kiểm tra kết nối'}{' '}
              {status?.ready && <Check size={14} />}
            </summary>
            <p>API key: {connection.key}</p>
            <p>Neo4j: {connection.graph}</p>
            {!status && !checking && (
              <p>Máy chủ chưa phản hồi. Vui lòng thử kiểm tra kết nối lại sau ít phút.</p>
            )}
            {status && !status.api_key_configured && (
              <p>
                Thêm <code>OPENAI_API_KEY</code> vào <code>models/.env</code> trên máy chủ. Không
                nhập key vào ô chat.
              </p>
            )}
            {status && !status.graph_connected && (
              <p>
                Khởi động kho dữ liệu: <code>python -m chat.setup</code> từ models/.
              </p>
            )}
            <button onClick={() => void checkStatus()} disabled={checking}>
              <RefreshCw size={13} />
              {checking ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
            </button>
          </details>
        </aside>
        <section className="stock-chat-conversation" aria-label="Hội thoại đầu tư FPT">
          <div
            className="stock-chat-scroll"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {turns.length === 0 && (
              <div className="stock-chat-welcome">
                <div className="stock-chat-welcome-heading">
                  <span className="stock-chat-icon" aria-hidden="true">
                    <Bot size={28} strokeWidth={1.6} />
                  </span>
                  <h2>Bạn đang cân nhắc điều gì?</h2>
                </div>
                <p>
                  Bắt đầu với số vốn hoặc một câu hỏi về FPT.
                  <br />
                  Bạn có thể mở nguồn tham khảo để tìm hiểu thêm.
                </p>
                <ol className="stock-chat-prompts">
                  {prompts.map((text, index) => (
                    <li key={text}>
                      <button onClick={() => usePrompt(text)}>
                        <span>0{index + 1}</span>
                        {text}
                        <ArrowUpRight size={20} />
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {turns.map((turn, index) => (
              <article
                key={index}
                className={`stock-chat-turn ${turn.role}`}
                ref={turn.role === 'assistant' && index === turns.length - 1 ? latestAnswer : null}
              >
                <span className="stock-chat-speaker">
                  {turn.role === 'assistant' && (
                    <Bot className="stock-chat-speaker-icon" size={22} aria-hidden="true" />
                  )}
                  {turn.role === 'user' ? 'Bạn' : 'sequence. · Trợ lý FPT'}
                </span>
                {turn.reply ? (
                  <>
                    {turn.reply.freshness.stale && (
                      <p className="stock-chat-stale">
                        Dữ liệu đã cách hiện tại {turn.reply.freshness.calendar_days} ngày; cần cập
                        nhật trước khi bàn giá hiện tại.
                      </p>
                    )}
                    <Evidence reply={turn.reply} />
                    {index === turns.length - 1 && (
                      <div className="stock-chat-followups">
                        {turn.reply.followups.map((text) => (
                          <button key={text} disabled={pending} onClick={() => usePrompt(text)}>
                            {text}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p>{turn.content}</p>
                )}
              </article>
            ))}
            {pending && (
              <div className="stock-chat-pending" role="status" aria-atomic="true">
                <span className="stock-chat-thinking-avatar" aria-hidden="true">
                  <Bot size={24} strokeWidth={1.6} />
                </span>
                <div className="stock-chat-thinking-copy">
                  <span className="stock-chat-speaker">sequence. · Trợ lý FPT</span>
                  <p>
                    Đang soạn câu trả lời
                    <span className="stock-chat-thinking-dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  </p>
                </div>
              </div>
            )}
            {error && (
              <div className="stock-chat-error" role="alert">
                <p>{error}</p>
                <button
                  onClick={() => {
                    if (retry.current) void submit(retry.current.at(-1)!.content, retry.current);
                  }}
                  disabled={pending}
                >
                  Thử lại câu hỏi
                </button>
              </div>
            )}
            <div ref={end} />
          </div>
          <form
            className="stock-chat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(input);
            }}
          >
            <label htmlFor="stock-question" className="sr-only">
              Câu hỏi về đầu tư và dữ liệu FPT
            </label>
            <div>
              <textarea
                id="stock-question"
                ref={field}
                value={input}
                maxLength={4000}
                rows={2}
                placeholder="Ví dụ: Tôi có 200 triệu, nên cân nhắc gì trước khi đầu tư FPT?"
                disabled={pending}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void submit(input);
                  }
                }}
              />
              <button type="submit" aria-label="Gửi câu hỏi" disabled={pending || !input.trim()}>
                <ArrowUp size={20} />
              </button>
            </div>
            <p>
              Gửi câu hỏi sẽ chuyển nội dung hội thoại gần đây và dữ liệu tham khảo đến OpenAI.
              Website không lưu lịch sử chat trên máy chủ.
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}
