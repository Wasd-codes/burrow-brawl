// Burrow Brawl — entry point.
import { Game } from './game.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';

const container = document.getElementById('game');
const root = document.getElementById('ui');
const game = new Game(container);
const ui = new UI(root, game);
game.ui = ui;
game.audio = Audio;
window.game = game; // debugging convenience
ui.showMainMenu();
