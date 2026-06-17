import './style.css';

const FEATURES = [
  { icon: '🔗', label: '链接可点击', desc: '还原被屏蔽的超链接，纯文本 URL 自动转为可点击链接' },
  { icon: '📚', label: '《》书籍识别', desc: '自动识别书名号中的书籍，添加 Amazon 搜索链接' },
  { icon: '📊', label: '表格 ↔ 图表', desc: '一键将表格切换为柱状图，支持双向转换' },
  { icon: '📋', label: '移除复制屏蔽', desc: '解除 user-select:none / 禁止复制等限制' },
  { icon: '💬', label: '注释气泡', desc: '提取脚注/注释，hover 气泡显示原文' },
  { icon: '📥', label: '导出下载', desc: '支持导出 Markdown / PDF / 图片，去除广告干扰' },
];

function App() {
  return (
    <div className="app">
      <header className="header">
        <img src="logo.png" alt="Sirius" className="logo" />
        <h1>Sirius 续貂</h1>
      </header>

      <section className="feature-grid">
        {FEATURES.map((f) => (
          <div className="feature-item" key={f.label}>
            <span className="feature-icon">{f.icon}</span>
            <div>
              <strong>{f.label}</strong>
              <p>{f.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <footer className="footer">
        <p>安装后刷新页面，底部工具栏即可使用导出功能</p>
      </footer>
    </div>
  );
}

export default App;
