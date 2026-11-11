import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { formatDateLabel } from '@/lib/dates';
import { useAppStore } from '@/state/appStore';

function parseTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,，\s]+/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

export function NotesPage() {
  const notes = useAppStore((state) => state.notes);
  const addNote = useAppStore((state) => state.addNote);
  const updateNote = useAppStore((state) => state.updateNote);
  const removeNote = useAppStore((state) => state.removeNote);
  const convertNoteToTask = useAppStore((state) => state.convertNoteToTask);

  const [draft, setDraft] = useState('');
  const [draftTags, setDraftTags] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [tagRenames, setTagRenames] = useState<Record<string, string>>({});

  const keyword = search.trim().toLowerCase();
  const visible = keyword
    ? notes.filter(
        (note) =>
          note.content.toLowerCase().includes(keyword) ||
          note.tags.some((tag) => tag.toLowerCase().includes(keyword)),
      )
    : notes;

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const note of notes) {
      for (const tag of note.tags) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [notes]);

  async function handleRenameTag(from: string) {
    const target = (tagRenames[from] ?? '').trim();
    if (!target || target === from) return;

    const affected = notes.filter((note) => note.tags.includes(from));
    await Promise.all(
      affected.map((note) =>
        updateNote(note.id, {
          tags: [...new Set(note.tags.map((tag) => (tag === from ? target : tag)))],
        }),
      ),
    );
    setTagRenames((current) => {
      const next = { ...current };
      delete next[from];
      return next;
    });
    setNotice(`标签「${from}」已改为「${target}」`);
  }

  async function handleRemoveTag(tag: string) {
    const affected = notes.filter((note) => note.tags.includes(tag));
    await Promise.all(
      affected.map((note) =>
        updateNote(note.id, { tags: note.tags.filter((item) => item !== tag) }),
      ),
    );
    setNotice(`标签「${tag}」已删除`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = await addNote(draft);
    if (!note) return;

    const tags = parseTags(draftTags);
    if (tags.length > 0) {
      await updateNote(note.id, { tags });
    }
    setDraft('');
    setDraftTags('');
  }

  async function handleConvert(id: string) {
    await convertNoteToTask(id);
    setNotice('已转为待办，可在待办页查看');
  }

  function startEditTags(id: string, tags: string[]) {
    setEditingTagsId(id);
    setTagDraft(tags.join(', '));
  }

  async function handleSaveTags(id: string) {
    await updateNote(id, { tags: parseTags(tagDraft) });
    setEditingTagsId(null);
    setTagDraft('');
    setNotice('标签已更新');
  }

  return (
    <div className="page notes-page">
      <header className="page-header">
        <div>
          <p className="muted">先记下来，再决定怎么处理</p>
          <h1>随想</h1>
        </div>
        <div className="header-badge">{notes.length} 条</div>
      </header>

      <form className="surface-card note-composer" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="记一句闪念，回车保存，Shift + Enter 换行"
          rows={3}
          aria-label="随想内容"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <input
          value={draftTags}
          onChange={(event) => setDraftTags(event.target.value)}
          placeholder="标签，逗号分隔（可选）"
          aria-label="随想标签"
        />
        <div className="note-composer-actions">
          <span className="muted">保存后可一键转成待办</span>
          <button type="submit" className="primary-button">
            保存
          </button>
        </div>
      </form>

      {notice ? (
        <div className="notice-bar" role="status">
          <span>{notice}</span>
          <button type="button" className="ghost-button" onClick={() => setNotice(null)}>
            关闭
          </button>
        </div>
      ) : null}

      <div className="note-search">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索内容或标签"
          aria-label="搜索随想"
        />
        {search ? (
          <button type="button" className="ghost-button" onClick={() => setSearch('')}>
            清除
          </button>
        ) : null}
        <span className="muted">共 {visible.length} 条</span>
      </div>

      <div className="tag-manager">
        <button
          type="button"
          className="ghost-button"
          onClick={() => setTagManagerOpen((current) => !current)}
        >
          {tagManagerOpen ? '收起标签管理' : '标签管理'}
        </button>
        {tagManagerOpen ? (
          tagCounts.length === 0 ? (
            <p className="muted">还没有标签。</p>
          ) : (
            <ul className="tag-manager-list">
              {tagCounts.map(([tag, count]) => (
                <li key={tag}>
                  <span>
                    #{tag} · {count}
                  </span>
                  <input
                    value={tagRenames[tag] ?? ''}
                    onChange={(event) =>
                      setTagRenames((current) => ({ ...current, [tag]: event.target.value }))
                    }
                    placeholder="新名称"
                    aria-label={`重命名标签 ${tag}`}
                  />
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void handleRenameTag(tag)}
                  >
                    改名
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void handleRemoveTag(tag)}
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>

      <section className="surface-card panel">
        {visible.length === 0 ? (
          <p className="empty-hint">{keyword ? '没有匹配的随想。' : '还没有随想。'}</p>
        ) : (
          <ul className="note-list">
            {visible.map((note) => (
              <li key={note.id} className="note-item">
                <p>{note.content}</p>

                <div className="note-tags">
                  {note.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="note-tag"
                      onClick={() => setSearch(tag)}
                      title={`筛选标签 ${tag}`}
                    >
                      #{tag}
                    </button>
                  ))}
                  {editingTagsId === note.id ? (
                    <>
                      <input
                        value={tagDraft}
                        onChange={(event) => setTagDraft(event.target.value)}
                        placeholder="标签，逗号分隔"
                        aria-label={`${note.content.slice(0, 10)} 的标签`}
                      />
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void handleSaveTags(note.id)}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => setEditingTagsId(null)}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => startEditTags(note.id, note.tags)}
                    >
                      标签
                    </button>
                  )}
                </div>

                <div className="note-footer">
                  <span className="muted">{formatDateLabel(note.createdAt, 'M/d HH:mm')}</span>
                  {note.convertedTaskId ? (
                    <span className="note-tag">已转待办</span>
                  ) : (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => void handleConvert(note.id)}
                    >
                      转待办
                    </button>
                  )}
                  <button
                    type="button"
                    className="ghost-button"
                    aria-label="删除随想"
                    onClick={() => void removeNote(note.id)}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}