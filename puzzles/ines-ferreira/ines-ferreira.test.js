// Todos os testes do puzzle da Inês. O ficheiro é autónomo: não importa nada
// de outros puzzles, para que cada pasta possa ser copiada tal como está.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const PERSON = "Inês";
const SLUG = "ines-ferreira";
const SIZE = 3;
const EMPTY = SIZE * SIZE - 1;

const PAGE_URL = `https://duquevieira.github.io/Birthdays/puzzles/${SLUG}/`;

const puzzleDir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(puzzleDir, "index.html"), "utf8");

let dom = null;

/** Gerador determinista, para que a mistura das peças seja sempre a mesma. */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function openPage({ seed = 20260805 } = {}) {
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

/** O tabuleiro tal como está desenhado: board[posição] = número da peça. */
function readBoard(document) {
  const board = new Array(SIZE * SIZE);
  document.querySelectorAll(".tile").forEach((tile, tileNumber) => {
    board[Number(tile.dataset.position)] = tileNumber;
  });
  return board;
}

function clickPosition(document, position) {
  const board = readBoard(document);
  document.querySelectorAll(".tile")[board[position]].click();
}

const distance = (a, b) =>
  Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) + Math.abs((a % SIZE) - (b % SIZE));

const areAdjacent = (a, b) => distance(a, b) === 1;

const isSolved = (board) => board.every((tile, position) => tile === position);

/** Procura em largura o caminho mais curto até ao tabuleiro resolvido. */
function solutionFor(board) {
  const goal = board.map((_, position) => position).join("");
  const start = board.join("");
  if (start === goal) return [];

  const cameFrom = new Map([[start, null]]);
  const queue = [start];

  for (let head = 0; head < queue.length; head += 1) {
    const state = queue[head];
    const emptyPosition = state.indexOf(String(EMPTY));

    for (let position = 0; position < SIZE * SIZE; position += 1) {
      if (!areAdjacent(position, emptyPosition)) continue;
      const next = state.split("");
      [next[position], next[emptyPosition]] = [next[emptyPosition], next[position]];
      const key = next.join("");
      if (cameFrom.has(key)) continue;
      cameFrom.set(key, { state, position });
      if (key === goal) {
        const moves = [];
        for (let node = cameFrom.get(key); node; node = cameFrom.get(node.state)) {
          moves.push(node.position);
        }
        return moves.reverse();
      }
      queue.push(key);
    }
  }

  throw new Error("Tabuleiro impossível de resolver.");
}

function solve(document) {
  const moves = solutionFor(readBoard(document));
  moves.forEach((position) => clickPosition(document, position));
  return moves.length;
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

describe(`Puzzle da ${PERSON} — tabuleiro`, () => {
  it("desenha nove peças, uma delas o espaço vazio", () => {
    const document = openPage();
    const tiles = document.querySelectorAll(".tile");

    expect(tiles).toHaveLength(SIZE * SIZE);
    expect(readBoard(document).slice().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(document.querySelectorAll(".tile.is-hidden")).toHaveLength(1);
    expect(tiles[EMPTY].classList.contains("is-hidden")).toBe(true);
  });

  it.each([1, 7, 42, 2026, 20260805])(
    "mistura as peças numa posição resolúvel mas por resolver (semente %i)",
    (seed) => {
      const document = openPage({ seed });
      const board = readBoard(document);

      expect(isSolved(board)).toBe(false);
      expect(() => solutionFor(board)).not.toThrow();
    },
  );

  it("move a peça encostada ao espaço vazio e conta a jogada", () => {
    const document = openPage();
    const board = readBoard(document);
    const emptyPosition = board.indexOf(EMPTY);
    const target = board.findIndex((_, position) => areAdjacent(position, emptyPosition));
    const movingTile = board[target];

    clickPosition(document, target);

    expect(readBoard(document)[emptyPosition]).toBe(movingTile);
    expect(document.querySelector("#moveCount").textContent).toBe("1");
  });

  it("ignora a peça que está na diagonal do espaço vazio", () => {
    const document = openPage();
    const board = readBoard(document);
    const emptyPosition = board.indexOf(EMPTY);
    // A diagonal é o caso limite: parece perto, mas não é uma jogada legal.
    const target = board.findIndex((_, position) => distance(position, emptyPosition) === 2);
    expect(target).toBeGreaterThan(-1);

    clickPosition(document, target);

    expect(readBoard(document)).toEqual(board);
    expect(document.querySelector("#moveCount").textContent).toBe("0");
  });

  it("desloca o espaço vazio com as setas do teclado", () => {
    const document = openPage();
    const { KeyboardEvent } = dom.window;
    const emptyPosition = readBoard(document).indexOf(EMPTY);
    const canMoveUp = emptyPosition + SIZE < SIZE * SIZE;
    const key = canMoveUp ? "ArrowUp" : "ArrowDown";
    const expected = emptyPosition + (canMoveUp ? SIZE : -SIZE);

    document.querySelector("#puzzle").dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

    expect(readBoard(document).indexOf(EMPTY)).toBe(expected);
  });

  it("volta ao início quando se mistura outra vez", () => {
    const document = openPage();
    const board = readBoard(document);
    const emptyPosition = board.indexOf(EMPTY);
    clickPosition(document, board.findIndex((_, position) => areAdjacent(position, emptyPosition)));
    expect(document.querySelector("#moveCount").textContent).toBe("1");

    document.querySelector("#shuffleButton").click();

    expect(document.querySelector("#moveCount").textContent).toBe("0");
    expect(document.querySelector("#timer").textContent).toBe("0:00");
    expect(isSolved(readBoard(document))).toBe(false);
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

  it("festeja com o nome da pessoa quando o puzzle fica resolvido", async () => {
    const document = openPage();
    const moves = solve(document);

    expect(isSolved(readBoard(document))).toBe(true);
    expect(document.querySelector("#moveCount").textContent).toBe(String(moves));
    expect(document.querySelector("#puzzle").classList.contains("solved")).toBe(true);
    expect(document.querySelectorAll(".tile.is-hidden")).toHaveLength(0);

    const text = document.querySelector("#celebrationText").textContent;
    expect(text).toContain(PERSON);
    expect(text).toContain(`${moves} jogadas`);

    await new Promise((done) => dom.window.setTimeout(done, 800));
    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(true);
    expect(document.querySelector("#celebration").getAttribute("aria-hidden")).toBe("false");
  });

  it("fecha a festa com a tecla Escape", async () => {
    const document = openPage();
    solve(document);
    await new Promise((done) => dom.window.setTimeout(done, 800));

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
  });

  it("recomeça o jogo a partir da festa", async () => {
    const document = openPage();
    solve(document);
    await new Promise((done) => dom.window.setTimeout(done, 800));

    document.querySelector("#playAgainButton").click();

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
    expect(document.querySelector("#moveCount").textContent).toBe("0");
    expect(isSolved(readBoard(document))).toBe(false);
  });
});
