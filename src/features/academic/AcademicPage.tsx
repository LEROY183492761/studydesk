import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { mergeAcademicPayload, parseAcademicPayload } from '@/domain/rules/academicImport';
import type { AcademicImportPayload } from '@/domain/rules/academicImport';

const STORAGE_KEY = 'studydesk.academicData';

const SAMPLE = JSON.stringify(
  {
    term: '2026 秋',
    grades: [
      { id: 'g1', courseId: 'c1', courseName: '线性代数', credit: 3, score: 92, gradePoint: 4.2 },
      { id: 'g2', courseId: 'c2', courseName: '大学英语', credit: 2, score: 85, gradePoint: 3.5 },
    ],
    exams: [
      {
        id: 'e1',
        courseId: 'c1',
        courseName: '线性代数',
        title: '期末考试',
        startAt: '2027-01-10T09:00:00.000Z',
        endAt: '2027-01-10T11:00:00.000Z',
        location: '教三-201',
        confirmed: true,
      },
    ],
    assignments: [
      {
        id: 'a1',
        courseId: 'c1',
        courseName: '线性代数',
        title: '第三次作业',
        dueAt: '2026-12-05T23:59:00.000Z',
        dueConfirmed: true,
      },
      {
        id: 'a2',
        courseId: 'c2',
        courseName: '大学英语',
        title: '英语作文',
        dueAt: '2026-12-01T23:59:00.000Z',
        dueConfirmed: false,
      },
    ],
  },
  null,
  2,
);

function loadData(): AcademicImportPayload | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseAcademicPayload(raw);
  } catch {
    return null;
  }
}

export function AcademicPage() {

  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState('');
  const [data, setData] = useState<AcademicImportPayload | null>(loadData);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleImport(mode: 'replace' | 'merge' = 'replace') {
    try {
      const parsed = parseAcademicPayload(source);
      const next = mode === 'merge' && data ? mergeAcademicPayload(data, parsed) : parsed;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setData(next);
      setError(null);
      setNotice(
        mode === 'merge'
          ? `已合并导入 ${next.term} 的教务数据`
          : `已导入 ${next.term} 的教务数据`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '导入失败');
      setNotice(null);
    }
  }

  function handleClear() {
    window.localStorage.removeItem(STORAGE_KEY);
    setData(null);
    setSource('');
    setNotice('已清空教务数据');
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const text = await file.text();
    setSource(text);
    setNotice(`已读取 ${file.name}，点击「导入」确认`);
  }


  return (
    <div className="page academic-page">
      <header className="page-header">
        <div>
          <p className="muted">离线导入成绩与考试；作业在独立「作业」页；在线拉取请在「设置 → 个人账号」中配置后刷新</p>
          <h1>教务</h1>
        </div>
        {data ? <div className="header-badge">{data.term}</div> : null}
      </header>

      {notice ? (
        <div className="notice-bar" role="status">
          <span>{notice}</span>
          <button type="button" className="ghost-button" onClick={() => setNotice(null)}>
            关闭
          </button>
        </div>
      ) : null}

      <section className="surface-card panel">
        <div className="panel-head">

          <h2 className="section-title">导入数据</h2>
          <span className="muted">粘贴 JSON，字段：term / grades / exams / assignments</span>
        </div>
        <textarea
          className="academic-import"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          rows={8}
          placeholder='{"term":"2026 秋","grades":[],"exams":[],"assignments":[]}'
          aria-label="教务 JSON"
        />
        <div className="academic-actions">
          <button type="button" className="ghost-button" onClick={() => setSource(SAMPLE)}>
            填入示例
          </button>
          <button type="button" className="ghost-button" onClick={() => fileRef.current?.click()}>
            选择文件
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json,text/plain"
            className="visually-hidden"
            aria-label="选择教务 JSON 文件"
            onChange={(event) => void handleFile(event)}
          />
          <button type="button" className="primary-button" onClick={() => handleImport('replace')}>
            导入
          </button>
          <button
            type="button"
            className="ghost-button"
            disabled={!data}
            onClick={() => handleImport('merge')}
          >
            合并导入
          </button>
          <button type="button" className="ghost-button" onClick={handleClear}>
            清空
          </button>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
      </section>

      {data ? (
        <>
          <div className="academic-summary">
            <span>
              成绩 <strong>{data.grades.length}</strong>
            </span>
            <span>
              考试 <strong>{data.exams.length}</strong>
            </span>

          </div>

          <section className="surface-card panel">
            <h2 className="section-title">成绩</h2>
            {data.grades.length === 0 ? (
              <p className="empty-hint">没有成绩记录。</p>
            ) : (
              <table className="academic-table">
                <thead>
                  <tr>
                    <th>课程</th>
                    <th>学分</th>
                    <th>成绩</th>
                    <th>绩点</th>
                  </tr>
                </thead>
                <tbody>
                  {data.grades.map((grade) => (
                    <tr key={grade.id}>
                      <td>{grade.courseName}</td>
                      <td>{grade.credit}</td>
                      <td>{grade.score ?? '—'}</td>
                      <td>{grade.gradePoint ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="surface-card panel">
            <h2 className="section-title">考试</h2>
            {data.exams.length === 0 ? (
              <p className="empty-hint">没有考试记录。</p>
            ) : (
              <table className="academic-table">
                <thead>
                  <tr>
                    <th>课程</th>
                    <th>考试</th>
                    <th>时间</th>
                    <th>地点</th>
                  </tr>
                </thead>
                <tbody>
                  {data.exams.map((exam) => (
                    <tr key={exam.id}>
                      <td>{exam.courseName}</td>
                      <td>{exam.title}</td>
                      <td>{exam.startAt ?? '未确认'}</td>
                      <td>{exam.location ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="surface-card panel">
            <h2 className="section-title">作业</h2>
            <p className="empty-hint">
              作业已移至独立的「作业」页，共 {data.assignments.length} 条。
              <Link to="/assignments">打开作业页</Link>
            </p>
          </section>
        </>
      ) : (
        <p className="empty-hint">还没有导入教务数据，可以先「填入示例」再导入。</p>
      )}
    </div>
  );
}