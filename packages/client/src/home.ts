const KEY = 'bto_pilot_name';

const input = document.getElementById('pilot-name') as HTMLInputElement | null;
const btnAi = document.getElementById('btn-ai') as HTMLAnchorElement | null;

if (input) {
  input.value = localStorage.getItem(KEY) ?? '';
  input.addEventListener('change', () => {
    const v = input.value.trim().slice(0, 24);
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  });
}

function withName(href: string): string {
  const name = input?.value.trim() ?? '';
  if (!name) return href;
  const u = new URL(href, window.location.origin);
  u.searchParams.set('name', name);
  return u.pathname + u.search;
}

if (btnAi) {
  btnAi.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = withName(btnAi.getAttribute('href') ?? 'game.html?mode=ai');
  });
}

document.querySelectorAll<HTMLAnchorElement>('a.home-btn-secondary[href*="game"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = withName(a.getAttribute('href') ?? '');
  });
});
