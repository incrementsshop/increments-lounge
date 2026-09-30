import { h, iconEl } from './dom.js';
import { openDialog } from './dialogs.js';
import { savedIncrements } from './composer.js';
import { track } from '../analytics.js';

// "Read the board": every approved note from visitors, plus the visitor's own, as paper
// cards. Notes are always inserted as text, never as HTML.

export async function openBoardPanel(app, { openComposer }) {
  track('board_open');
  const own = savedIncrements().slice().reverse();
  const api = openDialog({
    variant: 'sheet',
    title: 'Notes from the <em>Lounge</em>',
    kicker: 'Notice board',
    className: 'boardpanel',
    build(body) {
      body.append(h('p', { class: 'boardpanel__intro' },
        app.board.shared
          ? 'The next small steps people are taking. The Increments team reads every note before it goes up.'
          : 'Your notes live on this device. Pin one and it stays on the board for your next visit.'));
      body.append(h('div', { class: 'boardpanel__grid', 'aria-busy': 'true' }, h('p', { class: 'boardpanel__loading' }, 'Reading the board…')));
    },
    foot(foot, dlg) {
      foot.append(h('button', {
        class: 'button button--primary button--block', type: 'button',
        onclick: () => { dlg.close(); openComposer(app); },
      }, iconEl('pin'), 'Pin your next increment'));
    },
  });

  const notes = await app.board.list();
  if (!api.dlg.open) return api;
  const grid = api.body.querySelector('.boardpanel__grid');
  grid.removeAttribute('aria-busy');
  const cards = [
    ...own.map(n => card(n.text, 'You', true)),
    ...notes.map(n => card(n.text, [n.name, n.city].filter(Boolean).join(', ') || 'A visitor', false, n.sample)),
  ];
  grid.replaceChildren(...(cards.length ? cards : [h('p', { class: 'boardpanel__empty' }, 'The board’s waiting for its first note. Yours?')]));
  return api;
}

function card(text, who, own, sample) {
  return h('figure', { class: `note-card${own ? ' is-own' : ''}` },
    h('blockquote', {}, text),
    h('figcaption', {}, `— ${who}`, sample ? h('small', {}, ' (sample)') : null));
}
