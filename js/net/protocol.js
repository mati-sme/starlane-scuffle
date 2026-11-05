// Message types shared by the lobby, the host sim and the guest mirror (the worker uses the same literals).
export const T = {
  hello: 'hello', pick: 'pick', rename: 'rename', start: 'start', stage: 'stage', abort: 'abort', leave: 'leave',
  welcome: 'welcome', lobby: 'lobby', peer: 'peer', closed: 'closed', err: 'err',
  input: 'in', snap: 'snap', event: 'ev',
};

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export const randomCode = () => Array.from({ length: 4 }, () => ALPHABET[(Math.random() * ALPHABET.length) | 0]).join('');
export const cleanCode = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
export const shareLink = (code) => `https://mati-sme.github.io/starlane-scuffle/?room=${code}`;

export const TEAM_NAME = ['Sunny', 'Gloom'];
