export default function Footer({ navigate }) {
  return (
    <footer className="mt-12 border-t border-edge bg-ink/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <button className="hover:text-white" onClick={() => navigate('/privacy')}>
            Privacy Policy
          </button>
          <button className="hover:text-white" onClick={() => navigate('/terms')}>
            Terms &amp; Conditions
          </button>
          <a className="hover:text-white" href="https://portfolio.mfm965204.workers.dev/" target="_blank" rel="noreferrer">
            Portfolio
          </a>
          <a className="hover:text-white" href="https://www.instagram.com/fahad0101r" target="_blank" rel="noreferrer">
            Support · Instagram
          </a>
        </div>
        <p className="text-xs text-zinc-600">
          Developed by <span className="font-semibold text-zinc-300">Mohammad Fahad Mir</span>
        </p>
      </div>
    </footer>
  );
}
