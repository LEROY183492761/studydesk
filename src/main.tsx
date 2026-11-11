import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/global.css';
import './styles/pages.css';
import './styles/schedule.css';
import './styles/m2.css';
import './styles/v03.css';
import './styles/charts.css';
import './styles/goals.css';
import './styles/timetable.css';
import './styles/classrooms.css';
import './styles/academic.css';
import './styles/assignments.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('未找到根节点 #root');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);