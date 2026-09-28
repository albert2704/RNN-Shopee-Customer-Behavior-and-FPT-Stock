// Điểm khởi động React. Logic RNN nằm ở mã Python; bắt đầu đọc UI từ Shell.tsx.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './Shell';
import './styles.css';
import './Editorial.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
