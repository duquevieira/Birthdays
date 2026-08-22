// Todos os testes do puzzle do Diogo e do Bernardo. O ficheiro é autónomo: não
// importa nada de outros puzzles, para que cada pasta possa ser copiada tal como está.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const PEOPLE = ["Diogo", "Bernardo"];
const SLUG = "diogo-bernardo";
const COLS = 12;
const ROWS = 18;
const DOTS = 104;
const LIVES = 3;
// A página dá tempo a ver o tabuleiro já todo fotografia antes de abrir a festa.
const PARTY_DELAY = 2500;

const PAGE_URL = `https://duquevieira.github.io/Birthdays/puzzles/${SLUG}/`;

const puzzleDir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(puzzleDir, "index.html"), "utf8");

const DIRS = { up: [-1, 0], left: [0, -1], down: [1, 0], right: [0, 1] };
const wrapCol = (column) => ((column % COLS) + COLS) % COLS;

let dom = null;

/**
 * A página é aberta com o relógio do jogo acelerado: cada casa andada passa a
 * levar poucos milissegundos, e assim uma partida inteira cabe num teste. O
 * jogo em si não muda — não há sorteio nenhum lá dentro, os vilões pensam
 * sempre da mesma maneira.
 */
function openPage({ tick = 0 } = {}) {
  dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: PAGE_URL,
    beforeParse(window) {
      if (!tick) return;
      const original = window.setInterval.bind(window);
      window.setInterval = (callback, delay, ...rest) =>
        original(callback, Math.min(delay ?? 0, tick), ...rest);
    },
  });
  return dom.window.document;
}

const maze = (document) => document.querySelector("#maze");
const at = (document, key) => maze(document).dataset[key];
// As casas nunca mudam de sítio: procuram-se uma vez e ficam guardadas.
const boards = new WeakMap();
const cellsOf = (document) => {
  if (!boards.has(document)) boards.set(document, [...document.querySelectorAll(".cell")]);
  return boards.get(document);
};
const cellAt = (document, row, column) => cellsOf(document)[row * COLS + column];
const pacAt = (document) => at(document, "pac").split(",").map(Number);
const dotsLeft = (document) => Number(at(document, "dots"));
const click = (document, id) => document.querySelector(`#${id}`).click();
const press = (document, direction) =>
  document.querySelector(`.pad-button[data-dir="${direction}"]`).click();
const ghostsOf = (document) =>
  [0, 1, 2, 3].map((index) => {
    const element = document.querySelector(`#ghost${index}`);
    const [row, column] = element.dataset.cell.split(",").map(Number);
    return { index, row, column, mode: element.dataset.mode, element };
  });

const walkable = (document, row, column) =>
  row >= 0 && row < ROWS && cellAt(document, row, column).dataset.kind === "path";

const rest = () => new Promise((done) => dom.window.setTimeout(done, 0));

/** Espera que alguma coisa aconteça no tabuleiro, sem prender o teste. */
async function waitFor(check, { limit = 20000 } = {}) {
  const until = Date.now() + limit;
  while (!check()) {
    if (Date.now() > until) return false;
    await rest();
  }
  return true;
}

/** As distâncias e o primeiro passo do herói até cada casa do labirinto. */
function search(document, from) {
  const key = (row, column) => `${row},${column}`;
  const distance = new Map([[key(from.row, from.column), 0]]);
  const firstStep = new Map();
  const queue = [from];
  while (queue.length) {
    const current = queue.shift();
    const here = key(current.row, current.column);
    for (const [name, [dr, dc]] of Object.entries(DIRS)) {
      const row = current.row + dr;
      const column = wrapCol(current.column + dc);
      if (!walkable(document, row, column)) continue;
      const there = key(row, column);
      if (distance.has(there)) continue;
      distance.set(there, distance.get(here) + 1);
      firstStep.set(there, firstStep.get(here) ?? name);
      queue.push({ row, column });
    }
  }
  return { distance, firstStep };
}

/**
 * O piloto automático: de cada vez que o herói muda de casa, procura a pastilha
 * mais perto que não esteja em cima de um vilão e carrega na seta desse lado.
 */
function decide(document) {
  const [row, column] = pacAt(document);
  const { distance, firstStep } = search(document, { row, column });
  const safe = Number(at(document, "fright")) > 6;
  const hunters = ghostsOf(document).filter((ghost) => ghost.mode === "hunt");
  const near = hunters.length
    ? Math.min(...hunters.map((ghost) => Math.abs(ghost.row - row) + Math.abs(ghost.column - column)))
    : 99;

  // As casas ao pé de um vilão ficam de fora, a não ser que haja poder no ar.
  const danger = new Set();
  if (!safe) {
    for (const ghost of hunters) {
      const seen = new Set([`${ghost.row},${ghost.column}`]);
      const front = [{ row: ghost.row, column: ghost.column, depth: 0 }];
      while (front.length) {
        const spot = front.shift();
        danger.add(`${spot.row},${spot.column}`);
        if (spot.depth >= 2) continue;
        for (const [dr, dc] of Object.values(DIRS)) {
          const r = spot.row + dr;
          const c = wrapCol(spot.column + dc);
          if (!walkable(document, r, c) || seen.has(`${r},${c}`)) continue;
          seen.add(`${r},${c}`);
          front.push({ row: r, column: c, depth: spot.depth + 1 });
        }
      }
    }
  }

  const choose = (avoid) => {
    let best = null;
    cellsOf(document).forEach((cell, index) => {
      const food = cell.dataset.dot;
      if (!food) return;
      const target = `${Math.floor(index / COLS)},${index % COLS}`;
      if (avoid && danger.has(target)) return;
      const steps = distance.get(target);
      if (steps === undefined) return;
      // Com vilões por perto, vale a pena um desvio para apanhar um poder.
      const value = steps - (food === "power" && near < 7 ? 9 : 0);
      if (best === null || value < best.value) best = { value, direction: firstStep.get(target) };
    });
    return best;
  };

  const best = choose(true) ?? choose(false);
  if (best?.direction) return best.direction;

  // Encurralado: foge para o lado mais longe do vilão mais próximo.
  let escape = null;
  for (const [name, [dr, dc]] of Object.entries(DIRS)) {
    const r = row + dr;
    const c = wrapCol(column + dc);
    if (!walkable(document, r, c)) continue;
    const gap = hunters.length
      ? Math.min(...hunters.map((ghost) => Math.abs(ghost.row - r) + Math.abs(ghost.column - c)))
      : 9;
    if (escape === null || gap > escape.gap) escape = { gap, name };
  }
  return escape?.name ?? null;
}

/** Joga sozinho até limpar o labirinto (ou até chegar ao que lhe pedirem). */
async function play(document, { until = () => at(document, "state") === "solved", limit = 60000 } = {}) {
  if (at(document, "state") !== "playing") click(document, "startButton");
  const deadline = Date.now() + 30000;
  let previous = "";
  for (let turn = 0; turn < limit; turn += 1) {
    if (until()) break;
    if (Date.now() > deadline) break;
    // Perder não apaga o que já se comeu: continua-se de onde se estava.
    if (at(document, "state") === "over") click(document, "startButton");
    const here = at(document, "pac");
    if (here !== previous) {
      previous = here;
      const direction = decide(document);
      if (direction) press(document, direction);
    }
    await rest();
  }
  return until();
}

/** Leva o herói a uma casa à escolha, passo a passo. */
async function walkTo(document, target, { limit = 4000 } = {}) {
  let previous = "";
  for (let turn = 0; turn < limit; turn += 1) {
    const [row, column] = pacAt(document);
    if (row === target.row && column === target.column) return true;
    const here = `${row},${column}`;
    if (here !== previous) {
      previous = here;
      const { firstStep } = search(document, { row, column });
      const direction = firstStep.get(`${target.row},${target.column}`);
      if (direction) press(document, direction);
    }
    await rest();
  }
  return false;
}

afterEach(() => {
  dom?.window.close();
  dom = null;
});

describe("Puzzle do Diogo e do Bernardo — página", () => {
  it("anuncia as duas pessoas no título e no cabeçalho", () => {
    const document = openPage();
    PEOPLE.forEach((person) => {
      expect(document.title).toContain(person);
      expect(document.querySelector("h1").textContent).toContain(person);
    });
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

describe("Puzzle do Diogo e do Bernardo — o labirinto", () => {
  it("tapa a fotografia com o tabuleiro todo, cada casa com o seu pedaço", () => {
    const document = openPage();
    const cells = cellsOf(document);

    expect(cells).toHaveLength(ROWS * COLS);
    const crops = cells.map((cell) => cell.style.backgroundPosition);
    expect(new Set(crops).size).toBe(ROWS * COLS);
    expect(crops[0]).toBe("0% 0%");
    expect(crops.at(-1)).toBe("100% 100%");
    cells.forEach((cell) => expect(cell.style.backgroundImage).toContain("photo.jpg"));
    // Nenhuma casa começa destapada: a fotografia está toda por baixo da tinta.
    expect(cells.filter((cell) => cell.dataset.shown === "1")).toHaveLength(0);
  });

  it("põe uma pastilha em cada casa de chão e quatro poderes nos cantos", () => {
    const document = openPage();
    const cells = cellsOf(document);

    const dots = cells.filter((cell) => cell.dataset.dot === "dot");
    const powers = cells.filter((cell) => cell.dataset.dot === "power");
    expect(dots.length + powers.length).toBe(DOTS);
    expect(powers).toHaveLength(4);
    expect(dotsLeft(document)).toBe(DOTS);
    [[1, 1], [1, 10], [14, 1], [14, 10]].forEach(([row, column]) => {
      expect(cellAt(document, row, column).dataset.dot).toBe("power");
    });
  });

  it("chega a todas as pastilhas a partir do sítio onde o herói começa", () => {
    const document = openPage();
    const [row, column] = pacAt(document);
    const { distance } = search(document, { row, column });

    cellsOf(document).forEach((cell, index) => {
      if (!cell.dataset.dot) return;
      expect(distance.has(`${Math.floor(index / COLS)},${index % COLS}`), `pastilha presa em ${index}`).toBe(true);
    });
    expect([...distance.keys()]).toHaveLength(DOTS);
  });

  it("fecha o covil com uma porta que só os vilões atravessam", () => {
    const document = openPage();

    expect(cellAt(document, 6, 5).dataset.kind).toBe("door");
    expect(cellAt(document, 6, 6).dataset.kind).toBe("door");
    // As quatro casas do covil são chão, mas não têm pastilha nenhuma...
    const lair = [[7, 5], [7, 6], [8, 5], [8, 6]];
    lair.forEach(([row, column]) => {
      expect(cellAt(document, row, column).dataset.kind).toBe("path");
      expect(cellAt(document, row, column).dataset.dot).toBe("");
    });
    // ...e o herói nunca lá chega, porque a porta não é chão.
    const [row, column] = pacAt(document);
    const { distance } = search(document, { row, column });
    lair.forEach(([r, c]) => expect(distance.has(`${r},${c}`)).toBe(false));
  });

  it("começa parado, com os quatro vilões no covil e três heróis de reserva", () => {
    const document = openPage();

    expect(at(document, "state")).toBe("ready");
    expect(at(document, "pac")).toBe("12,5");
    expect(at(document, "lives")).toBe(String(LIVES));
    expect(at(document, "score")).toBe("0");
    expect(document.querySelectorAll(".life")).toHaveLength(LIVES);
    ghostsOf(document).forEach((ghost) => expect(ghost.mode).toBe("home"));
    expect(document.querySelectorAll(".villain")).toHaveLength(4);
    expect(document.querySelector("#startButton").textContent).toBe("Começar");
    expect(document.querySelector("#boardNote").classList.contains("visible")).toBe(true);
  });
});

describe("Puzzle do Diogo e do Bernardo — jogar", () => {
  it("anda para o lado que se pedir e come a pastilha da casa onde chega", async () => {
    const document = openPage({ tick: 8 });

    click(document, "startButton");
    press(document, "left");
    await waitFor(() => at(document, "pac") === "12,4");

    expect(at(document, "dir")).toBe("left");
    expect(dotsLeft(document)).toBeLessThan(DOTS);
    // A casa por onde passou ficou sem pastilha e com a fotografia à mostra.
    expect(cellAt(document, 12, 4).dataset.dot).toBe("");
    expect(cellAt(document, 12, 4).dataset.shown).toBe("1");
    expect(Number(at(document, "score"))).toBeGreaterThan(0);
  });

  it("não atravessa paredes: pára encostado a elas", async () => {
    const document = openPage({ tick: 8 });

    click(document, "startButton");
    press(document, "up");
    // Por cima do sítio onde começa há parede: fica onde está e anda para o lado.
    await waitFor(() => at(document, "pac") !== "12,5");

    const [row] = pacAt(document);
    expect(row).toBe(12);
  });

  it("dá a volta ao tabuleiro pelo túnel da linha do meio", async () => {
    const document = openPage({ tick: 8 });

    click(document, "startButton");
    expect(await walkTo(document, { row: 9, column: 0 })).toBe(true);

    press(document, "left");
    expect(await waitFor(() => at(document, "pac") === "9,11")).toBe(true);
    // Ao saltar de uma ponta à outra, o herói não atravessa o ecrã a deslizar.
    expect(document.querySelector("#hero").dataset.jump).toBe("1");
  });

  it("solta os vilões do covil, um de cada vez", async () => {
    const document = openPage({ tick: 8 });

    click(document, "startButton");
    expect(await waitFor(() => ghostsOf(document)[0].mode !== "home")).toBe(true);
    // O primeiro já anda pelo labirinto enquanto o último ainda espera a vez.
    expect(ghostsOf(document)[3].mode).toBe("home");

    // Daí em diante é preciso ir fugindo, senão o jogo acaba antes da vez dele.
    const allOut = () => ghostsOf(document).every((ghost) => ghost.mode !== "home");
    expect(await play(document, { until: allOut })).toBe(true);
  }, 20000);

  it("a pastilha grande troca de herói e põe os vilões em fuga", async () => {
    const document = openPage({ tick: 8 });

    expect(at(document, "hero")).toBe("0");
    expect(document.querySelector("#heroTag").textContent).toBe("Protest Man");

    click(document, "startButton");
    await waitFor(() => ghostsOf(document).some((ghost) => ghost.mode === "hunt"));
    expect(await walkTo(document, { row: 14, column: 1 })).toBe(true);

    expect(at(document, "hero")).toBe("1");
    expect(document.querySelector("#heroTag").textContent).toBe("Capitão Subsídio");
    expect(Number(at(document, "fright"))).toBeGreaterThan(0);
    expect(ghostsOf(document).some((ghost) => ghost.mode === "fright")).toBe(true);
    expect(document.querySelector("#burst").classList.contains("visible")).toBe(true);
  });

  it("pára e recomeça no mesmo sítio", async () => {
    const document = openPage({ tick: 8 });

    click(document, "startButton");
    await waitFor(() => at(document, "pac") !== "12,5");

    click(document, "startButton");
    expect(at(document, "state")).toBe("paused");
    expect(document.querySelector("#startButton").textContent).toBe("Continuar");

    const parked = at(document, "pac");
    await new Promise((done) => dom.window.setTimeout(done, 60));
    expect(at(document, "pac")).toBe(parked);

    click(document, "startButton");
    expect(at(document, "state")).toBe("playing");
  });
});

describe("Puzzle do Diogo e do Bernardo — fotografia e final", () => {
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

  it("destapa a fotografia inteira e festeja com os dois nomes", async () => {
    const document = openPage({ tick: 6 });

    expect(await play(document)).toBe(true);

    expect(at(document, "state")).toBe("solved");
    expect(dotsLeft(document)).toBe(0);
    expect(at(document, "eaten")).toBe(String(DOTS));
    expect(maze(document).classList.contains("solved")).toBe(true);
    // Todas as casas de chão ficaram destapadas pelo caminho.
    cellsOf(document)
      .filter((cell) => cell.dataset.kind === "path" && cell.dataset.dot === "")
      .forEach((cell) => expect(["1", ""]).toContain(cell.dataset.shown));
    expect(cellsOf(document).filter((cell) => cell.dataset.shown === "1")).toHaveLength(DOTS);

    const text = document.querySelector("#celebrationText").textContent;
    PEOPLE.forEach((person) => expect(text).toContain(person));
    expect(text).toContain(`${DOTS} pastilhas`);
    expect(text).toContain(`${at(document, "score")} pontos`);

    // A fotografia fica um bocado à vista antes de a festa entrar.
    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
    await new Promise((done) => dom.window.setTimeout(done, PARTY_DELAY));

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(true);
    expect(document.querySelector("#celebration").getAttribute("aria-hidden")).toBe("false");
    // O cartão da festa leva a fotografia consigo, para não a tapar por completo.
    expect(document.querySelector(".celebration-photo")).not.toBeNull();
    expect(html).toMatch(/\.celebration-photo\s*\{[^}]*photo\.jpg/);
  }, 60000);

  it("fecha a festa com a tecla Escape e recomeça com o labirinto cheio", async () => {
    const document = openPage({ tick: 6 });
    await play(document);
    await new Promise((done) => dom.window.setTimeout(done, PARTY_DELAY));

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);

    click(document, "playAgainButton");

    expect(at(document, "state")).toBe("ready");
    expect(dotsLeft(document)).toBe(DOTS);
    expect(at(document, "score")).toBe("0");
    expect(at(document, "lives")).toBe(String(LIVES));
    expect(at(document, "hero")).toBe("0");
    expect(at(document, "pac")).toBe("12,5");
    expect(maze(document).classList.contains("solved")).toBe(false);
    expect(cellsOf(document).filter((cell) => cell.dataset.shown === "1")).toHaveLength(0);
    ghostsOf(document).forEach((ghost) => expect(ghost.mode).toBe("home"));
  }, 60000);
});
