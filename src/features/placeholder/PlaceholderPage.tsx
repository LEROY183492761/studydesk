import { Link } from 'react-router-dom';

export interface PlaceholderPageProps {
  title: string;
  phase: string;
  description: string;
  bullets?: string[];
}

export function PlaceholderPage({ title, phase, description, bullets = [] }: PlaceholderPageProps) {
  return (
    <div className="page placeholder-page">
      <header className="page-header">
        <div>
          <p className="muted">{phase}</p>
          <h1>{title}</h1>
        </div>
      </header>

      <section className="surface-card panel">
        <p>{description}</p>
        {bullets.length > 0 ? (
          <ul className="bullet-list">
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
        <Link className="text-link" to="/">
          返回今日
        </Link>
      </section>
    </div>
  );
}