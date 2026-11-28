import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {jigsawPath} from './public/puzzle.js';

const url = 'https://arcade.thehouseofjoshi.com/puzzle-nft/';
const folder = fileURLToPath(new URL('./public/puzzle-nft/', import.meta.url));
const master = fileURLToPath(new URL('./public/puzzle-art.jpg', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'puzzle-print-'));
const magick = (...args) => execFileSync('magick', args);
mkdirSync(folder, {recursive:true});
try {
  copyFileSync(master, join(folder, 'master.jpg'));
  const board = join(temp, 'board.png');
  magick(master, '-resize', '1000x1000^', '-gravity', 'center', '-extent', '1000x1000',
    '-bordercolor', 'none', '-border', '32', board);
  const mask = join(temp, 'mask.svg');
  for (let id = 1; id <= 26; id++) {
    const completed = id === 26;
    const column = (id - 1) % 5;
    const row = Math.floor((id - 1) / 5);
    if (!completed) {
      writeFileSync(mask, '<svg xmlns="http://www.w3.org/2000/svg" width="264" height="264" viewBox="-16 -16 132 132"><rect x="-16" y="-16" width="132" height="132" fill="black"/><path fill="white" d="' + jigsawPath(id) + '"/></svg>');
      magick(board, '-gravity', 'NorthWest', '-crop', '264x264+' + (column * 200) + '+' + (row * 200),
        '+repage', '-alpha', 'off', '(', mask, '-colorspace', 'Gray', '-alpha', 'off', ')', '-compose', 'CopyOpacity', '-composite', join(folder, id + '.png'));
    }
    const name = completed ? 'Puzzle Print — Completed Artwork' : 'Puzzle Print — Piece ' + String(id).padStart(2,'0');
    const attributes = completed ? [{trait_type:'Type',value:'Completed print'}] :
      [{trait_type:'Piece',value:id},{trait_type:'Row',value:row+1},{trait_type:'Column',value:column+1}];
    writeFileSync(join(folder, id + '.json'), JSON.stringify({
      name, description:completed ? 'The finished pearlescent artwork awarded on a Puzzle Print claim.' :
        'One of the 25 interlocking pieces of the House Arcade Puzzle Print artwork.',
      image:url + (completed ? 'master.jpg' : id + '.png'),
      external_url:'https://arcade.thehouseofjoshi.com/puzzle-print',
      attributes
    }, null, 2) + '\n');
  }
} finally { rmSync(temp, {recursive:true,force:true}); }
