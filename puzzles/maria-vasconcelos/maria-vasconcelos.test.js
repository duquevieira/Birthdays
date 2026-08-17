// Todos os testes do puzzle da Maria Vasconcelos. O ficheiro é autónomo: não
// importa nada de outros puzzles, para que cada pasta possa ser copiada tal como está.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const PERSON = "Maria";
const SLUG = "maria-vasconcelos";
const COLS = 8;
const ROWS = 12;
const GOAL = 10;
// A página dá tempo a ver o poço já todo fotografia antes de abrir a festa.
const PARTY_DELAY = 2500;

const PAGE_URL = `https://duquevieira.github.io/Birthdays/puzzles/${SLUG}/`;

const puzzleDir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(puzzleDir, "index.html"), "utf8");

// As mesmas peças da página, para que os testes possam prever onde cada uma cai.
const SHAPES = {
  I: { box: 4, cells: [[1, 0], [1, 1], [1, 2], [1, 3]] },
  J: { box: 3, cells: [[0, 0], [1, 0], [1, 1], [1, 2]] },
  L: { box: 3, cells: [[0, 2], [1, 0], [1, 1], [1, 2]] },
  O: { box: 2, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  S: { box: 3, cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
  T: { box: 3, cells: [[0, 1], [1, 0], [1, 1], [1, 2]] },
  Z: { box: 3, cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
};

let dom = null;

/** Gerador determinista, para que o saco de peças seja sempre o mesmo. */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function openPage({ seed = 20260817 } = {}) {
  dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: PAGE_URL,
    beforeParse(window) {
      window.Math.random = seededRandom(seed);
    },
  });
  return dom.window.document;
}

const cellsOf = (document) => [...document.querySelectorAll(".cell")];
const stateOf = (document) => cellsOf(document).map((cell) => cell.dataset.state);
const click = (document, id) => document.querySelector(`#${id}`).click();
const lines = (document) => Number(document.querySelector("#lineCount").textContent);

/** Só as casas assentes: as da peça a cair contam-se à parte. */
function readBoard(document) {
  const board = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
  stateOf(document).forEach((state, index) => {
    if (state === "locked") board[Math.floor(index / COLS)][index % COLS] = true;
  });
  return board;
}

function activeCells(document) {
  const found = [];
  stateOf(document).forEach((state, index) => {
    if (state === "active") found.push([Math.floor(index / COLS), index % COLS]);
  });
  return found;
}

/** A mesma rotação da página: girar a caixa da peça um quarto de volta. */
function shapeOf(key, rotation) {
  const { box, cells } = SHAPES[key];
  let turned = cells;
  for (let turn = 0; turn < rotation % 4; turn += 1) {
    turned = turned.map(([row, column]) => [column, box - 1 - row]);
  }
  return turned;
}

const hits = (board, shape, row, column) =>
  shape.some(([shapeRow, shapeColumn]) => {
    const boardRow = row + shapeRow;
    const boardColumn = column + shapeColumn;
    if (boardColumn < 0 || boardColumn >= COLS || boardRow >= ROWS) return true;
    return boardRow >= 0 && board[boardRow][boardColumn];
  });

/** Onde a peça assentaria se caísse já daquela coluna. */
function landing(board, shape, column) {
  if (hits(board, shape, -4, column)) return null;
  let row = -4;
  while (!hits(board, shape, row + 1, column)) row += 1;
  return row;
}

/** Quão bom fica o poço depois de a peça assentar (pesos clássicos do Tetris). */
function judge(board, shape, row, column) {
  const after = board.map((line) => [...line]);
  for (const [shapeRow, shapeColumn] of shape) {
    const boardRow = row + shapeRow;
    if (boardRow < 0) return null; // encostar ao tecto é perder o jogo
    after[boardRow][column + shapeColumn] = true;
  }

  const cleared = after.filter((line) => line.every(Boolean)).length;
  const kept = after.filter((line) => !line.every(Boolean));

  const heights = new Array(COLS).fill(0);
  let holes = 0;
  for (let column2 = 0; column2 < COLS; column2 += 1) {
    let seen = false;
    for (let row2 = 0; row2 < kept.length; row2 += 1) {
      if (kept[row2][column2]) {
        if (!seen) {
          seen = true;
          heights[column2] = kept.length - row2;
        }
      } else if (seen) {
        holes += 1;
      }
    }
  }

  const total = heights.reduce((sum, height) => sum + height, 0);
  const bumpiness = heights
    .slice(1)
    .reduce((sum, height, index) => sum + Math.abs(height - heights[index]), 0);

  return -0.51 * total + 0.76 * cleared - 0.36 * holes - 0.18 * bumpiness;
}

/** Joga uma peça: escolhe o melhor sítio, encosta-a lá e larga-a. */
function playPiece(document) {
  const well = document.querySelector("#well");
  const key = well.dataset.piece;
  if (!key) return false;

  const board = readBoard(document);
  let best = null;
  for (let rotation = 0; rotation < 4; rotation += 1) {
    const shape = shapeOf(key, rotation);
    for (let column = -3; column < COLS; column += 1) {
      const row = landing(board, shape, column);
      if (row === null) continue;
      const score = judge(board, shape, row, column);
      if (score !== null && (best === null || score > best.score)) {
        best = { rotation, column, score };
      }
    }
  }

  if (best) {
    for (let turn = 0; turn < best.rotation; turn += 1) {
      const before = well.dataset.rotation;
      click(document, "rotateButton");
      if (well.dataset.rotation === before) break;
    }
    while (Number(well.dataset.column) !== best.column) {
      const before = well.dataset.column;
      click(document, Number(well.dataset.column) < best.column ? "rightButton" : "leftButton");
      if (well.dataset.column === before) break;
    }
  }

  click(document, "dropButton");
  return true;
}

/** Joga até fazer as linhas todas, até perder, ou até desistir. */
function play(document, { stopAt = GOAL, maxPieces = 300 } = {}) {
  for (let piece = 0; piece < maxPieces; piece += 1) {
    if (lines(document) >= stopAt) break;
    if (document.querySelector("#gameOver").classList.contains("visible")) break;
    if (!playPiece(document)) break;
  }
  return lines(document);
}

afterEach(() => {
  dom?.window.close();
  dom = null;
});

describe(`Puzzle da ${PERSON} — página`, () => {
  it("anuncia a pessoa no título e no cabeçalho", () => {
    const document = openPage();
    expect(document.title).toContain(PERSON);
    expect(document.querySelector("h1").textContent).toContain(PERSON);
  });

  it("aponta as ligações públicas para a pasta do próprio puzzle", () => {
    const document = openPage();

    expect(document.querySelector('link[rel="canonical"]').href).toBe(PAGE_URL);
    expect(document.querySelector('meta[property="og:url"]').content).toBe(PAGE_URL);
    expect(document.querySelector('meta[property="og:image"]').content).toBe(`${PAGE_URL}assets/og-image.jpg`);
    expect(document.querySelector('meta[name="twitter:image"]').content).toBe(`${PAGE_URL}assets/og-image.jpg`);
  });

  it("é autónoma: só usa ficheiros da sua própria pasta", () => {
    expect(html).not.toContain("../");
    const document = openPage();
    document.querySelectorAll("script[src], link[href], img[src]").forEach((element) => {
      const reference = element.getAttribute("src") ?? element.getAttribute("href");
      const isLocal = reference.startsWith("./");
      const isAbsoluteUrl = /^https?:\/\//.test(reference);
      expect(isLocal || isAbsoluteUrl).toBe(true);
    });
  });

  it("tem todos os ficheiros que a página pede à sua pasta", () => {
    const references = [...html.matchAll(/\.\/(assets\/[\w.-]+)/g)].map((match) => match[1]);
    expect(references.length).toBeGreaterThan(0);
    new Set(references).forEach((reference) => {
      expect(existsSync(resolve(puzzleDir, reference)), `falta ${reference}`).toBe(true);
    });
  });
});

describe(`Puzzle da ${PERSON} — o poço`, () => {
  it("desenha o poço todo, cada casa com o seu pedaço da fotografia", () => {
    const document = openPage();
    const cells = cellsOf(document);

    expect(cells).toHaveLength(ROWS * COLS);
    const crops = cells.map((cell) => cell.style.backgroundPosition);
    expect(new Set(crops).size).toBe(ROWS * COLS);
    expect(crops[0]).toBe("0% 0%");
    expect(crops.at(-1)).toBe("100% 100%");
  });

  it("começa com uma peça a cair e outra à espera", () => {
    const document = openPage();

    expect(activeCells(document)).toHaveLength(4);
    expect(document.querySelector("#well").dataset.piece).toMatch(/^[IJLOSTZ]$/);
    expect(document.querySelectorAll('.next-cell[data-filled="1"]')).toHaveLength(4);
    expect(lines(document)).toBe(0);
    expect(document.querySelector("#lineGoal").textContent).toBe(`/${GOAL}`);
  });

  it("não adianta onde a peça vai cair: só se vê a peça e o que já assentou", () => {
    const document = openPage();

    // Sem sombra nenhuma no poço — só peça a cair e casas vazias.
    expect(new Set(stateOf(document))).toEqual(new Set(["empty", "active"]));
  });

  it("move a peça para os lados e pára nas paredes", () => {
    const document = openPage();
    const well = document.querySelector("#well");
    const start = Number(well.dataset.column);

    click(document, "leftButton");
    expect(Number(well.dataset.column)).toBe(start - 1);

    click(document, "rightButton");
    expect(Number(well.dataset.column)).toBe(start);

    for (let step = 0; step < COLS + 4; step += 1) click(document, "leftButton");
    const leftmost = Math.min(...activeCells(document).map(([, column]) => column));
    expect(leftmost).toBe(0);

    for (let step = 0; step < COLS * 2; step += 1) click(document, "rightButton");
    const rightmost = Math.max(...activeCells(document).map(([, column]) => column));
    expect(rightmost).toBe(COLS - 1);
  });

  it("roda a peça um quarto de volta a cada toque", () => {
    const document = openPage();
    const well = document.querySelector("#well");

    for (let turn = 1; turn <= 4; turn += 1) {
      click(document, "rotateButton");
      expect(well.dataset.rotation).toBe(String(turn % 4));
    }
    // Quatro quartos de volta são uma volta inteira: a peça volta ao início.
    expect(activeCells(document)).toHaveLength(4);
  });

  it("desce uma casa de cada vez", () => {
    const document = openPage();
    const before = Math.min(...activeCells(document).map(([row]) => row));

    click(document, "downButton");

    expect(Math.min(...activeCells(document).map(([row]) => row))).toBe(before + 1);
  });

  it("larga a peça até ao fundo e assenta-a lá", () => {
    const document = openPage();

    click(document, "dropButton");

    const board = readBoard(document);
    const settled = board.flat().filter(Boolean);
    expect(settled).toHaveLength(4);
    // Assentou mesmo no fundo: a última linha do poço tem casas ocupadas.
    expect(board[ROWS - 1].some(Boolean)).toBe(true);
    // E já vem outra peça a caminho.
    expect(activeCells(document)).toHaveLength(4);
  });

  it("destapa a fotografia só nas casas onde a peça assentou", () => {
    const document = openPage();

    click(document, "dropButton");

    const locked = cellsOf(document).filter((cell) => cell.dataset.state === "locked");
    expect(locked).toHaveLength(4);
    locked.forEach((cell) => {
      expect(cell.dataset.piece).toMatch(/^[IJLOSTZ]$/);
      // Cada casa leva a fotografia inteira e mostra só o pedaço que lhe toca.
      expect(cell.style.backgroundSize).toBe(`${COLS * 100}% ${ROWS * 100}%`);
    });
    expect(html).toMatch(/\.cell\s*\{[^}]*photo\.jpg/);
  });

  it("pára e retoma o jogo no mesmo botão", () => {
    const document = openPage();
    const startButton = document.querySelector("#startButton");
    const well = document.querySelector("#well");

    click(document, "downButton");
    expect(startButton.textContent).toBe("Pausar");

    click(document, "startButton");
    expect(document.querySelector("#pauseVeil").classList.contains("visible")).toBe(true);
    expect(startButton.textContent).toBe("Continuar");

    // Em pausa, a peça não se mexe.
    const column = Number(well.dataset.column);
    click(document, "leftButton");
    expect(Number(well.dataset.column)).toBe(column);

    click(document, "startButton");
    expect(document.querySelector("#pauseVeil").classList.contains("visible")).toBe(false);
    click(document, "leftButton");
    expect(Number(well.dataset.column)).toBe(column - 1);
  });

  it("conta as linhas à medida que se fazem", () => {
    const document = openPage();

    play(document, { stopAt: 1, maxPieces: 40 });

    expect(lines(document)).toBeGreaterThanOrEqual(1);
    expect(document.querySelectorAll(".progress-dot.on").length).toBe(lines(document));
    // Uma linha cheia desfaz-se sempre: nunca fica nenhuma para trás no poço.
    expect(readBoard(document).some((line) => line.every(Boolean))).toBe(false);
  });
});

describe(`Puzzle da ${PERSON} — fotografia e final`, () => {
  it("mostra e esconde a pré-visualização da fotografia", () => {
    const document = openPage();
    const preview = document.querySelector("#preview");
    const button = document.querySelector("#previewButton");

    button.click();
    expect(preview.classList.contains("visible")).toBe(true);
    expect(button.getAttribute("aria-pressed")).toBe("true");

    button.click();
    expect(preview.classList.contains("visible")).toBe(false);
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("festeja com o nome da pessoa quando as dez linhas ficam feitas", async () => {
    const document = openPage();

    const made = play(document);

    expect(made).toBeGreaterThanOrEqual(GOAL);
    // O poço inteiro passa a fotografia: nem cor de peças, nem casas vazias.
    expect(document.querySelector("#well").classList.contains("solved")).toBe(true);
    expect(new Set(stateOf(document))).toEqual(new Set(["locked"]));

    const text = document.querySelector("#celebrationText").textContent;
    expect(text).toContain(PERSON);
    expect(text).toContain(`${GOAL} linhas`);

    await new Promise((done) => dom.window.setTimeout(done, PARTY_DELAY));
    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(true);
    expect(document.querySelector("#celebration").getAttribute("aria-hidden")).toBe("false");
  });

  it("deixa ver a fotografia inteira antes de abrir a festa", async () => {
    const document = openPage();
    play(document);

    // Feita a última linha, o poço já é a fotografia — e a festa ainda não entrou.
    expect(document.querySelector("#well").classList.contains("solved")).toBe(true);
    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);

    await new Promise((done) => dom.window.setTimeout(done, PARTY_DELAY));

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(true);
    // O cartão da festa leva a fotografia consigo, para não a tapar por completo.
    expect(document.querySelector(".celebration-photo")).not.toBeNull();
    expect(html).toMatch(/\.celebration-photo\s*\{[^}]*photo\.jpg/);
  });

  it("ignora as teclas depois de a fotografia estar inteira", async () => {
    const document = openPage();
    play(document);
    await new Promise((done) => dom.window.setTimeout(done, PARTY_DELAY));

    click(document, "dropButton");
    click(document, "leftButton");

    expect(new Set(stateOf(document))).toEqual(new Set(["locked"]));
    expect(lines(document)).toBeGreaterThanOrEqual(GOAL);
  });

  it("fecha a festa com a tecla Escape", async () => {
    const document = openPage();
    play(document);
    await new Promise((done) => dom.window.setTimeout(done, PARTY_DELAY));

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
  });

  it("recomeça o jogo a partir da festa", async () => {
    const document = openPage();
    play(document);
    await new Promise((done) => dom.window.setTimeout(done, PARTY_DELAY));

    click(document, "playAgainButton");

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
    expect(lines(document)).toBe(0);
    expect(document.querySelector("#timer").textContent).toBe("0:00");
    expect(readBoard(document).flat().some(Boolean)).toBe(false);
    expect(activeCells(document)).toHaveLength(4);
  });

  it("convida a recomeçar quando o poço se enche", async () => {
    const document = openPage();

    // Sempre à esquerda: as peças empilham-se num canto e nunca fazem linha.
    for (let piece = 0; piece < 60; piece += 1) {
      for (let step = 0; step < COLS; step += 1) click(document, "leftButton");
      click(document, "dropButton");
    }
    await new Promise((done) => dom.window.setTimeout(done, 600));

    expect(lines(document)).toBe(0);
    expect(document.querySelector("#gameOver").classList.contains("visible")).toBe(true);
    expect(document.querySelector("#gameOverText").textContent).toContain(PERSON);

    click(document, "tryAgainButton");
    expect(document.querySelector("#gameOver").classList.contains("visible")).toBe(false);
    expect(readBoard(document).flat().some(Boolean)).toBe(false);
  });
});
